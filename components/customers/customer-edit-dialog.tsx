"use client"

import { useEffect, useMemo, useState } from "react"

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
import type {
	CustomerBranchOption,
	CustomerDetail,
} from "@/features/customers/types"

export type CustomerEditSection =
	| "identity"
	| "contact"
	| "branch"
	| "verification"

type CustomerEditDialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	section: CustomerEditSection | null
	customer: CustomerDetail | null
	branches: CustomerBranchOption[]
	onSubmit: (payload: Record<string, unknown>) => Promise<void>
	isPending: boolean
	errorMessage: string | null
}

function formatVerificationStatus(status: string) {
	if (status === "in_review") {
		return "In review"
	}

	return status.charAt(0).toUpperCase() + status.slice(1)
}

function getDialogCopy(section: CustomerEditSection | null) {
	switch (section) {
		case "identity":
			return {
				title: "Edit identity",
				description:
					"Update the primary customer name used across the workspace.",
			}
		case "contact":
			return {
				title: "Edit contact",
				description: "Update the reachable contact details for this customer.",
			}
		case "branch":
			return {
				title: "Edit branch",
				description: "Choose which branch owns this customer profile.",
			}
		case "verification":
			return {
				title: "Edit verification",
				description:
					"Update verification status and supporting document fields.",
			}
		default:
			return {
				title: "Edit customer",
				description: "Update customer details.",
			}
	}
}

export function CustomerEditDialog({
	open,
	onOpenChange,
	section,
	customer,
	branches,
	onSubmit,
	isPending,
	errorMessage,
}: CustomerEditDialogProps) {
	const [fullName, setFullName] = useState("")
	const [email, setEmail] = useState("")
	const [phone, setPhone] = useState("")
	const [branchId, setBranchId] = useState("__none__")
	const [verificationStatus, setVerificationStatus] = useState("pending")
	const [licenseNumber, setLicenseNumber] = useState("")
	const [idDocumentType, setIdDocumentType] = useState("")
	const [idDocumentNumber, setIdDocumentNumber] = useState("")
	const [validationError, setValidationError] = useState<string | null>(null)

	const copy = useMemo(() => getDialogCopy(section), [section])

	useEffect(() => {
		if (!open || !customer) {
			setValidationError(null)
			return
		}

		const metadata = customer.verificationMetadata ?? {}
		setFullName(customer.fullName)
		setEmail(customer.email ?? "")
		setPhone(customer.phone ?? "")
		setBranchId(customer.branchId ?? "__none__")
		setVerificationStatus(customer.verificationStatus)
		setLicenseNumber(
			typeof metadata.licenseNumber === "string" ? metadata.licenseNumber : "",
		)
		setIdDocumentType(
			typeof metadata.idDocumentType === "string"
				? metadata.idDocumentType
				: "",
		)
		setIdDocumentNumber(
			typeof metadata.idDocumentNumber === "string"
				? metadata.idDocumentNumber
				: "",
		)
		setValidationError(null)
	}, [customer, open])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()

		if (!section) {
			return
		}

		let payload: Record<string, unknown>

		switch (section) {
			case "identity":
				if (!fullName.trim()) {
					setValidationError("Customer full name is required.")
					return
				}
				payload = { fullName: fullName.trim() }
				break
			case "contact":
				payload = {
					email: email.trim(),
					phone: phone.trim(),
				}
				break
			case "branch":
				payload = {
					branchId: branchId === "__none__" ? null : branchId,
				}
				break
			case "verification":
				payload = {
					verificationStatus,
					verificationMetadata: {
						licenseNumber: licenseNumber.trim(),
						idDocumentType: idDocumentType.trim(),
						idDocumentNumber: idDocumentNumber.trim(),
					},
				}
				break
			default:
				return
		}

		setValidationError(null)
		await onSubmit(payload)
	}

	return (
		<ResponsiveFormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={copy.title}
			description={copy.description}
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
					<Button type="submit" form="customer-edit-form" disabled={isPending}>
						{isPending ? "Saving..." : "Save changes"}
					</Button>
				</>
			}
		>
			<form id="customer-edit-form" onSubmit={handleSubmit}>
				<FieldGroup>
					{section === "identity" ? (
						<Field>
							<FieldLabel htmlFor="customer-edit-full-name">
								Full name
							</FieldLabel>
							<Input
								id="customer-edit-full-name"
								value={fullName}
								onChange={(event) => setFullName(event.target.value)}
								className="h-11"
								disabled={isPending}
							/>
						</Field>
					) : null}

					{section === "contact" ? (
						<>
							<Field>
								<FieldLabel htmlFor="customer-edit-email">Email</FieldLabel>
								<Input
									id="customer-edit-email"
									type="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									className="h-11"
									disabled={isPending}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="customer-edit-phone">Phone</FieldLabel>
								<Input
									id="customer-edit-phone"
									value={phone}
									onChange={(event) => setPhone(event.target.value)}
									className="h-11"
									disabled={isPending}
								/>
							</Field>
						</>
					) : null}

					{section === "branch" ? (
						<Field>
							<FieldLabel htmlFor="customer-edit-branch">Branch</FieldLabel>
							<Select
								value={branchId}
								onValueChange={setBranchId}
								disabled={isPending}
							>
								<SelectTrigger
									id="customer-edit-branch"
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
					) : null}

					{section === "verification" ? (
						<>
							<Field>
								<FieldLabel htmlFor="customer-edit-verification-status">
									Verification status
								</FieldLabel>
								<Select
									value={verificationStatus}
									onValueChange={setVerificationStatus}
									disabled={isPending}
								>
									<SelectTrigger
										id="customer-edit-verification-status"
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
								<FieldLabel htmlFor="customer-edit-license-number">
									License number
								</FieldLabel>
								<Input
									id="customer-edit-license-number"
									value={licenseNumber}
									onChange={(event) => setLicenseNumber(event.target.value)}
									className="h-11"
									disabled={isPending}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="customer-edit-id-document-type">
									ID document type
								</FieldLabel>
								<Input
									id="customer-edit-id-document-type"
									value={idDocumentType}
									onChange={(event) => setIdDocumentType(event.target.value)}
									className="h-11"
									disabled={isPending}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="customer-edit-id-document-number">
									ID document number
								</FieldLabel>
								<Input
									id="customer-edit-id-document-number"
									value={idDocumentNumber}
									onChange={(event) => setIdDocumentNumber(event.target.value)}
									className="h-11"
									disabled={isPending}
								/>
							</Field>
						</>
					) : null}
				</FieldGroup>

				<FieldError className="mt-4">
					{validationError ?? errorMessage}
				</FieldError>
			</form>
		</ResponsiveFormDialog>
	)
}
