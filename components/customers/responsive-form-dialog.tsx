"use client"

import type { ReactNode } from "react"

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

type ResponsiveFormDialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: string
	children: ReactNode
	footer?: ReactNode
	desktopClassName?: string
	mobileClassName?: string
}

export function ResponsiveFormDialog({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer,
	desktopClassName,
	mobileClassName,
}: ResponsiveFormDialogProps) {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={onOpenChange}>
				<DrawerContent
					className={cn(
						"max-h-[92vh] overflow-hidden rounded-t-2xl",
						mobileClassName,
					)}
				>
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
						{description ? (
							<DrawerDescription>{description}</DrawerDescription>
						) : null}
					</DrawerHeader>
					<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
						{children}
					</div>
					{footer ? <DrawerFooter>{footer}</DrawerFooter> : null}
				</DrawerContent>
			</Drawer>
		)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					"max-h-[88vh] overflow-y-auto sm:max-w-xl",
					desktopClassName,
				)}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? (
						<DialogDescription>{description}</DialogDescription>
					) : null}
				</DialogHeader>
				{children}
				{footer ? <DialogFooter>{footer}</DialogFooter> : null}
			</DialogContent>
		</Dialog>
	)
}
