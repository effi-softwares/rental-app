type ErrorWithMessage = {
	message?: unknown
}

export function resolveErrorMessage(
	error: unknown,
	fallbackMessage: string,
): string {
	if (typeof error === "string") {
		const nextMessage = error.trim()
		return nextMessage.length > 0 ? nextMessage : fallbackMessage
	}

	if (error instanceof Error) {
		const nextMessage = error.message.trim()
		return nextMessage.length > 0 ? nextMessage : fallbackMessage
	}

	if (typeof error === "object" && error !== null) {
		const nextMessage = (error as ErrorWithMessage).message
		if (typeof nextMessage === "string") {
			const trimmedMessage = nextMessage.trim()
			return trimmedMessage.length > 0 ? trimmedMessage : fallbackMessage
		}
	}

	return fallbackMessage
}
