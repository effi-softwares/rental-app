import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { mediaAsset, mediaLink } from "@/lib/db/schema/media"
import { mergeMediaStorageBucketMetadata } from "@/lib/media/storage-bucket"
import { getStorageAdapter } from "@/lib/storage"
import { mediaClientPayloadSchema } from "@/zod/media"

const galleryFinalizeSchema = mediaClientPayloadSchema.extend({
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
	const viewerResult = await requireViewer({ permission: "manageGalleryMedia" })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const parsed = galleryFinalizeSchema.safeParse(await request.json())
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

	if (
		payload.link.entityType !== "organization" ||
		payload.link.entityId !== viewer.activeOrganizationId ||
		payload.link.field !== "gallery"
	) {
		return jsonError("Invalid gallery finalize target.", 400)
	}

	if (payload.branchId) {
		return jsonError("Gallery media cannot be branch scoped.", 400)
	}

	const adapter = getStorageAdapter()

	const inserted = await db
		.insert(mediaAsset)
		.values({
			organizationId: viewer.activeOrganizationId,
			branchId: null,
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
		throw new Error("Failed to resolve gallery media asset.")
	}

	await db
		.insert(mediaLink)
		.values({
			organizationId: viewer.activeOrganizationId,
			assetId: upserted.id,
			entityType: "organization",
			entityId: viewer.activeOrganizationId,
			field: "gallery",
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
				? `/api/gallery/media/private/${upserted.id}`
				: payload.blob.url,
	})
}
