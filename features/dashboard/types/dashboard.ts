export type DashboardAlertSeverity = "warning" | "critical"

export type DashboardAgendaKind =
	| "overdue_return"
	| "due_return"
	| "due_pickup"
	| "awaiting_payment"

export type DashboardSummary = {
	activeRentals: number
	pickupsToday: number
	returnsToday: number
	awaitingPayment: number
	overdueReturns: number
	availableVehicles: number
	rentedVehicles: number
	maintenanceVehicles: number
	offlineTrackedVehicles: number | null
}

export type DashboardAgendaItem = {
	id: string
	rentalId: string
	kind: DashboardAgendaKind
	severity: DashboardAlertSeverity
	title: string
	supportingText: string
	primaryAt: string | null
	href: string
}

export type DashboardAlertItem = {
	id: string
	severity: DashboardAlertSeverity
	label: string
	supportingText: string
	timestamp: string | null
	href: string
}

export type DashboardRentalFlowPoint = {
	date: string
	label: string
	pickups: number
	returns: number
}

export type DashboardFleetStatusPoint = {
	status: "Available" | "Rented" | "Maintenance" | "Retired"
	label: string
	value: number
}

export type DashboardBranchLoadRow = {
	branchId: string
	branchName: string
	activeRentals: number
	pickupsToday: number
	availableVehicles: number
}

export type DashboardFleetPreview = {
	canViewLiveFleet: boolean
	defaultViewport: {
		center: [number, number]
		zoom: number
		selectedZoom: number
		pitch: number
		bearing: number
		styleUrl: string
	} | null
	stats: {
		moving: number
		parked: number
		offline: number
		noData: number
	}
	vehicles: Array<{
		id: string
		label: string
		licensePlate: string
		telemetryStatus: "moving" | "parked" | "offline" | "no_data"
		isRentedNow: boolean
		snapshot: {
			latitude: number
			longitude: number
			speedKph: number | null
			heading: number | null
			accuracyMeters: number | null
			recordedAt: string
			receivedAt: string
			source: "mock" | "traccar"
			freshnessSeconds: number | null
		} | null
	}>
}

export type DashboardComplianceItem = {
	id: string
	vehicleId: string
	vehicleLabel: string
	licensePlate: string
	branchName: string | null
	kind: "registration" | "insurance"
	severity: DashboardAlertSeverity
	dueAt: string
	href: string
}

export type DashboardOverviewResponse = {
	summary: DashboardSummary
	agenda: {
		items: DashboardAgendaItem[]
	}
	alerts: {
		items: DashboardAlertItem[]
	}
	charts: {
		rentalFlow: DashboardRentalFlowPoint[]
		fleetStatus: DashboardFleetStatusPoint[]
		branchLoad: DashboardBranchLoadRow[]
	}
	branchLoad: {
		rows: DashboardBranchLoadRow[]
	}
	fleetPreview: DashboardFleetPreview
	compliance: {
		summary: {
			overdueRegistration: number
			upcomingRegistration: number
			overdueInsurance: number
			upcomingInsurance: number
		}
		items: DashboardComplianceItem[]
	}
	permissions: {
		viewBookings: boolean
		viewFleet: boolean
		viewLiveFleet: boolean
		manageVehicles: boolean
		manageBillingAttention: boolean
		viewBranches: boolean
	}
}
