export type MediaKind = "image" | "video" | "document" | "other"

export function getMediaKindFromContentType(
	contentType?: string | null,
): MediaKind {
	if (!contentType) {
		return "other"
	}

	if (contentType.startsWith("image/")) {
		return "image"
	}

	if (contentType.startsWith("video/")) {
		return "video"
	}

	if (contentType === "application/pdf") {
		return "document"
	}

	return "other"
}
