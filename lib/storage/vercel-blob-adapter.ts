import { del, get, head, put } from "@vercel/blob"
import {
	type HandleUploadBody,
	type HandleUploadOptions,
	handleUpload,
} from "@vercel/blob/client"

import type {
	StorageAdapter,
	StorageBucket,
	StorageGetInput,
	StorageGetResult,
	StorageHandleClientUploadInput,
	StorageHandleClientUploadResult,
	StorageHeadInput,
	StorageHeadResult,
	StoragePutInput,
	StoragePutResult,
} from "./types"

export class VercelBlobAdapter implements StorageAdapter {
	readonly provider = "vercel-blob" as const

	private resolveToken(bucket: StorageBucket = "private"): string {
		const fallbackToken = process.env.BLOB_READ_WRITE_TOKEN

		if (bucket === "public") {
			return process.env.PUBLIC_BLOB_READ_WRITE_TOKEN ?? fallbackToken ?? ""
		}

		return process.env.PRIVATE_BLOB_READ_WRITE_TOKEN ?? fallbackToken ?? ""
	}

	private requireToken(bucket: StorageBucket = "private"): string {
		const token = this.resolveToken(bucket)

		if (!token) {
			throw new Error(
				`Missing blob token for ${bucket} bucket. Set ${
					bucket === "public"
						? "PUBLIC_BLOB_READ_WRITE_TOKEN"
						: "PRIVATE_BLOB_READ_WRITE_TOKEN"
				}, or fallback BLOB_READ_WRITE_TOKEN.`,
			)
		}

		return token
	}

	async put(input: StoragePutInput): Promise<StoragePutResult> {
		const token = this.requireToken(input.bucket)

		return put(input.pathname, input.body, {
			token,
			access: input.visibility,
			contentType: input.contentType,
			addRandomSuffix: input.addRandomSuffix ?? true,
			allowOverwrite: input.allowOverwrite,
			cacheControlMaxAge: input.cacheControlMaxAge,
			multipart: input.multipart,
		})
	}

	async delete(
		urlOrPathname: string | string[],
		options?: { bucket?: StorageBucket },
	): Promise<void> {
		const token = this.requireToken(options?.bucket)
		await del(urlOrPathname, { token })
	}

	async get(input: StorageGetInput): Promise<StorageGetResult | null> {
		const token = this.requireToken(input.bucket)

		return get(input.urlOrPathname, {
			token,
			access: input.visibility,
			ifNoneMatch: input.ifNoneMatch,
		})
	}

	async head(input: StorageHeadInput): Promise<StorageHeadResult> {
		const token = this.requireToken(input.bucket)
		return head(input.urlOrPathname, { token })
	}

	async handleClientUpload(
		input: StorageHandleClientUploadInput,
	): Promise<StorageHandleClientUploadResult> {
		const token = this.requireToken(input.bucket)
		const body = input.body as HandleUploadBody
		const options: HandleUploadOptions = {
			token,
			request: input.request,
			body,
			onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
				return input.onBeforeGenerateToken({
					pathname,
					clientPayload: clientPayload ?? null,
					multipart,
				})
			},
			onUploadCompleted: async ({ blob, tokenPayload }) => {
				await input.onUploadCompleted({
					blob,
					tokenPayload: tokenPayload ?? null,
				})
			},
		}

		return handleUpload(options)
	}
}
