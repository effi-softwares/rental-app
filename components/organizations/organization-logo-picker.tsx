"use client"

import Avvvatars from "avvvatars-react"
import Avatar from "boring-avatars"
import { ImagePlus, RefreshCw } from "lucide-react"
import {
	forwardRef,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react"
import Cropper, { type Area } from "react-easy-crop"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createCroppedImageFile } from "@/lib/media/client-crop"
import { generateBlurDataUrl } from "@/lib/media/client-image"
import { toSlug } from "@/lib/utils"

type LogoMode = "avatar" | "upload"
type AvatarProvider = "boring" | "avvvatars"

const boringAvatarVariants = [
	"marble",
	"beam",
	"pixel",
	"sunset",
	"ring",
	"bauhaus",
] as const

function buildAvatarSeeds(organizationName: string, seedVersion: number) {
	const baseSeed = toSlug(organizationName) || "organization"

	return Array.from(
		{ length: 6 },
		(_, index) => `${baseSeed}-${seedVersion}-${index}`,
	)
}

function serializeSvgElement(svgElement: SVGElement) {
	const serializer = new XMLSerializer()
	return serializer.serializeToString(svgElement)
}

async function uploadOrganizationLogo(input: {
	file: File
	blurDataUrl: string | null
}) {
	const body = new FormData()
	body.append("file", input.file)

	if (input.blurDataUrl) {
		body.append("blurDataUrl", input.blurDataUrl)
	}

	const response = await fetch("/api/organizations/logo-upload", {
		method: "POST",
		body,
	})

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as {
			error?: string
		} | null
		throw new Error(payload?.error ?? "Failed to upload organization logo.")
	}

	return (await response.json()) as {
		logoUrl: string
		blurDataUrl: string | null
	}
}

export type OrganizationLogoResult = {
	logoUrl: string
	blurDataUrl: string | null
}

export type OrganizationLogoPickerHandle = {
	resolveLogo: () => Promise<OrganizationLogoResult>
}

type OrganizationLogoPickerProps = {
	organizationName: string
}

export const OrganizationLogoPicker = forwardRef<
	OrganizationLogoPickerHandle,
	OrganizationLogoPickerProps
