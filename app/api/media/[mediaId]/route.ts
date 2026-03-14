import { and, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"

import { forbiddenError, jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { mediaAsset } from "@/lib/db/schema/media"
import { viewerCanAccessBranch } from "@/lib/media/server"
import { getMediaStorageBucketFromMetadata } from "@/lib/media/storage-bucket"
import type { StorageVisibility } from "@/lib/storage"
import { getStorageAdapter } from "@/lib/storage"

type RouteProps = {
	params: Promise<{
		mediaId: string
	}>
}

export async function GET(_: Request, { params }: RouteProps) {
	const viewerResult = await requireViewer({ permission: "viewCustomerModule" })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const { mediaId } = await params

	const rows = await db
		.select()
		.from(mediaAsset)
		.where(
			and(
				eq(mediaAsset.id, mediaId),
				eq(mediaAsset.organizationId, viewer.activeOrganizationId),
				isNull(mediaAsset.deletedAt),
			),
		)
		.limit(1)

	const asset = rows[0]
	if (!asset) {
		return jsonError("Media not found.", 404)
	}

	const canAccessBranch = await viewerCanAccessBranch(viewer, asset.branchId)
	if (!canAccessBranch) {
		return forbiddenError()
	}

	return NextResponse.json({
		asset: {
			id: asset.id,
			visibility: asset.visibility,
			url: asset.url,
			deliveryUrl:
				asset.visibility === "private"
					? `/api/media/private/${asset.id}`
					: asset.url,
			pathname: asset.pathname,
			contentType: asset.contentType,
			blurDataUrl: asset.blurDataUrl,
			width: asset.width,
			height: asset.height,
			createdAt: asset.createdAt.toISOString(),
		},
	})
}

export async function DELETE(_: Request, { params }: RouteProps) {
	const viewerResult = await requireViewer({ permission: "manageCustomers" })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const { mediaId } = await params

	const rows = await db
		.select()
		.from(mediaAsset)
		.where(
			and(
				eq(mediaAsset.id, mediaId),
				eq(mediaAsset.organizationId, viewer.activeOrganizationId),
				isNull(mediaAsset.deletedAt),
			),
		)
		.limit(1)

	const asset = rows[0]
	if (!asset) {
		return jsonError("Media not found.", 404)
	}

	const canAccessBranch = await viewerCanAccessBranch(viewer, asset.branchId)
	if (!canAccessBranch) {
		return forbiddenError()
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
