export const IMAGE_CONTENT_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/avif",
	"image/heic",
	"image/heif",
] as const

export const VIDEO_CONTENT_TYPES = [
	"video/mp4",
	"video/webm",
	"video/ogg",
	"video/quicktime",
] as const

export const DOCUMENT_CONTENT_TYPES = ["application/pdf"] as const

export const MEDIA_CONTENT_TYPES = [
	...IMAGE_CONTENT_TYPES,
	...VIDEO_CONTENT_TYPES,
	...DOCUMENT_CONTENT_TYPES,
] as const

export const MEDIA_INPUT_ACCEPT = "image/*,video/*,application/pdf"

export const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const MAX_CLIENT_UPLOAD_BYTES = 100 * 1024 * 1024
