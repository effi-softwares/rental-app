import Stripe from "stripe"

let stripeServer: Stripe | null = null

function getStripeSecretKey() {
	return process.env.STRIPE_SECRET_KEY?.trim() || null
}

export function isStripeServerConfigured() {
	return Boolean(getStripeSecretKey())
}

export function requireStripeServer() {
	if (stripeServer) {
		return stripeServer
	}

	const secretKey = getStripeSecretKey()
	if (!secretKey) {
		throw new Error("STRIPE_SECRET_KEY is not configured.")
	}

	stripeServer = new Stripe(secretKey)
	return stripeServer
}
