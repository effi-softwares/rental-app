"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import QRCode from "qrcode"
import { useEffect, useMemo, useState } from "react"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PageSectionHeader } from "@/components/ui/page-section-header"
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
import { Separator } from "@/components/ui/separator"
import { routes } from "@/config/routes"
import { mainQueryKeys } from "@/features/main/queries/keys"
import { profileQueryKeys } from "@/features/profile/queries/keys"
import { authClient } from "@/lib/auth-client"

type PasskeyRecord = {
	id: string
	name?: string | null
	createdAt?: string | Date | null
}

type SessionUser = {
	twoFactorEnabled?: boolean
	emailVerified?: boolean
}

type TwoFactorStep = "verify-email" | "choose-method" | "email-otp" | "totp"

type FeedbackScope =
	| "name"
	| "email"
	| "password"
	| "passkey-list"
	| "add-passkey"
	| "rename-passkey"
	| "twofactor"
	| "delete"

type ConfirmActionButtonProps = {
	label: string
	confirmLabel: string
	title: string
	description: string
	onConfirm: () => Promise<unknown>
	variant?: "default" | "outline" | "destructive" | "link"
	disabled?: boolean
	isPending?: boolean
	pendingLabel?: string
	className?: string
}

function ConfirmActionButton({
	label,
	confirmLabel,
	title,
	description,
	onConfirm,
	variant = "default",
	disabled = false,
	isPending = false,
	pendingLabel,
	className,
}: ConfirmActionButtonProps) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					type="button"
					variant={variant}
					disabled={disabled || isPending}
					className={className ?? "h-11"}
				>
					{isPending ? (pendingLabel ?? "Working...") : label}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant={variant === "destructive" ? "destructive" : "default"}
						onClick={() => void onConfirm()}
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

