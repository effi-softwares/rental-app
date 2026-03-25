import process from "node:process"
import { createInterface } from "node:readline/promises"
import { Writable } from "node:stream"
import dotenv from "dotenv"
import { and, eq } from "drizzle-orm"

function loadEnvironment() {
	dotenv.config({ path: ".env.local", quiet: true })
	dotenv.config({ path: ".env", quiet: true })
}

function toSlug(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
}

function clampColorChannel(value: number) {
	return Math.max(0, Math.min(255, Math.round(value)))
}

function stringToHue(seed: string) {
	let hash = 0

	for (const character of seed) {
		hash = (hash * 31 + character.charCodeAt(0)) % 360
	}

	return hash
}

function hslToHex(hue: number, saturation: number, lightness: number) {
	const normalizedSaturation = saturation / 100
	const normalizedLightness = lightness / 100

	const chroma =
		(1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation
	const section = hue / 60
	const secondComponent = chroma * (1 - Math.abs((section % 2) - 1))

	let red = 0
	let green = 0
	let blue = 0

	if (section >= 0 && section < 1) {
		red = chroma
		green = secondComponent
	} else if (section >= 1 && section < 2) {
		red = secondComponent
		green = chroma
	} else if (section >= 2 && section < 3) {
		green = chroma
		blue = secondComponent
	} else if (section >= 3 && section < 4) {
		green = secondComponent
		blue = chroma
	} else if (section >= 4 && section < 5) {
		red = secondComponent
		blue = chroma
	} else {
		red = chroma
		blue = secondComponent
	}

	const match = normalizedLightness - chroma / 2
	const toHex = (value: number) =>
		clampColorChannel((value + match) * 255)
			.toString(16)
			.padStart(2, "0")

	return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function encodeSvg(svgMarkup: string) {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`
}

function createOrganizationAvatarDataUri(organizationName: string) {
	const trimmedName = organizationName.trim()
	const seed = trimmedName || "Organization"
	const initials =
		seed
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("")
			.slice(0, 2) || "OR"

	const baseHue = stringToHue(seed)
	const primaryColor = hslToHex(baseHue, 65, 48)
	const secondaryColor = hslToHex((baseHue + 36) % 360, 72, 60)
	const accentColor = hslToHex((baseHue + 320) % 360, 70, 82)

	const svgMarkup = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${seed}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="${secondaryColor}" />
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="64" fill="url(#bg)" />
  <circle cx="205" cy="52" r="26" fill="${accentColor}" opacity="0.75" />
  <circle cx="54" cy="210" r="34" fill="#ffffff" opacity="0.16" />
  <path d="M56 190c24-45 74-64 144-52" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" opacity="0.16" />
  <text x="128" y="146" text-anchor="middle" font-size="92" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-weight="700" fill="#ffffff">${initials}</text>
</svg>`.trim()

	return encodeSvg(svgMarkup)
}

function createMutedOutput() {
	const stream = new Writable({
		write(chunk, encoding, callback) {
			if (!stream.muted) {
				process.stdout.write(chunk, encoding)
			}

			callback()
		},
	}) as Writable & { muted: boolean }

	stream.muted = false

	return stream
}

function requireString(value: string | null, message: string): string {
	if (!value) {
		throw new Error(message)
	}

	return value
}

async function main() {
	loadEnvironment()

	const [
		{ auth },
		{ syncCanonicalActiveOrganizationForUser },
		{ db },
		authSchema,
	] = await Promise.all([
		import("../lib/auth"),
		import("../lib/authorization/active-organization"),
		import("../lib/db/index"),
		import("../lib/db/schema/auth"),
	])

	const { account, member, organization, user } = authSchema

	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		throw new Error(
			"This command requires an interactive terminal so it can prompt for user details.",
		)
	}

	const mutedOutput = createMutedOutput()
	const readline = createInterface({
		input: process.stdin,
		output: mutedOutput,
		terminal: true,
	})

	async function prompt(question: string) {
		const answer = await readline.question(question)
		return answer.trim()
	}

	async function promptRequired(question: string, errorMessage: string) {
		while (true) {
			const answer = await prompt(question)

			if (answer) {
				return answer
			}

			console.log(errorMessage)
		}
	}

	async function promptHidden(question: string, errorMessage: string) {
		while (true) {
			process.stdout.write(question)
			mutedOutput.muted = true
			const answer = (await readline.question("")).trim()
			mutedOutput.muted = false
			process.stdout.write("\n")

			if (answer) {
				return answer
			}

			console.log(errorMessage)
		}
	}

	try {
		console.log("Owner bootstrap")
		console.log(
			"This command creates or reuses an owner user and default organization.",
		)
		console.log("")

		const ownerName = await promptRequired(
			"Owner full name: ",
			"Owner name is required.",
		)
		const ownerEmail = (
			await promptRequired("Owner email: ", "Owner email is required.")
		).toLowerCase()
		const ownerPassword = await promptHidden(
			"Owner password: ",
			"Owner password is required.",
		)
		const organizationName = await promptRequired(
			"Organization name: ",
			"Organization name is required.",
		)
		const slugOverride = await prompt("Organization slug override (optional): ")
		const organizationSlug = toSlug(slugOverride || organizationName)

		if (!organizationSlug) {
			throw new Error(
				"Unable to derive a valid organization slug from the provided input.",
			)
		}

		const existingUsers = await db
			.select({
				id: user.id,
				email: user.email,
				name: user.name,
			})
			.from(user)
			.where(eq(user.email, ownerEmail))
			.limit(1)

		let userId = existingUsers[0]?.id ?? null
		let userStatus = "reused"

		if (!userId) {
			const createdUserResponse = (await auth.api.createUser({
				body: {
					email: ownerEmail,
					password: ownerPassword,
					name: ownerName,
				},
			})) as { user?: { id?: string | null } }

			userId = createdUserResponse.user?.id ?? ""

			if (!userId) {
				throw new Error("Better Auth did not return the created user id.")
			}

			userStatus = "created"
		} else {
			const existingUserId = requireString(
				userId,
				"Expected an existing user id for the credential account check.",
			)
			const credentialAccounts = await db
				.select({
					id: account.id,
				})
				.from(account)
				.where(
					and(
						eq(account.userId, existingUserId),
						eq(account.providerId, "credential"),
					),
				)
				.limit(1)

			if (!credentialAccounts[0]) {
				throw new Error(
					[
						`A user with email "${ownerEmail}" already exists, but it does not have a credential account.`,
						"This command will not silently set a password for an existing non-credential user.",
						"Create a new email for bootstrap or add a credential password through the proper auth flow first.",
					].join(" "),
				)
			}
		}

		const resolvedUserId = requireString(
			userId,
			"Unable to resolve the owner user id.",
		)

		const existingOrganizations = await db
			.select({
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
			})
			.from(organization)
			.where(eq(organization.slug, organizationSlug))
			.limit(1)

		let organizationId = existingOrganizations[0]?.id ?? null
		let organizationStatus = "reused"

		if (!organizationId) {
			const createdOrganization = (await auth.api.createOrganization({
				body: {
					name: organizationName,
					slug: organizationSlug,
					logo: createOrganizationAvatarDataUri(organizationName),
					userId: resolvedUserId,
					keepCurrentActiveOrganization: false,
				},
			})) as { id?: string | null }

			organizationId = createdOrganization.id ?? ""

			if (!organizationId) {
				throw new Error(
					"Better Auth did not return the created organization id.",
				)
			}

			organizationStatus = "created"
		} else {
			const matchingMemberships = await db
				.select({
					role: member.role,
				})
				.from(member)
				.where(
					and(
						eq(member.organizationId, organizationId),
						eq(member.userId, resolvedUserId),
					),
				)
				.limit(1)

			if (!matchingMemberships[0]) {
				throw new Error(
					[
						`Organization slug "${organizationSlug}" is already in use by another workspace.`,
						"This command only reuses an existing organization when it already belongs to the target user.",
					].join(" "),
				)
			}
		}

		const resolvedOrganizationId = requireString(
			organizationId,
			"Unable to resolve the organization id.",
		)

		await syncCanonicalActiveOrganizationForUser(
			resolvedUserId,
			resolvedOrganizationId,
		)

		console.log("")
		console.log("Owner bootstrap complete.")
		console.log(`User: ${ownerEmail} (${userStatus})`)
		console.log(
			`Organization: ${existingOrganizations[0]?.name ?? organizationName} (${organizationStatus})`,
		)
		console.log(`Slug: ${organizationSlug}`)
		console.log(`Active organization synced: ${resolvedOrganizationId}`)
	} finally {
		readline.close()
	}
}

main().catch((error) => {
	console.error("")
	console.error("Owner bootstrap failed.")
	console.error(error instanceof Error ? error.message : error)
	process.exit(1)
})
