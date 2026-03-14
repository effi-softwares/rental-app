"use client"

import { useQueryClient } from "@tanstack/react-query"
import { KeyRound, Mail, ShieldCheck } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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
		<Card className="w-full max-w-lg border-border/70">
			<CardHeader>
				<div className="mb-1 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary/10 px-4 text-primary text-sm font-medium">
					<ShieldCheck className="size-4" />
					Verification required
				</div>
				<CardTitle className="text-xl">Two-factor verification</CardTitle>
				<CardDescription>
					Enter your authenticator code, email OTP, or backup code to finish
					signing in.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<div className="grid grid-cols-3 gap-2 rounded-lg border p-1">
						<Button
							type="button"
							variant={activeMethod === "totp" ? "default" : "ghost"}
							className="h-11"
							onClick={() => setActiveMethod("totp")}
						>
							<ShieldCheck className="size-4" />
							App
						</Button>
						<Button
							type="button"
							variant={activeMethod === "otp" ? "default" : "ghost"}
							className="h-11"
							onClick={() => setActiveMethod("otp")}
						>
							<Mail className="size-4" />
							Email
						</Button>
						<Button
							type="button"
							variant={activeMethod === "backup" ? "default" : "ghost"}
							className="h-11"
							onClick={() => setActiveMethod("backup")}
						>
							<KeyRound className="size-4" />
							Backup
						</Button>
					</div>

					<label className="flex items-center gap-3 rounded-md border p-3 text-sm">
						<input
							type="checkbox"
							checked={trustDevice}
							onChange={(event) => setTrustDevice(event.target.checked)}
							className="h-4 w-4"
						/>
						<span>Trust this device for 30 days</span>
					</label>

					<Separator />

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
									className="h-11"
								/>
								<Button
									type="button"
									onClick={() => void verifyTotp()}
									disabled={isSubmitting || isSendingOtp}
									className="h-11"
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
									className="h-11"
								/>
								<Button
									type="button"
									variant="outline"
									onClick={() => void sendOtp()}
									disabled={isSendingOtp || isSubmitting}
									className="h-11"
								>
									{isSendingOtp ? "Sending..." : "Send OTP"}
								</Button>
								<Button
									type="button"
									onClick={() => void verifyOtp()}
									disabled={isSubmitting || isSendingOtp}
									className="h-11"
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
									className="h-11"
								/>
								<Button
									type="button"
									onClick={() => void verifyBackupCode()}
									disabled={isSubmitting || isSendingOtp}
									className="h-11"
								>
									Verify backup code
								</Button>
							</div>
						</Field>
					) : null}

					{message ? <p className="text-primary text-sm">{message}</p> : null}
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
				</FieldGroup>
			</CardContent>
		</Card>
	)
}