>(function OrganizationLogoPicker({ organizationName }, ref) {
	const [logoMode, setLogoMode] = useState<LogoMode>("avatar")
	const [avatarProvider, setAvatarProvider] = useState<AvatarProvider>("boring")
	const [avatarSeedVersion, setAvatarSeedVersion] = useState(0)
	const [selectedAvatarSeed, setSelectedAvatarSeed] = useState<string>("")

	const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
	const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
	const [crop, setCrop] = useState({ x: 0, y: 0 })
	const [zoom, setZoom] = useState(1)
	const [rotation, setRotation] = useState(0)
	const [cropPixels, setCropPixels] = useState<Area | null>(null)

	const [isResolvingLogo, setIsResolvingLogo] = useState(false)
	const [pickerError, setPickerError] = useState<string | null>(null)

	const avatarCardReferences = useRef<Record<string, HTMLButtonElement | null>>(
		{},
	)

	const avatarSeeds = useMemo(
		() => buildAvatarSeeds(organizationName, avatarSeedVersion),
		[organizationName, avatarSeedVersion],
	)

	const effectiveSelectedAvatarSeed =
		selectedAvatarSeed || avatarSeeds[0] || "organization"

	useImperativeHandle(ref, () => ({
		resolveLogo: async () => {
			setPickerError(null)
			setIsResolvingLogo(true)

			try {
				if (logoMode === "avatar") {
					const avatarKey = `${avatarProvider}-${effectiveSelectedAvatarSeed}`
					const avatarCard = avatarCardReferences.current[avatarKey]
					const svgElement = avatarCard?.querySelector("svg")

					if (!svgElement) {
						throw new Error("Select an avatar before continuing.")
					}

					const svgMarkup = serializeSvgElement(svgElement)
					const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml" })
					const svgFile = new File(
						[svgBlob],
						`${toSlug(organizationName) || "organization"}-avatar.svg`,
						{ type: "image/svg+xml" },
					)

					const uploadResult = await uploadOrganizationLogo({
						file: svgFile,
						blurDataUrl: null,
					})

					return uploadResult
				}

				if (!selectedImageUrl || !selectedImageFile || !cropPixels) {
					throw new Error("Choose and edit a logo image before continuing.")
				}

				const croppedImageFile = await createCroppedImageFile({
					sourceUrl: selectedImageUrl,
					cropPixels,
					rotation,
					fileName: `${toSlug(organizationName) || "organization"}-logo.jpg`,
					outputType: "image/jpeg",
				})

				const blurDataUrl = await generateBlurDataUrl(croppedImageFile)

				const uploadResult = await uploadOrganizationLogo({
					file: croppedImageFile,
					blurDataUrl,
				})

				return uploadResult
			} finally {
				setIsResolvingLogo(false)
			}
		},
	}))

	return (
		<div className="space-y-4 rounded-lg border p-4">
			<div className="space-y-1">
				<p className="text-sm font-semibold">Organization logo</p>
				<p className="text-muted-foreground text-xs">
					Choose an avatar style or upload and edit your own image.
				</p>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<Button
					type="button"
					variant={logoMode === "avatar" ? "default" : "secondary"}
					className="h-11"
					onClick={() => {
						setLogoMode("avatar")
						setPickerError(null)
					}}
				>
					Generate avatar
				</Button>
				<Button
					type="button"
					variant={logoMode === "upload" ? "default" : "secondary"}
					className="h-11"
					onClick={() => {
						setLogoMode("upload")
						setPickerError(null)
					}}
				>
					Upload image
				</Button>
			</div>

			{logoMode === "avatar" ? (
				<div className="space-y-3">
					<div className="grid grid-cols-3 gap-2">
						<Button
							type="button"
							variant={avatarProvider === "boring" ? "default" : "secondary"}
							className="h-10"
							onClick={() => setAvatarProvider("boring")}
						>
							Boring
						</Button>
						<Button
							type="button"
							variant={avatarProvider === "avvvatars" ? "default" : "secondary"}
							className="h-10 col-span-2"
							onClick={() => setAvatarProvider("avvvatars")}
						>
							Avvvatars
						</Button>
					</div>

					<Button
						type="button"
						variant="outline"
						className="h-10 w-full"
						onClick={() => {
							setAvatarSeedVersion((current) => current + 1)
							setSelectedAvatarSeed("")
						}}
					>
						<RefreshCw className="mr-2 size-4" />
						Shuffle options
					</Button>

					<div className="grid grid-cols-3 gap-3">
						{avatarSeeds.map((seed) => {
							const avatarKey = `${avatarProvider}-${seed}`
							const isSelected = effectiveSelectedAvatarSeed === seed

							return (
								<button
									type="button"
									key={avatarKey}
									ref={(node) => {
										avatarCardReferences.current[avatarKey] = node
									}}
									onClick={() => {
										setSelectedAvatarSeed(seed)
										setPickerError(null)
									}}
									className={`rounded-lg border p-2 transition ${
										isSelected ? "border-primary bg-primary/5" : "border-border"
									}`}
								>
									<div className="flex justify-center">
										{avatarProvider === "boring" ? (
											<Avatar
												size={72}
												name={seed}
												variant={
													boringAvatarVariants[
														Math.abs(seed.length + avatarSeedVersion) %
															boringAvatarVariants.length
													]
												}
											/>
										) : (
											<Avvvatars value={seed} size={72} style="shape" />
										)}
									</div>
								</button>
							)
						})}
					</div>
				</div>
			) : (
				<div className="space-y-3">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="organizationLogoUpload">
								Logo image
							</FieldLabel>
							<Input
								id="organizationLogoUpload"
								type="file"
								accept="image/jpeg,image/png,image/webp,image/avif"
								className="h-11"
								onChange={(event) => {
									const nextFile = event.target.files?.[0]
									if (!nextFile) {
										return
									}

									setSelectedImageFile(nextFile)
									setSelectedImageUrl(URL.createObjectURL(nextFile))
									setCrop({ x: 0, y: 0 })
									setZoom(1)
									setRotation(0)
									setCropPixels(null)
									setPickerError(null)
								}}
							/>
						</Field>
					</FieldGroup>

					{selectedImageUrl ? (
						<div className="space-y-3">
							<div className="relative h-64 w-full overflow-hidden rounded-lg border bg-black/80">
								<Cropper
									image={selectedImageUrl}
									crop={crop}
									zoom={zoom}
									rotation={rotation}
									aspect={1}
									onCropChange={setCrop}
									onZoomChange={setZoom}
									onRotationChange={setRotation}
									onCropComplete={(_, nextCropPixels) => {
										setCropPixels(nextCropPixels)
									}}
									showGrid={false}
								/>
							</div>

							<div className="space-y-2">
								<FieldGroup>
									<Field>
										<FieldLabel htmlFor="logoZoom">Zoom</FieldLabel>
										<Input
											id="logoZoom"
											type="range"
											min={1}
											max={3}
											step={0.01}
											className="h-10"
											value={zoom}
											onChange={(event) => {
												setZoom(Number(event.target.value))
											}}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor="logoRotation">Rotation</FieldLabel>
										<Input
											id="logoRotation"
											type="range"
											min={-180}
											max={180}
											step={1}
											className="h-10"
											value={rotation}
											onChange={(event) => {
												setRotation(Number(event.target.value))
											}}
										/>
									</Field>
								</FieldGroup>
							</div>
						</div>
					) : (
						<div className="text-muted-foreground flex h-24 items-center justify-center rounded-lg border border-dashed text-sm">
							<ImagePlus className="mr-2 size-4" />
							Select an image to edit
						</div>
					)}
				</div>
			)}

			{pickerError ? (
				<p className="text-destructive text-sm">{pickerError}</p>
			) : null}

			{isResolvingLogo ? (
				<p className="text-muted-foreground text-xs">Preparing logo...</p>
			) : null}
		</div>
	)
})
