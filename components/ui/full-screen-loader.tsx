import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

type FullScreenLoaderProps = {
	title?: string
	description?: string
	fullscreen?: boolean
}

export function FullScreenLoader({
	title = "Preparing your workspace",
	description = "Loading data and syncing your organization context...",
	fullscreen = true,
}: FullScreenLoaderProps) {
	return (
		<div
			className={cn(
				"relative flex items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6",
				fullscreen ? "min-h-screen" : "min-h-96 rounded-2xl border",
			)}
		>
			<div className="bg-primary/15 absolute -top-28 right-1/3 size-72 rounded-full blur-3xl" />
			<div className="bg-chart-2/20 absolute -bottom-28 left-1/4 size-80 rounded-full blur-3xl" />

			<div className="ring-foreground/10 bg-card/90 relative z-10 w-full max-w-lg rounded-2xl p-6 text-center shadow-sm ring-1 backdrop-blur-sm sm:p-8">
				<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
					<LoaderCircle className="size-7 animate-spin" />
				</div>

				<div className="mx-auto mb-6 max-w-xs">
					<svg
						viewBox="0 0 220 90"
						className="h-auto w-full"
						role="img"
						aria-label="Loading animation"
					>
						<rect
							x="10"
							y="28"
							width="200"
							height="34"
							rx="17"
							className="fill-muted"
						/>
						<circle cx="42" cy="45" r="12" className="fill-primary/25" />
						<circle cx="42" cy="45" r="8" className="fill-primary" />
						<rect
							x="70"
							y="40"
							width="110"
							height="10"
							rx="5"
							className="fill-primary/20"
						/>
						<circle
							cx="30"
							cy="45"
							r="3"
							className="fill-primary animate-pulse"
						/>
						<circle
							cx="190"
							cy="45"
							r="3"
							className="fill-primary animate-pulse"
							style={{ animationDelay: "150ms" }}
						/>
					</svg>
				</div>

				<h2 className="text-lg font-semibold tracking-tight sm:text-xl">
					{title}
				</h2>
				<p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm sm:text-base">
					{description}
				</p>
			</div>
		</div>
	)
}
