"use client"

import {
	Activity,
	AlertTriangle,
	ArrowRight,
	Bell,
	CalendarClock,
	CalendarRange,
	CarFront,
	CreditCard,
	MapPinned,
	Plus,
	Radar,
	ShieldAlert,
	Siren,
	TimerReset,
	Users,
	Wrench,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
	Bar,
	BarChart,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"

import { useWorkspaceLiveStatus } from "@/app/workspace/(container)/_components/workspace-live-provider"
import { FleetMapScene } from "@/components/fleet/fleet-map-scene"
import { RentalAppointmentDrawer } from "@/components/rentals/rental-appointment-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltipContent,
} from "@/components/ui/chart"
import { PageContentShell } from "@/components/ui/page-content-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { useDashboardOverviewQuery } from "@/features/dashboard"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { cn } from "@/lib/utils"

const panelClassName =
	"overflow-hidden rounded-[18px] border border-border/70 bg-background/95"

const rentalFlowChartConfig = {
	pickups: {
		label: "Pickups",
		color: "var(--color-chart-2)",
	},
	returns: {
		label: "Returns",
		color: "var(--color-chart-4)",
	},
} satisfies ChartConfig

const fleetStatusChartConfig = {
	available: {
		label: "Available",
		color: "var(--color-chart-1)",
	},
	rented: {
		label: "Rented",
		color: "var(--color-chart-2)",
	},
	maintenance: {
		label: "Maintenance",
		color: "var(--color-chart-4)",
	},
	retired: {
		label: "Retired",
		color: "var(--color-muted-foreground)",
	},
} satisfies ChartConfig

const fleetPieColors = [
	"var(--color-chart-1)",
	"var(--color-chart-2)",
	"var(--color-chart-4)",
	"var(--color-muted-foreground)",
]

type DashboardDockAction =
	| {
			id: string
			label: string
			description: string
			icon: typeof Plus
			href: string
	  }
	| {
			id: string
			label: string
			description: string
			icon: typeof Plus
			onClick: () => void
	  }

function formatDateTime(value: string | null) {
	if (!value) {
		return "Schedule pending"
	}

	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return "Schedule pending"
	}

	return parsed.toLocaleString("en-AU", {
		dateStyle: "medium",
		timeStyle: "short",
	})
}

function formatShortDate(value: string) {
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return "-"
	}

	return parsed.toLocaleDateString("en-AU", {
		month: "short",
		day: "numeric",
	})
}

function severityBadgeClassName(severity: "warning" | "critical") {
	return severity === "critical"
		? "border-destructive/20 bg-destructive/10 text-destructive"
		: "border-amber-200 bg-amber-50 text-amber-700"
}

function agendaBadgeCopy(
	kind: "overdue_return" | "due_return" | "due_pickup" | "awaiting_payment",
) {
	switch (kind) {
		case "overdue_return":
			return "Overdue return"
		case "due_return":
			return "Return today"
		case "due_pickup":
			return "Pickup today"
		case "awaiting_payment":
			return "Awaiting payment"
	}
}