export function ProfileSecurityPanel() {
	const queryClient = useQueryClient()
	const session = authClient.useSession()

	const [name, setName] = useState("")
	const [currentPassword, setCurrentPassword] = useState("")
	const [newPassword, setNewPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")

	const [passkeyName, setPasskeyName] = useState("")
	const [renamePasskeyName, setRenamePasskeyName] = useState("")
	const [renamePasskeyId, setRenamePasskeyId] = useState<string | null>(null)

	const [enable2faPassword, setEnable2faPassword] = useState("")
	const [verifyTotpCode, setVerifyTotpCode] = useState("")
	const [email2faPassword, setEmail2faPassword] = useState("")
	const [emailOtpCode, setEmailOtpCode] = useState("")
	const [backupCodesPassword, setBackupCodesPassword] = useState("")
	const [disable2faPassword, setDisable2faPassword] = useState("")

	const [totpUri, setTotpUri] = useState<string | null>(null)
	const [totpQrDataUrl, setTotpQrDataUrl] = useState<string | null>(null)
	const [backupCodes, setBackupCodes] = useState<string[]>([])
	const [deleteAccountPassword, setDeleteAccountPassword] = useState("")

	const [isNameDrawerOpen, setIsNameDrawerOpen] = useState(false)
	const [isEmailDrawerOpen, setIsEmailDrawerOpen] = useState(false)
	const [isPasswordDrawerOpen, setIsPasswordDrawerOpen] = useState(false)
	const [isAddPasskeyDrawerOpen, setIsAddPasskeyDrawerOpen] = useState(false)
	const [isRenamePasskeyDrawerOpen, setIsRenamePasskeyDrawerOpen] =
		useState(false)
	const [isTwoFactorDrawerOpen, setIsTwoFactorDrawerOpen] = useState(false)
	const [isDeleteDrawerOpen, setIsDeleteDrawerOpen] = useState(false)
	const [twoFactorStep, setTwoFactorStep] =
		useState<TwoFactorStep>("verify-email")

	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [feedbackScope, setFeedbackScope] = useState<FeedbackScope | null>(null)

	const passkeysQuery = useQuery({
		queryKey: profileQueryKeys.passkeys(),
		queryFn: async () => {
			const { data, error } = await authClient.passkey.listUserPasskeys()

			if (error) {
				throw new Error(error.message ?? "Failed to load passkeys.")
			}

			return (Array.isArray(data) ? data : []) as PasskeyRecord[]
		},
	})

	const isEmailVerified = Boolean(
		(session.data?.user as SessionUser | undefined)?.emailVerified,
	)
	const isTwoFactorEnabled = Boolean(
		(session.data?.user as SessionUser | undefined)?.twoFactorEnabled,
	)

	const twoFactorStatusLabel = useMemo(() => {
		if (isTwoFactorEnabled) {
			return "Enabled"
		}

		if (totpUri) {
			return "Setup in progress"
		}

		return "Disabled"
	}, [isTwoFactorEnabled, totpUri])

	useEffect(() => {
		setName(session.data?.user?.name ?? "")
	}, [session.data?.user?.name])

	useEffect(() => {
		if (!totpUri) {
			setTotpQrDataUrl(null)
			return
		}

		void QRCode.toDataURL(totpUri, {
			margin: 1,
			width: 240,
		}).then((dataUrl: string) => {
			setTotpQrDataUrl(dataUrl)
		})
	}, [totpUri])

	useEffect(() => {
		if (!isTwoFactorDrawerOpen) {
			return
		}

		setTwoFactorStep(isEmailVerified ? "choose-method" : "verify-email")
	}, [isTwoFactorDrawerOpen, isEmailVerified])

	const updateNameMutation = useMutation({
		mutationFn: async () => {
			const trimmedName = name.trim()

			if (!trimmedName) {
				throw new Error("Name is required.")
			}

			const { error } = await authClient.updateUser({
				name: trimmedName,
			})

			if (error) {
				throw new Error(error.message ?? "Unable to update name.")
			}
		},
		onSuccess: async () => {
			setMessage("Profile details updated.")
			setError(null)
			await queryClient.invalidateQueries({ queryKey: mainQueryKeys.all })
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const changePasswordMutation = useMutation({
		mutationFn: async () => {
			if (!currentPassword || !newPassword || !confirmPassword) {
				throw new Error("All password fields are required.")
			}

			if (newPassword !== confirmPassword) {
				throw new Error("New passwords do not match.")
			}

			const { error } = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true,
			})

			if (error) {
				throw new Error(error.message ?? "Unable to change password.")
			}
		},
		onSuccess: () => {
			setCurrentPassword("")
			setNewPassword("")
			setConfirmPassword("")
			setMessage("Password changed successfully.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const sendVerificationMutation = useMutation({
		mutationFn: async () => {
			const email = session.data?.user?.email
			if (!email) {
				throw new Error("No user email found.")
			}

			const { error } = await authClient.sendVerificationEmail({
				email,
				callbackURL: routes.app.profile,
			})

			if (error) {
				throw new Error(error.message ?? "Unable to send verification email.")
			}
		},
		onSuccess: () => {
			setMessage("Verification email sent.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const addPasskeyMutation = useMutation({
		mutationFn: async () => {
			const { error } = await authClient.passkey.addPasskey({
				name: passkeyName.trim() || undefined,
			})

			if (error) {
				throw new Error(error.message ?? "Unable to add passkey.")
			}
		},
		onSuccess: async () => {
			setPasskeyName("")
			setMessage("Passkey registered.")
			setError(null)
			await queryClient.invalidateQueries({
				queryKey: profileQueryKeys.passkeys(),
			})
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const renamePasskeyMutation = useMutation({
		mutationFn: async ({ id, nextName }: { id: string; nextName: string }) => {
			const trimmedName = nextName.trim()
			if (!trimmedName) {
				throw new Error("Passkey name is required.")
			}

			const { error } = await authClient.passkey.updatePasskey({
				id,
				name: trimmedName,
			})

			if (error) {
				throw new Error(error.message ?? "Unable to rename passkey.")
			}
		},
		onSuccess: async () => {
			setMessage("Passkey name updated.")
			setError(null)
			await queryClient.invalidateQueries({
				queryKey: profileQueryKeys.passkeys(),
			})
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const deletePasskeyMutation = useMutation({
		mutationFn: async (id: string) => {
			const { error } = await authClient.passkey.deletePasskey({
				id,
			})

			if (error) {
				throw new Error(error.message ?? "Unable to delete passkey.")
			}
		},
		onSuccess: async () => {
			setMessage("Passkey deleted.")
			setError(null)
			await queryClient.invalidateQueries({
				queryKey: profileQueryKeys.passkeys(),
			})
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const enableTwoFactorMutation = useMutation({
		mutationFn: async () => {
			if (!enable2faPassword.trim()) {
				throw new Error("Password is required to prepare TOTP.")
			}

			const { data, error } = await authClient.twoFactor.enable({
				password: enable2faPassword,
				issuer: "Rental Ops",
			})

			if (error) {
				throw new Error(error.message ?? "Unable to enable 2FA.")
			}

			return data
		},
		onSuccess: (data) => {
			setTotpUri(data?.totpURI ?? null)
			setBackupCodes(Array.isArray(data?.backupCodes) ? data.backupCodes : [])
			setMessage("TOTP setup started. Scan QR and verify your code.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const verifyTotpMutation = useMutation({
		mutationFn: async () => {
			if (!verifyTotpCode.trim()) {
				throw new Error("Enter your TOTP code.")
			}

			const { error } = await authClient.twoFactor.verifyTotp({
				code: verifyTotpCode.trim(),
			})

			if (error) {
				throw new Error(error.message ?? "Unable to verify TOTP code.")
			}
		},
		onSuccess: async () => {
			setVerifyTotpCode("")
			setEnable2faPassword("")
			setMessage("Two-factor authentication enabled with TOTP.")
			setError(null)
			await queryClient.invalidateQueries({ queryKey: mainQueryKeys.all })
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const setupEmailTwoFactorMutation = useMutation({
		mutationFn: async () => {
			if (!isTwoFactorEnabled && !email2faPassword.trim()) {
				throw new Error("Password is required to start email 2FA.")
			}

			if (!isTwoFactorEnabled) {
				const { error: enableError } = await authClient.twoFactor.enable({
					password: email2faPassword,
					issuer: "Rental Ops",
				})

				if (enableError) {
					throw new Error(enableError.message ?? "Unable to start email 2FA.")
				}
			}

			const { error: otpError } = await authClient.twoFactor.sendOtp()
			if (otpError) {
				throw new Error(otpError.message ?? "Unable to send email OTP.")
			}
		},
		onSuccess: () => {
			setMessage("Email OTP sent. Enter the code to complete setup.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const sendEmailOtpMutation = useMutation({
		mutationFn: async () => {
			const { error } = await authClient.twoFactor.sendOtp()
			if (error) {
				throw new Error(error.message ?? "Unable to send email OTP.")
			}
		},
		onSuccess: () => {
			setMessage("Email OTP sent.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const verifyEmailOtpMutation = useMutation({
		mutationFn: async () => {
			if (!emailOtpCode.trim()) {
				throw new Error("Enter the email OTP code.")
			}

			const { error } = await authClient.twoFactor.verifyOtp({
				code: emailOtpCode.trim(),
			})

			if (error) {
				throw new Error(error.message ?? "Unable to verify email OTP.")
			}
		},
		onSuccess: async () => {
			setEmailOtpCode("")
			setEmail2faPassword("")
			setMessage("Two-factor authentication enabled with email OTP.")
			setError(null)
			await queryClient.invalidateQueries({ queryKey: mainQueryKeys.all })
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const generateBackupCodesMutation = useMutation({
		mutationFn: async () => {
			if (!backupCodesPassword.trim()) {
				throw new Error("Password is required to generate backup codes.")
			}

			const { data, error } = await authClient.twoFactor.generateBackupCodes({
				password: backupCodesPassword,
			})

			if (error) {
				throw new Error(error.message ?? "Unable to generate backup codes.")
			}

			return data
		},
		onSuccess: (data) => {
			setBackupCodes(Array.isArray(data?.backupCodes) ? data.backupCodes : [])
			setBackupCodesPassword("")
			setMessage("New backup codes generated.")
			setError(null)
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const disableTwoFactorMutation = useMutation({
		mutationFn: async () => {
			if (!disable2faPassword.trim()) {
				throw new Error("Password is required to disable 2FA.")
			}

			const { error } = await authClient.twoFactor.disable({
				password: disable2faPassword,
			})

			if (error) {
				throw new Error(error.message ?? "Unable to disable 2FA.")
			}
		},
		onSuccess: async () => {
			setDisable2faPassword("")
			setTotpUri(null)
			setBackupCodes([])
			setMessage("Two-factor authentication disabled.")
			setError(null)
			await queryClient.invalidateQueries({ queryKey: mainQueryKeys.all })
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const deleteAccountMutation = useMutation({
		mutationFn: async () => {
			if (!deleteAccountPassword.trim()) {
				throw new Error("Password is required to delete account.")
			}

			const response = await fetch("/api/auth/delete-user", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					password: deleteAccountPassword,
					callbackURL: routes.auth.signIn,
				}),
			})

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string
					message?: string
				} | null
				throw new Error(
					payload?.error ?? payload?.message ?? "Unable to delete account.",
				)
			}
		},
		onSuccess: () => {
			window.location.href = routes.auth.signIn
		},
		onError: (mutationError) => {
			setError(mutationError.message)
			setMessage(null)
		},
	})

	const passkeys = passkeysQuery.data ?? []
	const trimmedName = name.trim()
	const currentProfileName = (session.data?.user?.name ?? "").trim()
	const canSaveProfileName =
		trimmedName.length > 0 && trimmedName !== currentProfileName
	const canChangePassword =
		currentPassword.trim().length > 0 &&
		newPassword.trim().length > 0 &&
		confirmPassword.trim().length > 0 &&
		newPassword === confirmPassword &&
		newPassword !== currentPassword
	const canStartEmailTwoFactor =
		isTwoFactorEnabled || email2faPassword.trim().length > 0
	const canRenamePasskey =
		Boolean(renamePasskeyId) && renamePasskeyName.trim().length > 0
	const canVerifyEmailOtp = emailOtpCode.trim().length > 0
	const canPrepareTotp = enable2faPassword.trim().length > 0
	const canVerifyTotp = verifyTotpCode.trim().length > 0
	const canGenerateBackupCodes = backupCodesPassword.trim().length > 0
	const canDisableTwoFactor = disable2faPassword.trim().length > 0
	const canDeleteAccount = deleteAccountPassword.trim().length > 0
	const twoFactorStepNumber =
		twoFactorStep === "verify-email"
			? 1
			: twoFactorStep === "choose-method"
				? 2
				: 3

	function openRenamePasskey(passkey: PasskeyRecord) {
		setRenamePasskeyId(passkey.id)
		setRenamePasskeyName(passkey.name ?? "")
		setIsRenamePasskeyDrawerOpen(true)
	}

	function beginFeedback(scope: FeedbackScope) {
		setFeedbackScope(scope)
		setMessage(null)
		setError(null)
	}

	function renderScopedFeedback(scope: FeedbackScope) {
		if (feedbackScope !== scope) {
			return null
		}

		return (
			<>
				{message ? <p className="text-primary text-sm">{message}</p> : null}
				{error ? <p className="text-destructive text-sm">{error}</p> : null}
			</>
		)
	}

	return (
		<div className="space-y-6">
			<PageSectionHeader
				title="Profile & Security"
				description="Manage your account details and security settings with step-by-step actions."
			/>

			<section className="space-y-2">
				<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
					<div className="space-y-1">
						<p className="font-medium">Identity</p>
						<p className="text-muted-foreground text-sm">{name || "-"}</p>
					</div>
					<Button
						type="button"
						variant="outline"
						className="h-11"
						onClick={() => setIsNameDrawerOpen(true)}
					>
						Edit name
					</Button>
				</div>

				<div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
					<div className="space-y-1">
						<p className="font-medium">Email</p>
						<p className="text-muted-foreground text-sm">
							{session.data?.user?.email ?? "-"}
						</p>
						<div className="flex items-center gap-1">
							<Badge variant={isEmailVerified ? "default" : "secondary"}>
								{isEmailVerified ? "Verified" : "Not verified"}
							</Badge>
							<ConfirmActionButton
								label={isEmailVerified ? "Email verified" : "Verify email"}
								confirmLabel="Send"
								title="Send verification email"
								description="Confirm to send a new verification email to your address."
								onConfirm={() => {
									beginFeedback("email")
									return sendVerificationMutation.mutateAsync()
								}}
								isPending={sendVerificationMutation.isPending}
								pendingLabel="Sending..."
								variant="link"
								disabled={isEmailVerified}
								className="h-auto px-0"
							/>
						</div>
					</div>
					<Button
						type="button"
						variant="outline"
						className="h-11"
						onClick={() => setIsEmailDrawerOpen(true)}
					>
						Edit email
					</Button>
				</div>
				{renderScopedFeedback("email")}
				<Separator />
			</section>

			<section className="space-y-2">
				<div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
					<div className="space-y-1">
						<p className="font-medium">Password</p>
						<p className="text-muted-foreground text-sm">
							Change your password and revoke other active sessions.
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						className="h-11"
						onClick={() => setIsPasswordDrawerOpen(true)}
					>
						Change password
					</Button>
				</div>

				<div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
					<div className="space-y-1">
						<p className="font-medium">Two-factor authentication</p>
						<p className="text-muted-foreground text-sm">
							Set up email OTP or authenticator app (TOTP) with guided steps.
						</p>
						<div className="flex items-center gap-2">
							<Badge variant={isTwoFactorEnabled ? "default" : "secondary"}>
								{twoFactorStatusLabel}
							</Badge>
						</div>
					</div>
					<Button
						type="button"
						variant="outline"
						className="h-11"
						onClick={() => setIsTwoFactorDrawerOpen(true)}
					>
						Manage 2FA
					</Button>
				</div>

				<div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
					<div className="space-y-1">
						<p className="font-medium">Passkeys</p>
						<p className="text-muted-foreground text-sm">
							Register, rename, or remove passkeys.
						</p>
						<p className="text-sm">{passkeys.length} passkey(s)</p>
					</div>
					<Button
						type="button"
						variant="outline"
						className="h-11"
						onClick={() => setIsAddPasskeyDrawerOpen(true)}
					>
						Add passkey
					</Button>
				</div>

				{passkeysQuery.isLoading ? (
					<p className="text-muted-foreground py-2 text-sm">
						Loading passkeys...
					</p>
				) : null}

				{passkeys.length === 0 && !passkeysQuery.isLoading ? (
					<p className="text-muted-foreground py-2 text-sm">
						No passkeys added yet.
					</p>
				) : null}

				{passkeys.map((passkey) => (
					<div
						key={passkey.id}
						className="flex flex-col gap-3 rounded-xl border border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
					>
						<div className="min-w-0 space-y-1">
							<div className="flex items-center gap-2">
								<p className="truncate text-sm font-medium">
									{passkey.name || "Unnamed passkey"}
								</p>
								<Badge variant="secondary">Passkey</Badge>
							</div>
							<p className="text-muted-foreground text-xs">ID: {passkey.id}</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="outline"
								className="h-10"
								onClick={() => openRenamePasskey(passkey)}
							>
								Rename key
							</Button>
							<ConfirmActionButton
								label="Delete"
								confirmLabel="Delete"
								title="Delete passkey"
								description="Confirm to remove this passkey from your account."
								onConfirm={() => {
									beginFeedback("passkey-list")
									return deletePasskeyMutation.mutateAsync(passkey.id)
								}}
								variant="destructive"
								isPending={deletePasskeyMutation.isPending}
								pendingLabel="Deleting..."
								className="h-10"
							/>
						</div>
					</div>
				))}
				{renderScopedFeedback("passkey-list")}
				<Separator />
			</section>

			<section className="space-y-2">
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4">
					<div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
						<div className="space-y-1">
							<p className="font-medium text-destructive">Danger zone</p>
							<p className="text-muted-foreground text-sm">
								Permanently remove your account and end all active sessions.
							</p>
						</div>
						<Button
							type="button"
							variant="destructive"
							className="h-11"
							onClick={() => setIsDeleteDrawerOpen(true)}
						>
							Delete account
						</Button>
					</div>
				</div>
			</section>

			<ResponsiveDrawer
				open={isNameDrawerOpen}
				onOpenChange={setIsNameDrawerOpen}
				title="Edit name"
				description="Update your display name."
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="profileName">Name</FieldLabel>
						<Input
							id="profileName"
							value={name}
							onChange={(event) => setName(event.target.value)}
							className="h-11"
						/>
					</Field>

					<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
						<ConfirmActionButton
							label="Save name"
							confirmLabel="Save"
							title="Save name"
							description="Confirm to update your name."
							onConfirm={() => {
								beginFeedback("name")
								return updateNameMutation.mutateAsync()
							}}
							disabled={!canSaveProfileName}
							isPending={updateNameMutation.isPending}
							pendingLabel="Saving..."
						/>
					</div>
					{renderScopedFeedback("name")}
				</FieldGroup>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isEmailDrawerOpen}
				onOpenChange={setIsEmailDrawerOpen}
				title="Edit email"
				description="Review your email and verification status."
			>
				<FieldGroup>
					<Field>
						<FieldLabel>Email</FieldLabel>
						<Input
							value={session.data?.user?.email ?? "-"}
							readOnly
							className="h-11"
						/>
					</Field>
					<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
						<ConfirmActionButton
							label={
								isEmailVerified ? "Email verified" : "Send verification email"
							}
							confirmLabel="Send"
							title="Send verification email"
							description="Confirm to send a new verification email to your address."
							onConfirm={() => {
								beginFeedback("email")
								return sendVerificationMutation.mutateAsync()
							}}
							isPending={sendVerificationMutation.isPending}
							pendingLabel="Sending..."
							variant="outline"
							disabled={isEmailVerified}
						/>
					</div>
					{renderScopedFeedback("email")}
				</FieldGroup>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isPasswordDrawerOpen}
				onOpenChange={setIsPasswordDrawerOpen}
				title="Change password"
				description="Set a new password and revoke other sessions."
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
						<Input
							id="currentPassword"
							type="password"
							value={currentPassword}
							onChange={(event) => setCurrentPassword(event.target.value)}
							className="h-11"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="newPassword">New password</FieldLabel>
						<Input
							id="newPassword"
							type="password"
							value={newPassword}
							onChange={(event) => setNewPassword(event.target.value)}
							className="h-11"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="confirmPassword">
							Confirm new password
						</FieldLabel>
						<Input
							id="confirmPassword"
							type="password"
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							className="h-11"
						/>
					</Field>

					<div className="flex justify-end">
						<ConfirmActionButton
							label="Update password"
							confirmLabel="Update"
							title="Change password"
							description="Confirm to change your password and revoke other sessions."
							onConfirm={() => {
								beginFeedback("password")
								return changePasswordMutation.mutateAsync()
							}}
							disabled={!canChangePassword}
							isPending={changePasswordMutation.isPending}
							pendingLabel="Updating..."
						/>
					</div>
					{renderScopedFeedback("password")}
				</FieldGroup>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isAddPasskeyDrawerOpen}
				onOpenChange={setIsAddPasskeyDrawerOpen}
				title="Add passkey"
				description="Register a new passkey on this device."
			>
				<div className="space-y-4">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="passkeyName">
								New passkey name (optional)
							</FieldLabel>
							<Input
								id="passkeyName"
								value={passkeyName}
								onChange={(event) => setPasskeyName(event.target.value)}
								placeholder="MacBook Touch ID"
								className="h-11"
							/>
						</Field>
						<div className="flex justify-end">
							<ConfirmActionButton
								label="Add passkey"
								confirmLabel="Add"
								title="Register passkey"
								description="Confirm to start passkey registration on this device."
								onConfirm={() => {
									beginFeedback("add-passkey")
									return addPasskeyMutation.mutateAsync()
								}}
								isPending={addPasskeyMutation.isPending}
								pendingLabel="Registering..."
							/>
						</div>
					</FieldGroup>
					{renderScopedFeedback("add-passkey")}
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isRenamePasskeyDrawerOpen}
				onOpenChange={setIsRenamePasskeyDrawerOpen}
				title="Rename passkey"
				description="Update the display name for this passkey."
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="renamePasskeyName">Passkey name</FieldLabel>
						<Input
							id="renamePasskeyName"
							value={renamePasskeyName}
							onChange={(event) => setRenamePasskeyName(event.target.value)}
							className="h-11"
						/>
					</Field>
					<div className="flex justify-end">
						<ConfirmActionButton
							label="Save name"
							confirmLabel="Save"
							title="Rename passkey"
							description="Confirm to update this passkey name."
							onConfirm={async () => {
								beginFeedback("rename-passkey")
								if (!renamePasskeyId) {
									throw new Error("No passkey selected.")
								}

								await renamePasskeyMutation.mutateAsync({
									id: renamePasskeyId,
									nextName: renamePasskeyName,
								})

								setIsRenamePasskeyDrawerOpen(false)
							}}
							disabled={!canRenamePasskey}
							variant="outline"
							isPending={renamePasskeyMutation.isPending}
							pendingLabel="Saving..."
						/>
					</div>
					{renderScopedFeedback("rename-passkey")}
				</FieldGroup>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isTwoFactorDrawerOpen}
				onOpenChange={setIsTwoFactorDrawerOpen}
				title="Two-factor authentication"
				description="Follow the steps to set up email OTP or TOTP authenticator."
			>
				<div className="space-y-4">
					<div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
						<p className="text-sm font-medium">Setup progress</p>
						<div className="flex items-center gap-2">
							<Badge
								variant={twoFactorStepNumber >= 1 ? "default" : "secondary"}
							>
								1
							</Badge>
							<Badge
								variant={twoFactorStepNumber >= 2 ? "default" : "secondary"}
							>
								2
							</Badge>
							<Badge
								variant={twoFactorStepNumber >= 3 ? "default" : "secondary"}
							>
								3
							</Badge>
						</div>
					</div>

					<div className="rounded-md border p-3">
						<p className="text-sm font-medium">Current status</p>
						<p className="text-muted-foreground text-sm">
							{twoFactorStatusLabel}
						</p>
					</div>

					{twoFactorStep === "verify-email" ? (
						<div className="space-y-3">
							<p className="text-sm">
								Verify your email before enabling two-factor authentication.
							</p>
							<ConfirmActionButton
								label="Send verification email"
								confirmLabel="Send"
								title="Send verification email"
								description="Confirm to send verification instructions to your email."
								onConfirm={() => {
									beginFeedback("twofactor")
									return sendVerificationMutation.mutateAsync()
								}}
								isPending={sendVerificationMutation.isPending}
								pendingLabel="Sending..."
								className="h-11 w-full"
							/>
						</div>
					) : null}

					{twoFactorStep === "choose-method" ? (
						<div className="space-y-3">
							<p className="text-sm font-medium">
								Step 2: Choose verification method
							</p>
							<div className="grid gap-2 sm:grid-cols-2">
								<Button
									type="button"
									variant="outline"
									className="h-11"
									onClick={() => setTwoFactorStep("email-otp")}
								>
									Use email OTP
								</Button>
								<Button
									type="button"
									variant="outline"
									className="h-11"
									onClick={() => setTwoFactorStep("totp")}
								>
									Use authenticator app (TOTP)
								</Button>
							</div>
						</div>
					) : null}

					{twoFactorStep === "email-otp" ? (
						<FieldGroup>
							<p className="text-sm font-medium">
								Step 3: Complete email OTP setup
							</p>
							{!isTwoFactorEnabled ? (
								<Field>
									<FieldLabel htmlFor="email2faPassword">
										Password for setup
									</FieldLabel>
									<Input
										id="email2faPassword"
										type="password"
										value={email2faPassword}
										onChange={(event) =>
											setEmail2faPassword(event.target.value)
										}
										className="h-11"
									/>
								</Field>
							) : null}

							<div className="grid gap-2 sm:grid-cols-2">
								<ConfirmActionButton
									label={
										isTwoFactorEnabled ? "Send email code" : "Start email 2FA"
									}
									confirmLabel="Continue"
									title="Start email OTP setup"
									description="Confirm to send an OTP to your email for verification."
									onConfirm={() => {
										beginFeedback("twofactor")
										return setupEmailTwoFactorMutation.mutateAsync()
									}}
									disabled={!canStartEmailTwoFactor}
									isPending={setupEmailTwoFactorMutation.isPending}
									pendingLabel="Preparing..."
									className="h-11"
								/>
								<ConfirmActionButton
									label="Resend code"
									confirmLabel="Resend"
									title="Resend email OTP"
									description="Confirm to resend a one-time code to your email."
									onConfirm={() => {
										beginFeedback("twofactor")
										return sendEmailOtpMutation.mutateAsync()
									}}
									isPending={sendEmailOtpMutation.isPending}
									pendingLabel="Sending..."
									variant="outline"
									className="h-11"
								/>
							</div>

							<Field>
								<FieldLabel htmlFor="emailOtpCode">Email OTP code</FieldLabel>
								<Input
									id="emailOtpCode"
									value={emailOtpCode}
									onChange={(event) => setEmailOtpCode(event.target.value)}
									placeholder="123456"
									className="h-11"
								/>
							</Field>

							<div className="flex justify-end">
								<ConfirmActionButton
									label="Verify email OTP"
									confirmLabel="Verify"
									title="Verify email OTP"
									description="Confirm to verify your email code and enable 2FA."
									onConfirm={() => {
										beginFeedback("twofactor")
										return verifyEmailOtpMutation.mutateAsync()
									}}
									disabled={!canVerifyEmailOtp}
									isPending={verifyEmailOtpMutation.isPending}
									pendingLabel="Verifying..."
								/>
							</div>
						</FieldGroup>
					) : null}

					{twoFactorStep === "totp" ? (
						<FieldGroup>
							<p className="text-sm font-medium">
								Step 3: Complete authenticator app setup
							</p>
							<Field>
								<FieldLabel htmlFor="enable2faPassword">
									Password for TOTP setup
								</FieldLabel>
								<Input
									id="enable2faPassword"
									type="password"
									value={enable2faPassword}
									onChange={(event) => setEnable2faPassword(event.target.value)}
									className="h-11"
								/>
							</Field>

							<div className="flex justify-end">
								<ConfirmActionButton
									label="Generate QR"
									confirmLabel="Continue"
									title="Generate authenticator QR"
									description="Confirm to generate a QR code for your authenticator app."
									onConfirm={() => {
										beginFeedback("twofactor")
										return enableTwoFactorMutation.mutateAsync()
									}}
									disabled={!canPrepareTotp}
									isPending={enableTwoFactorMutation.isPending}
									pendingLabel="Preparing..."
								/>
							</div>

							{totpQrDataUrl ? (
								<div className="space-y-3 rounded-md border p-3">
									<p className="text-sm font-medium">
										Scan with your authenticator app
									</p>
									<Image
										src={totpQrDataUrl}
										alt="TOTP QR code"
										width={176}
										height={176}
										className="h-44 w-44"
										unoptimized
									/>

									<Field>
										<FieldLabel htmlFor="verifyTotpCode">TOTP code</FieldLabel>
										<Input
											id="verifyTotpCode"
											value={verifyTotpCode}
											onChange={(event) =>
												setVerifyTotpCode(event.target.value)
											}
											placeholder="123456"
											className="h-11"
										/>
									</Field>

									<div className="flex justify-end">
										<ConfirmActionButton
											label="Verify TOTP"
											confirmLabel="Verify"
											title="Verify TOTP"
											description="Confirm to verify the authenticator code and enable 2FA."
											onConfirm={() => {
												beginFeedback("twofactor")
												return verifyTotpMutation.mutateAsync()
											}}
											disabled={!canVerifyTotp}
											isPending={verifyTotpMutation.isPending}
											pendingLabel="Verifying..."
										/>
									</div>
								</div>
							) : null}
						</FieldGroup>
					) : null}

					{isTwoFactorEnabled ? (
						<>
							<Separator />
							<FieldGroup>
								<p className="text-sm font-medium">Recovery and disable</p>
								<Field>
									<FieldLabel htmlFor="backupCodesPassword">
										Password to generate backup codes
									</FieldLabel>
									<Input
										id="backupCodesPassword"
										type="password"
										value={backupCodesPassword}
										onChange={(event) =>
											setBackupCodesPassword(event.target.value)
										}
										className="h-11"
									/>
								</Field>

								<div className="flex justify-end">
									<ConfirmActionButton
										label="Generate backup codes"
										confirmLabel="Generate"
										title="Generate backup codes"
										description="Confirm to generate a new set of backup recovery codes."
										onConfirm={() => {
											beginFeedback("twofactor")
											return generateBackupCodesMutation.mutateAsync()
										}}
										disabled={!canGenerateBackupCodes}
										isPending={generateBackupCodesMutation.isPending}
										pendingLabel="Generating..."
									/>
								</div>

								{backupCodes.length > 0 ? (
									<div className="rounded-md border p-3">
										<p className="text-sm font-medium mb-2">Backup codes</p>
										<div className="grid gap-2 sm:grid-cols-2">
											{backupCodes.map((code) => (
												<p key={code} className="text-sm font-mono">
													{code}
												</p>
											))}
										</div>
									</div>
								) : null}

								<Field>
									<FieldLabel htmlFor="disable2faPassword">
										Password to disable 2FA
									</FieldLabel>
									<Input
										id="disable2faPassword"
										type="password"
										value={disable2faPassword}
										onChange={(event) =>
											setDisable2faPassword(event.target.value)
										}
										className="h-11"
									/>
								</Field>

								<div className="flex justify-end">
									<ConfirmActionButton
										label="Disable 2FA"
										confirmLabel="Disable"
										title="Disable two-factor authentication"
										description="Confirm to remove two-factor authentication from your account."
										onConfirm={() => {
											beginFeedback("twofactor")
											return disableTwoFactorMutation.mutateAsync()
										}}
										disabled={!canDisableTwoFactor}
										isPending={disableTwoFactorMutation.isPending}
										pendingLabel="Disabling..."
										variant="destructive"
									/>
								</div>
								{renderScopedFeedback("twofactor")}
							</FieldGroup>
						</>
					) : null}

					{renderScopedFeedback("twofactor")}
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isDeleteDrawerOpen}
				onOpenChange={setIsDeleteDrawerOpen}
				title="Delete account"
				description="This is permanent and cannot be undone."
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="deleteAccountPassword">
							Confirm password
						</FieldLabel>
						<Input
							id="deleteAccountPassword"
							type="password"
							value={deleteAccountPassword}
							onChange={(event) => setDeleteAccountPassword(event.target.value)}
							className="h-11"
						/>
					</Field>

					<div className="flex justify-end">
						<ConfirmActionButton
							label="Delete account"
							confirmLabel="Delete forever"
							title="Delete your account"
							description="Confirm to permanently delete your account and sign out."
							onConfirm={() => {
								beginFeedback("delete")
								return deleteAccountMutation.mutateAsync()
							}}
							disabled={!canDeleteAccount}
							isPending={deleteAccountMutation.isPending}
							pendingLabel="Deleting..."
							variant="destructive"
						/>
					</div>
					{renderScopedFeedback("delete")}
				</FieldGroup>
			</ResponsiveDrawer>
		</div>
	)
}
