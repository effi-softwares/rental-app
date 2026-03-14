import { NextResponse } from "next/server"

import { unauthorizedError } from "@/lib/api/errors"
import { resolveAuthContext } from "@/lib/authorization/server"

export async function GET() {
	const resolved = await resolveAuthContext()

	if (!resolved) {
		return unauthorizedError()
	}

	return NextResponse.json(resolved)
}
