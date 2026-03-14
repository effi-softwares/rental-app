import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { customer } from "@/lib/db/schema/customers"
import { requireStripeServer } from "@/lib/stripe/server"

export async function ensureStripeCustomerForRentalCustomer(input: {
	organizationId: string
	customerId: string
	fullName: string
	email: string | null
	phone: string | null
	stripeCustomerId: string | null
}) {
	const stripe = requireStripeServer()

	if (input.stripeCustomerId) {
		const existing = await stripe.customers.retrieve(input.stripeCustomerId)

		if (!("deleted" in existing) || !existing.deleted) {
			return existing.id
		}
	}

	const created = await stripe.customers.create({
		name: input.fullName,
		email: input.email ?? undefined,
		phone: input.phone ?? undefined,
		metadata: {
			organizationId: input.organizationId,
			customerId: input.customerId,
		},
	})

	await db
		.update(customer)
		.set({
			stripeCustomerId: created.id,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(customer.organizationId, input.organizationId),
				eq(customer.id, input.customerId),
			),
		)

	return created.id
}
