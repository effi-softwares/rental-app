import { and, asc, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"

import { requireViewer } from "@/lib/api/guards"
import { viewerHasPermission } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { mediaAsset, mediaLink } from "@/lib/db/schema/media"

type GalleryAssetResponse = {
	id: string
	provider: string
	visibility: "public" | "private"
	status: string
	pathname: string
	url: string
	downloadUrl: string | null
	deliveryUrl: string
	originalFileName: string | null
	contentType: string | null
	sizeBytes: number | null
	width: number | null
	height: number | null
	blurDataUrl: string | null
	branchId: string | null
	metadata: Record<string, unknown>
	createdAt: string
	updatedAt: string
	link: {
		entityType: string
		entityId: string
		field: string
		sortOrder: number
	} | null
}

function toGalleryAssetResponse(
	row: typeof mediaAsset.$inferSelect & {
		entityType: string | null
		entityId: string | null
		field: string | null
		sortOrder: number | null
	},
): GalleryAssetResponse {
	const visibility = row.visibility === "public" ? "public" : "private"

	return {
		id: row.id,
		provider: row.provider,
		visibility,
		status: row.status,
		pathname: row.pathname,
		url: row.url,
		downloadUrl: row.downloadUrl,
		deliveryUrl:
			visibility === "private"
				? `/api/gallery/media/private/${row.id}`
				: row.url,
		originalFileName: row.originalFileName,
		contentType: row.contentType,
		sizeBytes: row.sizeBytes,
		width: row.width,
		height: row.height,
		blurDataUrl: row.blurDataUrl,
		branchId: row.branchId,
		metadata: (row.metadata ?? {}) as Record<string, unknown>,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		link:
			row.entityType && row.entityId && row.field && row.sortOrder !== null
				? {
						entityType: row.entityType,
						entityId: row.entityId,
						field: row.field,
						sortOrder: row.sortOrder,
					}
				: null,
	}
}

export async function GET() {
	const viewerResult = await requireViewer({ permission: "viewGalleryModule" })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const canManageGalleryMedia = await viewerHasPermission(
		viewer,
		"manageGalleryMedia",
	)

	const rows = await db
		.select({
			id: mediaAsset.id,
			organizationId: mediaAsset.organizationId,
			branchId: mediaAsset.branchId,
			createdByUserId: mediaAsset.createdByUserId,
			provider: mediaAsset.provider,
			visibility: mediaAsset.visibility,
			status: mediaAsset.status,
			pathname: mediaAsset.pathname,
			url: mediaAsset.url,
			downloadUrl: mediaAsset.downloadUrl,
			originalFileName: mediaAsset.originalFileName,
			contentType: mediaAsset.contentType,
			sizeBytes: mediaAsset.sizeBytes,
			etag: mediaAsset.etag,
			width: mediaAsset.width,
			height: mediaAsset.height,
			blurDataUrl: mediaAsset.blurDataUrl,
			metadata: mediaAsset.metadata,
			createdAt: mediaAsset.createdAt,
			updatedAt: mediaAsset.updatedAt,
			deletedAt: mediaAsset.deletedAt,
			entityType: mediaLink.entityType,
			entityId: mediaLink.entityId,
			field: mediaLink.field,
			sortOrder: mediaLink.sortOrder,
		})
		.from(mediaAsset)
		.innerJoin(mediaLink, eq(mediaLink.assetId, mediaAsset.id))
		.where(
			and(
				eq(mediaAsset.organizationId, viewer.activeOrganizationId),
				eq(mediaLink.organizationId, viewer.activeOrganizationId),
				eq(mediaLink.entityType, "organization"),
				eq(mediaLink.entityId, viewer.activeOrganizationId),
				eq(mediaLink.field, "gallery"),
				isNull(mediaAsset.deletedAt),
			),
		)
		.orderBy(asc(mediaLink.sortOrder), asc(mediaAsset.createdAt))

	return NextResponse.json({
		assets: rows.map(toGalleryAssetResponse),
		canManageGalleryMedia,
	})
}
