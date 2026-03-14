"use client"

import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useMemo, useState } from "react"

import { MediaImage } from "@/components/media/media-image"
import { MediaUploader } from "@/components/media/media-uploader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { customersQueryKeys } from "@/features/customers/queries/keys"
import {
	type CreateCustomerFormValues,
	CUSTOMER_VERIFICATION_STATUSES,
	createCustomerFormSchema,
} from "@/features/customers/schemas/create-customer-form"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { useDeleteMediaMutation, useMediaListQuery } from "@/features/media"
import { useIsMobile } from "@/hooks/use-mobile"
import { resolveErrorMessage } from "@/lib/errors"

type BranchRecord = {
	id: string
	name: string
	code: string
}

type CustomerRecord = {
	id: string
	fullName: string
	email: string | null
	phone: string | null
	branchId: string | null
	branchName: string | null
	verificationStatus: string
	verificationMetadata: Record<string, unknown>
	createdAt: string
}

type CustomerListResponse = {
	customers: CustomerRecord[]
	branches: BranchRecord[]
	canManageCustomers: boolean
	canManageCustomerNotes: boolean
}

type CustomerNoteRecord = {
	id: string
	body: string
	createdAt: string
	authorName: string | null
	authorEmail: string | null
}

type CustomerNotesResponse = {
	notes: CustomerNoteRecord[]
}

const defaultCreateFormValues: CreateCustomerFormValues = {
	fullName: "",
	email: "",
	phone: "",
	branchId: "",
	verificationStatus: "pending",
	licenseNumber: "",
	idDocumentType: "",
	idDocumentNumber: "",
}

