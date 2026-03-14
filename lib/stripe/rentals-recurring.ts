import { requireStripeServer } from "./server"

type RecurringInterval = "week" | "month"

function toUnixTimestamp(date: Date) {
	return Math.floor(date.getTime() / 1000)
}

function groupSchedulePhases(
	rows: Array<{
		amount: number
		dueAt: Date
	}>,
) {
	const phases: Array<{ amount: number; iterations: number }> = []

	for (const row of rows) {
		const last = phases.at(-1)
		if (last && last.amount === row.amount) {
			last.iterations += 1
			continue
		}

		phases.push({
			amount: row.amount,
			iterations: 1,
		})
	}

	return phases
}

export async function createRentalRecurringBillingSchedule(input: {
	organizationId: string
	rentalId: string
	stripeCustomerId: string
	paymentMethodId: string
	currency: string
	installmentInterval: RecurringInterval
	scheduleRows: Array<{
		amount: number
		dueAt: Date
	}>
}) {
	const stripe = requireStripeServer()
	const groupedPhases = groupSchedulePhases(input.scheduleRows)
	const installmentProduct = await stripe.products.create(
		{
			name: `Rental ${input.rentalId} installment`,
			metadata: {
				organizationId: input.organizationId,
				rentalId: input.rentalId,
			},
		},
		{
			idempotencyKey: `${input.organizationId}:${input.rentalId}:installment_product`,
		},
	)

	const schedule = await stripe.subscriptionSchedules.create(
		{
			customer: input.stripeCustomerId,
			start_date: toUnixTimestamp(input.scheduleRows[0].dueAt),
			end_behavior: "cancel",
			default_settings: {
				default_payment_method: input.paymentMethodId,
				collection_method: "charge_automatically",
			},
			metadata: {
				organizationId: input.organizationId,
				rentalId: input.rentalId,
			},
			phases: groupedPhases.map((phase) => ({
				default_payment_method: input.paymentMethodId,
				collection_method: "charge_automatically",
				duration: {
					interval: input.installmentInterval,
					interval_count: phase.iterations,
				},
				items: [
					{
						price_data: {
							currency: input.currency.toLowerCase(),
							product: installmentProduct.id,
							unit_amount: Math.max(0, Math.round(phase.amount * 100)),
							recurring: {
								interval: input.installmentInterval,
								interval_count: 1,
							},
						},
						quantity: 1,
					},
				],
			})),
		},
		{
			idempotencyKey: `${input.organizationId}:${input.rentalId}:recurring_schedule`,
		},
	)

	return {
		scheduleId: schedule.id,
		subscriptionId:
			typeof schedule.subscription === "string"
				? schedule.subscription
				: (schedule.subscription?.id ?? null),
	}
}
