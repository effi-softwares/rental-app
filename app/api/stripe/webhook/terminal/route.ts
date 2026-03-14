import { desc, eq, or, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { jsonError } from "@/lib/api/errors"
import { db } from "@/lib/db"
import { rentalEvent, rentalPayment } from "@/lib/db/schema/rentals"
import { stripeWebhookEvent } from "@/lib/db/schema/workspace"
import { requireStripeServer } from "@/lib/stripe/server"
import { publishWorkspaceRealtimeEvents } from "@/lib/workspace-live/server"

function getReaderActionIntentIds(reader: Stripe.Terminal.Reader) {
	const processPaymentIntent = reader.action?.process_payment_intent
	const processSetupIntent = reader.action?.process_setup_intent

	return {
		paymentIntentId:
			typeof processPaymentIntent?.payment_intent === "string"
				? processPaymentIntent.payment_intent
				: (processPaymentIntent?.payment_intent?.id ?? null),
		setupIntentId:
			typeof processSetupIntent?.setup_intent === "string"
				? processSetupIntent.setup_intent
				: (processSetupIntent?.setup_intent?.id ?? null),
	}
}

async function resolveTerminalWebhookContext(input: {
	paymentIntentId?: string | null
	setupIntentId?: string | null
}) {
	const predicates = [
		input.paymentIntentId
			? eq(rentalPayment.stripePaymentIntentId, input.paymentIntentId)
			: undefined,
		input.setupIntentId
			? eq(rentalPayment.stripeSetupIntentId, input.setupIntentId)
			: undefined,
	].filter(Boolean)

	if (predicates.length === 0) {
		return null
	}

	const referencePredicate =
		predicates.length === 1 ? predicates[0] : or(...predicates)

	const rows = await db
		.select({
			organizationId: rentalPayment.organizationId,
			branchId: rentalPayment.branchId,
			rentalId: rentalPayment.rentalId,
		})
		.from(rentalPayment)
		.where(referencePredicate)
		.orderBy(desc(rentalPayment.createdAt))
		.limit(1)

	return rows[0] ?? null
}

export async function POST(request: Request) {
	const signingSecret =
		process.env.STRIPE_TERMINAL_WEBHOOK_SIGNING_SECRET?.trim()
	if (!signingSecret) {
		return jsonError(
			"STRIPE_TERMINAL_WEBHOOK_SIGNING_SECRET is not configured.",
			503,
		)
	}

	const signature = request.headers.get("stripe-signature")?.trim()
	if (!signature) {
		return jsonError("Missing Stripe signature header.", 400)
	}

	const payload = await request.text()
	const payloadJson = JSON.parse(payload) as Record<string, unknown>
	const stripe = requireStripeServer()

	let event: Stripe.Event

	try {
		event = stripe.webhooks.constructEvent(payload, signature, signingSecret)
	} catch {
		return jsonError("Invalid Stripe webhook signature.", 400)
	}

	if (
		event.type !== "terminal.reader.action_succeeded" &&
		event.type !== "terminal.reader.action_failed"
	) {
		return NextResponse.json({ received: true, ignored: event.type })
	}

	const reader = event.data.object as Stripe.Terminal.Reader
	const intentIds = getReaderActionIntentIds(reader)
	const context = await resolveTerminalWebhookContext(intentIds)

	const result = await db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${event.id}))`)

		const existingRows = await tx
			.select({ id: stripeWebhookEvent.id })
			.from(stripeWebhookEvent)
			.where(eq(stripeWebhookEvent.stripeEventId, event.id))
			.limit(1)

		if (existingRows[0]) {
			return { duplicate: true }
		}

		const insertedRows = await tx
			.insert(stripeWebhookEvent)
			.values({
				organizationId: context?.organizationId ?? null,
				branchId: context?.branchId ?? null,
				stripeEventId: event.id,
				type: event.type,
				mode: event.livemode ? "live" : "test",
				apiVersion: event.api_version ?? null,
				accountId: event.account ?? null,
				objectType: reader.object,
				objectId: reader.id,
				status: context ? "processed" : "ignored",
				errorMessage: context
					? null
					: "No rental payment matched this reader action.",
				payloadJson,
				processedAt: new Date(),
			})
			.returning({ id: stripeWebhookEvent.id })

		if (!context) {
			return {
				duplicate: false,
				webhookRecordId: insertedRows[0].id,
			}
		}

		const attention =
			event.type === "terminal.reader.action_failed" ? "critical" : "info"
		const summary =
			event.type === "terminal.reader.action_failed"
				? (reader.action?.failure_message ??
					"Stripe Terminal reader action failed.")
				: "Stripe Terminal reader action succeeded."

		await publishWorkspaceRealtimeEvents(tx as unknown as typeof db, [
			{
				organizationId: context.organizationId,
				branchId: context.branchId,
				topic: "billing_attention",
				eventType: "billing_attention.terminal.updated",
				entityType: "terminal_reader",
				entityId: reader.id,
				attention,
				summary,
				payload: {
					rentalId: context.rentalId,
					readerId: reader.id,
					readerLabel: reader.label,
					readerStatus: reader.status,
					readerActionType: reader.action?.type ?? null,
					paymentIntentId: intentIds.paymentIntentId,
					setupIntentId: intentIds.setupIntentId,
					stripeEventId: event.id,
				},
			},
		])

		await tx.insert(rentalEvent).values({
			organizationId: context.organizationId,
			branchId: context.branchId,
			rentalId: context.rentalId,
			type: "rental.terminal.webhook_reconciled",
			payloadJson: {
				eventId: event.id,
				eventType: event.type,
				readerId: reader.id,
				readerActionType: reader.action?.type ?? null,
			},
		})

		return {
			duplicate: false,
			webhookRecordId: insertedRows[0].id,
		}
	})

	if (result.duplicate) {
		return NextResponse.json({ received: true, duplicate: true })
	}

	return NextResponse.json({ received: true })
}
