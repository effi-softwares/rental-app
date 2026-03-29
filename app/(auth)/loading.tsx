import { RefreshCw } from "lucide-react"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { AuthPanel } from "@/components/auth/auth-panel"

export default function AuthLoading() {
	return (
		<AuthPageShell
			title="Loading dashboard access"
			description="Fetching organization modules, permissions, fleet activity, customer data, and recent rental updates."
			visualVariant="status"
			contentWidth="sm"
		>
			<AuthPanel
				aria-live="polite"
				className="flex flex-col items-center justify-center text-center"
			>
				<div className="relative mx-auto flex h-40 w-40 items-center justify-center">
					<div className="border-primary/30 absolute size-40 rounded-full border border-dashed animate-spin" />
					<div
						className="border-chart-2/30 absolute size-24 rounded-full border animate-spin"
						style={{ animationDuration: "7s", animationDirection: "reverse" }}
					/>
					<div className="relative flex size-20 items-center justify-center">
						<RefreshCw className="text-primary size-9 animate-spin" />
					</div>
				</div>

				<p className="text-muted-foreground/70 mt-8 text-xs tracking-[0.16em] uppercase">
					Syncing live workspace data
				</p>
			</AuthPanel>
		</AuthPageShell>
	)
}
