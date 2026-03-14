import { useQuery } from "@tanstack/react-query"

import { getAuthContextQueryOptions } from "./auth-context"

export function useAuthContextQuery() {
	return useQuery(getAuthContextQueryOptions())
}
