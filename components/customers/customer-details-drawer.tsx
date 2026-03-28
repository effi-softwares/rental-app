"use client"

import {
	BadgeCheck,
	CalendarClock,
	LoaderCircle,
	Mail,
	PencilLine,
	Phone,
	ShieldBan,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import type { CustomerDetail } from "@/features/customers/types"
import { useIsMobile } from "@/hooks/use-mobile"

type EditableSection = "identity" | "contact" | "verification"

type CustomerDetailsDrawerProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	customer: CustomerDetail | null
	isLoading: boolean
	errorMessage: string | null
	canManageCustomers: boolean
	onEditSection: (section: EditableSection) => void
}

function formatDateTime(value: string | null) {
	if (!value) {
		return "-"
	}

	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return "-"
	}

	return parsed.toLocaleString("en-AU", {
		dateStyle: "medium",
		timeStyle: "short",
	})
}

function formatVerificationStatus(status: string) {
	if (status === "in_review") {
		return "In review"
	}

	return status.charAt(0).toUpperCase() + status.slice(1)
}

function DetailSection({
	title,
	description,
	onEdit,
	canManageCustomers,
	children,
}: {
	title: string
	description: string
	onEdit: () => void
	canManageCustomers: boolean
	children: React.ReactNode
}) {
	return (
		<section className="space-y-3 py-5">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<h3 className="text-sm font-semibold">{title}</h3>
					<p className="text-muted-foreground text-sm">{description}</p>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onEdit}
					disabled={!canManageCustomers}
				>
					<PencilLine className="size-4" />
					<span className="sr-only">Edit {title}</span>
				</Button>
			</div>
			{children}
		</section>
	)
}

function DetailValue({
	label,
	value,
	icon,
}: {
	label: string
	value: string
	icon?: React.ReactNode
}) {
	return (
		<div className="space-y-1">
			<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
				{label}
			</p>
			<div className="flex items-center gap-2">
				{icon}
				<p className="text-sm font-medium">{value}</p>
			</div>
		</div>
	)
}

function DrawerBody({
	customer,
	isLoading,
	errorMessage,
	canManageCustomers,
	onEditSection,
}: Omit<CustomerDetailsDrawerProps, "open" | "onOpenChange">) {
	if (isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<LoaderCircle className="text-primary size-8 animate-spin" />
			</div>
		)
	}

	if (errorMessage) {
		return (
			<div className="px-4 pb-6 text-sm text-destructive">{errorMessage}</div>
		)
	}

	if (!customer) {
		return (
			<div className="px-4 pb-6 text-sm text-muted-foreground">
				Select a customer to view their details.
			</div>
		)
	}

	const metadata = customer.verificationMetadata ?? {}

	return (
		<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
			<div className="space-y-4 py-2">
				<DetailSection
					title="Identity"
					description="Primary profile name shown across workspace records."
					onEdit={() => onEditSection("identity")}
					canManageCustomers={canManageCustomers}
				>
					<DetailValue label="Full name" value={customer.fullName} />
				</DetailSection>

				<Separator />

				<DetailSection
					title="Contact"
					description="Reachable customer contact details used by operations."
					onEdit={() => onEditSection("contact")}
					canManageCustomers={canManageCustomers}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<DetailValue
							label="Email"
							value={customer.email ?? "Not provided"}
							icon={<Mail className="text-muted-foreground size-4" />}
						/>
						<DetailValue
							label="Phone"
							value={customer.phone ?? "Not provided"}
							icon={<Phone className="text-muted-foreground size-4" />}
						/>
					</div>
				</DetailSection>

				<Separator />

				<DetailSection
					title="Verification"
					description="Verification outcome and supporting document fields."
					onEdit={() => onEditSection("verification")}
					canManageCustomers={canManageCustomers}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<DetailValue
							label="Status"
							value={formatVerificationStatus(customer.verificationStatus)}
							icon={<BadgeCheck className="text-muted-foreground size-4" />}
						/>
						<DetailValue
							label="Customer status"
							value={customer.status === "banned" ? "Banned" : "Active"}
							icon={<ShieldBan className="text-muted-foreground size-4" />}
						/>
						<DetailValue
							label="License number"
							value={
								typeof metadata.licenseNumber === "string" &&
								metadata.licenseNumber.trim()
									? metadata.licenseNumber
									: "Not provided"
							}
						/>
						<DetailValue
							label="ID document type"
							value={
								typeof metadata.idDocumentType === "string" &&
								metadata.idDocumentType.trim()
									? metadata.idDocumentType
									: "Not provided"
							}
						/>
						<DetailValue
							label="ID document number"
							value={
								typeof metadata.idDocumentNumber === "string" &&
								metadata.idDocumentNumber.trim()
									? metadata.idDocumentNumber
									: "Not provided"
							}
						/>
						<DetailValue
							label="Banned at"
							value={
								customer.bannedAt
									? formatDateTime(customer.bannedAt)
									: "Not banned"
							}
						/>
					</div>
				</DetailSection>

				<Separator />

				<section className="space-y-3 py-5">
					<h3 className="text-sm font-semibold">Timeline</h3>
					<div className="grid gap-4 sm:grid-cols-2">
						<DetailValue
							label="Created"
							value={formatDateTime(customer.createdAt)}
							icon={<CalendarClock className="text-muted-foreground size-4" />}
						/>
						<DetailValue
							label="Last updated"
							value={formatDateTime(customer.updatedAt)}
							icon={<CalendarClock className="text-muted-foreground size-4" />}
						/>
					</div>
				</section>
			</div>
		</div>
	)
}

export function CustomerDetailsDrawer(props: CustomerDetailsDrawerProps) {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Drawer open={props.open} onOpenChange={props.onOpenChange}>
				<DrawerContent className="bg-sidebar max-h-[94vh] overflow-hidden rounded-t-2xl">
					<DrawerHeader>
						<DrawerTitle>Customer details</DrawerTitle>
						<DrawerDescription>
							Review the selected customer and edit sections in focused dialogs.
						</DrawerDescription>
					</DrawerHeader>
					<DrawerBody {...props} />
				</DrawerContent>
			</Drawer>
		)
	}

	return (
		<Sheet open={props.open} onOpenChange={props.onOpenChange}>
			<SheetContent
				side="right"
				className="bg-sidebar w-full gap-0 p-0 data-[side=right]:!w-[50vw] data-[side=right]:!max-w-none"
			>
				<SheetHeader className="border-b pb-4">
					<SheetTitle>Customer details</SheetTitle>
					<SheetDescription>
						Review the selected customer and edit sections in focused dialogs.
					</SheetDescription>
				</SheetHeader>
				<DrawerBody {...props} />
			</SheetContent>
		</Sheet>
	)
}
