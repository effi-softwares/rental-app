import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { computeRentalQuote } from "@/features/rentals/lib/quote"
import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import {
	rental,
	rentalAmendment,
	rentalCharge,
	rentalPricingSnapshot,
} from "@/lib/db/schema/rentals"
import {
	getRentalVehicleSummary,
	getScopedRentalForViewer,
	logRentalEvent,
	numericToNumber,
} from "../../_lib"

type RouteProps = {
	params: Promise<{
		rentalId: string
	}>
}

export async function POST(request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "viewBookingsModule" })

	if (guard.response) {
		return guard.response
	}

	const { rentalId } = await params
	const scopedRental = await getScopedRentalForViewer(guard.viewer, rentalId)

	if ("error" in scopedRental) {
		return scopedRental.error
	}

	if (scopedRental.record.status !== "active") {
		return jsonError("Only active rentals can be extended.", 400)
	}

	if (
		!scopedRental.record.vehicleId ||
		!scopedRental.record.plannedStartAt ||
		!scopedRental.record.plannedEndAt
	) {
		return jsonError("Rental schedule is incomplete.", 400)
	}

	const previousPlannedStartAt = scopedRental.record.plannedStartAt
	const previousPlannedEndAt = scopedRental.record.plannedEndAt

	const payload = (await request.json().catch(() => null)) as {
		nextPlannedEndAt?: string
		reason?: string
	} | null

	const nextPlannedEndAt = payload?.nextPlannedEndAt
		? new Date(payload.nextPlannedEndAt)
		: null

	if (!nextPlannedEndAt || Number.isNaN(nextPlannedEndAt.getTime())) {
		return jsonError("A valid next planned end time is required.", 400)
	}

	if (nextPlannedEndAt <= previousPlannedEndAt) {
		return jsonError("Extension must move the planned end date forward.", 400)
	}

	const [vehicleSummary, snapshotRecord] = await Promise.all([
		getRentalVehicleSummary(
			guard.viewer.activeOrganizationId,
			scopedRental.record.vehicleId,
		),
		scopedRental.record.latestPricingSnapshotId
			? db
					.select()
					.from(rentalPricingSnapshot)
					.where(
						and(
							eq(
								rentalPricingSnapshot.organizationId,
								guard.viewer.activeOrganizationId,
							),
							eq(
								rentalPricingSnapshot.id,
								scopedRental.record.latestPricingSnapshotId,
							),
						),
					)
					.limit(1)
					.then((rows) => rows[0] ?? null)
			: Promise.resolve(null),
	])

	if (!vehicleSummary || !snapshotRecord) {
		return jsonError("Rental pricing context is missing.", 400)
	}

	const taxableBase = Math.max(
		0,
		numericToNumber(snapshotRecord.subtotal) -
			numericToNumber(snapshotRecord.discountTotal),
	)
	const taxRatePercent =
		taxableBase > 0
			? (numericToNumber(snapshotRecord.taxTotal) / taxableBase) * 100
			: 0

	const oldQuote = computeRentalQuote({
		plannedStartAt: previousPlannedStartAt,
		plannedEndAt: previousPlannedEndAt,
		taxRatePercent,
		discountAmount: numericToNumber(snapshotRecord.discountTotal),
		depositRequired: scopedRental.record.depositRequired,
		depositAmount: numericToNumber(snapshotRecord.depositAmount),
		rates: vehicleSummary.rates,
	})
	const newQuote = computeRentalQuote({
		plannedStartAt: previousPlannedStartAt,
		plannedEndAt: nextPlannedEndAt,
		taxRatePercent,
		discountAmount: numericToNumber(snapshotRecord.discountTotal),
		depositRequired: scopedRental.record.depositRequired,
		depositAmount: numericToNumber(snapshotRecord.depositAmount),
		rates: vehicleSummary.rates,
	})
	const deltaAmount = Number(
		Math.max(0, newQuote.grandTotal - oldQuote.grandTotal).toFixed(2),
	)

	const result = await db.transaction(async (tx) => {
		const [amendment] = await tx
			.insert(rentalAmendment)
			.values({
				organizationId: guard.viewer.activeOrganizationId,
				branchId: scopedRental.record.branchId,
				rentalId: scopedRental.record.id,
				type: "extension",
				previousPlannedStartAt,
				previousPlannedEndAt,
				nextPlannedStartAt: previousPlannedStartAt,
				nextPlannedEndAt,
				deltaAmount: deltaAmount.toFixed(2),
				currency: scopedRental.record.currency,
				pricingSnapshotId: scopedRental.record.latestPricingSnapshotId,
				reason: payload?.reason?.trim() || null,
			})
			.returning()

		const [updatedRental] = await tx
			.update(rental)
			.set({
				plannedEndAt: nextPlannedEndAt,
				updatedAt: new Date(),
				version: scopedRental.record.version + 1,
			})
			.where(
				and(
					eq(rental.organizationId, guard.viewer.activeOrganizationId),
					eq(rental.id, scopedRental.record.id),
				),
			)
			.returning({ id: rental.id, plannedEndAt: rental.plannedEndAt })

		const extensionCharge =
			deltaAmount > 0
				? (
						await tx
							.insert(rentalCharge)
							.values({
								organizationId: guard.viewer.activeOrganizationId,
								branchId: scopedRental.record.branchId,
								rentalId: scopedRental.record.id,
								kind: "extension",
								status: "open",
								amount: deltaAmount.toFixed(2),
								taxAmount: "0.00",
								total: deltaAmount.toFixed(2),
								currency: scopedRental.record.currency,
								dueAt: nextPlannedEndAt,
								description: payload?.reason?.trim() || "Rental extension",
								metadata: {
									previousPlannedEndAt: previousPlannedEndAt.toISOString(),
									nextPlannedEndAt: nextPlannedEndAt.toISOString(),
									oldGrandTotal: oldQuote.grandTotal,
									newGrandTotal: newQuote.grandTotal,
								},
							})
							.returning()
					)[0]
				: null

		return {
			updatedRental,
			amendment,
			extensionCharge,
		}
	})

	await logRentalEvent({
		viewer: guard.viewer,
		rentalId: scopedRental.record.id,
		branchId: scopedRental.record.branchId,
		type: "rental.extension.created",
		payload: {
			previousPlannedEndAt: previousPlannedEndAt.toISOString(),
			nextPlannedEndAt:
				result.updatedRental.plannedEndAt?.toISOString() ?? null,
			deltaAmount,
			extensionChargeId: result.extensionCharge?.id ?? null,
		},
	})

	return NextResponse.json({
		rentalId: scopedRental.record.id,
		nextPlannedEndAt:
			result.updatedRental.plannedEndAt?.toISOString() ??
			nextPlannedEndAt.toISOString(),
		amendment: {
			id: result.amendment.id,
			type: result.amendment.type,
			previousPlannedStartAt:
				result.amendment.previousPlannedStartAt?.toISOString() ?? null,
			previousPlannedEndAt:
				result.amendment.previousPlannedEndAt?.toISOString() ?? null,
			nextPlannedStartAt:
				result.amendment.nextPlannedStartAt?.toISOString() ?? null,
			nextPlannedEndAt:
				result.amendment.nextPlannedEndAt?.toISOString() ?? null,
			deltaAmount: numericToNumber(result.amendment.deltaAmount),
			currency: result.amendment.currency,
			pricingSnapshotId: result.amendment.pricingSnapshotId,
			reason: result.amendment.reason,
			createdAt: result.amendment.createdAt.toISOString(),
		},
		extensionCharge: result.extensionCharge
			? {
					id: result.extensionCharge.id,
					kind: result.extensionCharge.kind,
					status: result.extensionCharge.status,
					amount: numericToNumber(result.extensionCharge.amount),
					taxAmount: numericToNumber(result.extensionCharge.taxAmount),
					total: numericToNumber(result.extensionCharge.total),
					currency: result.extensionCharge.currency,
					dueAt: result.extensionCharge.dueAt?.toISOString() ?? null,
					description: result.extensionCharge.description,
					linkedDamageId: result.extensionCharge.linkedDamageId,
					linkedPaymentId: result.extensionCharge.linkedPaymentId,
					metadata:
						(result.extensionCharge.metadata as Record<string, unknown>) ?? {},
					createdAt: result.extensionCharge.createdAt.toISOString(),
					updatedAt: result.extensionCharge.updatedAt.toISOString(),
				}
			: null,
	})
}
