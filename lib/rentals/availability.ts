import { and, eq, inArray, ne } from "drizzle-orm"

import { resolvePricingBucket } from "@/features/rentals/lib/quote"
import type {
	RentalAlternativeMatchMode,
	RentalAvailabilityAlternative,
	RentalAvailabilityConflict,
	RentalAvailabilityDayCell,
	RentalAvailabilityResponse,
	RentalVehicleSummary,
} from "@/features/rentals/types/rental"
import { db } from "@/lib/db"
import { rental, vehicleAvailabilityBlock } from "@/lib/db/schema/rentals"
import {
	vehicle,
	vehicleBrand,
	vehicleClass,
	vehicleModel,
	vehicleRate,
} from "@/lib/db/schema/vehicles"

const quarterHourMs = 15 * 60 * 1000
const draftHoldMinutes = 20
const alternativeLimit = 6

type AvailabilityVehicleRow = {
	id: string
	branchId: string | null
	vehicleClassId: string | null
	vehicleClassName: string | null
	vehicleClassCode: string | null
	brandId: string
	brandName: string
	modelId: string
	modelName: string
	year: number
	licensePlate: string
	status: string
	transmission: "Automatic" | "Manual" | "Semi-Automatic"
	seats: number
	images: unknown
}

function overlaps(
	leftStart: Date,
	leftEnd: Date,
	rightStart: Date,
	rightEnd: Date,
) {
	return leftStart < rightEnd && rightStart < leftEnd
}

function startOfDay(date: Date) {
	const next = new Date(date)
	next.setHours(0, 0, 0, 0)
	return next
}

function endOfDay(date: Date) {
	const next = new Date(date)
	next.setHours(23, 59, 59, 999)
	return next
}

function addDays(date: Date, days: number) {
	const next = new Date(date)
	next.setDate(next.getDate() + days)
	return next
}

function diffDays(startAt: Date, endAt: Date) {
	return Math.max(
		1,
		Math.ceil((endAt.getTime() - startAt.getTime()) / 86_400_000),
	)
}

function isQuarterHourAligned(date: Date) {
	return (
		date.getSeconds() === 0 &&
		date.getMilliseconds() === 0 &&
		date.getTime() % quarterHourMs === 0
	)
}

function isVehicleRentableStatus(status: string) {
	return status === "Available"
}

function pickFrontImage(images: unknown) {
	if (!images || typeof images !== "object") {
		return null
	}

	const frontImages = (
		images as { frontImages?: Array<Record<string, unknown>> }
	).frontImages
	if (!Array.isArray(frontImages)) {
		return null
	}

	const sorted = [...frontImages]
		.filter((entry) => entry && typeof entry === "object")
		.sort((left, right) => {
			const leftOrder =
				typeof left.sortOrder === "number"
					? left.sortOrder
					: Number.MAX_SAFE_INTEGER
			const rightOrder =
				typeof right.sortOrder === "number"
					? right.sortOrder
					: Number.MAX_SAFE_INTEGER
			return leftOrder - rightOrder
		})

	const first = sorted[0]
	if (
		!first ||
		typeof first.assetId !== "string" ||
		typeof first.deliveryUrl !== "string" ||
		typeof first.blurDataUrl !== "string"
	) {
		return null
	}

	return {
		assetId: first.assetId,
		deliveryUrl: first.deliveryUrl,
		blurDataUrl: first.blurDataUrl,
	}
}

function pricingModelForBucket(bucket: "day" | "week" | "month") {
	switch (bucket) {
		case "day":
			return "Daily" as const
		case "week":
			return "Weekly" as const
		case "month":
			return "Monthly" as const
	}
}

function buildVehicleSummary(
	row: AvailabilityVehicleRow,
	rates: Array<{
		pricingModel: "Daily" | "Weekly" | "Monthly" | "Distance-Based"
		rate: number
		requiresDeposit: boolean
		depositAmount: number | null
	}>,
): RentalVehicleSummary {
	return {
		id: row.id,
		label: `${row.year} ${row.brandName} ${row.modelName}`,
		licensePlate: row.licensePlate,
		status: row.status,
		branchId: row.branchId,
		vehicleClassId: row.vehicleClassId,
		vehicleClassName: row.vehicleClassName,
		vehicleClassCode: row.vehicleClassCode,
		transmission: row.transmission,
		seats: row.seats,
		frontImage: pickFrontImage(row.images),
		rates,
		latestConditionSnapshot: null,
	}
}

