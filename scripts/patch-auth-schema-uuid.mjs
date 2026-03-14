import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const filePath = resolve(process.cwd(), "lib/db/schema/auth.ts")
const file = readFileSync(filePath, "utf8")

const patched = file
	.replace(
		/activeOrganizationId: text\("active_organization_id"\),/g,
		'activeOrganizationId: uuid("active_organization_id").references(() => organization.id, { onDelete: "set null" }),',
	)
	.replace(
		'impersonatedBy: text("impersonated_by"),',
		'impersonatedBy: uuid("impersonated_by"),',
	)

writeFileSync(filePath, patched, "utf8")

console.log("Applied UUID patch to Better Auth session reference fields.")
