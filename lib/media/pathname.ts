function slugifySegment(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
}

export function sanitizeFileName(fileName: string): string {
	const trimmed = fileName.trim()
	if (!trimmed) {
		return "upload"
	}

	const dotIndex = trimmed.lastIndexOf(".")
	if (dotIndex === -1) {
		return slugifySegment(trimmed) || "upload"
	}

	const base = slugifySegment(trimmed.slice(0, dotIndex)) || "upload"
	const extension = slugifySegment(trimmed.slice(dotIndex + 1))

	return extension ? `${base}.${extension}` : base
}

export function getOrganizationMediaPrefix(organizationId: string): string {
	return `org/${organizationId}/`
}

export function buildMediaPathname(input: {
	organizationId: string
	entityType: string
	entityId: string
	fileName: string
}): string {
	const now = new Date()
	const yyyy = now.getUTCFullYear()
	const mm = String(now.getUTCMonth() + 1).padStart(2, "0")
	const dd = String(now.getUTCDate()).padStart(2, "0")

	const entityType = slugifySegment(input.entityType) || "unknown"
	const entityId = slugifySegment(input.entityId) || "unknown"
	const fileName = sanitizeFileName(input.fileName)

	return `${getOrganizationMediaPrefix(input.organizationId)}${entityType}/${entityId}/${yyyy}/${mm}/${dd}/${fileName}`
}
