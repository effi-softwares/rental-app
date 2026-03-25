import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema/auth"

const requestSchema = z.object({
	enabled: z.boolean(),
})

export async function PATCH(request: Request) {
	const viewerResult = await requireViewer({ requireActiveOrganization: false })

	if (viewerResult.response) {
		return viewerResult.response
	}

	const payload = await request.json().catch(() => null)
	const parsed = requestSchema.safeParse(payload)

	if (!parsed.success) {
		return jsonError("Invalid haptics preference payload.", 400)
	}

	const updatedUsers = await db
		.update(user)
		.set({
			hapticsEnabled: parsed.data.enabled,
		})
		.where(eq(user.id, viewerResult.viewer.userId))
		.returning({
			hapticsEnabled: user.hapticsEnabled,
		})

	const updatedUser = updatedUsers[0]

	if (!updatedUser) {
		return jsonError("Unable to update the haptics preference.", 404)
	}

	return NextResponse.json({
		hapticsEnabled: updatedUser.hapticsEnabled,
	})
}
