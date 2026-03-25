type UpdateHapticsPreferenceResponse = {
	hapticsEnabled: boolean
	error?: string
}

export async function updateHapticsPreference(enabled: boolean) {
	const response = await fetch("/api/profile/preferences/haptics", {
		method: "PATCH",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({ enabled }),
	})
	const payload = (await response
		.json()
		.catch(() => null)) as UpdateHapticsPreferenceResponse | null

	if (!response.ok) {
		throw new Error(
			payload?.error ?? "Failed to update the haptics preference.",
		)
	}

	if (!payload) {
		throw new Error("Failed to parse the haptics preference response.")
	}

	return payload
}
