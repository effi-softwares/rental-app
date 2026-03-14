"use client"

import { XIcon } from "lucide-react"
import { Dialog as DrawerPrimitive } from "radix-ui"
import type * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Drawer({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
	return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
	return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
	return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
	return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
	return (
		<DrawerPrimitive.Overlay
			data-slot="drawer-overlay"
			className={cn(
				"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
				className,
			)}
			{...props}
		/>
	)
}

function DrawerContent({
	className,
	children,
	showCloseButton = true,
	fullHeight = false,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
	showCloseButton?: boolean
	fullHeight?: boolean
}) {
	return (
		<DrawerPortal>
			<DrawerOverlay />
			<DrawerPrimitive.Content
				data-slot="drawer-content"
				className={cn(
					"bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:slide-out-to-bottom-10 data-open:slide-in-from-bottom-10 fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-2xl border-t text-sm duration-200 ease-in-out",
					fullHeight && "inset-y-0 mt-0 h-dvh rounded-none border-0",
					className,
				)}
				{...props}
			>
				{!fullHeight ? (
					<div className="bg-muted mx-auto mt-3 h-1.5 w-14 shrink-0 rounded-full" />
				) : null}
				{showCloseButton && (
					<DrawerPrimitive.Close data-slot="drawer-close" asChild>
						<Button
							variant="ghost"
							className="absolute top-3 right-3"
							size="icon-sm"
						>
							<XIcon />
							<span className="sr-only">Close</span>
						</Button>
					</DrawerPrimitive.Close>
				)}
				{children}
			</DrawerPrimitive.Content>
		</DrawerPortal>
	)
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="drawer-header"
			className={cn("flex flex-col gap-1 p-4 text-left", className)}
			{...props}
		/>
	)
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="drawer-footer"
			className={cn("mt-auto flex flex-col gap-2 p-4", className)}
			{...props}
		/>
	)
}

function DrawerTitle({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
	return (
		<DrawerPrimitive.Title
			data-slot="drawer-title"
			className={cn("text-foreground font-medium", className)}
			{...props}
		/>
	)
}

function DrawerDescription({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
	return (
		<DrawerPrimitive.Description
			data-slot="drawer-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	)
}

export {
	Drawer,
	DrawerPortal,
	DrawerOverlay,
	DrawerTrigger,
	DrawerClose,
	DrawerContent,
	DrawerHeader,
	DrawerFooter,
	DrawerTitle,
	DrawerDescription,
}
