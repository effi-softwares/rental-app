"use client"

import { useQueryClient } from "@tanstack/react-query"
import { KeyRound, Mail, ShieldCheck } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { AuthInlineMessage, AuthPanel } from "@/components/auth/auth-panel"
import { Button } from "@/components/ui/button"
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { routes } from "@/config/routes"
import { mainQueryKeys } from "@/features/main/queries/keys"
import { authClient } from "@/lib/auth-client"

type VerificationMethod = "totp" | "otp" | "backup"

export function TwoFactorChallengeForm() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const queryClient = useQueryClient()
	const [totpCode, setTotpCode] = useState("")
	const [otpCode, setOtpCode] = useState("")
	const [backupCode, setBackupCode] = useState("")
	const [trustDevice, setTrustDevice] = useState(true)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isSendingOtp, setIsSendingOtp] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [activeMethod, setActiveMethod] = useState<VerificationMethod>("totp")

	const redirectTo = (() => {
		const nextPath = searchParams.get("redirectTo")
		return nextPath?.startsWith("/") ? nextPath : routes.app.root
	})()

	async function completeSignInRedirect() {
		await queryClient.invalidateQueries({ queryKey: mainQueryKeys.all })
		router.replace(redirectTo)
		router.refresh()
	}

	async function verifyTotp() {
		if (!totpCode.trim()) {
			setError("Enter your authenticator app code.")
			return
		}

		setIsSubmitting(true)
		setError(null)
		setMessage(null)

		const { error: verifyError } = await authClient.twoFactor.verifyTotp({
			code: totpCode.trim(),
			trustDevice,
		})

		setIsSubmitting(false)

		if (verifyError) {
			setError(verifyError.message ?? "Unable to verify TOTP code.")
			return
		}

		await completeSignInRedirect()
	}

	async function sendOtp() {
		setIsSendingOtp(true)
		setError(null)
		setMessage(null)

		const { error: sendError } = await authClient.twoFactor.sendOtp()

		setIsSendingOtp(false)

		if (sendError) {
			setError(sendError.message ?? "Unable to send OTP code.")
			return
		}

		setMessage("A one-time code has been sent to your email.")
	}

	async function verifyOtp() {
		if (!otpCode.trim()) {
			setError("Enter the one-time code sent to your email.")
			return
		}

		setIsSubmitting(true)
		setError(null)
		setMessage(null)

		const { error: verifyError } = await authClient.twoFactor.verifyOtp({
			code: otpCode.trim(),
			trustDevice,
		})

		setIsSubmitting(false)

		if (verifyError) {
			setError(verifyError.message ?? "Unable to verify OTP code.")
			return
		}

		await completeSignInRedirect()
	}

	async function verifyBackupCode() {
		if (!backupCode.trim()) {
			setError("Enter a backup code.")
			return
		}

		setIsSubmitting(true)
		setError(null)
		setMessage(null)

		const { error: verifyError } = await authClient.twoFactor.verifyBackupCode({
			code: backupCode.trim(),
			trustDevice,
		})

		setIsSubmitting(false)

		if (verifyError) {
			setError(verifyError.message ?? "Unable to verify backup code.")
			return
		}

		await completeSignInRedirect()
	}

	return (
		<AuthPanel className="space-y-6">
			<div className="grid grid-cols-3 gap-2 rounded-[1.25rem] border border-border/70 bg-muted/35 p-1.5">
				<Button
					type="button"
					variant={activeMethod === "totp" ? "default" : "ghost"}
					className="h-11 rounded-xl"
					onClick={() => setActiveMethod("totp")}
				>
					<ShieldCheck className="size-4" />
					App
				</Button>
				<Button
					type="button"
					variant={activeMethod === "otp" ? "default" : "ghost"}
					className="h-11 rounded-xl"
					onClick={() => setActiveMethod("otp")}
				>
					<Mail className="size-4" />
					Email
				</Button>
				<Button
					type="button"
					variant={activeMethod === "backup" ? "default" : "ghost"}
					className="h-11 rounded-xl"
					onClick={() => setActiveMethod("backup")}
				>
					<KeyRound className="size-4" />
					Backup
				</Button>
			</div>

			<FieldGroup className="gap-4">
				<label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 text-sm">
					<input
						type="checkbox"
						checked={trustDevice}
						onChange={(event) => setTrustDevice(event.target.checked)}
						className="h-4 w-4"
					/>
					<span>Trust this device for 30 days</span>
				</label>

				<FieldSeparator>verify</FieldSeparator>

				{activeMethod === "totp" ? (
					<Field>
						<FieldLabel htmlFor="totpCode">
							Authenticator code (TOTP)
						</FieldLabel>
						<div className="grid gap-2 sm:grid-cols-2">
							<Input
								id="totpCode"
								value={totpCode}
								onChange={(event) => setTotpCode(event.target.value)}
								placeholder="123456"
								className="h-12 rounded-xl"
							/>
							<Button
								type="button"
								size="lg"
								onClick={() => void verifyTotp()}
								disabled={isSubmitting || isSendingOtp}
								className="h-12 rounded-xl"
							>
								Verify TOTP
							</Button>
						</div>
					</Field>
				) : null}

				{activeMethod === "otp" ? (
					<Field>
						<FieldLabel htmlFor="otpCode">Email OTP</FieldLabel>
						<div className="grid gap-2 sm:grid-cols-3">
							<Input
								id="otpCode"
								value={otpCode}
								onChange={(event) => setOtpCode(event.target.value)}
								placeholder="123456"
								className="h-12 rounded-xl sm:col-span-3"
							/>
							<Button
								type="button"
								variant="outline"
								size="lg"
								onClick={() => void sendOtp()}
								disabled={isSendingOtp || isSubmitting}
								className="h-12 rounded-xl"
							>
								{isSendingOtp ? "Sending..." : "Send OTP"}
							</Button>
							<Button
								type="button"
								size="lg"
								onClick={() => void verifyOtp()}
								disabled={isSubmitting || isSendingOtp}
								className="h-12 rounded-xl sm:col-span-2"
							>
								Verify OTP
							</Button>
						</div>
					</Field>
				) : null}

				{activeMethod === "backup" ? (
					<Field>
						<FieldLabel htmlFor="backupCode">Backup code</FieldLabel>
						<div className="grid gap-2 sm:grid-cols-2">
							<Input
								id="backupCode"
								value={backupCode}
								onChange={(event) => setBackupCode(event.target.value)}
								placeholder="ABCD-EFGH"
								className="h-12 rounded-xl"
							/>
							<Button
								type="button"
								size="lg"
								onClick={() => void verifyBackupCode()}
								disabled={isSubmitting || isSendingOtp}
								className="h-12 rounded-xl"
							>
								Verify backup code
							</Button>
						</div>
					</Field>
				) : null}

				{message ? (
					<AuthInlineMessage variant="success">{message}</AuthInlineMessage>
				) : null}
				{error ? (
					<AuthInlineMessage variant="destructive">{error}</AuthInlineMessage>
				) : null}
			</FieldGroup>
		</AuthPanel>
	)
}
