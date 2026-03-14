"use client"

import { Trash2 } from "lucide-react"

import { MediaDropzone } from "@/components/media/media-dropzone"
import { MediaImage } from "@/components/media/media-image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { VehicleImageAsset } from "@/features/vehicles"

type VehicleImageGroupUploadProps = {
	title: string
	description: string
	assets: VehicleImageAsset[]
	isUploading: boolean
	onFilesSelected: (files: File[]) => void
	onRemove: (assetId: string) => void
	uploadProgressByFile: Record<string, number>
	variant?: "default" | "wizard"
}

export function VehicleImageGroupUpload({
	title,
	description,
	assets,
	isUploading,
	onFilesSelected,
	onRemove,
	uploadProgressByFile,
	variant = "default",
}: VehicleImageGroupUploadProps) {
	const blurReadyCount = assets.length
	const isWizard = variant === "wizard"

	return (
		<div
			className={
				isWizard
					? "grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"
					: "grid gap-5 border-y py-5 lg:grid-cols-[220px_minmax(0,1fr)]"
			}
		>
			<div className="space-y-3">
				<div className="space-y-1">
					<p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
						{title}
					</p>
					<p className="text-sm leading-relaxed">{description}</p>
				</div>

				<div className="flex flex-wrap gap-2">
					<Badge variant="outline">{assets.length} uploaded</Badge>
					<Badge variant="secondary">{blurReadyCount} blur ready</Badge>
				</div>

				<p className="text-muted-foreground text-xs leading-relaxed">
					Blur placeholders are generated automatically during upload.
				</p>
			</div>

			<div className="space-y-4">
				<MediaDropzone
					multiple
					disabled={isUploading}
					label={isUploading ? "Uploading..." : "Upload images"}
					description="Tap to choose or drag and drop multiple files."
					onFilesSelected={onFilesSelected}
					accept="image/*"
				/>

				{Object.keys(uploadProgressByFile).length > 0 ? (
					<div className="space-y-2">
						{Object.entries(uploadProgressByFile).map(
							([fileName, percentage]) => (
								<div key={fileName} className="space-y-1">
									<div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
										<p className="truncate">{fileName}</p>
										<span>{Math.round(percentage)}%</span>
									</div>
									<div className="bg-muted h-1.5 overflow-hidden rounded-full">
										<div
											className="bg-primary h-full rounded-full transition-all"
											style={{ width: `${Math.round(percentage)}%` }}
										/>
									</div>
								</div>
							),
						)}
					</div>
				) : null}

				{assets.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No images uploaded yet.
					</p>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
						{assets.map((asset) => {
							return (
								<div
									key={asset.assetId}
									className={
										isWizard
											? "overflow-hidden rounded-2xl border bg-background/80"
											: "overflow-hidden rounded-md border"
									}
								>
									<div className="bg-muted/40 relative aspect-[4/3] overflow-hidden">
										<MediaImage
											asset={{
												id: asset.assetId,
												deliveryUrl: asset.deliveryUrl,
												visibility: "private",
												blurDataUrl: asset.blurDataUrl,
												originalFileName: `${title}-${asset.assetId}`,
												contentType: "image/jpeg",
											}}
											alt={title}
											fill
											sizes="(min-width: 1280px) 18vw, (min-width: 640px) 30vw, 45vw"
											className="h-full w-full object-cover"
										/>

										<Button
											type="button"
											variant="secondary"
											size="icon-sm"
											onClick={() => onRemove(asset.assetId)}
											className="absolute top-2 right-2"
										>
											<Trash2 />
											<span className="sr-only">Remove image</span>
										</Button>
									</div>

									<div
										className={
											isWizard
												? "flex items-center justify-between gap-2 px-3 py-2"
												: "flex items-center justify-between gap-2 px-2 py-1.5"
										}
									>
										<p className="text-muted-foreground truncate text-xs">
											{asset.assetId.slice(0, 8)}
										</p>
										<p className="text-muted-foreground text-xs">Blur ready</p>
									</div>
								</div>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
}
