function toRadians(degrees: number) {
	return (degrees * Math.PI) / 180
}

function createImageFromUrl(sourceUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image()
		image.crossOrigin = "anonymous"
		image.onload = () => resolve(image)
		image.onerror = () => reject(new Error("Failed to load image."))
		image.src = sourceUrl
	})
}

function getRotatedBounds(
	width: number,
	height: number,
	rotationDegrees: number,
) {
	const rotation = toRadians(rotationDegrees)

	return {
		width:
			Math.abs(Math.cos(rotation) * width) +
			Math.abs(Math.sin(rotation) * height),
		height:
			Math.abs(Math.sin(rotation) * width) +
			Math.abs(Math.cos(rotation) * height),
	}
}

export async function createCroppedImageFile(input: {
	sourceUrl: string
	cropPixels: { x: number; y: number; width: number; height: number }
	rotation: number
	fileName: string
	outputType?: "image/jpeg" | "image/png" | "image/webp"
	outputQuality?: number
}) {
	const image = await createImageFromUrl(input.sourceUrl)
	const outputType = input.outputType ?? "image/jpeg"
	const outputQuality = input.outputQuality ?? 0.9

	const rotatedBounds = getRotatedBounds(
		image.width,
		image.height,
		input.rotation,
	)

	const temporaryCanvas = document.createElement("canvas")
	temporaryCanvas.width = Math.round(rotatedBounds.width)
	temporaryCanvas.height = Math.round(rotatedBounds.height)

	const temporaryContext = temporaryCanvas.getContext("2d")
	if (!temporaryContext) {
		throw new Error("Failed to initialize image editor.")
	}

	const rotationInRadians = toRadians(input.rotation)
	temporaryContext.translate(
		temporaryCanvas.width / 2,
		temporaryCanvas.height / 2,
	)
	temporaryContext.rotate(rotationInRadians)
	temporaryContext.translate(-image.width / 2, -image.height / 2)
	temporaryContext.drawImage(image, 0, 0)

	const outputCanvas = document.createElement("canvas")
	outputCanvas.width = Math.max(1, Math.round(input.cropPixels.width))
	outputCanvas.height = Math.max(1, Math.round(input.cropPixels.height))

	const outputContext = outputCanvas.getContext("2d")
	if (!outputContext) {
		throw new Error("Failed to create cropped image.")
	}

	outputContext.drawImage(
		temporaryCanvas,
		input.cropPixels.x,
		input.cropPixels.y,
		input.cropPixels.width,
		input.cropPixels.height,
		0,
		0,
		input.cropPixels.width,
		input.cropPixels.height,
	)

	const fileBlob = await new Promise<Blob | null>((resolve) => {
		outputCanvas.toBlob((blob) => resolve(blob), outputType, outputQuality)
	})

	if (!fileBlob) {
		throw new Error("Unable to export cropped image.")
	}

	return new File([fileBlob], input.fileName, { type: outputType })
}
