"use client"

import type { ReactNode } from "react"

import type { VehicleStatus } from "@/features/vehicles"
import type { FleetTelemetryStatus } from "@/lib/fleet/live"
import { cn } from "@/lib/utils"

type FleetPillProps = {
	children: ReactNode
	className?: string
}

function FleetPill({ children, className }: FleetPillProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] uppercase",
				className,
			)}
		>
			{children}
		</span>
	)
}

export function FleetTelemetryPill({
	status,
	className,
}: {
	status: FleetTelemetryStatus
	className?: string
}) {
	const styles: Record<FleetTelemetryStatus, string> = {
		moving:
			"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
		parked:
			"border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
		offline:
			"border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
		no_data: "border-muted-foreground/20 bg-muted text-muted-foreground",
	}

	return (
		<FleetPill className={cn(styles[status], className)}>
			<span
				className={cn("size-1.5 rounded-full", {
					"bg-emerald-500": status === "moving",
					"bg-amber-500": status === "parked",
					"bg-slate-500": status === "offline",
					"bg-muted-foreground/60": status === "no_data",
				})}
			/>
			{status.replaceAll("_", " ")}
		</FleetPill>
	)
}

export function FleetRentalPill({
	isRentedNow,
	className,
}: {
	isRentedNow: boolean
	className?: string
}) {
	return isRentedNow ? (
		<FleetPill
			className={cn(
				"border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
				className,
			)}
		>
			On rent
		</FleetPill>
	) : (
		<FleetPill
			className={cn(
				"border-border bg-background text-muted-foreground",
				className,
			)}
		>
			Idle
		</FleetPill>
	)
}

export function FleetOperationalPill({
	status,
	className,
}: {
	status: VehicleStatus
	className?: string
}) {
	const styles: Record<VehicleStatus, string> = {
		Available:
			"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
		Rented: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
		Maintenance:
			"border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
		Retired:
			"border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
	}

	return (
		<FleetPill className={cn(styles[status], className)}>{status}</FleetPill>
	)
}
