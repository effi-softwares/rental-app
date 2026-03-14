import { NextResponse } from "next/server"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { sanitizeFileName } from "@/lib/media/pathname"
import { getStorageAdapter } from "@/lib/storage"

const ALLOWED_LOGO_CONTENT_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/avif",
	"image/svg+xml",
] as const

const MAX_LOGO_UPLOAD_BYTES = 8 * 1024 * 1024

function buildLogoPathname(userId: string, fileName: string) {
	const date = new Date()
	const year = date.getUTCFullYear()
	const month = String(date.getUTCMonth() + 1).padStart(2, "0")
	const day = String(date.getUTCDate()).padStart(2, "0")
	const safeFileName = sanitizeFileName(fileName)

	return `organization-logos/${userId}/${year}/${month}/${day}/${crypto.randomUUID()}-${safeFileName}`
}

export async function POST(request: Request) {
	const viewerResult = await requireViewer({ requireActiveOrganization: false })
	if (viewerResult.response) {
		return viewerResult.response
	}

	const { viewer } = viewerResult

	const formData = await request.formData()
	const logoFile = formData.get("file")
	const blurDataUrl = formData.get("blurDataUrl")

	if (!(logoFile instanceof File)) {
		return jsonError("Logo image is required.", 400)
	}

	if (!ALLOWED_LOGO_CONTENT_TYPES.includes(logoFile.type as never)) {
		return jsonError("Unsupported logo image type.", 400)
	}

	if (logoFile.size > MAX_LOGO_UPLOAD_BYTES) {
		return jsonError("Logo image exceeds maximum size.", 400)
	}

	if (typeof blurDataUrl !== "string" && blurDataUrl !== null) {
		return jsonError("Invalid blur data.", 400)
	}

	const adapter = getStorageAdapter()
	const pathname = buildLogoPathname(viewer.userId, logoFile.name)

	const storedLogo = await adapter.put({
		pathname,
		body: logoFile,
		bucket: "public",
		visibility: "public",
		contentType: logoFile.type,
		addRandomSuffix: false,
	})

	return NextResponse.json({
		logoUrl: storedLogo.url,
		blurDataUrl: typeof blurDataUrl === "string" ? blurDataUrl : null,
	})
}
