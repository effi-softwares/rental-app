import { and, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"

import { forbiddenError } from "@/lib/api/errors"
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

export async function GET(request: Request, { params }: RouteProps) {
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
				eq(mediaAsset.visibility, "private"),
				isNull(mediaAsset.deletedAt),
			),
		)
		.limit(1)

	const asset = rows[0]
	if (!asset) {
		return new NextResponse("Not found", { status: 404 })
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
			"Content-Type": result.blob.contentType ?? "application/octet-stream",
			ETag: result.blob.etag,
			"Cache-Control": "private, no-cache",
		},
	})
}
