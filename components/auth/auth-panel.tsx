import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type AuthPanelProps = React.ComponentProps<"div">

export function AuthPanel({ className, ...props }: AuthPanelProps) {
	return <div className={cn("p-0 sm:p-0", className)} {...props} />
}

type AuthInlineMessageProps = {
	children: ReactNode
	variant?: "default" | "success" | "destructive"
	className?: string
}

export function AuthInlineMessage({
	children,
	variant = "default",
	className,
}: AuthInlineMessageProps) {
	return (
		<div
			className={cn(
				"rounded-2xl border px-4 py-3 text-sm",
				variant === "default" &&
					"border-border/70 bg-muted/50 text-muted-foreground",
				variant === "success" &&
					"border-primary/20 bg-primary/10 text-foreground",
				variant === "destructive" &&
					"border-destructive/20 bg-destructive/10 text-destructive",
				className,
			)}
		>
			{children}
		</div>
	)
}

type AuthMetaGridProps = {
	items: Array<{
		label: string
		value: string
	}>
	className?: string
}

export function AuthMetaGrid({ items, className }: AuthMetaGridProps) {
	return (
		<div className={cn("grid gap-3 sm:grid-cols-2", className)}>
			{items.map((item) => (
				<div
					key={`${item.label}-${item.value}`}
					className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-3"
				>
					<p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
						{item.label}
					</p>
					<p className="mt-2 text-sm font-medium text-foreground">
						{item.value}
					</p>
				</div>
			))}
		</div>
	)
}
