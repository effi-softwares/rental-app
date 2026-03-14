import { NextResponse } from "next/server"

export function jsonError(message: string, status: number) {
	return NextResponse.json({ error: message }, { status })
}

export function unauthorizedError() {
	return jsonError("Unauthorized.", 401)
}

export function forbiddenError() {
	return jsonError("Forbidden.", 403)
}
