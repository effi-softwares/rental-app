import { Building2 } from "lucide-react"

import { cn } from "@/lib/utils"

type AuthBrandProps = {
	className?: string
}

export function AuthBrand({ className }: AuthBrandProps) {
	return (
		<div className={cn("flex items-center gap-3", className)}>
			<div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
				<Building2 className="size-5" />
			</div>
			<div className="space-y-0.5">
				<p className="text-sm font-semibold tracking-[0.22em] text-muted-foreground uppercase">
					Rental Ops
				</p>
				<p className="text-base font-semibold tracking-tight text-foreground">
					Command Center
				</p>
			</div>
		</div>
	)
}
