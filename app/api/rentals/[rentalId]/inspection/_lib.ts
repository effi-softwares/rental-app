import { and, desc, eq } from "drizzle-orm"

import { getViewerMembershipId } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { rentalDamage, rentalInspection } from "@/lib/db/schema/rentals"
import { vehicle } from "@/lib/db/schema/vehicles"
import type { Context } from "@/types"
import {
	logRentalEvent,
	mapRentalDamageRecord,
	mapRentalInspectionRecord,
	numericToNumber,
} from "../../_lib"

function normalizeChecklist(value: unknown) {
	if (!value || typeof value !== "object") {
		return {}
	}

	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
			key,
			Boolean(entry),
		]),
	)
}

function normalizeMedia(value: unknown) {
	if (!Array.isArray(value)) {
		return []
	}

	return value
		.filter((entry) => entry && typeof entry === "object")
		.map((entry) => {
			const media = entry as {
				assetId?: unknown
				deliveryUrl?: unknown
				blurDataUrl?: unknown
				label?: unknown
			}

			if (
				typeof media.assetId !== "string" ||
				typeof media.deliveryUrl !== "string" ||
				typeof media.blurDataUrl !== "string"
			) {
				return null
			}

			return {
				assetId: media.assetId,
				deliveryUrl: media.deliveryUrl,
				blurDataUrl: media.blurDataUrl,
				label: typeof media.label === "string" ? media.label : null,
			}
		})
		.filter(
			(
				entry,
			): entry is {
				assetId: string
				deliveryUrl: string
				blurDataUrl: string
				label: string | null
			} => Boolean(entry),
		)
}

