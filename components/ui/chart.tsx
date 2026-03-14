"use client"

import type * as React from "react"
import { createContext, forwardRef, useContext, useId } from "react"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
	string,
	{
		label?: React.ReactNode
		color?: string
	}
>

type ChartContextValue = {
	config: ChartConfig
}

const ChartContext = createContext<ChartContextValue | null>(null)

function useChart() {
	const context = useContext(ChartContext)

	if (!context) {
		throw new Error("useChart must be used inside a <ChartContainer />.")
	}

	return context
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
	const declarations = Object.entries(config)
		.map(([key, value]) =>
			value.color ? `--color-${key}: ${value.color};` : null,
		)
		.filter(Boolean)
		.join("")

	if (!declarations) {
		return null
	}

	return <style>{`[data-chart=${id}] { ${declarations} }`}</style>
}

const chartClassName =
	"flex aspect-[16/10] w-full justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/70 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector:focus]:outline-none [&_.recharts-tooltip-wrapper]:outline-none"

export const ChartContainer = forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> & {
		config: ChartConfig
	}
>(function ChartContainer({ className, children, config, ...props }, ref) {
	const id = useId().replace(/:/g, "")

	return (
		<ChartContext.Provider value={{ config }}>
			<div
				ref={ref}
				data-chart={id}
				className={cn(chartClassName, className)}
				{...props}
			>
				<ChartStyle id={id} config={config} />
				{children}
			</div>
		</ChartContext.Provider>
	)
})

export function ChartTooltipContent({
	active,
	payload,
	label,
	labelFormatter,
	hideLabel = false,
	className,
}: {
	active?: boolean
	payload?: Array<{
		dataKey?: string | number
		name?: React.ReactNode
		value?: number | string | null
		color?: string
	}>
	label?: React.ReactNode
	labelFormatter?: (value: React.ReactNode) => React.ReactNode
	hideLabel?: boolean
	className?: string
}) {
	const { config } = useChart()

	if (!active || !payload?.length) {
		return null
	}

	return (
		<div
			className={cn(
				"min-w-44 rounded-2xl border border-border/70 bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur",
				className,
			)}
		>
			{hideLabel ? null : (
				<p className="mb-2 text-xs font-medium text-foreground">
					{labelFormatter ? labelFormatter(label) : label}
				</p>
			)}
			<div className="space-y-2">
				{payload.map((item) => {
					const dataKey = String(item.dataKey ?? "")
					const itemConfig = config[dataKey]

					return (
						<div
							key={dataKey}
							className="flex items-center justify-between gap-3"
						>
							<div className="flex min-w-0 items-center gap-2">
								<span
									className="size-2.5 rounded-full"
									style={{
										backgroundColor:
											item.color ??
											itemConfig?.color ??
											`var(--color-${dataKey})`,
									}}
								/>
								<span className="truncate text-xs text-muted-foreground">
									{itemConfig?.label ?? item.name ?? dataKey}
								</span>
							</div>
							<span className="text-xs font-semibold text-foreground">
								{Number(item.value ?? 0)}
							</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}
