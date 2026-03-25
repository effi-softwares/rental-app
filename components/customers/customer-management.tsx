"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Search } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
	Suspense,
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react"
import { toast } from "sonner"

import { CustomerCreateDialog } from "@/components/customers/customer-create-dialog"
import { CustomerDetailsDrawer } from "@/components/customers/customer-details-drawer"
import {
	CustomerEditDialog,
	type CustomerEditSection,
} from "@/components/customers/customer-edit-dialog"
import { CustomerTable } from "@/components/customers/customer-table"
import { ResponsiveConfirmDialog } from "@/components/customers/responsive-confirm-dialog"
import { Input } from "@/components/ui/input"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group"
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
import { Separator } from "@/components/ui/separator"
import {
	AppWheelPicker,
	type WheelPickerOption,
} from "@/components/ui/wheel-picker"
import {
	CUSTOMER_STATUSES,
	CUSTOMER_VERIFICATION_STATUSES,
} from "@/features/customers/constants"
import { customersQueryKeys } from "@/features/customers/queries/keys"
import { useCustomerDetailQuery } from "@/features/customers/queries/use-customer-detail-query"
import { useCustomerListQuery } from "@/features/customers/queries/use-customer-list-query"
import type { CustomerListRow } from "@/features/customers/types"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { resolveErrorMessage } from "@/lib/errors"

const pageSizeOptions = ["10", "25", "50", "100"] as const
type WheelFilterOption = {
	value: string
	label: string
}

function parsePositiveInt(value: string | null, fallback: number) {
	const parsed = Number(value)
	if (!Number.isFinite(parsed) || parsed < 1) {
		return fallback
	}

	return Math.floor(parsed)
}

function formatVerificationStatus(status: string) {
	if (status === "in_review") {
		return "In review"
	}

	return status.charAt(0).toUpperCase() + status.slice(1)
}

function SummaryMetric({
	label,
	value,
	description,
}: {
	label: string
	value: number
	description: string
}) {
	return (
		<div className="rounded-2xl border px-4 py-4">
			<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
				{label}
			</p>
			<p className="mt-3 text-2xl font-semibold">{value}</p>
			<p className="text-muted-foreground mt-1 text-sm">{description}</p>
		</div>
	)
}

function CustomerSearchInput({
	initialValue,
	onCommit,
}: {
	initialValue: string
	onCommit: (value: string) => void
}) {
	const [value, setValue] = useState(initialValue)
	const debouncedValue = useDebouncedValue(value, 300)

	useEffect(() => {
		if (debouncedValue !== initialValue) {
			onCommit(debouncedValue)
		}
	}, [debouncedValue, initialValue, onCommit])

	return (
		<div className="relative">
			<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input
				value={value}
				onChange={(event) => setValue(event.target.value)}
				className="h-11 pl-9"
				placeholder="Search by customer, email, or phone"
			/>
		</div>
	)
}

function WheelFilterField({
	value,
	options,
	placeholder,
	title,
	description,
	onValueChange,
}: {
	value: string
	options: WheelFilterOption[]
	placeholder: string
	title: string
	description: string
	onValueChange: (value: string) => void
}) {
	const [open, setOpen] = useState(false)
	const wheelOptions = options as WheelPickerOption<string>[]
	const safeValue =
		options.find((option) => option.value === value)?.value ??
		options[0]?.value ??
		""
	const selectedOption =
		options.find((option) => option.value === safeValue) ?? options[0] ?? null
	const [pendingValue, setPendingValue] = useState(safeValue)

	useEffect(() => {
		if (!open) {
			setPendingValue(safeValue)
		}
	}, [open, safeValue])

	return (
		<>
			<InputGroup className="h-11">
				<InputGroupInput
					readOnly
					value={selectedOption?.label ?? ""}
					placeholder={placeholder}
					onClick={() => setOpen(true)}
					className="h-full cursor-pointer"
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton size="icon-sm" onClick={() => setOpen(true)}>
						<ChevronDown className="size-4" />
						<span className="sr-only">Open selector</span>
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>

			<ResponsiveDrawer
				open={open}
				onOpenChange={setOpen}
				title={title}
				description={description}
				desktopClassName="max-h-[88vh] overflow-hidden sm:max-w-sm"
				mobileClassName="max-h-[88vh] rounded-t-3xl p-0"
			>
				<div className="space-y-4 pt-1">
					<AppWheelPicker
						value={pendingValue}
						onValueChange={setPendingValue}
						options={wheelOptions}
						visibleCount={14}
						optionItemHeight={42}
						className="rounded-3xl p-4"
					/>
					<button
						type="button"
						className="bg-primary text-primary-foreground h-12 w-full rounded-2xl px-4 text-sm font-medium"
						onClick={() => {
							onValueChange(pendingValue)
							setOpen(false)
						}}
					>
						Apply
					</button>
				</div>
			</ResponsiveDrawer>
		</>
	)
}

