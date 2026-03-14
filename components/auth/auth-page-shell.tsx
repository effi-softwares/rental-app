import { Building2, Sparkles } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type AuthPageShellProps = {
	title: string
	description: string
	children: ReactNode
	className?: string
}

export function AuthPageShell({
	title,
	description,
	children,
	className,
}: AuthPageShellProps) {
	return (
		<main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-10">
			<div className="mx-auto grid w-full max-w-6xl gap-6 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1.1fr_1fr]">
				<section className="bg-muted/30 ring-foreground/10 relative hidden overflow-hidden rounded-2xl p-8 ring-1 lg:flex lg:flex-col lg:justify-between">
					<div className="space-y-5">
						<div className="bg-primary/10 text-primary inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium">
							<Building2 className="size-4" />
							Rental Ops Dashboard
						</div>
						<div className="max-w-md space-y-3">
							<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
							<p className="text-muted-foreground text-base">{description}</p>
						</div>
					</div>

					<div className="bg-background/80 ring-foreground/10 flex items-start gap-3 rounded-xl p-4 ring-1 backdrop-blur-sm">
						<div className="bg-primary/10 text-primary mt-0.5 inline-flex size-9 items-center justify-center rounded-lg">
							<Sparkles className="size-4" />
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium">Touch-first workspace</p>
							<p className="text-muted-foreground text-sm">
								Built for quick actions on tablet and mobile without dense UI.
							</p>
						</div>
					</div>

					<div className="bg-primary/15 absolute -right-20 -top-20 size-56 rounded-full blur-3xl" />
					<div className="bg-chart-1/15 absolute -bottom-24 -left-16 size-64 rounded-full blur-3xl" />
				</section>

				<section
					className={cn(
						"flex items-center justify-center rounded-2xl border border-border/60 bg-background p-2 sm:p-4",
						className,
					)}
				>
					<div className="w-full max-w-xl">{children}</div>
				</section>
			</div>
		</main>
	)
}
