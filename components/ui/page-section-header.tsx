import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageSectionHeaderProps = {
	title: string
	description?: string
	actions?: ReactNode
	className?: string
}

export function PageSectionHeader({
	title,
	description,
	actions,
	className,
}: PageSectionHeaderProps) {
	return (
		<section className={cn(className)}>
			<div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-center lg:justify-between">
				<div className="space-y-1.5">
					<h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
						{title}
					</h1>
					{description ? (
						<p className="text-muted-foreground text-sm sm:text-base">
							{description}
						</p>
					) : null}
				</div>
				{actions ? (
					<div className="flex flex-wrap items-center gap-2">{actions}</div>
				) : null}
			</div>
		</section>
	)
}