async function getVehicleRows(organizationId: string, vehicleIds?: string[]) {
	const rows = await db
		.select({
			id: vehicle.id,
			branchId: vehicle.branchId,
			vehicleClassId: vehicle.vehicleClassId,
			vehicleClassName: vehicleClass.name,
			vehicleClassCode: vehicleClass.code,
			brandId: vehicle.brandId,
			brandName: vehicleBrand.name,
			modelId: vehicle.modelId,
			modelName: vehicleModel.name,
			year: vehicle.year,
			licensePlate: vehicle.licensePlate,
			status: vehicle.status,
			transmission: vehicle.transmission,
			seats: vehicle.seats,
			images: vehicle.images,
		})
		.from(vehicle)
		.innerJoin(vehicleBrand, eq(vehicle.brandId, vehicleBrand.id))
		.innerJoin(vehicleModel, eq(vehicle.modelId, vehicleModel.id))
		.leftJoin(vehicleClass, eq(vehicle.vehicleClassId, vehicleClass.id))
		.where(
			and(
				eq(vehicle.organizationId, organizationId),
				vehicleIds && vehicleIds.length > 0
					? inArray(vehicle.id, vehicleIds)
					: undefined,
			),
		)

	const rateRows = await db
		.select({
			vehicleId: vehicleRate.vehicleId,
			pricingModel: vehicleRate.pricingModel,
			rate: vehicleRate.rate,
			requiresDeposit: vehicleRate.requiresDeposit,
			depositAmount: vehicleRate.depositAmount,
		})
		.from(vehicleRate)
		.where(
			and(
				eq(vehicleRate.organizationId, organizationId),
				vehicleIds && vehicleIds.length > 0
					? inArray(vehicleRate.vehicleId, vehicleIds)
					: undefined,
			),
		)

	const ratesByVehicle = rateRows.reduce<
		Map<
			string,
			Array<{
				pricingModel: "Daily" | "Weekly" | "Monthly" | "Distance-Based"
				rate: number
				requiresDeposit: boolean
				depositAmount: number | null
			}>
		>
	>((map, row) => {
		const collection = map.get(row.vehicleId) ?? []
		collection.push({
			pricingModel: row.pricingModel,
			rate: Number(row.rate),
			requiresDeposit: row.requiresDeposit,
			depositAmount:
				row.depositAmount === null ? null : Number(row.depositAmount),
		})
		map.set(row.vehicleId, collection)
		return map
	}, new Map())

	return rows.map((row) => ({
		row,
		summary: buildVehicleSummary(row, ratesByVehicle.get(row.id) ?? []),
	}))
}

async function getConflictsForVehicles(input: {
	organizationId: string
	vehicleIds: string[]
	startsAt: Date
	endsAt: Date
	rentalId?: string | null
}) {
	if (input.vehicleIds.length === 0) {
		return new Map<string, RentalAvailabilityConflict[]>()
	}

	const now = new Date()
	const [rentalRows, blockRows] = await Promise.all([
		db
			.select({
				id: rental.id,
				vehicleId: rental.vehicleId,
				plannedStartAt: rental.plannedStartAt,
				plannedEndAt: rental.plannedEndAt,
				status: rental.status,
			})
			.from(rental)
			.where(
				and(
					eq(rental.organizationId, input.organizationId),
					inArray(rental.vehicleId, input.vehicleIds),
					inArray(rental.status, ["awaiting_payment", "scheduled", "active"]),
					input.rentalId ? ne(rental.id, input.rentalId) : undefined,
				),
			),
		db
			.select({
				id: vehicleAvailabilityBlock.id,
				vehicleId: vehicleAvailabilityBlock.vehicleId,
				rentalId: vehicleAvailabilityBlock.rentalId,
				sourceType: vehicleAvailabilityBlock.sourceType,
				status: vehicleAvailabilityBlock.status,
				startsAt: vehicleAvailabilityBlock.startsAt,
				endsAt: vehicleAvailabilityBlock.endsAt,
				expiresAt: vehicleAvailabilityBlock.expiresAt,
				note: vehicleAvailabilityBlock.note,
			})
			.from(vehicleAvailabilityBlock)
			.where(
				and(
					eq(vehicleAvailabilityBlock.organizationId, input.organizationId),
					inArray(vehicleAvailabilityBlock.vehicleId, input.vehicleIds),
					eq(vehicleAvailabilityBlock.status, "active"),
				),
			),
	])

	const conflictsByVehicle = new Map<string, RentalAvailabilityConflict[]>()

	for (const row of rentalRows) {
		if (!row.vehicleId || !row.plannedStartAt || !row.plannedEndAt) {
			continue
		}

		if (
			!overlaps(
				input.startsAt,
				input.endsAt,
				row.plannedStartAt,
				row.plannedEndAt,
			)
		) {
			continue
		}

		const collection = conflictsByVehicle.get(row.vehicleId) ?? []
		collection.push({
			id: row.id,
			sourceType: "rental",
			startsAt: row.plannedStartAt.toISOString(),
			endsAt: row.plannedEndAt.toISOString(),
			note: `Blocked by ${row.status} rental`,
			status: "active",
			rentalId: row.id,
		})
		conflictsByVehicle.set(row.vehicleId, collection)
	}

	for (const row of blockRows) {
		if (row.expiresAt && row.expiresAt <= now) {
			continue
		}

		if (
			input.rentalId &&
			row.rentalId === input.rentalId &&
			row.sourceType === "draft_hold"
		) {
			continue
		}

		if (!overlaps(input.startsAt, input.endsAt, row.startsAt, row.endsAt)) {
			continue
		}

		const collection = conflictsByVehicle.get(row.vehicleId) ?? []
		collection.push({
			id: row.id,
			sourceType: row.sourceType,
			startsAt: row.startsAt.toISOString(),
			endsAt: row.endsAt.toISOString(),
			note: row.note,
			status: row.status,
			rentalId: row.rentalId,
		})
		conflictsByVehicle.set(row.vehicleId, collection)
	}

	return conflictsByVehicle
}

