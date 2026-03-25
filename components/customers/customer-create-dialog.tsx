"use client"

import { useEffect, useState } from "react"

import { ResponsiveFormDialog } from "@/components/customers/responsive-form-dialog"
import { Button } from "@/components/ui/button"
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { CUSTOMER_VERIFICATION_STATUSES } from "@/features/customers/constants"
import {
	type CreateCustomerFormValues,
	createCustomerFormSchema,
} from "@/features/customers/schemas/create-customer-form"
import type { CustomerBranchOption } from "@/features/customers/types"

type CustomerCreateDialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	branches: CustomerBranchOption[]
	onSubmit: (values: CreateCustomerFormValues) => Promise<void>
	isPending: boolean
	errorMessage: string | null
}

const emptyValues: CreateCustomerFormValues = {
	fullName: "",
	email: "",
	phone: "",
	branchId: "",
	verificationStatus: "pending",
	licenseNumber: "",
	idDocumentType: "",
	idDocumentNumber: "",
}

function formatVerificationStatus(status: string) {
	if (status === "in_review") {
		return "In review"
	}

	return status.charAt(0).toUpperCase() + status.slice(1)
}

export function CustomerCreateDialog({
	open,
	onOpenChange,
	branches,
	onSubmit,
	isPending,
	errorMessage,
}: CustomerCreateDialogProps) {
	const [values, setValues] = useState<CreateCustomerFormValues>(emptyValues)
	const [validationError, setValidationError] = useState<string | null>(null)

	useEffect(() => {
		if (!open) {
			setValues(emptyValues)
			setValidationError(null)
		}
	}, [open])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()

		const parsed = createCustomerFormSchema.safeParse(values)
		if (!parsed.success) {
			setValidationError(
				parsed.error.issues[0]?.message ?? "Invalid customer details.",
			)
			return
		}

		setValidationError(null)
		await onSubmit(parsed.data)
	}

	return (
		<ResponsiveFormDialog
			open={open}
			onOpenChange={onOpenChange}
			title="New customer"
			description="Create a fresh customer profile without the old page clutter."
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
						type="submit"
						form="customer-create-form"
						disabled={isPending}
					>
						{isPending ? "Creating..." : "Create customer"}
					</Button>
				</>
			}
		>
			<form id="customer-create-form" onSubmit={handleSubmit}>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="customer-create-full-name">
							Full name
						</FieldLabel>
						<Input
							id="customer-create-full-name"
							value={values.fullName}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									fullName: event.target.value,
								}))
							}
							className="h-11"
							placeholder="John Perera"
							disabled={isPending}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="customer-create-email">Email</FieldLabel>
						<Input
							id="customer-create-email"
							type="email"
							value={values.email}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									email: event.target.value,
								}))
							}
							className="h-11"
							placeholder="john@example.com"
							disabled={isPending}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="customer-create-phone">Phone</FieldLabel>
						<Input
							id="customer-create-phone"
							value={values.phone}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									phone: event.target.value,
								}))
							}
							className="h-11"
							placeholder="+61 4XX XXX XXX"
							disabled={isPending}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="customer-create-branch">Branch</FieldLabel>
						<Select
							value={values.branchId || "__none__"}
							onValueChange={(value) =>
								setValues((current) => ({
									...current,
									branchId: value === "__none__" ? "" : value,
								}))
							}
							disabled={isPending}
						>
							<SelectTrigger
								id="customer-create-branch"
								className="h-11 w-full"
							>
								<SelectValue placeholder="Select branch" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none__">Unassigned</SelectItem>
								{branches.map((branch) => (
									<SelectItem key={branch.id} value={branch.id}>
										{branch.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor="customer-create-verification-status">
							Verification status
						</FieldLabel>
						<Select
							value={values.verificationStatus}
							onValueChange={(value) =>
								setValues((current) => ({
									...current,
									verificationStatus:
										value as CreateCustomerFormValues["verificationStatus"],
								}))
							}
							disabled={isPending}
						>
							<SelectTrigger
								id="customer-create-verification-status"
								className="h-11 w-full"
							>
								<SelectValue placeholder="Select status" />
							</SelectTrigger>
							<SelectContent>
								{CUSTOMER_VERIFICATION_STATUSES.map((status) => (
									<SelectItem key={status} value={status}>
										{formatVerificationStatus(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor="customer-create-license-number">
							License number
						</FieldLabel>
						<Input
							id="customer-create-license-number"
							value={values.licenseNumber}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									licenseNumber: event.target.value,
								}))
							}
							className="h-11"
							placeholder="DL-102938"
							disabled={isPending}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="customer-create-id-document-type">
							ID document type
						</FieldLabel>
						<Input
							id="customer-create-id-document-type"
							value={values.idDocumentType}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									idDocumentType: event.target.value,
								}))
							}
							className="h-11"
							placeholder="Driver licence"
							disabled={isPending}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="customer-create-id-document-number">
							ID document number
						</FieldLabel>
						<Input
							id="customer-create-id-document-number"
							value={values.idDocumentNumber}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									idDocumentNumber: event.target.value,
								}))
							}
							className="h-11"
							placeholder="ABC123456"
							disabled={isPending}
						/>
					</Field>
				</FieldGroup>

				<FieldError className="mt-4">
					{validationError ?? errorMessage}
				</FieldError>
			</form>
		</ResponsiveFormDialog>
	)
}
