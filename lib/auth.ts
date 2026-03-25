import { passkey } from "@better-auth/passkey"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { admin, organization, twoFactor } from "better-auth/plugins"

import {
	getAccessibleOrganizationIdsForUser,
	getUserActiveOrganizationId,
	reconcileCanonicalActiveOrganizationForUser,
} from "./authorization/active-organization"
import {
	organizationAccessControl,
	organizationRoles,
} from "./authorization/policies"
import { db } from "./db"
import * as authSchema from "./db/schema/auth"
import {
	sendEmailVerificationEmail,
	sendOrganizationInvitationEmail,
	sendTwoFactorOtpEmail,
} from "./email/resend"

function readOrigin(value: string, envName: string) {
	try {
		return new URL(value).origin
	} catch {
		throw new Error(
			`${envName} must be a valid absolute URL. Received: ${value}`,
		)
	}
}

const configuredAuthUrl = process.env.BETTER_AUTH_URL
const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL

const appBaseUrl =
	configuredAuthUrl ?? configuredAppUrl ?? "http://localhost:4500"

const passkeyRpId = process.env.BETTER_AUTH_PASSKEY_RP_ID
const passkeyRpName = process.env.BETTER_AUTH_PASSKEY_RP_NAME
const passkeyOrigin = process.env.BETTER_AUTH_PASSKEY_ORIGIN ?? appBaseUrl

const authOrigin = readOrigin(appBaseUrl, "BETTER_AUTH_URL")
const publicAppOrigin = readOrigin(
	configuredAppUrl ?? appBaseUrl,
	"NEXT_PUBLIC_APP_URL",
)
const resolvedPasskeyOrigin = readOrigin(
	passkeyOrigin,
	"BETTER_AUTH_PASSKEY_ORIGIN",
)

if (authOrigin !== publicAppOrigin || authOrigin !== resolvedPasskeyOrigin) {
	throw new Error(
		[
			"Authentication origins are misaligned.",
			`BETTER_AUTH_URL origin: ${authOrigin}`,
			`NEXT_PUBLIC_APP_URL origin: ${publicAppOrigin}`,
			`BETTER_AUTH_PASSKEY_ORIGIN origin: ${resolvedPasskeyOrigin}`,
			"These values must share the same origin in each environment.",
		].join(" "),
	)
}

export const auth = betterAuth({
	appName: "Rental Ops",
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: authOrigin,
	advanced: {
		database: {
			generateId: "uuid",
		},
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7d
		updateAge: 60 * 60 * 24, // 1d
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5, // 5min
		},
	},
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: authSchema,
	}),
	user: {
		additionalFields: {
			requiresPasswordSetup: {
				type: "boolean",
				required: false,
				defaultValue: false,
				input: false,
			},
			hapticsEnabled: {
				type: "boolean",
				required: false,
				defaultValue: true,
				input: false,
			},
			activeOrganizationId: {
				type: "string",
				required: false,
				input: false,
				references: {
					model: "organization",
					field: "id",
					onDelete: "set null",
				},
			},
		},
	},
	databaseHooks: {
		session: {
			create: {
				before: async (sessionData) => {
					const userId =
						typeof sessionData.userId === "string" ? sessionData.userId : null

					if (!userId) {
						return
					}

					const userActiveOrganizationId =
						await getUserActiveOrganizationId(userId)
					const accessibleOrganizationIds =
						await getAccessibleOrganizationIdsForUser(userId)
					const reconciled = await reconcileCanonicalActiveOrganizationForUser({
						userId,
						userActiveOrganizationId,
						sessionActiveOrganizationId:
							typeof sessionData.activeOrganizationId === "string"
								? sessionData.activeOrganizationId
								: null,
						accessibleOrganizationIds,
					})

					if (
						reconciled.activeOrganizationId ===
						(typeof sessionData.activeOrganizationId === "string"
							? sessionData.activeOrganizationId
							: null)
					) {
						return
					}

					return {
						data: {
							activeOrganizationId: reconciled.activeOrganizationId,
						},
					}
				},
			},
		},
	},
	emailAndPassword: {
		enabled: true,
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) => {
			void sendEmailVerificationEmail({
				toEmail: user.email,
				verificationUrl: url,
			})
		},
	},
	plugins: [
		organization({
			ac: organizationAccessControl,
			roles: organizationRoles,
			schema: {
				organization: {
					additionalFields: {
						isVisible: {
							type: "boolean",
							input: true,
							required: false,
							defaultValue: true,
						},
					},
				},
			},
			dynamicAccessControl: {
				enabled: true,
				maximumRolesPerOrganization: 20,
			},
			organizationHooks: {
				beforeUpdateOrganization: async ({ organization, member }) => {
					if (
						Object.hasOwn(organization, "isVisible") &&
						!member.role.split(",").includes("owner")
					) {
						throw new APIError("FORBIDDEN", {
							message: "Only organization owners can change visibility.",
						})
					}
				},
			},
			async sendInvitationEmail(data) {
				const inviteLink = `${appBaseUrl}/invitation/${data.id}/accept`
				const inviterName = data.inviter.user.name ?? data.inviter.user.email

				void sendOrganizationInvitationEmail({
					toEmail: data.email,
					organizationName: data.organization.name,
					inviterName,
					inviteLink,
				})
			},
		}),
		admin(),
		passkey({
			rpID: passkeyRpId,
			rpName: passkeyRpName,
			origin: passkeyOrigin,
		}),
		twoFactor({
			issuer: "Rental Ops",
			otpOptions: {
				sendOTP: async ({ user, otp }) => {
					void sendTwoFactorOtpEmail({
						toEmail: user.email,
						otp,
					})
				},
			},
		}),
		nextCookies(),
	],
})