function buildDayCells(
	startsAt: Date,
	endsAt: Date,
	conflicts: RentalAvailabilityConflict[],
) {
	const cells: RentalAvailabilityDayCell[] = []
	let cursor = startOfDay(startsAt)
	const finish = startOfDay(endsAt)

	while (cursor <= finish) {
		const cellStart = startOfDay(cursor)
		const cellEnd = endOfDay(cursor)
		const overlapping = conflicts.filter((conflict) =>
			overlaps(
				cellStart,
				cellEnd,
				new Date(conflict.startsAt),
				new Date(conflict.endsAt),
			),
		)

		const status =
			overlapping.length === 0
				? "available"
				: overlapping.some((conflict) => {
							const blockStart = new Date(conflict.startsAt)
							const blockEnd = new Date(conflict.endsAt)
							return blockStart <= cellStart && blockEnd >= cellEnd
						})
					? "blocked"
					: "partial"

		cells.push({
			date: cellStart.toISOString(),
			status,
			notes: [
				...new Set(
					overlapping.map((conflict) => conflict.note).filter(Boolean),
				),
			] as string[],
		})

		cursor = addDays(cursor, 1)
	}

	return cells
}

async function findNextAvailableRange(input: {
	organizationId: string
	vehicleId: string
	startsAt: Date
	endsAt: Date
	rentalId?: string | null
}) {
	const durationMs = input.endsAt.getTime() - input.startsAt.getTime()

	for (let dayOffset = 1; dayOffset <= 60; dayOffset += 1) {
		const nextStart = addDays(input.startsAt, dayOffset)
		const nextEnd = new Date(nextStart.getTime() + durationMs)
		const conflicts = await getConflictsForVehicles({
			organizationId: input.organizationId,
			vehicleIds: [input.vehicleId],
			startsAt: nextStart,
			endsAt: nextEnd,
			rentalId: input.rentalId,
		})

		if ((conflicts.get(input.vehicleId) ?? []).length === 0) {
			return {
				startsAt: nextStart.toISOString(),
				endsAt: nextEnd.toISOString(),
			}
		}
	}

	return null
}

function rateForBucket(
	vehicleSummary: RentalVehicleSummary,
	bucket: "day" | "week" | "month",
) {
	const model = pricingModelForBucket(bucket)
	return (
		vehicleSummary.rates.find((rate) => rate.pricingModel === model)?.rate ??
		null
	)
}

function buildAlternativeReasons(input: {
	selectedVehicle: AvailabilityVehicleRow
	candidate: AvailabilityVehicleRow
	matchMode: RentalAlternativeMatchMode
	selectedBucketRate: number | null
	candidateBucketRate: number | null
}) {
	const reasons: string[] = []

	if (input.candidate.vehicleClassName) {
		reasons.push(`Same class: ${input.candidate.vehicleClassName}`)
	}

	if (input.candidate.transmission === input.selectedVehicle.transmission) {
		reasons.push(`${input.candidate.transmission} transmission match`)
	}

	if (input.candidate.seats >= input.selectedVehicle.seats) {
		reasons.push(`${input.candidate.seats} seats`)
	}

	if (
		input.matchMode === "same_class_brand_family" &&
		input.candidate.brandId === input.selectedVehicle.brandId
	) {
		reasons.push(`Same brand family: ${input.candidate.brandName}`)
	}

	if (
		input.matchMode === "same_class_price_band" &&
		input.selectedBucketRate !== null &&
		input.candidateBucketRate !== null
	) {
		reasons.push("Within the same pricing band")
	}

	return reasons
}

