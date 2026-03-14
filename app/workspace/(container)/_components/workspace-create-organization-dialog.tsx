"use client"

import { Building2 } from "lucide-react"
import type { FormEvent, RefObject } from "react"

import {
	OrganizationLogoPicker,
	type OrganizationLogoPickerHandle,
} from "@/components/organizations/organization-logo-picker"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { toSlug } from "@/lib/utils"

type WorkspaceCreateOrganizationDialogProps = {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	newOrganizationName: string
	onNewOrganizationNameChange: (value: string) => void
	createOrganizationError: string | null
	onResetCreateOrganizationError: () => void
	isCreatingOrganization: boolean
	logoPickerRef: RefObject<OrganizationLogoPickerHandle | null>
	onCreateOrganization: (event: FormEvent<HTMLFormElement>) => void
}

export function WorkspaceCreateOrganizationDialog({
	isOpen,
	onOpenChange,
	newOrganizationName,
	onNewOrganizationNameChange,
	createOrganizationError,
	onResetCreateOrganizationError,
	isCreatingOrganization,
	logoPickerRef,
	onCreateOrganization,
}: WorkspaceCreateOrganizationDialogProps) {
	const isMobile = useIsMobile()

	const formContent = (
		<form onSubmit={onCreateOrganization}>
			<FieldGroup>
				<div className="rounded-lg border bg-muted/30 p-3">
					<p className="text-muted-foreground text-xs">
						Create and switch to a new organization workspace under your owner
						account.
					</p>
				</div>

				<Field>
					<FieldLabel htmlFor="newOrganizationName">
						Organization name
					</FieldLabel>
					<Input
						id="newOrganizationName"
						value={newOrganizationName}
						onChange={(event) =>
							onNewOrganizationNameChange(event.target.value)
						}
						placeholder="Acme Rentals"
						required
						className="h-11"
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor="newOrganizationSlug">Slug preview</FieldLabel>
					<Input
						id="newOrganizationSlug"
						value={toSlug(newOrganizationName) || "-"}
						readOnly
						className="text-muted-foreground h-11"
					/>
				</Field>

				<OrganizationLogoPicker
					ref={logoPickerRef}
					organizationName={newOrganizationName}
				/>

				{createOrganizationError ? (
					<p className="text-destructive text-sm">{createOrganizationError}</p>
				) : null}

				{isMobile ? (
					<SheetFooter className="border-t p-0 pt-4 sm:flex-row">
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								onOpenChange(false)
								onResetCreateOrganizationError()
							}}
							disabled={isCreatingOrganization}
							className="h-11"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isCreatingOrganization}
							className="h-11"
						>
							{isCreatingOrganization ? "Creating..." : "Create organization"}
						</Button>
					</SheetFooter>
				) : (
					<DialogFooter className="border-t pt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								onOpenChange(false)
								onResetCreateOrganizationError()
							}}
							disabled={isCreatingOrganization}
							className="h-11"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isCreatingOrganization}
							className="h-11"
						>
							{isCreatingOrganization ? "Creating..." : "Create organization"}
						</Button>
					</DialogFooter>
				)}
			</FieldGroup>
		</form>
	)

	if (isMobile) {
		return (
			<Sheet open={isOpen} onOpenChange={onOpenChange}>
				<SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
					<SheetHeader>
						<div className="bg-primary/10 text-primary mb-2 inline-flex size-10 items-center justify-center rounded-xl">
							<Building2 className="size-5" />
						</div>
						<SheetTitle>Create organization</SheetTitle>
						<SheetDescription>
							Add a new organization under your owner account.
						</SheetDescription>
					</SheetHeader>

					<div className="px-4 pb-4">{formContent}</div>
				</SheetContent>
			</Sheet>
		)
	}

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<div className="bg-primary/10 text-primary mb-2 inline-flex size-10 items-center justify-center rounded-xl">
						<Building2 className="size-5" />
					</div>
					<DialogTitle>Create organization</DialogTitle>
					<DialogDescription>
						Add a new organization under your owner account.
					</DialogDescription>
				</DialogHeader>

				{formContent}
			</DialogContent>
		</Dialog>
	)
}
