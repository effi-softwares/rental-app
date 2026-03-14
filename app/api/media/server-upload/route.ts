import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { mediaAsset, mediaLink } from "@/lib/db/schema/media"
import {
	DEFAULT_MAX_UPLOAD_BYTES,
	MEDIA_CONTENT_TYPES,
} from "@/lib/media/constants"
import { buildMediaPathname } from "@/lib/media/pathname"
import {
	isBranchInOrganization,
	viewerCanAccessBranch,
} from "@/lib/media/server"
import { mergeMediaStorageBucketMetadata } from "@/lib/media/storage-bucket"
import { getStorageAdapter } from "@/lib/storage"
import { isAllowedMediaContentType, mediaServerUploadSchema } from "@/zod/media"

function parseNullableNumber(value: FormDataEntryValue | null) {
	if (typeof value !== "string") {
		return null
	}

	const parsed = Number(value)
	if (!Number.isFinite(parsed)) {
		return null
	}

	return parsed
}

function parseOptionalJson(value: FormDataEntryValue | null) {
	if (typeof value !== "string" || !value.trim()) {
		return {}
	}

	return JSON.parse(value) as Record<string, unknown>
}

export async function POST(request: Request) {
	const viewerResult = await requireViewer({ permission: "manageCustomers" })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const formData = await request.formData()
	const file = formData.get("file")

	if (!(file instanceof File)) {
		return jsonError("Missing file.", 400)
	}

	if (!isAllowedMediaContentType(file.type)) {
		return jsonError(
			`Unsupported file type (${MEDIA_CONTENT_TYPES.join(", ")}).`,
			400,
		)
	}

	if (file.size > DEFAULT_MAX_UPLOAD_BYTES) {
		return jsonError("File too large for server upload mode.", 400)
	}

	let metadata: Record<string, unknown>

	try {
		metadata = parseOptionalJson(formData.get("metadata"))
	} catch {
		return jsonError("Invalid metadata payload.", 400)
	}

	const parsed = mediaServerUploadSchema.safeParse({
		visibility: formData.get("visibility") ?? undefined,
		branchId: formData.get("branchId") ?? undefined,
		width: parseNullableNumber(formData.get("width")),
		height: parseNullableNumber(formData.get("height")),
		blurDataUrl: formData.get("blurDataUrl") ?? undefined,
		metadata,
		link: {
			entityType: formData.get("entityType"),
			entityId: formData.get("entityId"),
			field: formData.get("field") ?? undefined,
			sortOrder: parseNullableNumber(formData.get("sortOrder")) ?? undefined,
		},
	})

	if (!parsed.success) {
		return jsonError("Invalid upload fields.", 400)
	}

	const payload = parsed.data

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

	const pathname = buildMediaPathname({
		organizationId: viewer.activeOrganizationId,
		entityType: payload.link.entityType,
		entityId: payload.link.entityId,
		fileName: file.name,
	})

	const adapter = getStorageAdapter()
	const blob = await adapter.put({
		pathname,
		body: file,
		bucket: payload.storageBucket,
		visibility: payload.visibility,
		contentType: file.type,
		addRandomSuffix: true,
		multipart: file.size > 100 * 1024 * 1024,
	})

	const inserted = await db
		.insert(mediaAsset)
		.values({
			organizationId: viewer.activeOrganizationId,
			branchId: payload.branchId ?? null,
			createdByUserId: viewer.userId,
			provider: adapter.provider,
			visibility: payload.visibility,
			status: "uploaded",
			pathname: blob.pathname,
			url: blob.url,
			downloadUrl: blob.downloadUrl,
			originalFileName: file.name,
			contentType: blob.contentType,
			sizeBytes: file.size,
			etag: blob.etag,
			width: payload.width ?? null,
			height: payload.height ?? null,
			blurDataUrl: payload.blurDataUrl ?? null,
			metadata: mergeMediaStorageBucketMetadata({
				metadata: payload.metadata,
				storageBucket: payload.storageBucket,
			}),
			updatedAt: new Date(),
		})
		.returning({ id: mediaAsset.id })

	await db.insert(mediaLink).values({
		organizationId: viewer.activeOrganizationId,
		assetId: inserted[0].id,
		entityType: payload.link.entityType,
		entityId: payload.link.entityId,
		field: payload.link.field,
		sortOrder: payload.link.sortOrder,
	})

	return NextResponse.json(
		{
			id: inserted[0].id,
			url: blob.url,
			deliveryUrl:
				payload.visibility === "private"
					? `/api/media/private/${inserted[0].id}`
					: blob.url,
		},
		{ status: 201 },
	)
}
