import { and, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { mediaAsset, mediaLink } from "@/lib/db/schema/media"
import { getMediaStorageBucketFromMetadata } from "@/lib/media/storage-bucket"
import { getStorageAdapter } from "@/lib/storage"

type RouteProps = {
	params: Promise<{
		mediaId: string
	}>
}

export async function GET(request: Request, { params }: RouteProps) {
	const viewerResult = await requireViewer({ permission: "viewGalleryModule" })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const { mediaId } = await params

	const rows = await db
		.select({
			id: mediaAsset.id,
			pathname: mediaAsset.pathname,
			contentType: mediaAsset.contentType,
			metadata: mediaAsset.metadata,
		})
		.from(mediaAsset)
		.innerJoin(mediaLink, eq(mediaLink.assetId, mediaAsset.id))
		.where(
			and(
				eq(mediaAsset.id, mediaId),
				eq(mediaAsset.organizationId, viewer.activeOrganizationId),
				eq(mediaAsset.visibility, "private"),
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
		return new NextResponse("Not found", { status: 404 })
	}

	const adapter = getStorageAdapter()
	const bucket = getMediaStorageBucketFromMetadata({
		metadata: asset.metadata,
		visibility: "private",
	})
	const result = await adapter.get({
		urlOrPathname: asset.pathname,
		bucket,
		visibility: "private",
		ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
	})

	if (!result) {
		return new NextResponse("Not found", { status: 404 })
	}

	if (result.statusCode === 304) {
		return new NextResponse(null, {
			status: 304,
			headers: {
				ETag: result.blob.etag,
				"Cache-Control": "private, no-cache",
			},
		})
	}

	if (!result.stream) {
		return new NextResponse("Not found", { status: 404 })
	}

	return new NextResponse(result.stream, {
		headers: {
			"Content-Type":
				result.blob.contentType ??
				asset.contentType ??
				"application/octet-stream",
			ETag: result.blob.etag,
			"Cache-Control": "private, no-cache",
		},
	})
}
