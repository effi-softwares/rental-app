"use client"

import { Trash2 } from "lucide-react"

import { MediaImage } from "@/components/media/media-image"
import { Button } from "@/components/ui/button"

type ConditionMediaItem = {
	assetId: string
	deliveryUrl: string
	blurDataUrl: string
	label: string | null
}

type RentalConditionMediaPreviewProps = {
	items: ConditionMediaItem[]
	onRemove: (assetId: string) => void
	emptyMessage?: string
}

function inferContentType(deliveryUrl: string) {
	const normalized = deliveryUrl.toLowerCase()

	if (normalized.includes(".mp4")) {
		return "video/mp4"
	}

	if (normalized.includes(".webm")) {
		return "video/webm"
	}

	if (normalized.includes(".mov") || normalized.includes("quicktime")) {
		return "video/quicktime"
	}

	if (normalized.includes(".pdf")) {
		return "application/pdf"
	}

	if (normalized.includes(".png")) {
		return "image/png"
	}

	if (normalized.includes(".webp")) {
		return "image/webp"
	}

	return "image/jpeg"
}

export function RentalConditionMediaPreview({
	items,
	onRemove,
	emptyMessage = "No evidence added yet.",
}: RentalConditionMediaPreviewProps) {
	if (items.length === 0) {
		return (
			<div className="rounded-2xl border border-dashed p-4">
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			</div>
		)
	}

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{items.map((item) => (
				<div key={item.assetId} className="overflow-hidden rounded-2xl border">
					<div className="relative aspect-[4/3] bg-muted">
						<MediaImage
							fill
							asset={{
								id: item.assetId,
								deliveryUrl: item.deliveryUrl,
								visibility: "private",
								blurDataUrl: item.blurDataUrl || null,
								originalFileName: item.label ?? "Condition evidence",
								contentType: inferContentType(item.deliveryUrl),
							}}
							alt={item.label ?? "Condition evidence"}
						/>
					</div>
					<div className="flex items-center justify-between gap-2 px-3 py-2">
						<p className="truncate text-sm font-medium">
							{item.label ?? "Uploaded evidence"}
						</p>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => {
								onRemove(item.assetId)
							}}
						>
							<Trash2 className="size-4" />
						</Button>
					</div>
				</div>
			))}
		</div>
	)
}