function ActionDock() {
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? null
	const viewerRole = authContextQuery.data?.viewer.role ?? "member"
	const [isCreateRentalOpen, setIsCreateRentalOpen] = useState(false)

	const actionItems = useMemo(() => {
		const permissions = authContextQuery.data?.permissions
		const canViewBookings = Boolean(permissions?.viewBookingsModule)
		const canManageVehicles = Boolean(permissions?.manageVehicles)
		const canViewFleet = Boolean(permissions?.viewFleetModule)
		const canManageBilling = Boolean(permissions?.manageBillingAttentionModule)
		const canViewLiveFleet =
			canViewFleet && (viewerRole === "owner" || viewerRole === "admin")

		return [
			canViewBookings
				? {
						id: "new-rental",
						label: "New rental",
						description: "Open the booking flow instantly.",
						icon: Plus,
						onClick: () => setIsCreateRentalOpen(true),
					}
				: null,
			canViewBookings
				? {
						id: "active-rentals",
						label: "Active rentals",
						description: "Jump into live handovers and returns.",
						icon: CalendarRange,
						href: `${routes.app.rentals}?status=active`,
					}
				: null,
			canViewBookings
				? {
						id: "return-rental",
						label: "Return rental",
						description: "Go straight to vehicles due back.",
						icon: TimerReset,
						href: `${routes.app.rentals}?status=active`,
					}
				: null,
			canViewFleet
				? {
						id: "vehicle-catalog",
						label: canManageVehicles ? "Add vehicle" : "Vehicle catalog",
						description: canManageVehicles
							? "Add or update vehicles from the catalog."
							: "Open the fleet catalog and inspect vehicles.",
						icon: CarFront,
						href: routes.app.vehicleCatalog,
					}
				: null,
			canViewLiveFleet
				? {
						id: "fleet-live",
						label: "Fleet live",
						description: "Watch tracked vehicles on the map.",
						icon: MapPinned,
						href: routes.app.fleet,
					}
				: null,
			canManageBilling
				? {
						id: "billing-attention",
						label: "Billing attention",
						description: "Resolve payment exceptions and blockers.",
						icon: CreditCard,
						href: routes.app.billingAttention,
					}
				: null,
		].filter((item): item is DashboardDockAction => Boolean(item))
	}, [authContextQuery.data?.permissions, viewerRole])

	if (!activeOrganizationId || actionItems.length === 0) {
		return null
	}

	return (
		<>
			<div className="grid gap-3 border-t border-white/40 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
				{actionItems.map((item) => {
					if ("href" in item) {
						return (
							<Button
								key={item.id}
								asChild
								variant="outline"
								size="lg"
								className="h-auto justify-start rounded-[14px] border-white/55 bg-white/82 px-4 py-4 text-left shadow-none backdrop-blur hover:bg-white"
							>
								<Link href={item.href}>
									<item.icon className="mt-0.5 size-4 shrink-0" />
									<span className="flex min-w-0 flex-col items-start">
										<span className="text-sm font-semibold">{item.label}</span>
										<span className="text-muted-foreground line-clamp-2 text-xs">
											{item.description}
										</span>
									</span>
								</Link>
							</Button>
						)
					}

					return (
						<Button
							key={item.id}
							type="button"
							variant="outline"
							size="lg"
							className="h-auto justify-start rounded-[14px] border-white/55 bg-white/82 px-4 py-4 text-left shadow-none backdrop-blur hover:bg-white"
							onClick={item.onClick}
						>
							<item.icon className="mt-0.5 size-4 shrink-0" />
							<span className="flex min-w-0 flex-col items-start">
								<span className="text-sm font-semibold">{item.label}</span>
								<span className="text-muted-foreground line-clamp-2 text-xs">
									{item.description}
								</span>
							</span>
						</Button>
					)
				})}
			</div>

			<RentalAppointmentDrawer
				open={isCreateRentalOpen}
				onOpenChange={setIsCreateRentalOpen}
			/>
		</>
	)
}

function MetricStrip({
	items,
}: {
	items: Array<{
		label: string
		value: number
		hint: string
		icon: typeof Activity
	}>
}) {
	return (
		<div className="grid gap-3 border-t border-white/40 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
			{items.map((item) => (
				<div
					key={item.label}
					className="rounded-[16px] border border-white/55 bg-white/72 px-4 py-4 backdrop-blur"
				>
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.22em]">
								{item.label}
							</p>
							<p className="mt-2 text-3xl font-semibold tracking-tight">
								{item.value}
							</p>
						</div>
						<div className="flex size-10 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
							<item.icon className="size-4" />
						</div>
					</div>
					<p className="mt-3 text-sm text-muted-foreground">{item.hint}</p>
				</div>
			))}
		</div>
	)
}

function SectionShell({
	title,
	description,
	actions,
	children,
	className,
}: {
	title: string
	description: string
	actions?: React.ReactNode
	children: React.ReactNode
	className?: string
}) {
	return (
		<section className={cn(panelClassName, className)}>
			<header className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<h2 className="text-base font-semibold tracking-tight">{title}</h2>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
				{actions ? <div className="shrink-0">{actions}</div> : null}
			</header>
			{children}
		</section>
	)
}

function EmptySection({ title, copy }: { title: string; copy: string }) {
	return (
		<div className="px-5 py-8">
			<p className="text-sm font-medium">{title}</p>
			<p className="mt-2 text-sm text-muted-foreground">{copy}</p>
		</div>
	)
}

