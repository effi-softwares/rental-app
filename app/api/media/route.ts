import { and, asc, eq, inArray, isNull } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { getScopedBranchIdsForViewer } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { mediaAsset, mediaLink } from "@/lib/db/schema/media"
import { mediaListQuerySchema } from "@/zod/media"

type MediaAssetResponse = {
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

function toMediaResponse(
	row: typeof mediaAsset.$inferSelect & {
		entityType: string | null
		entityId: string | null
		field: string | null
		sortOrder: number | null
	},
): MediaAssetResponse {
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
			visibility === "private" ? `/api/media/private/${row.id}` : row.url,
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

export async function GET(request: NextRequest) {
	const viewerResult = await requireViewer({ permission: "viewCustomerModule" })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const parsedQuery = mediaListQuerySchema.safeParse({
		entityType: request.nextUrl.searchParams.get("entityType") ?? undefined,
		entityId: request.nextUrl.searchParams.get("entityId") ?? undefined,
		field: request.nextUrl.searchParams.get("field") ?? undefined,
	})

	if (!parsedQuery.success) {
		return jsonError("Invalid query parameters.", 400)
	}

	const { entityType, entityId, field } = parsedQuery.data
	const organizationId = viewer.activeOrganizationId
	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)

	if (scopedBranchIds !== null && scopedBranchIds.length === 0) {
		return NextResponse.json({ assets: [] })
	}

	const baseAssetFilter =
		scopedBranchIds === null
			? and(
					eq(mediaAsset.organizationId, organizationId),
					isNull(mediaAsset.deletedAt),
				)
			: and(
					eq(mediaAsset.organizationId, organizationId),
					isNull(mediaAsset.deletedAt),
					inArray(mediaAsset.branchId, scopedBranchIds),
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
		.leftJoin(mediaLink, eq(mediaLink.assetId, mediaAsset.id))
		.where(
			entityType && entityId
				? and(
						baseAssetFilter,
						eq(mediaLink.organizationId, organizationId),
						eq(mediaLink.entityType, entityType),
						eq(mediaLink.entityId, entityId),
						field ? eq(mediaLink.field, field) : undefined,
					)
				: baseAssetFilter,
		)
		.orderBy(asc(mediaAsset.createdAt), asc(mediaLink.sortOrder))

	return NextResponse.json({
		assets: rows.map(toMediaResponse),
	})
}
