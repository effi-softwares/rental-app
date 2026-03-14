"use client"

import type * as React from "react"

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

type ResponsiveDrawerProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: string
	children: React.ReactNode
	desktopClassName?: string
	mobileClassName?: string
}

export function ResponsiveDrawer({
	open,
	onOpenChange,
	title,
	description,
	children,
	desktopClassName,
	mobileClassName,
}: ResponsiveDrawerProps) {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent
					side="bottom"
					className={
						mobileClassName ?? "max-h-[92vh] overflow-y-auto rounded-t-2xl p-0"
					}
				>
					<SheetHeader>
						<SheetTitle>{title}</SheetTitle>
						{description ? (
							<SheetDescription>{description}</SheetDescription>
						) : null}
					</SheetHeader>
					<div className="px-4 pb-4">{children}</div>
				</SheetContent>
			</Sheet>
		)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={
					desktopClassName ?? "max-h-[88vh] overflow-y-auto sm:max-w-2xl"
				}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? (
						<DialogDescription>{description}</DialogDescription>
					) : null}
				</DialogHeader>
				{children}
			</DialogContent>
		</Dialog>
	)
}
