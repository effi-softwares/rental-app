import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const filePath = resolve(process.cwd(), "lib/db/schema/auth.ts")
const file = readFileSync(filePath, "utf8")

const requiredUuidColumns = [
	'id: uuid("id")',
	'userId: uuid("user_id")',
	'organizationId: uuid("organization_id")',
	'inviterId: uuid("inviter_id")',
	'activeOrganizationId: uuid("active_organization_id")',
	'impersonatedBy: uuid("impersonated_by")',
]

const missing = requiredUuidColumns.filter((pattern) => !file.includes(pattern))

const activeOrganizationMatches = file.match(
	/activeOrganizationId:\s+uuid\("active_organization_id"\)/g,
)

if (missing.length > 0) {
	console.error("UUID verification failed in lib/db/schema/auth.ts")
	for (const item of missing) {
		console.error(`- Missing pattern: ${item}`)
	}
	process.exit(1)
}

if ((activeOrganizationMatches?.length ?? 0) < 2) {
	console.error("UUID verification failed in lib/db/schema/auth.ts")
	console.error(
		'- Expected activeOrganizationId UUID references on both "user" and "session" tables.',
	)
	process.exit(1)
}

console.log("UUID verification passed for Better Auth schema.")
