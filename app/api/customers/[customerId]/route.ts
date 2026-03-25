import { and, count, eq, inArray, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"

import { CUSTOMER_VERIFICATION_STATUSES } from "@/features/customers/constants"
import {
	normalizeCustomerEmail,
	normalizeCustomerPhone,
} from "@/features/customers/lib/normalize"
import type { CustomerDetailResponse } from "@/features/customers/types"
import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { customer } from "@/lib/db/schema/customers"
import { mediaAsset, mediaLink } from "@/lib/db/schema/media"
import { rental } from "@/lib/db/schema/rentals"
import { getMediaStorageBucketFromMetadata } from "@/lib/media/storage-bucket"
import type { StorageVisibility } from "@/lib/storage"
import { getStorageAdapter } from "@/lib/storage"
import {
	normalizeCustomerDetail,
	resolveAssignableBranch,
	resolveVisibleCustomer,
} from "../_lib"

type RouteProps = {
	params: Promise<{
		customerId: string
	}>
}

export async function GET(_: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "viewCustomerModule" })

	if (guard.response) {
		return guard.response
	}

	const { customerId } = await params
	const target = await resolveVisibleCustomer({
		viewer: guard.viewer,
		customerId,
	})

	if (target.response) {
		return target.response
	}

	const rentalHistoryRows = await db
		.select({ value: count() })
		.from(rental)
		.where(
			and(
				eq(rental.organizationId, guard.viewer.activeOrganizationId),
				eq(rental.customerId, customerId),
			),
		)

	return NextResponse.json({
		customer: normalizeCustomerDetail(target.customer),
		hasRentalHistory: Number(rentalHistoryRows[0]?.value ?? 0) > 0,
	} satisfies CustomerDetailResponse)
}

export async function PATCH(request: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "manageCustomers" })

	if (guard.response) {
		return guard.response
	}

	const { customerId } = await params
	const target = await resolveVisibleCustomer({
		viewer: guard.viewer,
		customerId,
	})

	if (target.response) {
		return target.response
	}

	const payload = (await request.json().catch(() => null)) as {
		fullName?: string
		email?: string | null
		phone?: string | null
		branchId?: string | null
		verificationStatus?: string
		verificationMetadata?: Record<string, unknown>
	} | null

	const updates: Partial<typeof customer.$inferInsert> = {
		updatedAt: new Date(),
	}

	if (typeof payload?.fullName === "string") {
		const fullName = payload.fullName.trim()
		if (!fullName) {
			return jsonError("Customer full name is required.", 400)
		}
		updates.fullName = fullName
	}

	if (payload?.email !== undefined) {
		updates.email = payload.email?.trim() || null
		updates.emailNormalized = normalizeCustomerEmail(payload.email)
	}

	if (payload?.phone !== undefined) {
		updates.phone = payload.phone?.trim() || null
		updates.phoneNormalized = normalizeCustomerPhone(payload.phone)
	}

	if (payload?.branchId !== undefined) {
		const branchId = payload.branchId?.trim() || null
		const branchResult = await resolveAssignableBranch({
			viewer: guard.viewer,
			branchId,
		})

		if (branchResult.error) {
			return branchResult.error
		}

		updates.branchId = branchResult.branch?.id ?? null
	}

	if (payload?.verificationStatus !== undefined) {
		if (
			!CUSTOMER_VERIFICATION_STATUSES.includes(
				payload.verificationStatus as (typeof CUSTOMER_VERIFICATION_STATUSES)[number],
			)
		) {
			return jsonError("Invalid verification status.", 400)
		}

		updates.verificationStatus = payload.verificationStatus
	}

	if (
		payload?.verificationMetadata !== undefined &&
		(typeof payload.verificationMetadata !== "object" ||
			payload.verificationMetadata === null ||
			Array.isArray(payload.verificationMetadata))
	) {
		return jsonError("Verification metadata must be an object.", 400)
	}

	if (payload?.verificationMetadata !== undefined) {
		updates.verificationMetadata = payload.verificationMetadata
	}

	await db
		.update(customer)
		.set(updates)
		.where(
			and(
				eq(customer.organizationId, guard.viewer.activeOrganizationId),
				eq(customer.id, customerId),
			),
		)

	return NextResponse.json({ success: true })
}

export async function DELETE(_: Request, { params }: RouteProps) {
	const guard = await requireViewer({ permission: "manageCustomers" })

	if (guard.response) {
		return guard.response
	}

	const { customerId } = await params
	const target = await resolveVisibleCustomer({
		viewer: guard.viewer,
		customerId,
	})

	if (target.response) {
		return target.response
	}

	const rentalHistoryRows = await db
		.select({ value: count() })
		.from(rental)
		.where(
			and(
				eq(rental.organizationId, guard.viewer.activeOrganizationId),
				eq(rental.customerId, customerId),
			),
		)

	if (Number(rentalHistoryRows[0]?.value ?? 0) > 0) {
		return jsonError(
			"This customer has rental history and cannot be deleted.",
			409,
		)
	}

	const adapter = getStorageAdapter()
	const orphanedAssets = await db.transaction(async (tx) => {
		const linkedAssets = await tx
			.select({
				id: mediaAsset.id,
				pathname: mediaAsset.pathname,
				metadata: mediaAsset.metadata,
				visibility: mediaAsset.visibility,
			})
			.from(mediaLink)
			.innerJoin(mediaAsset, eq(mediaLink.assetId, mediaAsset.id))
			.where(
				and(
					eq(mediaLink.organizationId, guard.viewer.activeOrganizationId),
					eq(mediaLink.entityType, "customer"),
					eq(mediaLink.entityId, customerId),
					isNull(mediaAsset.deletedAt),
				),
			)

		await tx
			.delete(mediaLink)
			.where(
				and(
					eq(mediaLink.organizationId, guard.viewer.activeOrganizationId),
					eq(mediaLink.entityType, "customer"),
					eq(mediaLink.entityId, customerId),
				),
			)

		const orphanCandidates: typeof linkedAssets = []

		for (const asset of linkedAssets) {
			const remainingLinks = await tx
				.select({ value: count() })
				.from(mediaLink)
				.where(
					and(
						eq(mediaLink.organizationId, guard.viewer.activeOrganizationId),
						eq(mediaLink.assetId, asset.id),
					),
				)

			if (Number(remainingLinks[0]?.value ?? 0) === 0) {
				orphanCandidates.push(asset)
			}
		}

		if (orphanCandidates.length > 0) {
			await tx
				.update(mediaAsset)
				.set({
					status: "deleted",
					deletedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(mediaAsset.organizationId, guard.viewer.activeOrganizationId),
						inArray(
							mediaAsset.id,
							orphanCandidates.map((asset) => asset.id),
						),
					),
				)
		}

		await tx
			.delete(customer)
			.where(
				and(
					eq(customer.organizationId, guard.viewer.activeOrganizationId),
					eq(customer.id, customerId),
				),
			)

		return orphanCandidates
	})

	// Best-effort storage cleanup after the database transaction succeeds.
	for (const asset of orphanedAssets) {
		try {
			await adapter.delete(asset.pathname, {
				bucket: getMediaStorageBucketFromMetadata({
					metadata: asset.metadata,
					visibility: asset.visibility as StorageVisibility,
				}),
			})
		} catch {}
	}

	return NextResponse.json({ success: true })
}
