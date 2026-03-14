import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageContentShellProps = {
	children: ReactNode
	className?: string
}

export function PageContentShell({
	children,
	className,
}: PageContentShellProps) {
	return (
		<div className={cn("mx-auto w-full max-w-7xl space-y-4", className)}>
			{children}
		</div>
	)
}
