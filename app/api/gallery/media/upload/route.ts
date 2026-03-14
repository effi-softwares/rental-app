import type { HandleUploadBody } from "@vercel/blob/client"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { mediaAsset, mediaLink } from "@/lib/db/schema/media"
import {
	MAX_CLIENT_UPLOAD_BYTES,
	MEDIA_CONTENT_TYPES,
} from "@/lib/media/constants"
import {
	getOrganizationMediaPrefix,
	sanitizeFileName,
} from "@/lib/media/pathname"
import {
	DEFAULT_MEDIA_STORAGE_BUCKET,
	mergeMediaStorageBucketMetadata,
} from "@/lib/media/storage-bucket"
import { getStorageAdapter } from "@/lib/storage"
import { mediaClientPayloadSchema } from "@/zod/media"

const galleryUploadTokenPayloadSchema = mediaClientPayloadSchema.extend({
	organizationId: z.string().uuid(),
	uploadedByUserId: z.string().uuid(),
	pathname: z.string().trim().min(1),
})

function extractErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message
	}

	return "Unexpected upload error."
}

function resolveUploadBucket(body: HandleUploadBody) {
	if (body.type === "blob.generate-client-token") {
		let parsedPayload: unknown = null

		try {
			parsedPayload = body.payload.clientPayload
				? JSON.parse(body.payload.clientPayload)
				: null
		} catch {}

		const parsed = mediaClientPayloadSchema.safeParse(parsedPayload)

		if (parsed.success) {
			return parsed.data.storageBucket
		}
	}

	if (body.type === "blob.upload-completed") {
		let parsedTokenPayload: unknown = null

		try {
			parsedTokenPayload = body.payload.tokenPayload
				? JSON.parse(body.payload.tokenPayload)
				: null
		} catch {}

		const parsed = galleryUploadTokenPayloadSchema.safeParse(parsedTokenPayload)

		if (parsed.success) {
			return parsed.data.storageBucket
		}
	}

	return DEFAULT_MEDIA_STORAGE_BUCKET
}

export async function POST(request: Request): Promise<NextResponse> {
	const adapter = getStorageAdapter()

	if (!adapter.handleClientUpload) {
		return jsonError(
			"The current storage provider does not support client uploads.",
			501,
		)
	}

	const body = (await request.json()) as HandleUploadBody

	try {
		const uploadBucket = resolveUploadBucket(body)

		const result = await adapter.handleClientUpload({
			request,
			body,
			bucket: uploadBucket,
			onBeforeGenerateToken: async ({ pathname, clientPayload }) => {
				const viewerResult = await requireViewer({
					permission: "manageGalleryMedia",
				})

				if (viewerResult.response) {
					throw new Error(
						viewerResult.response.status === 403
							? "Forbidden."
							: "Unauthorized.",
					)
				}

				const { viewer } = viewerResult

				const parsedPayload = mediaClientPayloadSchema.safeParse(
					clientPayload ? JSON.parse(clientPayload) : null,
				)

				if (!parsedPayload.success) {
					throw new Error("Invalid upload payload.")
				}

				const payload = parsedPayload.data

				if (
					payload.organizationId &&
					payload.organizationId !== viewer.activeOrganizationId
				) {
					throw new Error("Organization mismatch in upload payload.")
				}

				if (
					payload.link.entityType !== "organization" ||
					payload.link.entityId !== viewer.activeOrganizationId ||
					payload.link.field !== "gallery"
				) {
					throw new Error("Invalid gallery upload target.")
				}

				if (payload.branchId) {
					throw new Error("Gallery uploads cannot target a branch.")
				}

				const orgPrefix = getOrganizationMediaPrefix(
					viewer.activeOrganizationId,
				)
				if (!pathname.startsWith(orgPrefix)) {
					throw new Error("Invalid upload pathname prefix.")
				}

				if (!MEDIA_CONTENT_TYPES.includes(payload.contentType as never)) {
					throw new Error("Unsupported media type for upload.")
				}

				if (payload.sizeBytes > MAX_CLIENT_UPLOAD_BYTES) {
					throw new Error("File exceeds allowed upload size.")
				}

				const fileName = sanitizeFileName(payload.originalFileName)
				const pathnameWithName = pathname.endsWith(fileName)
					? pathname
					: `${pathname.replace(/\/$/, "")}/${fileName}`

				const tokenPayload = galleryUploadTokenPayloadSchema.parse({
					...payload,
					organizationId: viewer.activeOrganizationId,
					uploadedByUserId: viewer.userId,
					pathname: pathnameWithName,
				})

				return {
					addRandomSuffix: true,
					allowedContentTypes: [...MEDIA_CONTENT_TYPES],
					maximumSizeInBytes: MAX_CLIENT_UPLOAD_BYTES,
					tokenPayload: JSON.stringify(tokenPayload),
				}
			},
			onUploadCompleted: async ({ blob, tokenPayload }) => {
				const parsedTokenPayload = galleryUploadTokenPayloadSchema.safeParse(
					tokenPayload ? JSON.parse(tokenPayload) : null,
				)

				if (!parsedTokenPayload.success) {
					throw new Error("Invalid upload completion payload.")
				}

				const payload = parsedTokenPayload.data

				const inserted = await db
					.insert(mediaAsset)
					.values({
						organizationId: payload.organizationId,
						branchId: null,
						createdByUserId: payload.uploadedByUserId,
						provider: adapter.provider,
						visibility: payload.visibility,
						status: "uploaded",
						pathname: blob.pathname,
						url: blob.url,
						downloadUrl: blob.downloadUrl,
						originalFileName: payload.originalFileName,
						contentType: blob.contentType,
						sizeBytes: payload.sizeBytes,
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
					.onConflictDoNothing({
						target: [mediaAsset.organizationId, mediaAsset.pathname],
					})
					.returning({ id: mediaAsset.id })

				let assetId = inserted[0]?.id

				if (!assetId) {
					const existing = await db
						.select({ id: mediaAsset.id })
						.from(mediaAsset)
						.where(
							and(
								eq(mediaAsset.organizationId, payload.organizationId),
								eq(mediaAsset.pathname, blob.pathname),
							),
						)
						.limit(1)

					assetId = existing[0]?.id
				}

				if (!assetId) {
					throw new Error("Failed to resolve uploaded asset.")
				}

				await db
					.insert(mediaLink)
					.values({
						organizationId: payload.organizationId,
						assetId,
						entityType: "organization",
						entityId: payload.organizationId,
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
			},
		})

		return NextResponse.json(result)
	} catch (error) {
		return jsonError(extractErrorMessage(error), 400)
	}
}
