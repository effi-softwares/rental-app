import { and, asc, desc, eq, or } from "drizzle-orm"
import { NextResponse } from "next/server"

import {
	hasCustomerLookupInput,
	normalizeCustomerEmail,
	normalizeCustomerPhone,
} from "@/features/customers/lib/normalize"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { customer } from "@/lib/db/schema/customers"

export async function GET(request: Request) {
	const guard = await requireViewer({ permission: "viewBookingsModule" })

	if (guard.response) {
		return guard.response
	}

	const email = normalizeCustomerEmail(
		new URL(request.url).searchParams.get("email"),
	)
	const phone = normalizeCustomerPhone(
		new URL(request.url).searchParams.get("phone"),
	)

	if (!hasCustomerLookupInput({ email, phone })) {
		return NextResponse.json({ matches: [] })
	}

	const predicates = [
		email ? eq(customer.emailNormalized, email) : undefined,
		phone ? eq(customer.phoneNormalized, phone) : undefined,
	].filter(Boolean)

	if (predicates.length === 0) {
		return NextResponse.json({ matches: [] })
	}

	const rows = await db
		.select({
			id: customer.id,
			fullName: customer.fullName,
			email: customer.email,
			phone: customer.phone,
			verificationStatus: customer.verificationStatus,
			verificationMetadata: customer.verificationMetadata,
			createdAt: customer.createdAt,
		})
		.from(customer)
		.where(
			and(
				eq(customer.organizationId, guard.viewer.activeOrganizationId),
				predicates.length === 1 ? predicates[0] : or(...predicates),
			),
		)
		.orderBy(desc(customer.updatedAt), asc(customer.fullName))
		.limit(5)

	const ranked = rows
		.map((row) => {
			const rowEmail = normalizeCustomerEmail(row.email)
			const rowPhone = normalizeCustomerPhone(row.phone)
			const score =
				email && phone && rowEmail === email && rowPhone === phone
					? 3
					: email && rowEmail === email
						? 2
						: phone && rowPhone === phone
							? 1
							: 0

			return {
				...row,
				score,
			}
		})
		.sort((left, right) => right.score - left.score)

	return NextResponse.json({
		customers: ranked.map((row) => ({
			id: row.id,
			fullName: row.fullName,
			email: row.email,
			phone: row.phone,
		})),
	})
}
