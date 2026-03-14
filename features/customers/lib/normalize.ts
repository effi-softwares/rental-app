export function normalizeCustomerEmail(value: string | null | undefined) {
	if (!value) {
		return null
	}

	const normalized = value.trim().toLowerCase()
	return normalized.length > 0 ? normalized : null
}

export function normalizeCustomerPhone(value: string | null | undefined) {
	if (!value) {
		return null
	}

	const normalized = value.replaceAll(/[^0-9]/g, "")
	return normalized.length > 0 ? normalized : null
}

export function hasCustomerLookupInput(input: {
	email?: string | null
	phone?: string | null
}) {
	const email = normalizeCustomerEmail(input.email)
	const phone = normalizeCustomerPhone(input.phone)

	return Boolean(email || (phone && phone.length >= 7))
}
