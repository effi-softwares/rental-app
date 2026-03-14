import { RefreshCw } from "lucide-react"

export default function AuthLoading() {
	return (
		<div
			aria-live="polite"
			className="relative flexitems-center justify-center overflow-hidden bg-linear-to-b from-background via-background to-muted/30 px-4 py-10 h-screen"
		>
			<div className="h-full text-center flex flex-col items-center justify-center">
				<div className="relative mx-auto mt-8 flex h-40 w-40 items-center justify-center">
					<div className="border-primary/30 absolute size-40 rounded-full border border-dashed animate-spin" />
					<div
						className="border-chart-2/30 absolute size-24 rounded-full border animate-spin"
						style={{ animationDuration: "7s", animationDirection: "reverse" }}
					/>
					<div className="relative flex size-20 items-center justify-center">
						<RefreshCw className="text-primary size-9 animate-spin" />
					</div>
				</div>

				<h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
					Loading dashboard
				</h1>
				<p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-6 sm:text-base">
					Fetching organization modules, permissions, fleet activity, customer
					data, and recent rental updates.
				</p>

				<p className="text-muted-foreground/70 mt-8 text-xs tracking-[0.16em] uppercase">
					Syncing live workspace data
				</p>
			</div>
		</div>
	)
}
