import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StatePanelProps = {
	title: string
	description: string
	icon?: LucideIcon
	actions?: ReactNode
	variant?: "default" | "error"
	className?: string
}

export function StatePanel({
	title,
	description,
	icon: Icon,
	actions,
	variant = "default",
	className,
}: StatePanelProps) {
	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				{Icon ? (
					<div
						className={cn(
							"mb-2 inline-flex size-12 items-center justify-center rounded-xl",
							variant === "error"
								? "bg-destructive/10 text-destructive"
								: "bg-muted text-muted-foreground",
						)}
					>
						<Icon className="size-5" />
					</div>
				) : null}
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			{actions ? (
				<CardContent className="flex flex-wrap gap-2">{actions}</CardContent>
			) : null}
		</Card>
	)
}
