export async function readImageDimensions(file: File): Promise<{
	width: number
	height: number
} | null> {
	if (typeof window === "undefined") {
		return null
	}

	try {
		const imageBitmap = await createImageBitmap(file)
		const dimensions = {
			width: imageBitmap.width,
			height: imageBitmap.height,
		}
		imageBitmap.close()
		return dimensions
	} catch {
		return null
	}
}

export async function generateBlurDataUrl(file: File): Promise<string | null> {
	if (typeof window === "undefined") {
		return null
	}

	try {
		const imageBitmap = await createImageBitmap(file)
		const targetWidth = Math.max(8, Math.min(20, imageBitmap.width))
		const targetHeight = Math.max(
			8,
			Math.round((imageBitmap.height / imageBitmap.width) * targetWidth),
		)

		const canvas = document.createElement("canvas")
		canvas.width = targetWidth
		canvas.height = targetHeight

		const context = canvas.getContext("2d")
		if (!context) {
			imageBitmap.close()
			return null
		}

		context.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight)
		imageBitmap.close()

		return canvas.toDataURL("image/jpeg", 0.6)
	} catch {
		return null
	}
}