export async function saveRentalInspection(input: {
	viewer: Context & { activeOrganizationId: string }
	rentalId: string
	vehicleId: string | null
	branchId: string | null
	stage: "pickup" | "return"
	payload: {
		odometerKm?: number | null
		fuelPercent?: number | null
		cleanliness?: "clean" | "needs_attention" | "dirty" | null
		conditionRating?: "excellent" | "good" | "fair" | "poor" | null
		updateVehicleCondition?: boolean
		checklist?: Record<string, boolean>
		notes?: string
		signature?: string
		signerName?: string
		media?: Array<{
			assetId: string
			deliveryUrl: string
			blurDataUrl: string
			label?: string | null
		}>
		damages?: Array<{
			category: "exterior" | "interior" | "mechanical" | "other"
			title: string
			description?: string
			severity: "minor" | "moderate" | "severe"
			customerLiabilityAmount?: number
			estimatedCost?: number | null
			actualCost?: number | null
			repairStatus?: "reported" | "approved" | "repaired" | "waived"
			occurredAt?: string | null
			media?: Array<{
				assetId: string
				deliveryUrl: string
				blurDataUrl: string
				label?: string | null
			}>
		}>
	}
}) {
	const memberId = await getViewerMembershipId(input.viewer)
	const normalizedInspectionValues = {
		odometerKm:
			typeof input.payload.odometerKm === "number"
				? input.payload.odometerKm.toFixed(2)
				: null,
		fuelPercent:
			typeof input.payload.fuelPercent === "number"
				? input.payload.fuelPercent.toFixed(2)
				: null,
		cleanliness: input.payload.cleanliness ?? null,
		conditionRating: input.payload.conditionRating ?? null,
		checklistJson: normalizeChecklist(input.payload.checklist),
		notes: input.payload.notes?.trim() || null,
		signaturePayload: {
			signerName: input.payload.signerName?.trim() || null,
			signature: input.payload.signature?.trim() || null,
		},
		mediaJson: normalizeMedia(input.payload.media),
		completedByMemberId: memberId,
		completedAt: new Date(),
		updatedAt: new Date(),
	}

	const existingInspection =
		input.stage === "return"
			? await db
				.select()
				.from(rentalInspection)
				.where(
					and(
						eq(
							rentalInspection.organizationId,
							input.viewer.activeOrganizationId,
						),
						eq(rentalInspection.rentalId, input.rentalId),
						eq(rentalInspection.stage, input.stage),
					),
				)
				.orderBy(
					desc(rentalInspection.completedAt),
					desc(rentalInspection.createdAt),
				)
				.limit(1)
				.then((rows) => rows[0] ?? null)
			: null

	const inspection = existingInspection
		? await db
			.update(rentalInspection)
			.set(normalizedInspectionValues)
			.where(
				and(
					eq(
						rentalInspection.organizationId,
						input.viewer.activeOrganizationId,
					),
					eq(rentalInspection.id, existingInspection.id),
				),
			)
			.returning()
			.then((rows) => rows[0])
		: await db
			.insert(rentalInspection)
			.values({
				organizationId: input.viewer.activeOrganizationId,
				branchId: input.branchId,
				rentalId: input.rentalId,
				stage: input.stage,
				...normalizedInspectionValues,
			})
			.returning()
			.then((rows) => rows[0])

	if (existingInspection) {
		await db
			.delete(rentalDamage)
			.where(
				and(
					eq(rentalDamage.organizationId, input.viewer.activeOrganizationId),
					eq(rentalDamage.inspectionId, existingInspection.id),
				),
			)
	}

	const normalizedDamages = (input.payload.damages ?? [])
		.filter((entry) => entry.title.trim().length > 0)
		.map((entry) => ({
			category: entry.category,
			title: entry.title.trim(),
			description: entry.description?.trim() || null,
			severity: entry.severity,
			customerLiabilityAmount: Math.max(0, entry.customerLiabilityAmount ?? 0),
			estimatedCost:
				entry.estimatedCost == null ? null : Math.max(0, entry.estimatedCost),
			actualCost:
				entry.actualCost == null ? null : Math.max(0, entry.actualCost),
			repairStatus: entry.repairStatus ?? "reported",
			occurredAt:
				entry.occurredAt && !Number.isNaN(new Date(entry.occurredAt).getTime())
					? new Date(entry.occurredAt)
					: null,
			mediaJson: normalizeMedia(entry.media),
		}))

	const damageRows =
		normalizedDamages.length > 0
			? await db
				.insert(rentalDamage)
				.values(
					normalizedDamages.map((entry) => ({
						organizationId: input.viewer.activeOrganizationId,
						branchId: input.branchId,
						rentalId: input.rentalId,
						inspectionId: inspection.id,
						category: entry.category,
						title: entry.title,
						description: entry.description,
						severity: entry.severity,
						customerLiabilityAmount: entry.customerLiabilityAmount.toFixed(2),
						estimatedCost:
							entry.estimatedCost == null
								? null
								: entry.estimatedCost.toFixed(2),
						actualCost:
							entry.actualCost == null ? null : entry.actualCost.toFixed(2),
						repairStatus: entry.repairStatus,
						occurredAt: entry.occurredAt,
						mediaJson: entry.mediaJson,
						metadata: {
							stage: input.stage,
						},
					})),
				)
				.returning()
			: []

	const shouldUpdateVehicleCondition =
		input.stage === "return" || Boolean(input.payload.updateVehicleCondition)

	if (shouldUpdateVehicleCondition && input.vehicleId) {
		const recordedAt = inspection.completedAt.toISOString()
		await db
			.update(vehicle)
			.set({
				latestConditionSnapshot: {
					rating: inspection.conditionRating || 'fair',
					inspectionStage: input.stage,
					rentalId: input.rentalId,
					inspectionId: inspection.id,
					recordedAt,
					odometerKm:
						inspection.odometerKm === null
							? null
							: numericToNumber(inspection.odometerKm),
					fuelPercent:
						inspection.fuelPercent === null
							? null
							: numericToNumber(inspection.fuelPercent),
					cleanliness: inspection.cleanliness,
					notes: inspection.notes,
					media: normalizeMedia(input.payload.media),
				},
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(vehicle.organizationId, input.viewer.activeOrganizationId),
					eq(vehicle.id, input.vehicleId),
				),
			)
	}

	await logRentalEvent({
		viewer: input.viewer,
		rentalId: input.rentalId,
		branchId: input.branchId,
		type: `rental.inspection.${input.stage}.saved`,
		payload: {
			inspectionId: inspection.id,
			conditionRating: inspection.conditionRating,
			odometerKm:
				inspection.odometerKm === null
					? null
					: numericToNumber(inspection.odometerKm),
			fuelPercent:
				inspection.fuelPercent === null
					? null
					: numericToNumber(inspection.fuelPercent),
			damageCount: damageRows.length,
		},
	})

	return {
		inspection: mapRentalInspectionRecord(inspection),
		damages: damageRows.map(mapRentalDamageRecord),
	}
}
