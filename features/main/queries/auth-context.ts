import { queryOptions } from "@tanstack/react-query"

import type { AuthContextResponse } from "../types/auth-context"
import { mainQueryKeys } from "./keys"

export async function fetchAuthContext() {
	const response = await fetch("/api/auth-context")
	const payload = (await response.json().catch(() => null)) as
		| (AuthContextResponse & { error?: string })
		| null

	if (!response.ok) {
		throw new Error(payload?.error ?? "Failed to load auth context.")
	}

	return payload as AuthContextResponse
}

export function getAuthContextQueryOptions() {
	return queryOptions({
		queryKey: mainQueryKeys.authContext(),
		queryFn: fetchAuthContext,
	})
}
