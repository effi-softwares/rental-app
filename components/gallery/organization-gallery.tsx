"use client"

import { useState } from "react"

import { MediaImage } from "@/components/media/media-image"
import { MediaUploader } from "@/components/media/media-uploader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { StatePanel } from "@/components/ui/state-panel"
import {
	useDeleteOrganizationGalleryMediaMutation,
	useOrganizationGalleryQuery,
} from "@/features/gallery"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import type { StorageBucket } from "@/lib/storage"

function resolveAssetBucket(asset: {
	metadata?: Record<string, unknown>
	visibility: "public" | "private"
}): StorageBucket {
	const configured = asset.metadata?.storageBucket

	if (configured === "private" || configured === "public") {
		return configured
	}

	return asset.visibility === "public" ? "public" : "private"
}

export function OrganizationGallery() {
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined

	const galleryQuery = useOrganizationGalleryQuery(activeOrganizationId)
	const deleteMutation = useDeleteOrganizationGalleryMediaMutation()
	const [storageBucket, setStorageBucket] = useState<StorageBucket>("private")

	if (!activeOrganizationId) {
		return (
			<StatePanel
				title="Organization gallery"
				description="Select an active organization first."
			/>
		)
	}

	const assets = galleryQuery.data?.assets ?? []
	const canManageGalleryMedia = Boolean(
		galleryQuery.data?.canManageGalleryMedia,
	)

	return (
		<div className="space-y-4">
			<PageSectionHeader
				title="Organization gallery"
				description="Store shared organization images for dashboards and operational content."
			/>

			<div className="grid gap-3 sm:grid-cols-3">
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs">Images</p>
						<p className="mt-1 text-2xl font-semibold">{assets.length}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs">Private assets</p>
						<p className="mt-1 text-2xl font-semibold">
							{
								assets.filter(
									(asset) => resolveAssetBucket(asset) === "private",
								).length
							}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs">Upload access</p>
						<p className="mt-1 text-sm font-semibold">
							{canManageGalleryMedia ? "Can manage media" : "View only"}
						</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Upload controls</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{canManageGalleryMedia ? (
						<div className="space-y-3">
							<div className="space-y-1">
								<p className="text-sm font-medium">Upload bucket</p>
								<p className="text-muted-foreground text-xs">
									Private is the default and recommended for organization data.
								</p>
							</div>
							<Select
								value={storageBucket}
								onValueChange={(value) => {
									setStorageBucket(value as StorageBucket)
								}}
							>
								<SelectTrigger className="h-11 w-full">
									<SelectValue placeholder="Select bucket" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="private">Private bucket</SelectItem>
									<SelectItem value="public">Public bucket</SelectItem>
								</SelectContent>
							</Select>

							<MediaUploader
								entityType="organization"
								entityId={activeOrganizationId}
								field="gallery"
								visibility={storageBucket === "public" ? "public" : "private"}
								storageBucket={storageBucket}
								handleUploadUrl="/api/gallery/media/upload"
								finalizeUrl="/api/gallery/media/finalize"
								onUploaded={() => {
									void galleryQuery.refetch()
								}}
								multiple
							/>
						</div>
					) : (
						<StatePanel
							title="Read-only gallery"
							description="Your role can view gallery images but cannot upload or delete."
						/>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Images</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{galleryQuery.isPending ? (
						<StatePanel
							title="Loading images"
							description="Fetching organization gallery assets..."
						/>
					) : null}

					{galleryQuery.isError ? (
						<StatePanel
							title="Unable to load gallery"
							description={galleryQuery.error.message}
							variant="error"
						/>
					) : null}

					{!galleryQuery.isPending &&
					!galleryQuery.isError &&
					assets.length === 0 ? (
						<StatePanel
							title="No images yet"
							description="Upload your first organization image to populate the gallery."
						/>
					) : null}

					{assets.length > 0 ? (
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{assets.map((asset) => {
								const assetBucket = resolveAssetBucket(asset)

								return (
									<div
										key={asset.id}
										className="space-y-2 rounded-md border p-2"
									>
										<div className="bg-muted relative aspect-4/3 overflow-hidden rounded-md">
											<MediaImage
												asset={asset}
												fill
												sizes="(max-width: 1024px) 50vw, 33vw"
											/>
										</div>
										<div className="flex items-center justify-between gap-2">
											<p className="truncate text-xs font-medium">
												{asset.originalFileName ?? "image"}
											</p>
											<Badge
												variant="secondary"
												className="h-6 px-2 text-[10px] uppercase"
											>
												{assetBucket}
											</Badge>
										</div>
										<p className="text-muted-foreground text-xs">
											{asset.sizeBytes
												? `${Math.round(asset.sizeBytes / 1024)} KB`
												: "-"}
										</p>
										{canManageGalleryMedia ? (
											<Button
												type="button"
												variant="secondary"
												className="h-11 w-full"
												disabled={deleteMutation.isPending}
												onClick={() => {
													deleteMutation.mutate({
														mediaId: asset.id,
														organizationId: activeOrganizationId,
													})
												}}
											>
												Delete image
											</Button>
										) : null}
									</div>
								)
							})}
						</div>
					) : null}
				</CardContent>
			</Card>
		</div>
	)
}
