import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { mediaAsset, mediaLink } from "@/lib/db/schema/media"
import {
	isBranchInOrganization,
	viewerCanAccessBranch,
} from "@/lib/media/server"
import { mergeMediaStorageBucketMetadata } from "@/lib/media/storage-bucket"
import { getStorageAdapter } from "@/lib/storage"
import { mediaClientPayloadSchema } from "@/zod/media"

const finalizeSchema = mediaClientPayloadSchema.extend({
	blob: z.object({
		pathname: z.string().trim().min(1),
		contentType: z.string().trim().min(1),
		contentDisposition: z.string().trim().min(1),
		url: z.string().trim().url(),
		downloadUrl: z.string().trim().url(),
		etag: z.string().trim().min(1),
	}),
})

export async function POST(request: Request) {
	const viewerResult = await requireViewer({ permission: "manageCustomers" })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const parsed = finalizeSchema.safeParse(await request.json())
	if (!parsed.success) {
		return jsonError("Invalid finalize payload.", 400)
	}

	const payload = parsed.data

	if (
		payload.organizationId &&
		payload.organizationId !== viewer.activeOrganizationId
	) {
		return jsonError("Organization mismatch in finalize payload.", 400)
	}

	if (payload.branchId) {
		const validBranch = await isBranchInOrganization(
			viewer.activeOrganizationId,
			payload.branchId,
		)

		if (!validBranch) {
			return jsonError("Invalid branch.", 400)
		}

		const canAccessBranch = await viewerCanAccessBranch(
			viewer,
			payload.branchId,
		)
		if (!canAccessBranch) {
			return jsonError("Forbidden branch.", 403)
		}
	}

	const adapter = getStorageAdapter()

	const inserted = await db
		.insert(mediaAsset)
		.values({
			organizationId: viewer.activeOrganizationId,
			branchId: payload.branchId ?? null,
			createdByUserId: viewer.userId,
			provider: adapter.provider,
			visibility: payload.visibility,
			status: "uploaded",
			pathname: payload.blob.pathname,
			url: payload.blob.url,
			downloadUrl: payload.blob.downloadUrl,
			originalFileName: payload.originalFileName,
			contentType: payload.blob.contentType,
			sizeBytes: payload.sizeBytes,
			etag: payload.blob.etag,
			width: payload.width ?? null,
			height: payload.height ?? null,
			blurDataUrl: payload.blurDataUrl ?? null,
			metadata: mergeMediaStorageBucketMetadata({
				metadata: payload.metadata,
				storageBucket: payload.storageBucket,
			}),
			updatedAt: new Date(),
		})
		.onConflictDoNothing({
			target: [mediaAsset.organizationId, mediaAsset.pathname],
		})
		.returning({ id: mediaAsset.id, visibility: mediaAsset.visibility })

	let upserted = inserted[0]

	if (!upserted) {
		const existing = await db
			.select({ id: mediaAsset.id, visibility: mediaAsset.visibility })
			.from(mediaAsset)
			.where(
				and(
					eq(mediaAsset.organizationId, viewer.activeOrganizationId),
					eq(mediaAsset.pathname, payload.blob.pathname),
				),
			)
			.limit(1)

		upserted = existing[0]
	}

	if (!upserted) {
		throw new Error("Failed to resolve media asset.")
	}

	await db
		.insert(mediaLink)
		.values({
			organizationId: viewer.activeOrganizationId,
			assetId: upserted.id,
			entityType: payload.link.entityType,
			entityId: payload.link.entityId,
			field: payload.link.field,
			sortOrder: payload.link.sortOrder,
		})
		.onConflictDoNothing({
			target: [
				mediaLink.organizationId,
				mediaLink.assetId,
				mediaLink.entityType,
				mediaLink.entityId,
				mediaLink.field,
			],
		})

	return NextResponse.json({
		assetId: upserted.id,
		deliveryUrl:
			upserted.visibility === "private"
				? `/api/media/private/${upserted.id}`
				: payload.blob.url,
	})
}
