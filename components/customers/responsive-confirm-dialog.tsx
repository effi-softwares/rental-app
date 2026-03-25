"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { ResponsiveFormDialog } from "./responsive-form-dialog"

type ResponsiveConfirmDialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: ReactNode
	confirmLabel: string
	onConfirm: () => void | Promise<void>
	confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost"
	isPending?: boolean
	pendingLabel?: string
}

export function ResponsiveConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	onConfirm,
	confirmVariant = "default",
	isPending = false,
	pendingLabel = "Saving...",
}: ResponsiveConfirmDialogProps) {
	return (
		<ResponsiveFormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={typeof description === "string" ? description : undefined}
			footer={
				<>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant={confirmVariant}
						onClick={() => void onConfirm()}
						disabled={isPending}
					>
						{isPending ? pendingLabel : confirmLabel}
					</Button>
				</>
			}
			desktopClassName="sm:max-w-md"
		>
			{typeof description === "string" ? (
				<p className="text-muted-foreground text-sm">{description}</p>
			) : (
				description
			)}
		</ResponsiveFormDialog>
	)
}
