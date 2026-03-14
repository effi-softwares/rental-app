import type { StorageBucket, StorageVisibility } from "@/lib/storage"

export const DEFAULT_MEDIA_STORAGE_BUCKET: StorageBucket = "private"

export function getMediaStorageBucketFromMetadata(input: {
	metadata: Record<string, unknown> | null | undefined
	visibility?: StorageVisibility | null
}): StorageBucket {
	const configured = input.metadata?.storageBucket

	if (configured === "private" || configured === "public") {
		return configured
	}

	if (input.visibility === "public") {
		return "public"
	}

	return DEFAULT_MEDIA_STORAGE_BUCKET
}

export function mergeMediaStorageBucketMetadata(input: {
	metadata: Record<string, unknown> | null | undefined
	storageBucket: StorageBucket
}): Record<string, unknown> {
	return {
		...(input.metadata ?? {}),
		storageBucket: input.storageBucket,
	}
}
