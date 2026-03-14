import { and, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { mediaAsset, mediaLink } from "@/lib/db/schema/media"
import { getMediaStorageBucketFromMetadata } from "@/lib/media/storage-bucket"
import { getStorageAdapter } from "@/lib/storage"
import type { StorageVisibility } from "@/lib/storage/types"

type RouteProps = {
	params: Promise<{
		mediaId: string
	}>
}

export async function DELETE(_: Request, { params }: RouteProps) {
	const viewerResult = await requireViewer({ permission: "manageGalleryMedia" })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const { mediaId } = await params

	const rows = await db
		.select({
			id: mediaAsset.id,
			pathname: mediaAsset.pathname,
			organizationId: mediaAsset.organizationId,
			visibility: mediaAsset.visibility,
			metadata: mediaAsset.metadata,
		})
		.from(mediaAsset)
		.innerJoin(mediaLink, eq(mediaLink.assetId, mediaAsset.id))
		.where(
			and(
				eq(mediaAsset.id, mediaId),
				eq(mediaAsset.organizationId, viewer.activeOrganizationId),
				eq(mediaLink.organizationId, viewer.activeOrganizationId),
				eq(mediaLink.entityType, "organization"),
				eq(mediaLink.entityId, viewer.activeOrganizationId),
				eq(mediaLink.field, "gallery"),
				isNull(mediaAsset.deletedAt),
			),
		)
		.limit(1)

	const asset = rows[0]
	if (!asset) {
		return jsonError("Gallery media not found.", 404)
	}

	const adapter = getStorageAdapter()
	const bucket = getMediaStorageBucketFromMetadata({
		metadata: asset.metadata,
		visibility: asset.visibility as StorageVisibility,
	})

	try {
		await adapter.delete(asset.pathname, { bucket })
	} catch {}

	await db
		.update(mediaAsset)
		.set({
			status: "deleted",
			deletedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(mediaAsset.id, mediaId),
				eq(mediaAsset.organizationId, viewer.activeOrganizationId),
			),
		)

	return NextResponse.json({ success: true })
}
