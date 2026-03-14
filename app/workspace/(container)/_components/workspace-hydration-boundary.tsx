"use client"

import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query"
import type { ReactNode } from "react"

type WorkspaceShellProviderProps = {
	children: ReactNode
	state: DehydratedState
}

export function WorkspaceHydrationBoundary({
	children,
	state,
}: WorkspaceShellProviderProps) {
	return <HydrationBoundary state={state}>{children}</HydrationBoundary>
}
