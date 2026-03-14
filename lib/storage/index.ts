import type { StorageAdapter, StorageProvider } from "./types"
import { VercelBlobAdapter } from "./vercel-blob-adapter"

const adapters: Record<StorageProvider, StorageAdapter | null> = {
	"vercel-blob": new VercelBlobAdapter(),
	s3: null,
	uploadthing: null,
}

export function getStorageAdapter(): StorageAdapter {
	const adapter =
		adapters[process.env.MEDIA_STORAGE_PROVIDER as StorageProvider]
	if (!adapter)
		throw new Error(
			`Storage provider "${process.env.MEDIA_STORAGE_PROVIDER}" is not configured in this environment.`,
		)

	return adapter
}

export type * from "./types"
