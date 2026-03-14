import { z } from "zod"

import {
	MAX_CLIENT_UPLOAD_BYTES,
	MEDIA_CONTENT_TYPES,
} from "@/lib/media/constants"

export const mediaVisibilitySchema = z.enum(["public", "private"])
export const mediaStorageBucketSchema = z.enum(["private", "public"])

export const mediaLinkPayloadSchema = z.object({
	entityType: z.string().trim().min(1).max(64),
	entityId: z.string().trim().min(1).max(128),
	field: z.string().trim().min(1).max(64).default("default"),
	sortOrder: z.number().int().min(0).max(10_000).default(0),
})

export const mediaClientPayloadSchema = z.object({
	organizationId: z.string().uuid().optional(),
	storageBucket: mediaStorageBucketSchema.default("private"),
	visibility: mediaVisibilitySchema.default("private"),
	branchId: z.string().uuid().nullable().optional(),
	originalFileName: z.string().trim().min(1).max(260),
	contentType: z.string().trim().min(1),
	sizeBytes: z.number().int().positive().max(MAX_CLIENT_UPLOAD_BYTES),
	width: z.number().int().positive().max(20_000).nullable().optional(),
	height: z.number().int().positive().max(20_000).nullable().optional(),
	blurDataUrl: z.string().trim().max(10_000).nullable().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	link: mediaLinkPayloadSchema,
})

export const mediaServerUploadSchema = z.object({
	storageBucket: mediaStorageBucketSchema.default("private"),
	visibility: mediaVisibilitySchema.default("private"),
	branchId: z.string().uuid().nullable().optional(),
	width: z.number().int().positive().max(20_000).nullable().optional(),
	height: z.number().int().positive().max(20_000).nullable().optional(),
	blurDataUrl: z.string().trim().max(10_000).nullable().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	link: mediaLinkPayloadSchema,
})

export const mediaListQuerySchema = z.object({
	entityType: z.string().trim().min(1).max(64).optional(),
	entityId: z.string().trim().min(1).max(128).optional(),
	field: z.string().trim().min(1).max(64).optional(),
})

export function isAllowedMediaContentType(contentType: string) {
	return (MEDIA_CONTENT_TYPES as readonly string[]).includes(contentType)
}
