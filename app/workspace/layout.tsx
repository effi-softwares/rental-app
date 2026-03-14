import { dehydrate, QueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { mainQueryKeys } from "@/features/main/queries/keys"
import type { AuthContextResponse } from "@/features/main/types/auth-context"
import { requireWorkspaceContext } from "@/lib/authorization/server"
import { WorkspaceHeader } from "./(container)/_components/workspace-header"
import { WorkspaceHydrationBoundary } from "./(container)/_components/workspace-hydration-boundary"
import { WorkspaceLiveProvider } from "./(container)/_components/workspace-live-provider"
import { WorkspaceSidebar } from "./(container)/_components/workspace-sidebar"

type WorkspaceLayoutProps = {
	children: ReactNode
}

export default async function WorkspaceLayout({
	children,
}: WorkspaceLayoutProps) {
	const resolved = await requireWorkspaceContext()
	const queryClient = new QueryClient()

	queryClient.setQueryData<AuthContextResponse>(
		mainQueryKeys.authContext(),
		resolved,
	)

	return (
		<WorkspaceHydrationBoundary state={dehydrate(queryClient)}>
			<WorkspaceLiveProvider>
				<SidebarProvider>
					<WorkspaceSidebar />
					<SidebarInset>
						<WorkspaceHeader />
						{children}
					</SidebarInset>
				</SidebarProvider>
			</WorkspaceLiveProvider>
		</WorkspaceHydrationBoundary>
	)
}
