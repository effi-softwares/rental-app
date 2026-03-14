import { Resend } from "resend"

type SendOrganizationInvitationEmailInput = {
	toEmail: string
	organizationName: string
	inviterName: string
	inviteLink: string
}

type SendEmailVerificationEmailInput = {
	toEmail: string
	verificationUrl: string
}

type SendTwoFactorOtpEmailInput = {
	toEmail: string
	otp: string
}

function getResendClient() {
	const apiKey = process.env.RESEND_API_KEY
	const fromEmail =
		process.env.RESEND_FROM_EMAIL ?? "Rental Ops <onboarding@resend.dev>"

	if (!apiKey) {
		return null
	}

	return {
		resend: new Resend(apiKey),
		fromEmail,
	}
}

export async function sendOrganizationInvitationEmail({
	toEmail,
	organizationName,
	inviterName,
	inviteLink,
}: SendOrganizationInvitationEmailInput) {
	const client = getResendClient()

	if (!client) {
		console.warn(
			"RESEND_API_KEY is not configured. Invitation email delivery was skipped.",
		)
		return
	}

	await client.resend.emails.send({
		from: client.fromEmail,
		to: [toEmail],
		subject: `You're invited to ${organizationName}`,
		html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="margin-bottom: 12px;">Join ${organizationName}</h2>
        <p style="margin-bottom: 12px;">${inviterName} invited you to join the Rental Ops dashboard.</p>
        <p style="margin-bottom: 20px;">Review the invitation, then sign in or create the invited account to continue.</p>
        <a
          href="${inviteLink}"
          style="display: inline-block; padding: 12px 16px; border-radius: 8px; text-decoration: none; background: #111827; color: #ffffff;"
        >
          Accept invitation
        </a>
        <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">If the button does not work, copy and paste this URL:</p>
        <p style="word-break: break-all; color: #374151; font-size: 12px;">${inviteLink}</p>
      </div>
    `,
	})
}

export async function sendEmailVerificationEmail({
	toEmail,
	verificationUrl,
}: SendEmailVerificationEmailInput) {
	const client = getResendClient()

	if (!client) {
		console.warn(
			"RESEND_API_KEY is not configured. Email verification delivery was skipped.",
		)
		return
	}

	await client.resend.emails.send({
		from: client.fromEmail,
		to: [toEmail],
		subject: "Verify your email",
		html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="margin-bottom: 12px;">Verify your email address</h2>
        <p style="margin-bottom: 20px;">Use the button below to verify your account email.</p>
        <a
          href="${verificationUrl}"
          style="display: inline-block; padding: 12px 16px; border-radius: 8px; text-decoration: none; background: #111827; color: #ffffff;"
        >
          Verify email
        </a>
        <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">If the button does not work, copy and paste this URL:</p>
        <p style="word-break: break-all; color: #374151; font-size: 12px;">${verificationUrl}</p>
      </div>
    `,
	})
}

export async function sendTwoFactorOtpEmail({
	toEmail,
	otp,
}: SendTwoFactorOtpEmailInput) {
	const client = getResendClient()

	if (!client) {
		console.warn(
			"RESEND_API_KEY is not configured. Two-factor OTP delivery was skipped.",
		)
		return
	}

	await client.resend.emails.send({
		from: client.fromEmail,
		to: [toEmail],
		subject: "Your verification code",
		html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="margin-bottom: 12px;">Two-factor verification code</h2>
        <p style="margin-bottom: 12px;">Use this one-time code to finish signing in:</p>
        <p style="margin-bottom: 16px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #f3f4f6; padding: 10px 12px; border-radius: 8px; font-size: 18px; letter-spacing: 2px;">${otp}</p>
      </div>
    `,
	})
}
