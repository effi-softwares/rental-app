"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { type MediaVisibility, useUploadImagesMutation } from "@/features/media"
import { MEDIA_INPUT_ACCEPT } from "@/lib/media/constants"
import type { StorageBucket } from "@/lib/storage"
import { MediaDropzone } from "./media-dropzone"

type MediaUploaderProps = {
	entityType: string
	entityId: string
	handleUploadUrl?: string
	finalizeUrl?: string
	storageBucket?: StorageBucket
	field?: string
	branchId?: string | null
	visibility?: MediaVisibility
	metadata?: Record<string, unknown>
	multiple?: boolean
	onUploaded?: (
		result: Array<{
			assetId: string
			url: string
			deliveryUrl: string
			blurDataUrl: string | null
		}>,
	) => void
}

export function MediaUploader({
	entityType,
	entityId,
	handleUploadUrl,
	finalizeUrl,
	storageBucket = "private",
	field,
	branchId,
	visibility = "private",
	metadata,
	multiple = true,
	onUploaded,
}: MediaUploaderProps) {
	const authContextQuery = useAuthContextQuery()
	const organizationId = authContextQuery.data?.viewer.activeOrganizationId

	const uploadImagesMutation = useUploadImagesMutation()
	const [selectedFiles, setSelectedFiles] = useState<File[]>([])
	const [progressByFile, setProgressByFile] = useState<Record<string, number>>(
		{},
	)
	const [error, setError] = useState<string | null>(null)

	const disabled = !organizationId || uploadImagesMutation.isPending

	const onStartUpload = async () => {
		if (!organizationId) {
			setError("Select an active organization first.")
			return
		}

		if (selectedFiles.length === 0) {
			setError("Select at least one file.")
			return
		}

		setError(null)

		try {
			const result = await uploadImagesMutation.mutateAsync({
				organizationId,
				files: selectedFiles,
				entityType,
				entityId,
				handleUploadUrl,
				finalizeUrl,
				storageBucket,
				field,
				branchId,
				visibility,
				metadata,
				onFileProgress: (fileName, percentage) => {
					setProgressByFile((current) => ({
						...current,
						[fileName]: percentage,
					}))
				},
			})

			setSelectedFiles([])
			setProgressByFile({})
			onUploaded?.(result)
		} catch (uploadError) {
			setError(
				uploadError instanceof Error
					? uploadError.message
					: "Failed to upload images.",
			)
		}
	}

	return (
		<Card className="border-border/70">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<CardTitle>Media uploader</CardTitle>
					<Badge variant="secondary">{multiple ? "Multiple" : "Single"}</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-muted-foreground text-sm">
					Drag and drop files or browse from your device. PNG, JPEG, and WebP
					are recommended.
				</p>

				<MediaDropzone
					accept={MEDIA_INPUT_ACCEPT}
					disabled={disabled}
					multiple={multiple}
					onFilesSelected={(files) => {
						setSelectedFiles((current) =>
							multiple ? [...current, ...files] : files.slice(0, 1),
						)
					}}
				/>

				{selectedFiles.length > 0 ? (
					<div className="space-y-2">
						<p className="text-sm font-medium">
							Selected files ({selectedFiles.length})
						</p>
						{selectedFiles.map((file) => (
							<div
								key={`${file.name}-${file.lastModified}`}
								className="bg-muted/50 space-y-1.5 rounded-md px-3 py-2"
							>
								<p className="truncate text-sm font-medium">{file.name}</p>
								<p className="text-muted-foreground text-xs">
									{Math.round(file.size / 1024)} KB
									{progressByFile[file.name] !== undefined
										? ` • ${Math.round(progressByFile[file.name])}%`
										: ""}
								</p>
								{progressByFile[file.name] !== undefined ? (
									<div className="h-2 overflow-hidden rounded-full bg-background">
										<div
											className="h-full rounded-full bg-primary transition-all"
											style={{
												width: `${Math.round(progressByFile[file.name])}%`,
											}}
										/>
									</div>
								) : null}
							</div>
						))}
					</div>
				) : (
					<div className="rounded-md border border-dashed p-3">
						<p className="text-muted-foreground text-sm">
							No files selected yet.
						</p>
					</div>
				)}

				{error ? <p className="text-destructive text-sm">{error}</p> : null}

				<div className="grid gap-2 sm:grid-cols-2">
					<Button
						type="button"
						className="h-11 w-full"
						disabled={disabled}
						onClick={onStartUpload}
					>
						{uploadImagesMutation.isPending ? "Uploading..." : "Upload files"}
					</Button>
					<Button
						type="button"
						variant="secondary"
						className="h-11 w-full"
						disabled={disabled || selectedFiles.length === 0}
						onClick={() => {
							setSelectedFiles([])
							setProgressByFile({})
							setError(null)
						}}
					>
						Clear
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
