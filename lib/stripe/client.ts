"use client"

import { loadStripe } from "@stripe/stripe-js"

let stripeBrowserPromise: ReturnType<typeof loadStripe> | null = null

function getStripePublishableKey() {
	return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null
}

export function isStripeBrowserConfigured() {
	return Boolean(getStripePublishableKey())
}

export function getStripeBrowserPromise() {
	if (stripeBrowserPromise) {
		return stripeBrowserPromise
	}

	const publishableKey = getStripePublishableKey()
	if (!publishableKey) {
		throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured.")
	}

	stripeBrowserPromise = loadStripe(publishableKey)
	return stripeBrowserPromise
}
