import type { HandleUploadBody } from "@vercel/blob/client"

export type StorageProvider = "vercel-blob" | "s3" | "uploadthing"
export type StorageVisibility = "public" | "private"
export type StorageBucket = "private" | "public"

export type StorageBody =
	| Blob
	| ArrayBuffer
	| ReadableStream<Uint8Array>
	| string

export type StoragePutInput = {
	pathname: string
	body: StorageBody
	bucket?: StorageBucket
	visibility: StorageVisibility
	contentType?: string
	addRandomSuffix?: boolean
	allowOverwrite?: boolean
	cacheControlMaxAge?: number
	multipart?: boolean
}

export type StoragePutResult = {
	pathname: string
	contentType: string
	contentDisposition: string
	url: string
	downloadUrl: string
	etag: string
}

export type StorageGetInput = {
	urlOrPathname: string
	bucket?: StorageBucket
	visibility: StorageVisibility
	ifNoneMatch?: string
}

export type StorageGetResult = {
	statusCode: number
	stream: ReadableStream<Uint8Array> | null
	headers: unknown
	blob: {
		url: string
		downloadUrl: string
		pathname: string
		contentType: string | null
		contentDisposition: string
		cacheControl: string
		etag: string
		size: number | null
		uploadedAt: Date
	}
}

export type StorageHeadInput = {
	urlOrPathname: string
	bucket?: StorageBucket
}

export type StorageHeadResult = {
	size: number
	uploadedAt: Date
	pathname: string
	contentType: string
	contentDisposition: string
	url: string
	downloadUrl: string
	cacheControl: string
	etag: string
}

export type StorageClientUploadTokenResult = {
	type: "blob.generate-client-token"
	clientToken: string
}

export type StorageClientUploadCompletedResult = {
	type: "blob.upload-completed"
	response: "ok"
}

export type StorageHandleClientUploadResult =
	| StorageClientUploadTokenResult
	| StorageClientUploadCompletedResult

export type StorageHandleClientUploadInput = {
	request: Request
	body: HandleUploadBody
	bucket?: StorageBucket
	onBeforeGenerateToken: (input: {
		pathname: string
		clientPayload: string | null
		multipart: boolean
	}) => Promise<{
		addRandomSuffix?: boolean
		allowedContentTypes?: string[]
		maximumSizeInBytes?: number
		allowOverwrite?: boolean
		cacheControlMaxAge?: number
		tokenPayload?: string
	}>
	onUploadCompleted: (input: {
		blob: StoragePutResult
		tokenPayload?: string | null
	}) => Promise<void>
}

export interface StorageAdapter {
	provider: StorageProvider
	put(input: StoragePutInput): Promise<StoragePutResult>
	delete(
		urlOrPathname: string | string[],
		options?: { bucket?: StorageBucket },
	): Promise<void>
	get(input: StorageGetInput): Promise<StorageGetResult | null>
	head(input: StorageHeadInput): Promise<StorageHeadResult>
	handleClientUpload?(
		input: StorageHandleClientUploadInput,
	): Promise<StorageHandleClientUploadResult>
}
