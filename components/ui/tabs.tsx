"use client"

import { Tabs as TabsPrimitive } from "radix-ui"
import type * as React from "react"

import { cn } from "@/lib/utils"

function Tabs({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root data-slot="tabs" className={className} {...props} />
	)
}

function TabsList({
	className,
	variant = "default",
	...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
	variant?: "default" | "line"
}) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			data-variant={variant}
			className={cn(
				"bg-muted text-muted-foreground inline-flex h-10 w-fit items-center justify-center rounded-lg p-1",
				"data-[variant=line]:bg-transparent data-[variant=line]:h-auto data-[variant=line]:w-full data-[variant=line]:justify-start data-[variant=line]:rounded-none data-[variant=line]:border-b data-[variant=line]:p-0",
				className,
			)}
			{...props}
		/>
	)
}

function TabsTrigger({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				"data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-3 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50",
				"data-[slot=tabs-list][data-variant=line]_&:rounded-none data-[slot=tabs-list][data-variant=line]_&:border-0 data-[slot=tabs-list][data-variant=line]_&:border-b-2 data-[slot=tabs-list][data-variant=line]_&:border-transparent data-[slot=tabs-list][data-variant=line]_&:bg-transparent data-[slot=tabs-list][data-variant=line]_&:py-2 data-[slot=tabs-list][data-variant=line]_&:text-muted-foreground data-[slot=tabs-list][data-variant=line]_&:data-[state=active]:border-primary data-[slot=tabs-list][data-variant=line]_&:data-[state=active]:text-foreground data-[slot=tabs-list][data-variant=line]_&:shadow-none",
				className,
			)}
			{...props}
		/>
	)
}

function TabsContent({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn("mt-5 outline-none", className)}
			{...props}
		/>
	)
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
