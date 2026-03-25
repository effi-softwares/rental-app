import { cn } from "@/lib/utils"

export type StatusTone =
	| "success"
	| "info"
	| "warning"
	| "danger"
	| "neutral"
	| "muted"

export function statusToneClassName(tone: StatusTone) {
	switch (tone) {
		case "success":
			return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
		case "info":
			return "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
		case "warning":
			return "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300"
		case "danger":
			return "border-destructive/30 bg-destructive/10 text-destructive"
		case "muted":
			return "border-border bg-muted text-muted-foreground"
		case "neutral":
			return "border-border bg-background text-muted-foreground"
	}
}

export function feedbackMessageClassName(
	tone: "success" | "info" | "warning" | "danger" | "neutral",
) {
	return cn("rounded-md border px-3 py-2 text-sm", statusToneClassName(tone))
}

export function statusTextClassName(
	tone: "success" | "info" | "warning" | "danger",
) {
	switch (tone) {
		case "success":
			return "text-emerald-700 dark:text-emerald-300"
		case "info":
			return "text-sky-700 dark:text-sky-300"
		case "warning":
			return "text-amber-800 dark:text-amber-300"
		case "danger":
			return "text-destructive"
	}
}

export const completedStepCardClassName =
	"border-emerald-500/25 bg-emerald-500/10 text-foreground"

export const completedStepIndicatorClassName =
	"border-emerald-500/40 bg-emerald-500 text-white shadow-sm"