function LoadingDashboard() {
	return (
		<PageContentShell className="max-w-none space-y-5 pb-8">
			<Skeleton className="h-[28rem] rounded-[20px]" />
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_23rem]">
				<div className="space-y-5">
					<Skeleton className="h-[24rem] rounded-[18px]" />
					<Skeleton className="h-[24rem] rounded-[18px]" />
				</div>
				<div className="space-y-5">
					<Skeleton className="h-[20rem] rounded-[18px]" />
					<Skeleton className="h-[18rem] rounded-[18px]" />
					<Skeleton className="h-[16rem] rounded-[18px]" />
				</div>
			</div>
		</PageContentShell>
	)
}

export function WorkspaceDashboard() {
	const authContextQuery = useAuthContextQuery()
	const workspaceLive = useWorkspaceLiveStatus()
	const organizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const overviewQuery = useDashboardOverviewQuery(organizationId)
	const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
		null,
	)

	useEffect(() => {
		const firstVehicle =
			overviewQuery.data?.fleetPreview.vehicles.find(
				(vehicle) => vehicle.snapshot,
			)?.id ?? null

		setSelectedVehicleId((current) => {
			if (!overviewQuery.data?.fleetPreview.vehicles.length) {
				return null
			}

			if (
				current &&
				overviewQuery.data.fleetPreview.vehicles.some(
					(vehicle) => vehicle.id === current,
				)
			) {
				return current
			}

			return firstVehicle
		})
	}, [overviewQuery.data?.fleetPreview.vehicles])

	if (overviewQuery.isPending && !overviewQuery.data) {
		return <LoadingDashboard />
	}

	if (overviewQuery.isError || !overviewQuery.data) {
		return (
			<PageContentShell className="max-w-none pb-8">
				<section className={cn(panelClassName, "px-5 py-8")}>
					<div className="max-w-xl space-y-3">
						<p className="text-lg font-semibold tracking-tight">
							Dashboard unavailable
						</p>
						<p className="text-sm text-muted-foreground">
							The workspace overview could not be loaded right now. You can try
							again without leaving the page.
						</p>
						<Button type="button" onClick={() => overviewQuery.refetch()}>
							Retry dashboard
						</Button>
					</div>
				</section>
			</PageContentShell>
		)
	}

	const dashboard = overviewQuery.data
	const userName = authContextQuery.data?.user?.name?.trim() || "there"
	const organizationName =
		authContextQuery.data?.activeOrganization?.name ?? "Active organization"
	const viewerRole = authContextQuery.data?.viewer.role ?? "member"

	const metricItems = [
		{
			label: "Active rentals",
			value: dashboard.summary.activeRentals,
			hint: "Vehicles currently out with customers.",
			icon: Activity,
		},
		{
			label: "Pickups today",
			value: dashboard.summary.pickupsToday,
			hint: "Bookings scheduled to start before close.",
			icon: CalendarClock,
		},
		{
			label: "Returns today",
			value: dashboard.summary.returnsToday,
			hint: "Vehicles planned to come back today.",
			icon: TimerReset,
		},
		{
			label: "Awaiting payment",
			value: dashboard.summary.awaitingPayment,
			hint: "Bookings blocked until payment is settled.",
			icon: CreditCard,
		},
		{
			label: "Overdue returns",
			value: dashboard.summary.overdueReturns,
			hint: "Active rentals already past planned return time.",
			icon: AlertTriangle,
		},
		{
			label: "Available vehicles",
			value: dashboard.summary.availableVehicles,
			hint: "Fleet ready for the next booking cycle.",
			icon: CarFront,
		},
		{
			label: "Maintenance",
			value: dashboard.summary.maintenanceVehicles,
			hint: "Vehicles temporarily out of booking rotation.",
			icon: Wrench,
		},
		...(dashboard.summary.offlineTrackedVehicles === null
			? []
			: [
					{
						label: "Offline tracked",
						value: dashboard.summary.offlineTrackedVehicles,
						hint: "Tracked vehicles without a recent live fix.",
						icon: Radar,
					},
				]),
	]

	const visibleMetricItems = metricItems.slice(0, 8)
	const visibleModules = [
		dashboard.permissions.viewBookings ? "Rentals" : null,
		dashboard.permissions.viewFleet ? "Fleet" : null,
		dashboard.permissions.manageBillingAttention ? "Billing attention" : null,
		dashboard.permissions.viewBranches ? "Branches" : null,
	].filter(Boolean)

	return (
		<PageContentShell className="max-w-none space-y-5 pb-8">
			<section className="overflow-hidden rounded-[20px] border border-border/70 bg-background">
				<div className="flex flex-col gap-5 px-5 py-6 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-7">
					<div className="max-w-3xl space-y-4">
						<div className="flex flex-wrap items-center gap-2">
							<Badge
								variant="outline"
								className="border-white/60 bg-white/75 text-foreground"
							>
								Operations pulse
							</Badge>
							<Badge
								variant="outline"
								className="border-white/60 bg-white/70 text-muted-foreground"
							>
								{organizationName}
							</Badge>
							<Badge
								variant="outline"
								className="border-white/60 bg-white/70 text-muted-foreground capitalize"
							>
								{viewerRole}
							</Badge>
						</div>

						<div className="space-y-2">
							<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
								{`Keep today moving, ${userName.split(" ")[0]}.`}
							</h1>
							<p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
								This workspace is tuned for live rental operations, fleet
								readiness, and branch-level coordination without exposing
								revenue metrics.
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2 text-sm">
							<div className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/75 px-3 py-1.5 text-foreground">
								<Siren className="size-4 text-primary" />
								<span>
									{dashboard.alerts.items.length} live alerts in focus
								</span>
							</div>
							<div className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/75 px-3 py-1.5 text-foreground">
								<Users className="size-4 text-primary" />
								<span>
									{visibleModules.join(" • ") || "Core workspace access"}
								</span>
							</div>
						</div>
					</div>

					<div className="grid gap-3 sm:min-w-[18rem]">
						<div className="rounded-[16px] border border-white/55 bg-white/78 px-4 py-4 backdrop-blur">
							<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
								Live workspace status
							</p>
							<p className="mt-2 text-sm font-semibold">
								{workspaceLive.latestAlert?.summary ??
									dashboard.alerts.items[0]?.label ??
									"No urgent workspace alert right now"}
							</p>
							<p className="mt-2 text-sm text-muted-foreground">
								{workspaceLive.latestAlert?.occurredAt
									? `Latest update ${formatDateTime(workspaceLive.latestAlert.occurredAt)}`
									: "The rail below will update when rental or billing events change."}
							</p>
						</div>

						<div className="rounded-[16px] border border-white/55 bg-white/78 px-4 py-4 backdrop-blur">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
										Quick scope
									</p>
									<p className="mt-2 text-sm font-semibold">
										{dashboard.branchLoad.rows.length > 0
											? `${dashboard.branchLoad.rows.length} branch${dashboard.branchLoad.rows.length === 1 ? "" : "es"} in view`
											: "No branch breakdown available"}
									</p>
								</div>
								<Bell className="size-4 text-primary" />
							</div>
							<p className="mt-2 text-sm text-muted-foreground">
								Use the quick-action dock to move directly into the next
								operational flow.
							</p>
						</div>
					</div>
				</div>

				<MetricStrip items={visibleMetricItems} />
				<ActionDock />
			</section>

			<div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_23rem]">
				<div className="space-y-5">
					{dashboard.permissions.viewLiveFleet &&
					dashboard.fleetPreview.canViewLiveFleet &&
					dashboard.fleetPreview.defaultViewport ? (
						<SectionShell
							title="Fleet surface"
							description="A live spatial snapshot for the vehicles your operations team is actively tracking."
							actions={
								<Button asChild variant="outline" size="sm">
									<Link href={routes.app.fleet}>
										Open fleet live
										<ArrowRight />
									</Link>
								</Button>
							}
						>
							<div className="p-3">
								<FleetMapScene
									className="rounded-[16px]"
									vehicles={dashboard.fleetPreview.vehicles}
									selectedVehicleId={selectedVehicleId}
									onSelectVehicle={setSelectedVehicleId}
									defaultViewport={dashboard.fleetPreview.defaultViewport}
									chromeStyle="flat"
									header={
										<div className="flex flex-wrap items-center gap-3">
											<div>
												<p className="text-sm font-semibold">
													Tracked fleet overview
												</p>
												<p className="text-xs text-muted-foreground">
													Moving {dashboard.fleetPreview.stats.moving} • Parked{" "}
													{dashboard.fleetPreview.stats.parked} • Offline{" "}
													{dashboard.fleetPreview.stats.offline}
												</p>
											</div>
										</div>
									}
								/>
							</div>
						</SectionShell>
					) : null}

					<SectionShell
						title="Today's agenda"
						description="The queue is sorted by urgency so overdue returns and due operations rise to the top."
						actions={
							dashboard.permissions.viewBookings ? (
								<Button asChild variant="outline" size="sm">
									<Link href={routes.app.rentals}>
										Open rentals
										<ArrowRight />
									</Link>
								</Button>
							) : null
						}
					>
						{dashboard.agenda.items.length === 0 ? (
							<EmptySection
								title="No urgent rental agenda right now"
								copy="When pickups, returns, or payment blockers appear, they will be stacked here in operational order."
							/>
						) : (
							<div className="divide-y divide-border/70">
								{dashboard.agenda.items.map((item) => (
									<Link
										key={item.id}
										href={item.href}
										className="flex flex-col gap-3 px-5 py-4 transition hover:bg-muted/35 sm:flex-row sm:items-start sm:justify-between"
									>
										<div className="min-w-0 space-y-2">
											<div className="flex flex-wrap items-center gap-2">
												<Badge
													variant="outline"
													className={severityBadgeClassName(item.severity)}
												>
													{agendaBadgeCopy(item.kind)}
												</Badge>
												{item.primaryAt ? (
													<span className="text-xs text-muted-foreground">
														{formatDateTime(item.primaryAt)}
													</span>
												) : null}
											</div>
											<div>
												<p className="text-sm font-semibold">{item.title}</p>
												<p className="mt-1 text-sm text-muted-foreground">
													{item.supportingText}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-2 text-sm font-medium text-foreground">
											<span>Open queue</span>
											<ArrowRight className="size-4" />
										</div>
									</Link>
								))}
							</div>
						)}
					</SectionShell>

					{dashboard.permissions.viewBookings ||
					dashboard.permissions.viewFleet ? (
						<SectionShell
							title="Operational trends"
							description="Short-range volume and fleet-distribution signals help teams spot pressure before it becomes a blocker."
						>
							<div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_22rem]">
								<div className="rounded-[16px] border border-border/70 bg-muted/15 p-4">
									<div className="space-y-1">
										<p className="text-sm font-semibold">7-day rental flow</p>
										<p className="text-sm text-muted-foreground">
											Pickups and returns across the last rolling week.
										</p>
									</div>
									<ChartContainer
										config={rentalFlowChartConfig}
										className="mt-4 h-72"
									>
										<ResponsiveContainer width="100%" height="100%">
											<BarChart
												data={dashboard.charts.rentalFlow}
												margin={{ left: -16, right: 8, top: 8, bottom: 0 }}
											>
												<XAxis
													dataKey="label"
													axisLine={false}
													tickLine={false}
												/>
												<YAxis
													allowDecimals={false}
													axisLine={false}
													tickLine={false}
												/>
												<Tooltip content={<ChartTooltipContent />} />
												<Bar
													dataKey="pickups"
													radius={[10, 10, 0, 0]}
													fill="var(--color-pickups)"
												/>
												<Bar
													dataKey="returns"
													radius={[10, 10, 0, 0]}
													fill="var(--color-returns)"
												/>
											</BarChart>
										</ResponsiveContainer>
									</ChartContainer>
								</div>

								<div className="rounded-[16px] border border-border/70 bg-muted/15 p-4">
									<div className="space-y-1">
										<p className="text-sm font-semibold">Fleet status mix</p>
										<p className="text-sm text-muted-foreground">
											How the visible fleet is currently distributed.
										</p>
									</div>
									<ChartContainer
										config={fleetStatusChartConfig}
										className="mt-4 h-72"
									>
										<ResponsiveContainer width="100%" height="100%">
											<PieChart>
												<Tooltip content={<ChartTooltipContent hideLabel />} />
												<Pie
													data={dashboard.charts.fleetStatus.map((item) => ({
														...item,
														dataKey:
															item.status === "Available"
																? "available"
																: item.status === "Rented"
																	? "rented"
																	: item.status === "Maintenance"
																		? "maintenance"
																		: "retired",
													}))}
													dataKey="value"
													nameKey="label"
													innerRadius={64}
													outerRadius={92}
													paddingAngle={2}
												>
													{dashboard.charts.fleetStatus.map((item, index) => (
														<Cell
															key={item.status}
															fill={fleetPieColors[index] ?? fleetPieColors[0]}
														/>
													))}
												</Pie>
											</PieChart>
										</ResponsiveContainer>
									</ChartContainer>

									<div className="mt-1 grid gap-2">
										{dashboard.charts.fleetStatus.map((item, index) => (
											<div
												key={item.status}
												className="flex items-center justify-between text-sm"
											>
												<div className="flex items-center gap-2 text-muted-foreground">
													<span
														className="size-2.5 rounded-full"
														style={{
															backgroundColor:
																fleetPieColors[index] ?? fleetPieColors[0],
														}}
													/>
													<span>{item.label}</span>
												</div>
												<span className="font-semibold text-foreground">
													{item.value}
												</span>
											</div>
										))}
									</div>
								</div>
							</div>
						</SectionShell>
					) : null}

					{dashboard.permissions.viewBranches &&
					dashboard.branchLoad.rows.length > 1 ? (
						<SectionShell
							title="Branch load"
							description="A quick ranking of where today's live activity and ready inventory are concentrated."
						>
							<div className="space-y-3 p-4">
								{dashboard.branchLoad.rows.map((row) => {
									const intensity =
										row.activeRentals * 3 +
										row.pickupsToday * 2 +
										row.availableVehicles
									const maxIntensity = Math.max(
										...dashboard.branchLoad.rows.map(
											(item) =>
												item.activeRentals * 3 +
												item.pickupsToday * 2 +
												item.availableVehicles,
										),
										1,
									)
									const width = `${Math.max((intensity / maxIntensity) * 100, 10)}%`

									return (
										<div
											key={row.branchId}
											className="rounded-[16px] border border-border/70 bg-muted/15 px-4 py-4"
										>
											<div className="flex flex-wrap items-center justify-between gap-3">
												<div>
													<p className="text-sm font-semibold">
														{row.branchName}
													</p>
													<p className="mt-1 text-sm text-muted-foreground">
														{row.activeRentals} active • {row.pickupsToday}{" "}
														pickups today • {row.availableVehicles} ready
													</p>
												</div>
												<Badge variant="outline">{intensity} load pts</Badge>
											</div>
											<div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
												<div
													className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-chart-2),var(--color-chart-4))]"
													style={{ width }}
												/>
											</div>
										</div>
									)
								})}
							</div>
						</SectionShell>
					) : null}
				</div>

				<div className="space-y-5">
					<SectionShell
						title="Attention rail"
						description="Only the warning and critical items that need operator awareness make it into this lane."
					>
						{dashboard.alerts.items.length === 0 ? (
							<EmptySection
								title="No warning-level alerts"
								copy="Rental exceptions, billing blockers, and compliance risk will surface here when they need attention."
							/>
						) : (
							<div className="divide-y divide-border/70">
								{dashboard.alerts.items.map((item) => (
									<Link
										key={item.id}
										href={item.href}
										className="block px-5 py-4 transition hover:bg-muted/35"
									>
										<div className="flex items-start gap-3">
											<div
												className={cn(
													"mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[12px]",
													item.severity === "critical"
														? "bg-destructive/10 text-destructive"
														: "bg-amber-100 text-amber-700",
												)}
											>
												{item.severity === "critical" ? (
													<Siren className="size-4" />
												) : (
													<Bell className="size-4" />
												)}
											</div>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="text-sm font-semibold">{item.label}</p>
													<Badge
														variant="outline"
														className={severityBadgeClassName(item.severity)}
													>
														{item.severity}
													</Badge>
												</div>
												<p className="mt-1 text-sm text-muted-foreground">
													{item.supportingText}
												</p>
												{item.timestamp ? (
													<p className="mt-2 text-xs text-muted-foreground">
														{formatDateTime(item.timestamp)}
													</p>
												) : null}
											</div>
										</div>
									</Link>
								))}
							</div>
						)}
					</SectionShell>

					{dashboard.permissions.viewFleet ? (
						<SectionShell
							title="Compliance watch"
							description="Vehicle registration and insurance items that are already overdue or coming up soon."
						>
							<div className="grid gap-px border-b border-border/70 bg-border/70 sm:grid-cols-2">
								{[
									{
										label: "Overdue registration",
										value: dashboard.compliance.summary.overdueRegistration,
									},
									{
										label: "Upcoming registration",
										value: dashboard.compliance.summary.upcomingRegistration,
									},
									{
										label: "Overdue insurance",
										value: dashboard.compliance.summary.overdueInsurance,
									},
									{
										label: "Upcoming insurance",
										value: dashboard.compliance.summary.upcomingInsurance,
									},
								].map((item) => (
									<div key={item.label} className="bg-background px-4 py-4">
										<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
											{item.label}
										</p>
										<p className="mt-2 text-2xl font-semibold">{item.value}</p>
									</div>
								))}
							</div>

							{dashboard.compliance.items.length === 0 ? (
								<EmptySection
									title="No urgent compliance risk"
									copy="As renewals approach, the most time-sensitive vehicles will appear here."
								/>
							) : (
								<div className="divide-y divide-border/70">
									{dashboard.compliance.items.map((item) => (
										<Link
											key={item.id}
											href={item.href}
											className="block px-5 py-4 transition hover:bg-muted/35"
										>
											<div className="flex items-start gap-3">
												<div
													className={cn(
														"mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[12px]",
														item.kind === "registration"
															? "bg-sky-100 text-sky-700"
															: "bg-emerald-100 text-emerald-700",
													)}
												>
													<ShieldAlert className="size-4" />
												</div>
												<div className="min-w-0 flex-1">
													<div className="flex flex-wrap items-center gap-2">
														<p className="text-sm font-semibold">
															{item.vehicleLabel}
														</p>
														<Badge
															variant="outline"
															className={severityBadgeClassName(item.severity)}
														>
															{item.severity}
														</Badge>
													</div>
													<p className="mt-1 text-sm text-muted-foreground">
														{item.kind === "registration"
															? "Registration"
															: "Insurance"}{" "}
														{item.severity === "critical" ? "expired" : "due"}{" "}
														on {formatShortDate(item.dueAt)} •{" "}
														{item.licensePlate}
													</p>
													{item.branchName ? (
														<p className="mt-1 text-xs text-muted-foreground">
															{item.branchName}
														</p>
													) : null}
												</div>
											</div>
										</Link>
									))}
								</div>
							)}
						</SectionShell>
					) : null}

					<SectionShell
						title="Workspace scope"
						description="A quick read on what this role can act on from the dashboard right now."
					>
						<div className="space-y-4 px-5 py-5">
							<div className="rounded-[16px] border border-border/70 bg-muted/15 px-4 py-4">
								<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
									Organization
								</p>
								<p className="mt-2 text-lg font-semibold">{organizationName}</p>
								<p className="mt-1 text-sm text-muted-foreground capitalize">
									Role scope: {viewerRole}
								</p>
							</div>

							<div className="space-y-2">
								<p className="text-sm font-semibold">Visible modules</p>
								<div className="flex flex-wrap gap-2">
									{visibleModules.length > 0 ? (
										visibleModules.map((item) => (
											<Badge key={item} variant="outline">
												{item}
											</Badge>
										))
									) : (
										<Badge variant="outline">Core workspace</Badge>
									)}
								</div>
							</div>

							<div className="rounded-[16px] border border-dashed border-border px-4 py-4">
								<p className="text-sm font-medium">
									{dashboard.branchLoad.rows.length > 0
										? `${dashboard.branchLoad.rows.length} branch${dashboard.branchLoad.rows.length === 1 ? "" : "es"} represented in this overview`
										: "Branch-specific load is not available for this role"}
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									The dashboard adapts to the current viewer so modules without
									access simply stay out of the way.
								</p>
							</div>
						</div>
					</SectionShell>
				</div>
			</div>
		</PageContentShell>
	)
}