function rankAlternative(input: {
	selectedVehicle: AvailabilityVehicleRow
	candidate: AvailabilityVehicleRow
	matchMode: RentalAlternativeMatchMode
	selectedBucketRate: number | null
	candidateBucketRate: number | null
}) {
	let score = 0

	if (input.candidate.branchId === input.selectedVehicle.branchId) {
		score += 400
	}

	if (input.candidate.vehicleClassId === input.selectedVehicle.vehicleClassId) {
		score += 300
	}

	if (input.matchMode === "same_class_transmission") {
		if (input.candidate.transmission !== input.selectedVehicle.transmission) {
			return Number.NEGATIVE_INFINITY
		}
		score += 150
	}

	if (input.candidate.seats >= input.selectedVehicle.seats) {
		score += 100
	}

	if (
		input.matchMode === "same_class_brand_family" &&
		input.candidate.brandId !== input.selectedVehicle.brandId
	) {
		return Number.NEGATIVE_INFINITY
	}

	if (
		input.matchMode === "same_class_brand_family" &&
		input.candidate.brandId === input.selectedVehicle.brandId
	) {
		score +=
			input.candidate.modelId === input.selectedVehicle.modelId ? 180 : 120
	}

	if (
		input.matchMode === "same_class_price_band" &&
		input.selectedBucketRate !== null &&
		input.candidateBucketRate !== null
	) {
		const maxDiff = Math.max(25, input.selectedBucketRate * 0.2)
		const diff = Math.abs(input.selectedBucketRate - input.candidateBucketRate)

		if (diff > maxDiff) {
			return Number.NEGATIVE_INFINITY
		}

		score += Math.max(0, 100 - diff)
	} else if (
		input.selectedBucketRate !== null &&
		input.candidateBucketRate !== null
	) {
		score += Math.max(
			0,
			60 - Math.abs(input.selectedBucketRate - input.candidateBucketRate),
		)
	}

	score += input.candidate.year / 10_000

	return score
}

