export type MediaVisibility = "public" | "private"

export type MediaLink = {
	entityType: string
	entityId: string
	field: string
	sortOrder: number
}

export type MediaAsset = {
	id: string
	provider: string
	visibility: MediaVisibility
	status: string
	pathname: string
	url: string
	downloadUrl: string | null
	deliveryUrl: string
	originalFileName: string | null
	contentType: string | null
	sizeBytes: number | null
	width: number | null
	height: number | null
	blurDataUrl: string | null
	branchId: string | null
	metadata: Record<string, unknown>
	createdAt: string
	updatedAt: string
	link: MediaLink | null
}

export type MediaListResponse = {
	assets: MediaAsset[]
}
