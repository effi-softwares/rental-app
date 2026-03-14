import { and, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import { routes } from "@/config/routes"
import type { DashboardOverviewResponse } from "@/features/dashboard"
import { requireViewer } from "@/lib/api/guards"
import {
	getScopedBranchIdsForViewer,
	viewerHasPermission,
} from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { customer } from "@/lib/db/schema/customers"
import { rental, rentalPayment } from "@/lib/db/schema/rentals"
import { vehicle, vehicleBrand, vehicleModel } from "@/lib/db/schema/vehicles"
import { isPrivilegedFleetRole } from "@/lib/fleet/live"
import { getFleetLiveResponse } from "@/lib/fleet/server"
import { buildBranchScopedPredicate } from "../../payments/_lib"

const DASHBOARD_RENTAL_STATUSES = [
	"awaiting_payment",
	"scheduled",
	"active",
	"completed",
] as const

const UPCOMING_COMPLIANCE_WINDOW_DAYS = 30
const RENTAL_FLOW_DAYS = 7

function startOfDay(value: Date) {
	const result = new Date(value)
	result.setHours(0, 0, 0, 0)
	return result
}

function endOfDay(value: Date) {
	const result = new Date(value)
	result.setHours(23, 59, 59, 999)
	return result
}

function addDays(value: Date, days: number) {
	const result = new Date(value)
	result.setDate(result.getDate() + days)
	return result
}

function formatChartLabel(value: Date) {
	return new Intl.DateTimeFormat("en-AU", {
		month: "short",
		day: "numeric",
	}).format(value)
}

function formatDueLabel(value: Date | null) {
	if (!value) {
		return "Schedule pending"
	}

	return new Intl.DateTimeFormat("en-AU", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(value)
}

function createFleetStatusRows(input: {
	availableVehicles: number
	rentedVehicles: number
	maintenanceVehicles: number
	retiredVehicles: number
}): DashboardOverviewResponse["charts"]["fleetStatus"] {
	return [
		{ status: "Available", label: "Available", value: input.availableVehicles },
		{ status: "Rented", label: "Rented", value: input.rentedVehicles },
		{
			status: "Maintenance",
			label: "Maintenance",
			value: input.maintenanceVehicles,
		},
		{ status: "Retired", label: "Retired", value: input.retiredVehicles },
	]
}

export async function GET() {
	const guard = await requireViewer({ permission: "viewDashboardModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const [
		canViewBookings,
		canViewFleet,
		canManageVehicles,
		canManageBillingAttention,
		canViewBranches,
		scopedBranchIds,
	] = await Promise.all([
		viewerHasPermission(viewer, "viewBookingsModule"),
		viewerHasPermission(viewer, "viewFleetModule"),
		viewerHasPermission(viewer, "manageVehicles"),
		viewerHasPermission(viewer, "manageBillingAttentionModule"),
		viewerHasPermission(viewer, "viewBranchModule"),
		getScopedBranchIdsForViewer(viewer),
	])

	const canViewLiveFleet = canViewFleet && isPrivilegedFleetRole(viewer.role)
	const rentalBranchScope = buildBranchScopedPredicate(
		rental.branchId,
		scopedBranchIds,
	)
	const paymentBranchScope = buildBranchScopedPredicate(
		rentalPayment.branchId,
		scopedBranchIds,
	)
	const vehicleBranchScope = buildBranchScopedPredicate(
		vehicle.branchId,
		scopedBranchIds,
	)
	const branchScope = buildBranchScopedPredicate(branch.id, scopedBranchIds)

	const now = new Date()
	const todayStart = startOfDay(now)
	const todayEnd = endOfDay(now)
	const complianceWindowEnd = endOfDay(
		addDays(todayStart, UPCOMING_COMPLIANCE_WINDOW_DAYS),
	)
	const flowStart = startOfDay(addDays(todayStart, -(RENTAL_FLOW_DAYS - 1)))

	const [rentalRows, vehicleRows, branchRows, paymentAttentionRows, fleetLive] =
		await Promise.all([
			canViewBookings
				? db
						.select({
							id: rental.id,
							status: rental.status,
							plannedStartAt: rental.plannedStartAt,
							plannedEndAt: rental.plannedEndAt,
							createdAt: rental.createdAt,
							branchId: rental.branchId,
							branchName: branch.name,
							customerName: customer.fullName,
							vehicleYear: vehicle.year,
							vehiclePlate: vehicle.licensePlate,
							vehicleBrand: vehicleBrand.name,
							vehicleModel: vehicleModel.name,
						})
						.from(rental)
						.leftJoin(branch, eq(rental.branchId, branch.id))
						.leftJoin(customer, eq(rental.customerId, customer.id))
						.leftJoin(vehicle, eq(rental.vehicleId, vehicle.id))
						.leftJoin(vehicleBrand, eq(vehicle.brandId, vehicleBrand.id))
						.leftJoin(vehicleModel, eq(vehicle.modelId, vehicleModel.id))
						.where(
							and(
								eq(rental.organizationId, viewer.activeOrganizationId),
								rentalBranchScope,
								inArray(rental.status, DASHBOARD_RENTAL_STATUSES),
							),
						)
				: Promise.resolve([]),
			canViewFleet
				? db
						.select({
							id: vehicle.id,
							status: vehicle.status,
							branchId: vehicle.branchId,
							branchName: branch.name,
							licensePlate: vehicle.licensePlate,
							year: vehicle.year,
							brandName: vehicleBrand.name,
							modelName: vehicleModel.name,
							registrationExpiryDate: vehicle.registrationExpiryDate,
							insuranceExpiryDate: vehicle.insuranceExpiryDate,
						})
						.from(vehicle)
						.leftJoin(branch, eq(vehicle.branchId, branch.id))
						.innerJoin(vehicleBrand, eq(vehicle.brandId, vehicleBrand.id))
						.innerJoin(vehicleModel, eq(vehicle.modelId, vehicleModel.id))
						.where(
							and(
								eq(vehicle.organizationId, viewer.activeOrganizationId),
								vehicleBranchScope,
							),
						)
				: Promise.resolve([]),
			canViewBranches
				? db
						.select({
							id: branch.id,
							name: branch.name,
						})
						.from(branch)
						.where(
							and(
								eq(branch.organizationId, viewer.activeOrganizationId),
								branchScope,
							),
						)
				: Promise.resolve([]),
			canManageBillingAttention
				? Promise.all([
						db
							.select({ id: rentalPayment.id })
							.from(rentalPayment)
							.where(
								and(
									eq(rentalPayment.organizationId, viewer.activeOrganizationId),
									eq(rentalPayment.status, "requires_action"),
									paymentBranchScope,
								),
							),
						db
							.select({ id: rentalPayment.id })
							.from(rentalPayment)
							.where(
								and(
									eq(rentalPayment.organizationId, viewer.activeOrganizationId),
									eq(rentalPayment.status, "failed"),
									paymentBranchScope,
								),
							),
					])
				: Promise.resolve<[Array<{ id: string }>, Array<{ id: string }>]>([
						[],
						[],
					]),
			canViewLiveFleet
				? getFleetLiveResponse(viewer.activeOrganizationId)
				: Promise.resolve(null),
		])

	const [requiresActionRows, failedPaymentRows] = paymentAttentionRows

	const summary = {
		activeRentals: 0,
		pickupsToday: 0,
		returnsToday: 0,
		awaitingPayment: 0,
		overdueReturns: 0,
		availableVehicles: 0,
		rentedVehicles: 0,
		maintenanceVehicles: 0,
		offlineTrackedVehicles: null as number | null,
	}

	const agendaItems: DashboardOverviewResponse["agenda"]["items"] = []
	const alertItems: DashboardOverviewResponse["alerts"]["items"] = []

	const rentalFlowMap = new Map<
		string,
		DashboardOverviewResponse["charts"]["rentalFlow"][number]
	>()

	for (let index = 0; index < RENTAL_FLOW_DAYS; index += 1) {
		const date = addDays(flowStart, index)
		const key = date.toISOString().slice(0, 10)
		rentalFlowMap.set(key, {
			date: key,
			label: formatChartLabel(date),
			pickups: 0,
			returns: 0,
		})
	}

	for (const row of rentalRows) {
		const vehicleLabel =
			row.vehicleYear && row.vehicleBrand && row.vehicleModel
				? `${row.vehicleYear} ${row.vehicleBrand} ${row.vehicleModel}`
				: "Vehicle pending"
		const customerLabel = row.customerName ?? "Customer pending"

		if (row.status === "active") {
			summary.activeRentals += 1
		}
		if (row.status === "awaiting_payment") {
			summary.awaitingPayment += 1
		}

		if (
			row.plannedStartAt &&
			row.plannedStartAt >= todayStart &&
			row.plannedStartAt <= todayEnd
		) {
			summary.pickupsToday += 1
		}

		if (
			row.plannedEndAt &&
			row.plannedEndAt >= todayStart &&
			row.plannedEndAt <= todayEnd
		) {
			summary.returnsToday += 1
		}

		if (row.status === "active" && row.plannedEndAt && row.plannedEndAt < now) {
			summary.overdueReturns += 1
			agendaItems.push({
				id: `overdue-return-${row.id}`,
				rentalId: row.id,
				kind: "overdue_return",
				severity: "critical",
				title: `${vehicleLabel} is overdue for return`,
				supportingText: `${customerLabel} was due back ${formatDueLabel(row.plannedEndAt)}.`,
				primaryAt: row.plannedEndAt.toISOString(),
				href: `${routes.app.rentals}?status=active`,
			})
		} else if (
			row.status === "active" &&
			row.plannedEndAt &&
			row.plannedEndAt >= todayStart &&
			row.plannedEndAt <= todayEnd
		) {
			agendaItems.push({
				id: `due-return-${row.id}`,
				rentalId: row.id,
				kind: "due_return",
				severity: "warning",
				title: `${vehicleLabel} is due back today`,
				supportingText: `${customerLabel} is scheduled to return by ${formatDueLabel(row.plannedEndAt)}.`,
				primaryAt: row.plannedEndAt.toISOString(),
				href: `${routes.app.rentals}?status=active`,
			})
		}

		if (
			row.status === "scheduled" &&
			row.plannedStartAt &&
			row.plannedStartAt >= todayStart &&
			row.plannedStartAt <= todayEnd
		) {
			agendaItems.push({
				id: `due-pickup-${row.id}`,
				rentalId: row.id,
				kind: "due_pickup",
				severity: "warning",
				title: `${vehicleLabel} pickup is scheduled today`,
				supportingText: `${customerLabel} is due to pick up at ${formatDueLabel(row.plannedStartAt)}.`,
				primaryAt: row.plannedStartAt.toISOString(),
				href: `${routes.app.rentals}?status=scheduled`,
			})
		}

		if (row.status === "awaiting_payment") {
			agendaItems.push({
				id: `awaiting-payment-${row.id}`,
				rentalId: row.id,
				kind: "awaiting_payment",
				severity: "warning",
				title: `${vehicleLabel} still needs payment`,
				supportingText: `${customerLabel} has not cleared booking payment yet.`,
				primaryAt:
					row.plannedStartAt?.toISOString() ?? row.createdAt.toISOString(),
				href: `${routes.app.rentals}?status=awaiting_payment`,
			})
		}

		if (row.plannedStartAt && row.plannedStartAt >= flowStart) {
			const key = row.plannedStartAt.toISOString().slice(0, 10)
			const bucket = rentalFlowMap.get(key)
			if (bucket) {
				bucket.pickups += 1
			}
		}

		if (row.plannedEndAt && row.plannedEndAt >= flowStart) {
			const key = row.plannedEndAt.toISOString().slice(0, 10)
			const bucket = rentalFlowMap.get(key)
			if (bucket) {
				bucket.returns += 1
			}
		}
	}

	if (summary.overdueReturns > 0) {
		alertItems.push({
			id: "alert-overdue-returns",
			severity: "critical",
			label: `${summary.overdueReturns} overdue return${summary.overdueReturns === 1 ? "" : "s"}`,
			supportingText:
				"Active rentals have passed their planned return time and need follow-up.",
			timestamp: now.toISOString(),
			href: `${routes.app.rentals}?status=active`,
		})
	}

	if (summary.awaitingPayment > 0) {
		alertItems.push({
			id: "alert-awaiting-payment",
			severity: "warning",
			label: `${summary.awaitingPayment} booking${summary.awaitingPayment === 1 ? "" : "s"} awaiting payment`,
			supportingText:
				"These rentals cannot move forward cleanly until payment is resolved.",
			timestamp: now.toISOString(),
			href: `${routes.app.rentals}?status=awaiting_payment`,
		})
	}

	if (failedPaymentRows.length > 0) {
		alertItems.push({
			id: "alert-failed-payments",
			severity: "critical",
			label: `${failedPaymentRows.length} failed payment${failedPaymentRows.length === 1 ? "" : "s"}`,
			supportingText:
				"Payment collection has failed and needs manual attention from operations.",
			timestamp: now.toISOString(),
			href: routes.app.billingAttention,
		})
	}

	if (requiresActionRows.length > 0) {
		alertItems.push({
			id: "alert-payment-actions",
			severity: "warning",
			label: `${requiresActionRows.length} payment${requiresActionRows.length === 1 ? "" : "s"} require customer action`,
			supportingText:
				"Customer follow-up is needed before these bookings are fully operational.",
			timestamp: now.toISOString(),
			href: routes.app.billingAttention,
		})
	}

	const branchLoadMap = new Map<
		string,
		DashboardOverviewResponse["branchLoad"]["rows"][number]
	>()
	for (const row of branchRows) {
		branchLoadMap.set(row.id, {
			branchId: row.id,
			branchName: row.name,
			activeRentals: 0,
			pickupsToday: 0,
			availableVehicles: 0,
		})
	}

	for (const row of rentalRows) {
		if (!row.branchId || !branchLoadMap.has(row.branchId)) {
			continue
		}

		const entry = branchLoadMap.get(row.branchId)
		if (!entry) {
			continue
		}

		if (row.status === "active") {
			entry.activeRentals += 1
		}
		if (
			row.plannedStartAt &&
			row.plannedStartAt >= todayStart &&
			row.plannedStartAt <= todayEnd
		) {
			entry.pickupsToday += 1
		}
	}

	const complianceItems: DashboardOverviewResponse["compliance"]["items"] = []
	let retiredVehicles = 0

	for (const row of vehicleRows) {
		if (row.status === "Available") {
			summary.availableVehicles += 1
		}
		if (row.status === "Rented") {
			summary.rentedVehicles += 1
		}
		if (row.status === "Maintenance") {
			summary.maintenanceVehicles += 1
		}
		if (row.status === "Retired") {
			retiredVehicles += 1
		}

		if (row.branchId && row.status === "Available") {
			const entry = branchLoadMap.get(row.branchId)
			if (entry) {
				entry.availableVehicles += 1
			}
		}

		if (row.status === "Retired") {
			continue
		}

		const vehicleLabel = `${row.year} ${row.brandName} ${row.modelName}`
		const href = routes.app.vehicleDetails(row.id)

		if (row.registrationExpiryDate < todayStart) {
			complianceItems.push({
				id: `registration-overdue-${row.id}`,
				vehicleId: row.id,
				vehicleLabel,
				licensePlate: row.licensePlate,
				branchName: row.branchName,
				kind: "registration",
				severity: "critical",
				dueAt: row.registrationExpiryDate.toISOString(),
				href,
			})
		} else if (
			row.registrationExpiryDate >= todayStart &&
			row.registrationExpiryDate <= complianceWindowEnd
		) {
			complianceItems.push({
				id: `registration-upcoming-${row.id}`,
				vehicleId: row.id,
				vehicleLabel,
				licensePlate: row.licensePlate,
				branchName: row.branchName,
				kind: "registration",
				severity: "warning",
				dueAt: row.registrationExpiryDate.toISOString(),
				href,
			})
		}

		if (row.insuranceExpiryDate < todayStart) {
			complianceItems.push({
				id: `insurance-overdue-${row.id}`,
				vehicleId: row.id,
				vehicleLabel,
				licensePlate: row.licensePlate,
				branchName: row.branchName,
				kind: "insurance",
				severity: "critical",
				dueAt: row.insuranceExpiryDate.toISOString(),
				href,
			})
		} else if (
			row.insuranceExpiryDate >= todayStart &&
			row.insuranceExpiryDate <= complianceWindowEnd
		) {
			complianceItems.push({
				id: `insurance-upcoming-${row.id}`,
				vehicleId: row.id,
				vehicleLabel,
				licensePlate: row.licensePlate,
				branchName: row.branchName,
				kind: "insurance",
				severity: "warning",
				dueAt: row.insuranceExpiryDate.toISOString(),
				href,
			})
		}
	}

	const complianceSummary = {
		overdueRegistration: complianceItems.filter(
			(item) => item.kind === "registration" && item.severity === "critical",
		).length,
		upcomingRegistration: complianceItems.filter(
			(item) => item.kind === "registration" && item.severity === "warning",
		).length,
		overdueInsurance: complianceItems.filter(
			(item) => item.kind === "insurance" && item.severity === "critical",
		).length,
		upcomingInsurance: complianceItems.filter(
			(item) => item.kind === "insurance" && item.severity === "warning",
		).length,
	}

	for (const item of complianceItems) {
		alertItems.push({
			id: `alert-${item.id}`,
			severity: item.severity,
			label: `${item.vehicleLabel} ${item.kind} ${item.severity === "critical" ? "is overdue" : "is expiring soon"}`,
			supportingText: `${item.licensePlate}${item.branchName ? ` • ${item.branchName}` : ""}`,
			timestamp: item.dueAt,
			href: item.href,
		})
	}

	const branchLoadRows = [...branchLoadMap.values()].sort((left, right) => {
		const intensityLeft =
			left.activeRentals * 3 + left.pickupsToday * 2 + left.availableVehicles
		const intensityRight =
			right.activeRentals * 3 + right.pickupsToday * 2 + right.availableVehicles
		if (intensityLeft !== intensityRight) {
			return intensityRight - intensityLeft
		}

		return left.branchName.localeCompare(right.branchName)
	})

	let fleetPreview: DashboardOverviewResponse["fleetPreview"] = {
		canViewLiveFleet: false,
		defaultViewport: null,
		stats: {
			moving: 0,
			parked: 0,
			offline: 0,
			noData: 0,
		},
		vehicles: [],
	}

	if (fleetLive) {
		fleetPreview = {
			canViewLiveFleet: true,
			defaultViewport: fleetLive.defaultViewport,
			stats: {
				moving: fleetLive.vehicles.filter(
					(item) => item.telemetryStatus === "moving",
				).length,
				parked: fleetLive.vehicles.filter(
					(item) => item.telemetryStatus === "parked",
				).length,
				offline: fleetLive.vehicles.filter(
					(item) => item.telemetryStatus === "offline",
				).length,
				noData: fleetLive.vehicles.filter(
					(item) => item.telemetryStatus === "no_data",
				).length,
			},
			vehicles: fleetLive.vehicles.map((item) => ({
				id: item.id,
				label: item.label,
				licensePlate: item.licensePlate,
				telemetryStatus: item.telemetryStatus,
				isRentedNow: item.isRentedNow,
				snapshot: item.snapshot
					? {
							latitude: item.snapshot.latitude,
							longitude: item.snapshot.longitude,
							speedKph: item.snapshot.speedKph,
							heading: item.snapshot.heading,
							accuracyMeters: item.snapshot.accuracyMeters,
							recordedAt: item.snapshot.recordedAt,
							receivedAt: item.snapshot.receivedAt,
							source: item.snapshot.source,
							freshnessSeconds: item.snapshot.freshnessSeconds,
						}
					: null,
			})),
		}
		summary.offlineTrackedVehicles = fleetPreview.stats.offline
	}

	const agendaPriority = {
		overdue_return: 0,
		due_return: 1,
		due_pickup: 2,
		awaiting_payment: 3,
	} as const

	agendaItems.sort((left, right) => {
		const priorityDifference =
			agendaPriority[left.kind] - agendaPriority[right.kind]
		if (priorityDifference !== 0) {
			return priorityDifference
		}

		const leftTime = left.primaryAt ? new Date(left.primaryAt).getTime() : 0
		const rightTime = right.primaryAt ? new Date(right.primaryAt).getTime() : 0
		return leftTime - rightTime
	})

	alertItems.sort((left, right) => {
		if (left.severity !== right.severity) {
			return left.severity === "critical" ? -1 : 1
		}

		const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0
		const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0
		return leftTime - rightTime
	})

	const payload: DashboardOverviewResponse = {
		summary,
		agenda: {
			items: agendaItems.slice(0, 8),
		},
		alerts: {
			items: alertItems.slice(0, 8),
		},
		charts: {
			rentalFlow: [...rentalFlowMap.values()],
			fleetStatus: createFleetStatusRows({
				availableVehicles: summary.availableVehicles,
				rentedVehicles: summary.rentedVehicles,
				maintenanceVehicles: summary.maintenanceVehicles,
				retiredVehicles,
			}),
			branchLoad: branchLoadRows,
		},
		branchLoad: {
			rows: branchLoadRows,
		},
		fleetPreview,
		compliance: {
			summary: complianceSummary,
			items: complianceItems
				.sort((left, right) => {
					if (left.severity !== right.severity) {
						return left.severity === "critical" ? -1 : 1
					}

					return (
						new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime()
					)
				})
				.slice(0, 6),
		},
		permissions: {
			viewBookings: canViewBookings,
			viewFleet: canViewFleet,
			viewLiveFleet: canViewLiveFleet,
			manageVehicles: canManageVehicles,
			manageBillingAttention: canManageBillingAttention,
			viewBranches: canViewBranches,
		},
	}

	return NextResponse.json(payload)
}
