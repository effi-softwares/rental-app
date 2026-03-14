"use client"

import Image from "next/image"

import type { MediaAsset } from "@/features/media"
import { getMediaKindFromContentType } from "@/lib/media/media-kind"
import { cn } from "@/lib/utils"

type MediaImageProps = {
	asset: Pick<
		MediaAsset,
		| "id"
		| "deliveryUrl"
		| "visibility"
		| "blurDataUrl"
		| "originalFileName"
		| "contentType"
	>
	alt?: string
	className?: string
	width?: number
	height?: number
	fill?: boolean
	sizes?: string
}

function encodeSvg(value: string) {
	return value.replace(/#/g, "%23").replace(/\n/g, "")
}

function buildMediaIndicatorDataUrl(label: string) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="${label}"><rect width="1200" height="800" fill="%23f4f4f5"/><rect x="180" y="120" width="840" height="560" rx="24" fill="%23e4e4e7"/><text x="600" y="430" text-anchor="middle" fill="%2352525b" font-size="88" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-weight="700">${label}</text></svg>`
	return `data:image/svg+xml,${encodeSvg(svg)}`
}

function getNonImageLabel(contentType: string | null, mediaKind: string) {
	if (mediaKind === "video") {
		return "VIDEO"
	}

	if (contentType === "application/pdf") {
		return "PDF"
	}

	return "DOC"
}

export function MediaImage({
	asset,
	alt,
	className,
	width,
	height,
	fill = false,
	sizes,
}: MediaImageProps) {
	const mediaKind = getMediaKindFromContentType(asset.contentType)
	const nonImageLabel = getNonImageLabel(asset.contentType, mediaKind)

	const source =
		mediaKind === "image"
			? asset.deliveryUrl || `/api/media/private/${asset.id}`
			: buildMediaIndicatorDataUrl(nonImageLabel)

	const fallbackAlt = asset.originalFileName || "uploaded image"

	const shouldUseBlurPlaceholder =
		mediaKind === "image" && Boolean(asset.blurDataUrl)
	const blurDataURL =
		mediaKind === "image" ? (asset.blurDataUrl ?? undefined) : undefined
	const shouldUnoptimize =
		asset.visibility === "private" || Boolean(source?.startsWith("data:"))

	if (fill) {
		return (
			<Image
				src={source ?? ""}
				alt={alt ?? fallbackAlt}
				fill
				sizes={sizes ?? "100vw"}
				placeholder={shouldUseBlurPlaceholder ? "blur" : "empty"}
				blurDataURL={blurDataURL}
				unoptimized={shouldUnoptimize}
				className={cn("object-cover", className)}
			/>
		)
	}

	return (
		<Image
			src={source ?? ""}
			alt={alt ?? fallbackAlt}
			width={width ?? 1200}
			height={height ?? 800}
			placeholder={shouldUseBlurPlaceholder ? "blur" : "empty"}
			blurDataURL={blurDataURL}
			unoptimized={shouldUnoptimize}
			className={cn("h-auto w-full object-cover", className)}
		/>
	)
}
