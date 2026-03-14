type SetActiveOrganizationResponse = {
	activeOrganizationId: string | null
	error?: string
}

export async function setActiveOrganization(organizationId: string | null) {
	const response = await fetch("/api/auth/active-organization", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({ organizationId }),
	})
	const payload = (await response
		.json()
		.catch(() => null)) as SetActiveOrganizationResponse | null

	if (!response.ok) {
		throw new Error(
			payload?.error ?? "Failed to update the active organization.",
		)
	}

	return payload
}