export async function checkRentalAvailability(input: {
	organizationId: string
	vehicleId: string
	startsAt: Date
	endsAt: Date
	rentalId?: string | null
	matchMode?: RentalAlternativeMatchMode
	scopedBranchIds?: string[] | null
}) {
	const matchMode = input.matchMode ?? "same_class"

	if (
		Number.isNaN(input.startsAt.getTime()) ||
		Number.isNaN(input.endsAt.getTime())
	) {
		throw new Error("Valid schedule timestamps are required.")
	}

	if (
		!isQuarterHourAligned(input.startsAt) ||
		!isQuarterHourAligned(input.endsAt)
	) {
		throw new Error("Rental schedule must use 15-minute increments.")
	}

	if (input.endsAt <= input.startsAt) {
		throw new Error("Rental end time must be after the start time.")
	}

	const [selectedVehicleEntry] = await getVehicleRows(input.organizationId, [
		input.vehicleId,
	])
	if (!selectedVehicleEntry) {
		throw new Error("Selected vehicle was not found.")
	}

	if (
		input.scopedBranchIds !== null &&
		input.scopedBranchIds !== undefined &&
		(!selectedVehicleEntry.row.branchId ||
			!input.scopedBranchIds.includes(selectedVehicleEntry.row.branchId))
	) {
		throw new Error("Selected vehicle branch is outside your scope.")
	}

	const conflictsByVehicle = await getConflictsForVehicles({
		organizationId: input.organizationId,
		vehicleIds: [input.vehicleId],
		startsAt: input.startsAt,
		endsAt: input.endsAt,
		rentalId: input.rentalId,
	})

	const conflicts = conflictsByVehicle.get(input.vehicleId) ?? []
	const durationDays = diffDays(input.startsAt, input.endsAt)
	const bucket = resolvePricingBucket(durationDays)
	const selectedBucketRate = rateForBucket(selectedVehicleEntry.summary, bucket)

	let blockingReason: string | null = null
	if (!isVehicleRentableStatus(selectedVehicleEntry.row.status)) {
		blockingReason = `Vehicle is currently ${selectedVehicleEntry.row.status.toLowerCase()}.`
	} else if (conflicts.length > 0) {
		blockingReason =
			conflicts[0]?.note ?? "Vehicle is unavailable for the selected period."
	}

	let nextAvailableRange = null
	if (blockingReason) {
		nextAvailableRange = await findNextAvailableRange({
			organizationId: input.organizationId,
			vehicleId: input.vehicleId,
			startsAt: input.startsAt,
			endsAt: input.endsAt,
			rentalId: input.rentalId,
		})
	}

	let alternatives: RentalAvailabilityAlternative[] = []

	if (selectedVehicleEntry.row.vehicleClassId) {
		const vehicleEntries = await getVehicleRows(input.organizationId)
		const candidateEntries = vehicleEntries.filter(
			(entry) =>
				entry.row.id !== input.vehicleId &&
				entry.row.vehicleClassId === selectedVehicleEntry.row.vehicleClassId &&
				entry.row.branchId === selectedVehicleEntry.row.branchId &&
				isVehicleRentableStatus(entry.row.status),
		)

		const candidateConflicts = await getConflictsForVehicles({
			organizationId: input.organizationId,
			vehicleIds: candidateEntries.map((entry) => entry.row.id),
			startsAt: input.startsAt,
			endsAt: input.endsAt,
			rentalId: input.rentalId,
		})

		alternatives = candidateEntries
			.map((entry) => {
				const candidateBucketRate = rateForBucket(entry.summary, bucket)
				const score = rankAlternative({
					selectedVehicle: selectedVehicleEntry.row,
					candidate: entry.row,
					matchMode,
					selectedBucketRate,
					candidateBucketRate,
				})

				const available =
					(candidateConflicts.get(entry.row.id) ?? []).length === 0

				return {
					score,
					item: {
						vehicle: entry.summary,
						available,
						matchReasons: buildAlternativeReasons({
							selectedVehicle: selectedVehicleEntry.row,
							candidate: entry.row,
							matchMode,
							selectedBucketRate,
							candidateBucketRate,
						}),
						bucketRate: candidateBucketRate,
					} satisfies RentalAvailabilityAlternative,
				}
			})
			.filter((entry) => entry.item.available && Number.isFinite(entry.score))
			.sort((left, right) => right.score - left.score)
			.slice(0, alternativeLimit)
			.map((entry) => entry.item)
	}

	return {
		selectedVehicle: selectedVehicleEntry.summary,
		matchMode,
		range: {
			startsAt: input.startsAt.toISOString(),
			endsAt: input.endsAt.toISOString(),
		},
		durationDays,
		isAvailable: blockingReason === null,
		blockingReason,
		conflicts,
		dayCells: buildDayCells(input.startsAt, input.endsAt, conflicts),
		nextAvailableRange,
		alternatives,
	} satisfies RentalAvailabilityResponse
}

export async function upsertRentalDraftHold(input: {
	organizationId: string
	branchId: string | null
	vehicleId: string
	rentalId: string
	startsAt: Date
	endsAt: Date
	memberId?: string | null
	note?: string | null
}) {
	await db
		.update(vehicleAvailabilityBlock)
		.set({
			status: "released",
			updatedAt: new Date(),
			updatedByMemberId: input.memberId ?? null,
		})
		.where(
			and(
				eq(vehicleAvailabilityBlock.organizationId, input.organizationId),
				eq(vehicleAvailabilityBlock.rentalId, input.rentalId),
				eq(vehicleAvailabilityBlock.sourceType, "draft_hold"),
				eq(vehicleAvailabilityBlock.status, "active"),
			),
		)

	await db.insert(vehicleAvailabilityBlock).values({
		organizationId: input.organizationId,
		branchId: input.branchId,
		vehicleId: input.vehicleId,
		rentalId: input.rentalId,
		sourceType: "draft_hold",
		status: "active",
		startsAt: input.startsAt,
		endsAt: input.endsAt,
		expiresAt: new Date(Date.now() + draftHoldMinutes * 60_000),
		note: input.note ?? "Draft rental hold",
		createdByMemberId: input.memberId ?? null,
		updatedByMemberId: input.memberId ?? null,
	})
}

export async function releaseRentalDraftHold(input: {
	organizationId: string
	rentalId: string
	memberId?: string | null
}) {
	await db
		.update(vehicleAvailabilityBlock)
		.set({
			status: "released",
			expiresAt: new Date(),
			updatedAt: new Date(),
			updatedByMemberId: input.memberId ?? null,
		})
		.where(
			and(
				eq(vehicleAvailabilityBlock.organizationId, input.organizationId),
				eq(vehicleAvailabilityBlock.rentalId, input.rentalId),
				eq(vehicleAvailabilityBlock.sourceType, "draft_hold"),
				eq(vehicleAvailabilityBlock.status, "active"),
			),
		)
}