export function CustomerManagement() {
	const queryClient = useQueryClient()
	const isMobile = useIsMobile()
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined

	const [formError, setFormError] = useState<string | null>(null)

	const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
		null,
	)
	const [isCustomerSheetOpen, setIsCustomerSheetOpen] = useState(false)
	const [customerDetailTab, setCustomerDetailTab] = useState<
		"overview" | "notes" | "media"
	>("overview")
	const [newNote, setNewNote] = useState("")
	const [notesError, setNotesError] = useState<string | null>(null)

	const customersQuery = useQuery({
		queryKey: customersQueryKeys.list(activeOrganizationId),
		enabled: Boolean(activeOrganizationId),
		queryFn: async () => {
			const response = await fetch("/api/customers", { method: "GET" })

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load customers.")
			}

			return (await response.json()) as CustomerListResponse
		},
	})

	const notesQuery = useQuery({
		queryKey: customersQueryKeys.notes(
			activeOrganizationId,
			selectedCustomerId,
		),
		enabled: Boolean(activeOrganizationId && selectedCustomerId),
		queryFn: async () => {
			const response = await fetch(
				`/api/customers/${selectedCustomerId}/notes`,
				{ method: "GET" },
			)

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to load customer notes.")
			}

			return (await response.json()) as CustomerNotesResponse
		},
	})

	const createCustomerMutation = useMutation({
		mutationFn: async (payload: {
			fullName: string
			email: string
			phone: string
			branchId: string
			verificationStatus: string
			verificationMetadata: Record<string, unknown>
		}) => {
			const response = await fetch("/api/customers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			})

			if (!response.ok) {
				const errorPayload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(errorPayload?.error ?? "Failed to create customer.")
			}
		},
		onSuccess: async () => {
			setFormError(null)
			await queryClient.invalidateQueries({
				queryKey: customersQueryKeys.list(activeOrganizationId),
			})
		},
		onError: (error) => {
			setFormError(resolveErrorMessage(error, "Failed to create customer."))
		},
	})

	const updateVerificationMutation = useMutation({
		mutationFn: async ({
			customerId,
			nextStatus,
			metadata,
		}: {
			customerId: string
			nextStatus: string
			metadata: Record<string, unknown>
		}) => {
			const response = await fetch(`/api/customers/${customerId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					verificationStatus: nextStatus,
					verificationMetadata: metadata,
				}),
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(
					payload?.error ?? "Failed to update verification status.",
				)
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: customersQueryKeys.list(activeOrganizationId),
			})
		},
	})

	const addNoteMutation = useMutation({
		mutationFn: async ({
			customerId,
			body,
		}: {
			customerId: string
			body: string
		}) => {
			const response = await fetch(`/api/customers/${customerId}/notes`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ body }),
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to add note.")
			}
		},
		onSuccess: async () => {
			setNewNote("")
			setNotesError(null)
			await queryClient.invalidateQueries({
				queryKey: customersQueryKeys.notes(
					activeOrganizationId,
					selectedCustomerId,
				),
			})
		},
		onError: (error) => {
			setNotesError(resolveErrorMessage(error, "Failed to add note."))
		},
	})

	const data = customersQuery.data
	const customers = useMemo(() => data?.customers ?? [], [data?.customers])
	const branches = data?.branches ?? []
	const selectedCustomer =
		customers.find((customer) => customer.id === selectedCustomerId) ?? null
	const notes = notesQuery.data?.notes ?? []

	const customerMediaQuery = useMediaListQuery({
		organizationId: activeOrganizationId,
		entityType: selectedCustomer ? "customer" : undefined,
		entityId: selectedCustomer?.id,
		field: "profile",
		enabled: Boolean(selectedCustomer),
	})

	const deleteMediaMutation = useDeleteMediaMutation()
	const customerMediaAssets = customerMediaQuery.data?.assets ?? []

	const canManageCustomers = Boolean(data?.canManageCustomers)
	const canManageCustomerNotes = Boolean(data?.canManageCustomerNotes)

	const customerCreateForm = useForm({
		defaultValues: defaultCreateFormValues,
		onSubmit: async ({ value }) => {
			if (!canManageCustomers) {
				setFormError("Your role cannot create customer profiles.")
				return
			}

			const parsed = createCustomerFormSchema.safeParse(value)
			if (!parsed.success) {
				const issue = parsed.error.issues[0]
				setFormError(resolveErrorMessage(issue, "Invalid customer details."))
				return
			}

			setFormError(null)

			await createCustomerMutation.mutateAsync({
				fullName: parsed.data.fullName,
				email: parsed.data.email,
				phone: parsed.data.phone,
				branchId: parsed.data.branchId,
				verificationStatus: parsed.data.verificationStatus,
				verificationMetadata: {
					licenseNumber: parsed.data.licenseNumber,
					idDocumentType: parsed.data.idDocumentType,
					idDocumentNumber: parsed.data.idDocumentNumber,
				},
			})

			customerCreateForm.reset(defaultCreateFormValues)
		},
	})

	const isLoading = customersQuery.isLoading
	const sortedCustomers = useMemo(() => customers, [customers])

	function formatVerificationStatus(status: string) {
		if (status === "in_review") {
			return "In review"
		}

		return status.charAt(0).toUpperCase() + status.slice(1)
	}

	async function onAddNote(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		if (!selectedCustomerId) {
			return
		}

		if (!canManageCustomerNotes) {
			setNotesError("Your role cannot add customer notes.")
			return
		}

		const body = newNote.trim()
		if (!body) {
			setNotesError("Note content is required.")
			return
		}

		await addNoteMutation.mutateAsync({
			customerId: selectedCustomerId,
			body,
		})
	}

	if (!activeOrganizationId) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Customer management</CardTitle>
					<CardDescription>
						Select an active organization first.
					</CardDescription>
				</CardHeader>
			</Card>
		)
	}

	const detailTabs = (
		<div className="grid grid-cols-3 gap-2 rounded-md border p-1">
			<Button
				type="button"
				variant={customerDetailTab === "overview" ? "default" : "ghost"}
				className="h-11"
				onClick={() => setCustomerDetailTab("overview")}
			>
				Overview
			</Button>
			<Button
				type="button"
				variant={customerDetailTab === "notes" ? "default" : "ghost"}
				className="h-11"
				onClick={() => setCustomerDetailTab("notes")}
			>
				Notes
			</Button>
			<Button
				type="button"
				variant={customerDetailTab === "media" ? "default" : "ghost"}
				className="h-11"
				onClick={() => setCustomerDetailTab("media")}
			>
				Media
			</Button>
		</div>
	)

	const customerDetailsContent = (
		<div className="space-y-4">
			{!selectedCustomer ? (
				<p className="text-muted-foreground text-sm">
					Select a customer from the list to continue.
				</p>
			) : null}

			{selectedCustomer ? (
				<>
					{detailTabs}

					{customerDetailTab === "overview" ? (
						<div className="space-y-3 rounded-md border p-3">
							<div className="flex items-center justify-between gap-3">
								<p className="text-sm font-medium">Verification status</p>
								<Badge variant="secondary">
									{formatVerificationStatus(
										selectedCustomer.verificationStatus,
									)}
								</Badge>
							</div>

							<Select
								value={selectedCustomer.verificationStatus}
								onValueChange={(value) =>
									updateVerificationMutation.mutate({
										customerId: selectedCustomer.id,
										nextStatus: value,
										metadata: selectedCustomer.verificationMetadata ?? {},
									})
								}
								disabled={
									!canManageCustomers || updateVerificationMutation.isPending
								}
							>
								<SelectTrigger className="h-11 w-full">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									{CUSTOMER_VERIFICATION_STATUSES.map((status) => (
										<SelectItem key={status} value={status}>
											{formatVerificationStatus(status)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<div className="grid gap-2 text-sm sm:grid-cols-2">
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">Email</p>
									<p className="mt-1 font-medium">
										{selectedCustomer.email ?? "-"}
									</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">Phone</p>
									<p className="mt-1 font-medium">
										{selectedCustomer.phone ?? "-"}
									</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">Branch</p>
									<p className="mt-1 font-medium">
										{selectedCustomer.branchName ?? "Unassigned"}
									</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">Created</p>
									<p className="mt-1 font-medium">
										{new Date(selectedCustomer.createdAt).toLocaleDateString()}
									</p>
								</div>
							</div>
						</div>
					) : null}

					{customerDetailTab === "notes" ? (
						<>
							<form onSubmit={onAddNote} className="space-y-2">
								<Textarea
									value={newNote}
									onChange={(event) => setNewNote(event.target.value)}
									placeholder="Add a note about documents, verification follow-up, or rental risk context..."
									disabled={!canManageCustomerNotes}
								/>

								{notesError ? (
									<p className="text-destructive text-sm">{notesError}</p>
								) : null}
								{!canManageCustomerNotes ? (
									<p className="text-muted-foreground text-sm">
										Your role is read-only for customer notes.
									</p>
								) : null}

								<Button
									type="submit"
									className="h-11"
									disabled={
										!canManageCustomerNotes || addNoteMutation.isPending
									}
								>
									{addNoteMutation.isPending ? "Saving note..." : "Add note"}
								</Button>
							</form>

							<div className="space-y-2">
								{notesQuery.isLoading ? (
									<p className="text-muted-foreground text-sm">
										Loading notes...
									</p>
								) : null}
								{!notesQuery.isLoading && notes.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										No notes recorded yet.
									</p>
								) : null}

								{notes.map((note) => (
									<div
										key={note.id}
										className="space-y-1 rounded-md border p-3"
									>
										<p className="text-sm">{note.body}</p>
										<p className="text-muted-foreground text-xs">
											{note.authorName ?? note.authorEmail ?? "Unknown"} •{" "}
											{new Date(note.createdAt).toLocaleString()}
										</p>
									</div>
								))}
							</div>
						</>
					) : null}

					{customerDetailTab === "media" ? (
						<div className="space-y-3 rounded-md border p-3">
							<div>
								<p className="text-sm font-medium">Customer media</p>
								<p className="text-muted-foreground text-xs">
									Upload and manage customer verification images.
								</p>
							</div>

							<MediaUploader
								entityType="customer"
								entityId={selectedCustomer.id}
								field="profile"
								branchId={selectedCustomer.branchId}
								visibility="private"
								multiple
							/>

							{customerMediaQuery.isLoading ? (
								<p className="text-muted-foreground text-sm">
									Loading media...
								</p>
							) : null}

							{customerMediaQuery.isError ? (
								<p className="text-destructive text-sm">
									{resolveErrorMessage(
										customerMediaQuery.error,
										"Failed to load media.",
									)}
								</p>
							) : null}

							{!customerMediaQuery.isLoading &&
							customerMediaAssets.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									No media uploaded yet.
								</p>
							) : null}

							{customerMediaAssets.length > 0 ? (
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{customerMediaAssets.map((asset) => (
										<div
											key={asset.id}
											className="space-y-2 rounded-md border p-2"
										>
											<div className="relative aspect-4/3 overflow-hidden rounded-md bg-muted">
												<MediaImage
													asset={asset}
													fill
													sizes="(max-width: 1024px) 50vw, 33vw"
												/>
											</div>
											<div className="space-y-1">
												<p className="truncate text-xs font-medium">
													{asset.originalFileName ?? "image"}
												</p>
												<p className="text-muted-foreground text-xs">
													{asset.sizeBytes
														? `${Math.round(asset.sizeBytes / 1024)} KB`
														: "-"}
												</p>
											</div>
											<Button
												type="button"
												variant="secondary"
												className="h-11 w-full"
												disabled={
													!canManageCustomers || deleteMediaMutation.isPending
												}
												onClick={() => {
													if (!activeOrganizationId) {
														return
													}

													deleteMediaMutation.mutate({
														mediaId: asset.id,
														organizationId: activeOrganizationId,
														entityType: "customer",
														entityId: selectedCustomer.id,
														field: "profile",
													})
												}}
											>
												Delete image
											</Button>
										</div>
									))}
								</div>
							) : null}
						</div>
					) : null}
				</>
			) : null}
		</div>
	)

	return (
		<div className="space-y-4">
			<PageSectionHeader
				title="Customer management"
				description="Create customer profiles, update verification status, and manage notes and media."
			/>

			<div className="grid gap-3 sm:grid-cols-3">
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs">Customers</p>
						<p className="mt-1 text-2xl font-semibold">
							{sortedCustomers.length}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs">Branches</p>
						<p className="mt-1 text-2xl font-semibold">{branches.length}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs">Verified</p>
						<p className="mt-1 text-2xl font-semibold">
							{
								sortedCustomers.filter(
									(customer) => customer.verificationStatus === "verified",
								).length
							}
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-1">
					<CardHeader>
						<CardTitle>Create customer profile</CardTitle>
						<CardDescription>
							Capture customer details and verification metadata.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							onSubmit={(event) => {
								event.preventDefault()
								void customerCreateForm.handleSubmit()
							}}
						>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="customer-full-name">
										Full name
									</FieldLabel>
									<customerCreateForm.Field name="fullName">
										{(field) => (
											<Input
												id="customer-full-name"
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
												onBlur={field.handleBlur}
												placeholder="John Perera"
												className="h-11"
												disabled={!canManageCustomers}
											/>
										)}
									</customerCreateForm.Field>
								</Field>

								<Field>
									<FieldLabel htmlFor="customer-email">Email</FieldLabel>
									<customerCreateForm.Field name="email">
										{(field) => (
											<Input
												id="customer-email"
												type="email"
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
												onBlur={field.handleBlur}
												placeholder="john@example.com"
												className="h-11"
												disabled={!canManageCustomers}
											/>
										)}
									</customerCreateForm.Field>
								</Field>

								<Field>
									<FieldLabel htmlFor="customer-phone">Phone</FieldLabel>
									<customerCreateForm.Field name="phone">
										{(field) => (
											<Input
												id="customer-phone"
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
												onBlur={field.handleBlur}
												placeholder="+94XXXXXXXXX"
												className="h-11"
												disabled={!canManageCustomers}
											/>
										)}
									</customerCreateForm.Field>
								</Field>

								<Field>
									<FieldLabel htmlFor="customer-branch">Branch</FieldLabel>
									<customerCreateForm.Field name="branchId">
										{(field) => (
											<Select
												value={field.state.value}
												onValueChange={(value) =>
													field.handleChange(
														value as CreateCustomerFormValues["verificationStatus"],
													)
												}
												disabled={!canManageCustomers}
											>
												<SelectTrigger
													id="customer-branch"
													className="h-11 w-full"
												>
													<SelectValue placeholder="Select branch" />
												</SelectTrigger>
												<SelectContent>
													{branches.map((branch) => (
														<SelectItem key={branch.id} value={branch.id}>
															{branch.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									</customerCreateForm.Field>
								</Field>

								<Field>
									<FieldLabel htmlFor="customer-verification-status">
										Verification status
									</FieldLabel>
									<customerCreateForm.Field name="verificationStatus">
										{(field) => (
											<Select
												value={field.state.value}
												onValueChange={(value) =>
													field.handleChange(
														value as CreateCustomerFormValues["verificationStatus"],
													)
												}
												disabled={!canManageCustomers}
											>
												<SelectTrigger
													id="customer-verification-status"
													className="h-11 w-full"
												>
													<SelectValue placeholder="Select status" />
												</SelectTrigger>
												<SelectContent>
													{CUSTOMER_VERIFICATION_STATUSES.map((status) => (
														<SelectItem key={status} value={status}>
															{status === "in_review"
																? "In review"
																: status.charAt(0).toUpperCase() +
																	status.slice(1)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									</customerCreateForm.Field>
								</Field>

								<Field>
									<FieldLabel htmlFor="customer-license-number">
										License number
									</FieldLabel>
									<customerCreateForm.Field name="licenseNumber">
										{(field) => (
											<Input
												id="customer-license-number"
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
												onBlur={field.handleBlur}
												className="h-11"
												disabled={!canManageCustomers}
											/>
										)}
									</customerCreateForm.Field>
								</Field>

								<Field>
									<FieldLabel htmlFor="customer-id-type">
										ID document type
									</FieldLabel>
									<customerCreateForm.Field name="idDocumentType">
										{(field) => (
											<Input
												id="customer-id-type"
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
												onBlur={field.handleBlur}
												className="h-11"
												disabled={!canManageCustomers}
											/>
										)}
									</customerCreateForm.Field>
								</Field>

								<Field>
									<FieldLabel htmlFor="customer-id-number">
										ID document number
									</FieldLabel>
									<customerCreateForm.Field name="idDocumentNumber">
										{(field) => (
											<Input
												id="customer-id-number"
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
												onBlur={field.handleBlur}
												className="h-11"
												disabled={!canManageCustomers}
											/>
										)}
									</customerCreateForm.Field>
								</Field>

								{formError ? (
									<p className="text-destructive text-sm">{formError}</p>
								) : null}
								{!canManageCustomers ? (
									<p className="text-muted-foreground text-sm">
										Your role is read-only for customer profile creation.
									</p>
								) : null}

								<Button
									type="submit"
									className="h-11 w-full"
									disabled={
										!canManageCustomers || createCustomerMutation.isPending
									}
								>
									{createCustomerMutation.isPending
										? "Creating customer..."
										: "Create customer"}
								</Button>
							</FieldGroup>
						</form>
					</CardContent>
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Customers</CardTitle>
						<CardDescription>
							Customer profiles and verification status by branch.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{isLoading ? (
							<p className="text-muted-foreground text-sm">
								Loading customers...
							</p>
						) : null}

						{!isLoading && sortedCustomers.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No customers found.
							</p>
						) : null}

						{sortedCustomers.map((customer) => {
							const metadata = customer.verificationMetadata ?? {}

							return (
								<div
									key={customer.id}
									className="space-y-3 rounded-md border p-3"
								>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<p className="text-sm font-medium">{customer.fullName}</p>
											<p className="text-muted-foreground text-xs">
												{customer.email ?? customer.phone ?? "-"}
											</p>
											<p className="text-muted-foreground text-xs">
												Branch: {customer.branchName ?? "Unassigned"}
											</p>
										</div>
										<Badge variant="secondary">
											{formatVerificationStatus(customer.verificationStatus)}
										</Badge>
									</div>

									<div className="text-muted-foreground grid gap-1 text-xs">
										<p>License: {String(metadata.licenseNumber ?? "-")}</p>
										<p>
											ID: {String(metadata.idDocumentType ?? "-")} /{" "}
											{String(metadata.idDocumentNumber ?? "-")}
										</p>
									</div>

									<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
										<div className="w-full md:w-44">
											<Select
												value={customer.verificationStatus}
												onValueChange={(value) =>
													updateVerificationMutation.mutate({
														customerId: customer.id,
														nextStatus: value,
														metadata,
													})
												}
												disabled={
													!canManageCustomers ||
													updateVerificationMutation.isPending
												}
											>
												<SelectTrigger className="h-11 w-full">
													<SelectValue placeholder="Status" />
												</SelectTrigger>
												<SelectContent>
													{CUSTOMER_VERIFICATION_STATUSES.map((status) => (
														<SelectItem key={status} value={status}>
															{formatVerificationStatus(status)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<Button
											variant="outline"
											className="h-11"
											onClick={() => {
												setSelectedCustomerId(customer.id)
												setNotesError(null)
												setCustomerDetailTab("overview")
												setIsCustomerSheetOpen(true)
											}}
										>
											Manage details
										</Button>
									</div>
								</div>
							)
						})}
					</CardContent>
				</Card>
			</div>

			{isMobile ? (
				<Sheet
					open={isCustomerSheetOpen}
					onOpenChange={(open) => {
						setIsCustomerSheetOpen(open)
						if (!open) {
							setSelectedCustomerId(null)
							setNotesError(null)
							setCustomerDetailTab("overview")
						}
					}}
				>
					<SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
						<SheetHeader>
							<SheetTitle>
								{selectedCustomer
									? `Manage ${selectedCustomer.fullName}`
									: "Customer details"}
							</SheetTitle>
							<SheetDescription>
								Manage profile overview, notes, and verification media.
							</SheetDescription>
						</SheetHeader>

						<div className="p-4 pt-0">{customerDetailsContent}</div>
					</SheetContent>
				</Sheet>
			) : (
				<Dialog
					open={isCustomerSheetOpen}
					onOpenChange={(open) => {
						setIsCustomerSheetOpen(open)
						if (!open) {
							setSelectedCustomerId(null)
							setNotesError(null)
							setCustomerDetailTab("overview")
						}
					}}
				>
					<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
						<DialogHeader>
							<DialogTitle>
								{selectedCustomer
									? `Manage ${selectedCustomer.fullName}`
									: "Customer details"}
							</DialogTitle>
							<DialogDescription>
								Manage profile overview, notes, and verification media.
							</DialogDescription>
						</DialogHeader>

						{customerDetailsContent}
					</DialogContent>
				</Dialog>
			)}
		</div>
	)
}