function CustomerManagementContent() {
	const queryClient = useQueryClient()
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined

	const page = parsePositiveInt(searchParams.get("page"), 1)
	const pageSize = parsePositiveInt(searchParams.get("pageSize"), 25)
	const search = searchParams.get("search")?.trim() ?? ""
	const branchId = searchParams.get("branchId")?.trim() ?? ""
	const verificationStatus =
		searchParams.get("verificationStatus")?.trim() ?? ""
	const status = searchParams.get("status")?.trim() ?? "all"
	const selectedCustomerId = searchParams.get("customer")?.trim() ?? null

	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editSection, setEditSection] = useState<CustomerEditSection | null>(
		null,
	)
	const [statusTarget, setStatusTarget] = useState<CustomerListRow | null>(null)
	const [deleteTarget, setDeleteTarget] = useState<CustomerListRow | null>(null)
	const [createError, setCreateError] = useState<string | null>(null)
	const [editError, setEditError] = useState<string | null>(null)

	const updateUrl = useCallback(
		(mutator: (params: URLSearchParams) => void) => {
			const params = new URLSearchParams(searchParams.toString())
			mutator(params)
			const query = params.toString()
			startTransition(() => {
				router.replace(query ? `${pathname}?${query}` : pathname, {
					scroll: false,
				})
			})
		},
		[pathname, router, searchParams],
	)

	const listQuery = useCustomerListQuery({
		organizationId: activeOrganizationId,
		page,
		pageSize,
		search,
		branchId,
		verificationStatus,
		status,
	})

	const detailQuery = useCustomerDetailQuery({
		organizationId: activeOrganizationId,
		customerId: selectedCustomerId,
	})

	const branches = listQuery.data?.meta.branches ?? []
	const canManageCustomers = Boolean(listQuery.data?.meta.canManageCustomers)
	const summary = listQuery.data?.meta.summary ?? {
		total: 0,
		active: 0,
		banned: 0,
		verified: 0,
	}

	const selectedCustomer = detailQuery.data?.customer ?? null

	async function invalidateCustomerQueries() {
		await queryClient.invalidateQueries({
			queryKey: customersQueryKeys.all,
		})
	}

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
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to create customer.")
			}

			return (await response.json()) as { id: string }
		},
		onSuccess: async (result) => {
			setCreateError(null)
			setIsCreateOpen(false)
			await invalidateCustomerQueries()
			toast.success("Customer created.")
			updateUrl((params) => {
				params.set("customer", result.id)
			})
		},
		onError: (error) => {
			setCreateError(resolveErrorMessage(error, "Failed to create customer."))
		},
	})

	const editCustomerMutation = useMutation({
		mutationFn: async (payload: Record<string, unknown>) => {
			if (!selectedCustomerId) {
				throw new Error("Select a customer first.")
			}

			const response = await fetch(`/api/customers/${selectedCustomerId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to update customer.")
			}
		},
		onSuccess: async () => {
			setEditError(null)
			setEditSection(null)
			await invalidateCustomerQueries()
			toast.success("Customer updated.")
		},
		onError: (error) => {
			setEditError(resolveErrorMessage(error, "Failed to update customer."))
		},
	})

	const statusMutation = useMutation({
		mutationFn: async (target: CustomerListRow) => {
			const response = await fetch(`/api/customers/${target.id}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					status: target.status === "banned" ? "active" : "banned",
				}),
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to update customer status.")
			}
		},
		onSuccess: async (_, target) => {
			setStatusTarget(null)
			await invalidateCustomerQueries()
			toast.success(
				target.status === "banned" ? "Customer unbanned." : "Customer banned.",
			)
		},
		onError: (error) => {
			toast.error(
				resolveErrorMessage(error, "Failed to update customer status."),
			)
		},
	})

	const deleteMutation = useMutation({
		mutationFn: async (target: CustomerListRow) => {
			const response = await fetch(`/api/customers/${target.id}`, {
				method: "DELETE",
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
				} | null
				throw new Error(payload?.error ?? "Failed to delete customer.")
			}
		},
		onSuccess: async (_, target) => {
			setDeleteTarget(null)
			await invalidateCustomerQueries()
			toast.success("Customer deleted.")

			if (selectedCustomerId === target.id) {
				updateUrl((params) => {
					params.delete("customer")
				})
			}
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error, "Failed to delete customer."))
		},
	})

	const listErrorMessage = listQuery.isError
		? resolveErrorMessage(listQuery.error, "Failed to load customers.")
		: null
	const detailErrorMessage = detailQuery.isError
		? resolveErrorMessage(detailQuery.error, "Failed to load customer details.")
		: null

	const hasDrawerOpen = Boolean(selectedCustomerId)
	const rows = listQuery.data?.rows ?? []
	const listPage = listQuery.data?.page.page ?? page
	const pageCount = listQuery.data?.page.pageCount ?? 1
	const total = listQuery.data?.page.total ?? 0
	const verificationFilterOptions = useMemo<WheelFilterOption[]>(
		() => [
			{ value: "__all__", label: "All verification" },
			...CUSTOMER_VERIFICATION_STATUSES.map((statusValue) => ({
				value: statusValue,
				label: formatVerificationStatus(statusValue),
			})),
		],
		[],
	)
	const statusFilterOptions = useMemo<WheelFilterOption[]>(
		() => [
			{ value: "all", label: "All statuses" },
			{ value: "active", label: "Active" },
			{ value: "banned", label: "Banned" },
		],
		[],
	)
	const pageSizeFilterOptions = useMemo<WheelFilterOption[]>(
		() =>
			pageSizeOptions.map((option) => ({
				value: option,
				label: `${option} per page`,
			})),
		[],
	)

	if (!activeOrganizationId) {
		return (
			<div className="space-y-6">
				<p className="text-muted-foreground text-sm">
					Select an active organization first.
				</p>
			</div>
		)
	}

	return (
		<>
			<div className="space-y-8">
				<section className="space-y-3">
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
						<SummaryMetric
							label="Customers"
							value={summary.total}
							description="Profiles inside your visible branch scope."
						/>
						<SummaryMetric
							label="Active"
							value={summary.active}
							description="Customers currently available for new rentals."
						/>
						<SummaryMetric
							label="Banned"
							value={summary.banned}
							description="Profiles blocked from new rental assignment."
						/>
						<SummaryMetric
							label="Verified"
							value={summary.verified}
							description="Customers with verification completed."
						/>
					</div>
				</section>

				<section className="space-y-4">
					<div className="space-y-2">
						<div className="space-y-1">
							<h2 className="text-base font-semibold">Customer details</h2>
							<p className="text-muted-foreground text-sm">
								Search, filter, and open any row for a focused right-side detail
								view.
							</p>
						</div>
						<Separator />
					</div>

					<div className="grid gap-3 rounded-2xl p-3 lg:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))]">
						<CustomerSearchInput
							key={search}
							initialValue={search}
							onCommit={(value) =>
								updateUrl((params) => {
									if (value) {
										params.set("search", value)
									} else {
										params.delete("search")
									}
									params.set("page", "1")
								})
							}
						/>

						<WheelFilterField
							value={verificationStatus || "__all__"}
							options={verificationFilterOptions}
							placeholder="All verification"
							title="Filter verification"
							description="Choose which verification state to show in the table."
							onValueChange={(value) =>
								updateUrl((params) => {
									if (value === "__all__") {
										params.delete("verificationStatus")
									} else {
										params.set("verificationStatus", value)
									}
									params.set("page", "1")
								})
							}
						/>

						<WheelFilterField
							value={
								CUSTOMER_STATUSES.includes(
									status as (typeof CUSTOMER_STATUSES)[number],
								)
									? status
									: "all"
							}
							options={statusFilterOptions}
							placeholder="All statuses"
							title="Filter customer status"
							description="Choose whether to show active, banned, or all customers."
							onValueChange={(value) =>
								updateUrl((params) => {
									if (value === "all") {
										params.delete("status")
									} else {
										params.set("status", value)
									}
									params.set("page", "1")
								})
							}
						/>

						<WheelFilterField
							value={String(pageSize)}
							options={pageSizeFilterOptions}
							placeholder="Page size"
							title="Rows per page"
							description="Choose how many customer rows to load per page."
							onValueChange={(value) =>
								updateUrl((params) => {
									params.set("pageSize", value)
									params.set("page", "1")
								})
							}
						/>
					</div>

					<CustomerTable
						rows={rows}
						isLoading={listQuery.isPending}
						errorMessage={listErrorMessage}
						page={listPage}
						pageCount={pageCount}
						total={total}
						canManageCustomers={canManageCustomers}
						onPageChange={(nextPage) =>
							updateUrl((params) => {
								params.set("page", String(nextPage))
							})
						}
						onRowClick={(customerId) =>
							updateUrl((params) => {
								params.set("customer", customerId)
							})
						}
						onToggleBan={(customer) => setStatusTarget(customer)}
						onDelete={(customer) => setDeleteTarget(customer)}
					/>
				</section>
			</div>

			<CustomerCreateDialog
				open={isCreateOpen}
				onOpenChange={(open) => {
					setIsCreateOpen(open)
					if (!open) {
						setCreateError(null)
					}
				}}
				branches={branches}
				onSubmit={async (values) => {
					await createCustomerMutation.mutateAsync({
						fullName: values.fullName,
						email: values.email,
						phone: values.phone,
						branchId: values.branchId,
						verificationStatus: values.verificationStatus,
						verificationMetadata: {
							licenseNumber: values.licenseNumber,
							idDocumentType: values.idDocumentType,
							idDocumentNumber: values.idDocumentNumber,
						},
					})
				}}
				isPending={createCustomerMutation.isPending}
				errorMessage={createError}
			/>

			<CustomerEditDialog
				open={Boolean(editSection)}
				onOpenChange={(open) => {
					if (!open) {
						setEditSection(null)
						setEditError(null)
					}
				}}
				section={editSection}
				customer={selectedCustomer}
				branches={branches}
				onSubmit={async (payload) => {
					await editCustomerMutation.mutateAsync(payload)
				}}
				isPending={editCustomerMutation.isPending}
				errorMessage={editError}
			/>

			<ResponsiveConfirmDialog
				open={Boolean(statusTarget)}
				onOpenChange={(open) => {
					if (!open) {
						setStatusTarget(null)
					}
				}}
				title={
					statusTarget?.status === "banned" ? "Unban customer" : "Ban customer"
				}
				description={
					statusTarget
						? statusTarget.status === "banned"
							? `Restore ${statusTarget.fullName} to active status so they can be assigned to new rentals again.`
							: `Ban ${statusTarget.fullName}. They will stay visible here, but rental assignment and lookup will block them.`
						: ""
				}
				confirmLabel={statusTarget?.status === "banned" ? "Unban" : "Ban"}
				confirmVariant={
					statusTarget?.status === "banned" ? "default" : "destructive"
				}
				onConfirm={async () => {
					if (statusTarget) {
						await statusMutation.mutateAsync(statusTarget)
					}
				}}
				isPending={statusMutation.isPending}
				pendingLabel="Saving..."
			/>

			<ResponsiveConfirmDialog
				open={Boolean(deleteTarget)}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null)
					}
				}}
				title="Delete customer"
				description={
					deleteTarget ? (
						<div className="space-y-2">
							<p className="text-muted-foreground text-sm">
								Delete <strong>{deleteTarget.fullName}</strong> permanently.
								This is only allowed when the customer has no rental history.
							</p>
							<p className="text-muted-foreground text-sm">
								If the record has historical rentals, the API will block this
								action and keep the profile intact.
							</p>
						</div>
					) : (
						""
					)
				}
				confirmLabel="Delete"
				confirmVariant="destructive"
				onConfirm={async () => {
					if (deleteTarget) {
						await deleteMutation.mutateAsync(deleteTarget)
					}
				}}
				isPending={deleteMutation.isPending}
				pendingLabel="Deleting..."
			/>

			<CustomerDetailsDrawer
				open={hasDrawerOpen}
				onOpenChange={(open) => {
					if (!open) {
						updateUrl((params) => {
							params.delete("customer")
						})
					}
				}}
				customer={selectedCustomer}
				hasRentalHistory={Boolean(detailQuery.data?.hasRentalHistory)}
				isLoading={detailQuery.isPending && hasDrawerOpen}
				errorMessage={detailErrorMessage}
				canManageCustomers={canManageCustomers}
				onEditSection={(section) => {
					setEditError(null)
					setEditSection(section)
				}}
			/>
		</>
	)
}

export function CustomerManagement() {
	return (
		<Suspense
			fallback={
				<div className="space-y-6">
					<p className="text-muted-foreground text-sm">
						Loading customer workspace...
					</p>
				</div>
			}
		>
			<CustomerManagementContent />
		</Suspense>
	)
}
