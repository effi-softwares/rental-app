"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import {
	OrganizationLogoPicker,
	type OrganizationLogoPickerHandle,
} from "@/components/organizations/organization-logo-picker"
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
import { setActiveOrganization } from "@/features/main/mutations/active-organization"
import { mainQueryKeys } from "@/features/main/queries/keys"
import { organizationsQueryKeys } from "@/features/organizations/queries/keys"
import { organizationSettingsFormSchema } from "@/features/organizations/schemas/settings-form"
import { authClient } from "@/lib/auth-client"
import { resolveErrorMessage } from "@/lib/errors"

type CurrentOrganizationResponse = {
	organization: {
		id: string
		name: string
		slug: string
		logo: string | null
		isVisible: boolean
		metadata: {
			logoBlurDataUrl?: string | null
			supportEmail?: string | null
			supportPhone?: string | null
			website?: string | null
		} | null
	}
	role: string
	canManageOrganization: boolean
	canDeleteOrganization: boolean
	canManageVisibility: boolean
}

type FeedbackScope =
	| "name"
	| "slug"
	| "logo"
	| "support-email"
	| "support-phone"
	| "website"
	| "visibility"
	| "delete"

type ConfirmActionButtonProps = {
	label: string
	confirmLabel: string
	title: string
	description: string
	onConfirm: () => Promise<unknown>
	variant?: "default" | "outline" | "destructive"
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

export function OrganizationSettingsPanel() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const logoPickerRef = useRef<OrganizationLogoPickerHandle | null>(null)

	const [name, setName] = useState("")
	const [slug, setSlug] = useState("")
	const [supportEmail, setSupportEmail] = useState("")
	const [supportPhone, setSupportPhone] = useState("")
	const [website, setWebsite] = useState("")

	const [deleteConfirmationName, setDeleteConfirmationName] = useState("")
	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [feedbackScope, setFeedbackScope] = useState<FeedbackScope | null>(null)

	const [isNameDrawerOpen, setIsNameDrawerOpen] = useState(false)
	const [isSlugDrawerOpen, setIsSlugDrawerOpen] = useState(false)
	const [isLogoDrawerOpen, setIsLogoDrawerOpen] = useState(false)
	const [isSupportEmailDrawerOpen, setIsSupportEmailDrawerOpen] =
		useState(false)
	const [isSupportPhoneDrawerOpen, setIsSupportPhoneDrawerOpen] =
		useState(false)
	const [isWebsiteDrawerOpen, setIsWebsiteDrawerOpen] = useState(false)
	const [isVisibilityDrawerOpen, setIsVisibilityDrawerOpen] = useState(false)
	const [isDeleteDrawerOpen, setIsDeleteDrawerOpen] = useState(false)

	const currentOrganizationQuery = useQuery({
		queryKey: organizationsQueryKeys.current(),
		queryFn: async () => {
			const response = await fetch("/api/organizations/current")
			const payload = (await response.json().catch(() => null)) as
				| (CurrentOrganizationResponse & { error?: string })
				| null

			if (!response.ok) {
				throw new Error(payload?.error ?? "Failed to load organization.")
			}

			return payload as CurrentOrganizationResponse
		},
	})

	const currentOrganization = currentOrganizationQuery.data?.organization
	const canManageOrganization =
		currentOrganizationQuery.data?.canManageOrganization ?? false
	const canDeleteOrganization =
		currentOrganizationQuery.data?.canDeleteOrganization ?? false
	const canManageVisibility =
		currentOrganizationQuery.data?.canManageVisibility ?? false

	const updateDetailsMutation = useMutation({
		mutationFn: async (input: {
			organizationId: string
			name: string
			slug: string
			logo: string | null
			logoBlurDataUrl: string | null
			supportEmail: string | null
			supportPhone: string | null
			website: string | null
		}) => {
			const { error } = await authClient.organization.update({
				organizationId: input.organizationId,
				data: {
					name: input.name,
					slug: input.slug,
					logo: input.logo ?? undefined,
					metadata: {
						logoBlurDataUrl: input.logoBlurDataUrl,
						supportEmail: input.supportEmail,
						supportPhone: input.supportPhone,
						website: input.website,
					},
				},
			})

			if (error) {
				throw new Error(error.message ?? "Unable to update organization.")
			}
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: organizationsQueryKeys.current(),
				}),
				queryClient.invalidateQueries({
					queryKey: mainQueryKeys.all,
				}),
				queryClient.invalidateQueries({
					queryKey: mainQueryKeys.organizations(),
				}),
			])
			router.refresh()
		},
	})

	const updateVisibilityMutation = useMutation({
		mutationFn: async (input: {
			organizationId: string
			isVisible: boolean
		}) => {
			const { error } = await authClient.organization.update({
				organizationId: input.organizationId,
				data: {
					isVisible: input.isVisible,
				},
			})

			if (error) {
				throw new Error(
					error.message ?? "Unable to update organization visibility.",
				)
			}
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: organizationsQueryKeys.current(),
				}),
				queryClient.invalidateQueries({
					queryKey: mainQueryKeys.all,
				}),
				queryClient.invalidateQueries({
					queryKey: mainQueryKeys.organizations(),
				}),
			])
			router.refresh()
		},
	})

	const deleteOrganizationMutation = useMutation({
		mutationFn: async (organizationId: string) => {
			const { error } = await authClient.organization.delete({
				organizationId,
			})

			if (error) {
				throw new Error(error.message ?? "Unable to delete organization.")
			}

			const organizationsResponse = await fetch("/api/organizations/accessible")
			const organizationsPayload = (await organizationsResponse
				.json()
				.catch(() => null)) as {
				organizations?: Array<{ id: string }>
				error?: string
			} | null

			if (!organizationsResponse.ok) {
				throw new Error(
					organizationsPayload?.error ??
						"Organization deleted, but session could not be refreshed.",
				)
			}

			const fallbackOrganizationId =
				organizationsPayload?.organizations?.[0]?.id
			if (fallbackOrganizationId) {
				await setActiveOrganization(fallbackOrganizationId)
				return { hasFallbackOrganization: true }
			}

			await setActiveOrganization(null)

			return { hasFallbackOrganization: false }
		},
		onSuccess: async (result) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: organizationsQueryKeys.current(),
				}),
				queryClient.invalidateQueries({
					queryKey: mainQueryKeys.all,
				}),
				queryClient.invalidateQueries({
					queryKey: mainQueryKeys.organizations(),
				}),
			])
			router.replace(
				result.hasFallbackOrganization ? routes.app.root : routes.setup,
			)
			router.refresh()
		},
	})

	useEffect(() => {
		if (!currentOrganization) {
			return
		}

		setName(currentOrganization.name)
		setSlug(currentOrganization.slug)
		setSupportEmail(currentOrganization.metadata?.supportEmail ?? "")
		setSupportPhone(currentOrganization.metadata?.supportPhone ?? "")
		setWebsite(currentOrganization.metadata?.website ?? "")
	}, [currentOrganization])

	const isSubmitting =
		updateDetailsMutation.isPending ||
		updateVisibilityMutation.isPending ||
		deleteOrganizationMutation.isPending

	const beginFeedback = (scope: FeedbackScope) => {
		setFeedbackScope(scope)
		setMessage(null)
		setError(null)
	}

	const renderScopedFeedback = (scope: FeedbackScope) => {
		if (feedbackScope !== scope) {
			return null
		}

		return (
			<div className="space-y-2">
				{message ? <p className="text-sm text-emerald-600">{message}</p> : null}
				{error ? <p className="text-destructive text-sm">{error}</p> : null}
			</div>
		)
	}

	const getBaseInput = () => {
		if (!currentOrganization) {
			throw new Error("Organization data is unavailable.")
		}

		return {
			name: currentOrganization.name,
			slug: currentOrganization.slug,
			supportEmail: currentOrganization.metadata?.supportEmail ?? "",
			supportPhone: currentOrganization.metadata?.supportPhone ?? "",
			website: currentOrganization.metadata?.website ?? "",
		}
	}

	const buildValidatedDetails = (
		overrides: Partial<ReturnType<typeof getBaseInput>>,
	) => {
		const parsed = organizationSettingsFormSchema.safeParse({
			...getBaseInput(),
			...overrides,
		})

		if (!parsed.success) {
			const issue = parsed.error.issues[0]
			throw new Error(
				resolveErrorMessage(issue, "Invalid organization settings."),
			)
		}

		return parsed.data
	}

	const submitDetailsUpdate = async (
		scope: FeedbackScope,
		overrides: Partial<ReturnType<typeof getBaseInput>>,
		successMessage: string,
		onSuccess?: () => void,
	) => {
		beginFeedback(scope)

		if (!currentOrganization || !canManageOrganization) {
			setError("You are not allowed to manage this organization.")
			return
		}

		try {
			const details = buildValidatedDetails(overrides)
			await updateDetailsMutation.mutateAsync({
				organizationId: currentOrganization.id,
				name: details.name,
				slug: details.slug,
				logo: currentOrganization.logo,
				logoBlurDataUrl: currentOrganization.metadata?.logoBlurDataUrl ?? null,
				supportEmail: details.supportEmail || null,
				supportPhone: details.supportPhone || null,
				website: details.website || null,
			})
			setMessage(successMessage)
			setError(null)
			onSuccess?.()
		} catch (mutationError) {
			setError(
				resolveErrorMessage(
					mutationError,
					"Unable to update organization settings.",
				),
			)
			setMessage(null)
		}
	}

	const submitLogoUpdate = async () => {
		beginFeedback("logo")

		if (!currentOrganization || !canManageOrganization) {
			setError("You are not allowed to manage this organization.")
			return
		}

		try {
			const details = buildValidatedDetails({})
			const logoResult = await logoPickerRef.current?.resolveLogo()

			if (!logoResult?.logoUrl) {
				setError("Please choose or upload an organization logo.")
				setMessage(null)
				return
			}

			await updateDetailsMutation.mutateAsync({
				organizationId: currentOrganization.id,
				name: details.name,
				slug: details.slug,
				logo: logoResult.logoUrl,
				logoBlurDataUrl: logoResult.blurDataUrl,
				supportEmail: details.supportEmail || null,
				supportPhone: details.supportPhone || null,
				website: details.website || null,
			})

			setMessage("Organization logo updated.")
			setError(null)
			setIsLogoDrawerOpen(false)
		} catch (mutationError) {
			setError(
				resolveErrorMessage(
					mutationError,
					"Unable to update organization logo.",
				),
			)
			setMessage(null)
		}
	}

	const submitVisibilityUpdate = async () => {
		beginFeedback("visibility")

		if (!currentOrganization || !canManageVisibility) {
			setError("Only organization owners can change visibility.")
			return
		}

		try {
			await updateVisibilityMutation.mutateAsync({
				organizationId: currentOrganization.id,
				isVisible: !currentOrganization.isVisible,
			})
			setMessage(
				currentOrganization.isVisible
					? "Organization is now hidden."
					: "Organization is now visible.",
			)
			setError(null)
			setIsVisibilityDrawerOpen(false)
		} catch (mutationError) {
			setError(
				resolveErrorMessage(
					mutationError,
					"Unable to update organization visibility.",
				),
			)
			setMessage(null)
		}
	}

	const submitDeleteOrganization = async () => {
		beginFeedback("delete")

		if (!currentOrganization || !canDeleteOrganization) {
			setError("Only organization owners can delete organizations.")
			return
		}

		if (deleteConfirmationName.trim() !== currentOrganization.name) {
			setError("Type the organization name exactly to continue.")
			setMessage(null)
			return
		}

		try {
			await deleteOrganizationMutation.mutateAsync(currentOrganization.id)
			setDeleteConfirmationName("")
			setMessage("Organization deleted.")
			setError(null)
		} catch (mutationError) {
			setError(
				resolveErrorMessage(mutationError, "Unable to delete organization."),
			)
			setMessage(null)
		}
	}

	if (currentOrganizationQuery.isPending) {
		return (
			<div className=" space-y-4">
				<PageSectionHeader
					title="Organization settings"
					description="Manage organization identity and operational preferences."
				/>
				<p className="text-muted-foreground text-sm">
					Loading organization settings...
				</p>
			</div>
		)
	}

	if (currentOrganizationQuery.isError || !currentOrganization) {
		return (
			<div className=" space-y-4">
				<PageSectionHeader
					title="Organization settings"
					description="Manage organization identity and operational preferences."
				/>
				<p className="text-destructive text-sm">
					{resolveErrorMessage(
						currentOrganizationQuery.error,
						"Failed to load organization settings.",
					)}
				</p>
				<Button
					type="button"
					className="h-11"
					onClick={() => {
						currentOrganizationQuery.refetch()
					}}
				>
					Retry
				</Button>
			</div>
		)
	}

	return (
		<div className=" space-y-8">
			<PageSectionHeader
				title="Organization settings"
				description="Manage organization profile details and operational settings."
			/>

			<section className="space-y-2">
				<div className="space-y-0">
					{/* <div className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
						<div className="space-y-1">
							<p className="text-sm font-medium">Role</p>
							<div className="flex items-center gap-2">
								<Badge variant="secondary">
									{currentOrganizationQuery.data?.role}
								</Badge>
								<p className="text-muted-foreground text-sm">
									Current access level
								</p>
							</div>
						</div>
						<div className="md:justify-self-end" />
					</div> */}

					<div className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
						<div className="space-y-1">
							<p className="text-sm font-medium">Organization name</p>
							<p className="text-muted-foreground text-sm">
								{currentOrganization.name}
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => setIsNameDrawerOpen(true)}
							disabled={!canManageOrganization || isSubmitting}
						>
							Edit name
						</Button>
					</div>
					{renderScopedFeedback("name") ? (
						<div className="pb-5">{renderScopedFeedback("name")}</div>
					) : null}

					<div className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
						<div className="space-y-1">
							<p className="text-sm font-medium">Organization slug</p>
							<p className="text-muted-foreground text-sm">
								{currentOrganization.slug}
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => setIsSlugDrawerOpen(true)}
							disabled={!canManageOrganization || isSubmitting}
						>
							Edit slug
						</Button>
					</div>
					{renderScopedFeedback("slug") ? (
						<div className="pb-5">{renderScopedFeedback("slug")}</div>
					) : null}

					<div className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
						<div className="space-y-2">
							<p className="text-sm font-medium">Organization logo</p>
							<div className="flex items-center gap-3">
								{currentOrganization.logo ? (
									<Image
										src={currentOrganization.logo}
										alt={currentOrganization.name}
										width={44}
										height={44}
										className="size-11 rounded-md border object-cover"
									/>
								) : (
									<div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-md border text-xs font-semibold">
										N/A
									</div>
								)}
								<p className="text-muted-foreground text-sm">
									Used in workspace switcher and invites.
								</p>
							</div>
						</div>
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => setIsLogoDrawerOpen(true)}
							disabled={!canManageOrganization || isSubmitting}
						>
							Change logo
						</Button>
					</div>
					{renderScopedFeedback("logo") ? (
						<div className="pb-5">{renderScopedFeedback("logo")}</div>
					) : null}

					<div className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
						<div className="space-y-1">
							<p className="text-sm font-medium">Support email</p>
							<p className="text-muted-foreground text-sm">
								{currentOrganization.metadata?.supportEmail || "Not set"}
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => setIsSupportEmailDrawerOpen(true)}
							disabled={!canManageOrganization || isSubmitting}
						>
							Edit support email
						</Button>
					</div>
					{renderScopedFeedback("support-email") ? (
						<div className="pb-5">{renderScopedFeedback("support-email")}</div>
					) : null}

					<div className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
						<div className="space-y-1">
							<p className="text-sm font-medium">Support phone</p>
							<p className="text-muted-foreground text-sm">
								{currentOrganization.metadata?.supportPhone || "Not set"}
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => setIsSupportPhoneDrawerOpen(true)}
							disabled={!canManageOrganization || isSubmitting}
						>
							Edit support phone
						</Button>
					</div>
					{renderScopedFeedback("support-phone") ? (
						<div className="pb-5">{renderScopedFeedback("support-phone")}</div>
					) : null}

					<div className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
						<div className="space-y-1">
							<p className="text-sm font-medium">Website</p>
							<p className="text-muted-foreground text-sm">
								{currentOrganization.metadata?.website || "Not set"}
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => setIsWebsiteDrawerOpen(true)}
							disabled={!canManageOrganization || isSubmitting}
						>
							Edit website
						</Button>
					</div>
					{renderScopedFeedback("website") ? (
						<div className="pb-5">{renderScopedFeedback("website")}</div>
					) : null}
				</div>
			</section>

			<section className="space-y-2">
				<Separator />

				<div className="space-y-0">
					<div className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
						<div className="space-y-1">
							<p className="text-sm font-medium">Visibility</p>
							<div className="flex items-center gap-2">
								<Badge
									variant={
										currentOrganization.isVisible ? "secondary" : "outline"
									}
								>
									{currentOrganization.isVisible ? "Visible" : "Hidden"}
								</Badge>
								<p className="text-muted-foreground text-sm">
									Hidden organizations are removed from employee organization
									lists.
								</p>
							</div>
						</div>
						<Button
							type="button"
							variant="outline"
							className="h-11"
							onClick={() => setIsVisibilityDrawerOpen(true)}
							disabled={!canManageVisibility || isSubmitting}
						>
							Manage visibility
						</Button>
					</div>
					{renderScopedFeedback("visibility") ? (
						<div className="pb-5">{renderScopedFeedback("visibility")}</div>
					) : null}

					<div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
						<div className="grid gap-4 py-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
							<div className="space-y-1">
								<p className="text-sm font-medium text-destructive">
									Delete organization
								</p>
								<p className="text-muted-foreground text-sm">
									Deleting an organization removes members, invitations, and
									related auth records.
								</p>
							</div>
							<Button
								type="button"
								variant="destructive"
								className="h-11"
								onClick={() => setIsDeleteDrawerOpen(true)}
								disabled={!canDeleteOrganization || isSubmitting}
							>
								<Trash2 className="mr-2 size-4" /> Delete
							</Button>
						</div>
						{renderScopedFeedback("delete")}
					</div>
				</div>
			</section>

			<ResponsiveDrawer
				open={isNameDrawerOpen}
				onOpenChange={setIsNameDrawerOpen}
				title="Edit organization name"
				description="Update your organization display name."
			>
				<div className="space-y-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="organizationName">
								Organization name
							</FieldLabel>
							<Input
								id="organizationName"
								value={name}
								onChange={(event) => setName(event.target.value)}
								className="h-11"
								required
								disabled={!canManageOrganization || isSubmitting}
							/>
						</Field>
					</FieldGroup>
					<div className="flex justify-end">
						<ConfirmActionButton
							label="Save name"
							confirmLabel="Save"
							title="Save organization name"
							description="Confirm you want to update the organization name."
							onConfirm={() =>
								submitDetailsUpdate(
									"name",
									{ name },
									"Organization name updated.",
									() => setIsNameDrawerOpen(false),
								)
							}
							disabled={!canManageOrganization}
							isPending={isSubmitting}
							pendingLabel="Saving..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isSlugDrawerOpen}
				onOpenChange={setIsSlugDrawerOpen}
				title="Edit organization slug"
				description="Update the slug used for organization references."
			>
				<div className="space-y-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="organizationSlug">
								Organization slug
							</FieldLabel>
							<Input
								id="organizationSlug"
								value={slug}
								onChange={(event) => setSlug(event.target.value)}
								className="h-11"
								required
								disabled={!canManageOrganization || isSubmitting}
							/>
						</Field>
					</FieldGroup>
					<div className="flex justify-end">
						<ConfirmActionButton
							label="Save slug"
							confirmLabel="Save"
							title="Save organization slug"
							description="Confirm you want to update the organization slug."
							onConfirm={() =>
								submitDetailsUpdate(
									"slug",
									{ slug },
									"Organization slug updated.",
									() => setIsSlugDrawerOpen(false),
								)
							}
							disabled={!canManageOrganization}
							isPending={isSubmitting}
							pendingLabel="Saving..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isLogoDrawerOpen}
				onOpenChange={setIsLogoDrawerOpen}
				title="Change organization logo"
				description="Choose an avatar or upload an image for your organization logo."
			>
				<div className="space-y-5">
					<OrganizationLogoPicker
						ref={logoPickerRef}
						organizationName={name || currentOrganization.name}
					/>
					<div className="flex justify-end">
						<ConfirmActionButton
							label="Save logo"
							confirmLabel="Save"
							title="Save organization logo"
							description="Confirm you want to update the organization logo."
							onConfirm={submitLogoUpdate}
							disabled={!canManageOrganization}
							isPending={isSubmitting}
							pendingLabel="Saving..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isSupportEmailDrawerOpen}
				onOpenChange={setIsSupportEmailDrawerOpen}
				title="Edit support email"
				description="Set the support email visible to your team."
			>
				<div className="space-y-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="supportEmail">Support email</FieldLabel>
							<Input
								id="supportEmail"
								type="email"
								value={supportEmail}
								onChange={(event) => setSupportEmail(event.target.value)}
								className="h-11"
								disabled={!canManageOrganization || isSubmitting}
							/>
						</Field>
					</FieldGroup>
					<div className="flex justify-end">
						<ConfirmActionButton
							label="Save support email"
							confirmLabel="Save"
							title="Save support email"
							description="Confirm you want to update support email."
							onConfirm={() =>
								submitDetailsUpdate(
									"support-email",
									{ supportEmail },
									"Support email updated.",
									() => setIsSupportEmailDrawerOpen(false),
								)
							}
							disabled={!canManageOrganization}
							isPending={isSubmitting}
							pendingLabel="Saving..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isSupportPhoneDrawerOpen}
				onOpenChange={setIsSupportPhoneDrawerOpen}
				title="Edit support phone"
				description="Set the support phone visible to your team."
			>
				<div className="space-y-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="supportPhone">Support phone</FieldLabel>
							<Input
								id="supportPhone"
								value={supportPhone}
								onChange={(event) => setSupportPhone(event.target.value)}
								className="h-11"
								disabled={!canManageOrganization || isSubmitting}
							/>
						</Field>
					</FieldGroup>
					<div className="flex justify-end">
						<ConfirmActionButton
							label="Save support phone"
							confirmLabel="Save"
							title="Save support phone"
							description="Confirm you want to update support phone."
							onConfirm={() =>
								submitDetailsUpdate(
									"support-phone",
									{ supportPhone },
									"Support phone updated.",
									() => setIsSupportPhoneDrawerOpen(false),
								)
							}
							disabled={!canManageOrganization}
							isPending={isSubmitting}
							pendingLabel="Saving..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isWebsiteDrawerOpen}
				onOpenChange={setIsWebsiteDrawerOpen}
				title="Edit website"
				description="Set the public website URL for this organization."
			>
				<div className="space-y-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="website">Website</FieldLabel>
							<Input
								id="website"
								value={website}
								onChange={(event) => setWebsite(event.target.value)}
								className="h-11"
								disabled={!canManageOrganization || isSubmitting}
							/>
						</Field>
					</FieldGroup>
					<div className="flex justify-end">
						<ConfirmActionButton
							label="Save website"
							confirmLabel="Save"
							title="Save website"
							description="Confirm you want to update website."
							onConfirm={() =>
								submitDetailsUpdate(
									"website",
									{ website },
									"Website updated.",
									() => setIsWebsiteDrawerOpen(false),
								)
							}
							disabled={!canManageOrganization}
							isPending={isSubmitting}
							pendingLabel="Saving..."
						/>
					</div>
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isVisibilityDrawerOpen}
				onOpenChange={setIsVisibilityDrawerOpen}
				title="Manage visibility"
				description="Choose whether this organization is visible in employee organization lists."
			>
				<div className="space-y-5">
					<div className="rounded-lg border p-4">
						<div className="flex items-center gap-2">
							<Badge
								variant={
									currentOrganization.isVisible ? "secondary" : "outline"
								}
							>
								{currentOrganization.isVisible ? "Visible" : "Hidden"}
							</Badge>
							<p className="text-muted-foreground text-sm">
								{currentOrganization.isVisible
									? "Organization currently appears in employee organization lists."
									: "Organization is currently hidden from employee organization lists."}
							</p>
						</div>
					</div>
					<div className="flex justify-end">
						<ConfirmActionButton
							label={
								currentOrganization.isVisible
									? "Hide organization"
									: "Show organization"
							}
							confirmLabel={currentOrganization.isVisible ? "Hide" : "Show"}
							title={
								currentOrganization.isVisible
									? "Hide organization"
									: "Show organization"
							}
							description={
								currentOrganization.isVisible
									? "Confirm you want to hide this organization."
									: "Confirm you want to make this organization visible."
							}
							onConfirm={submitVisibilityUpdate}
							disabled={!canManageVisibility}
							isPending={isSubmitting}
							pendingLabel="Saving..."
							className="h-11"
						/>
					</div>
					{!canManageVisibility ? (
						<p className="text-muted-foreground text-xs">
							Only organization owners can change visibility.
						</p>
					) : null}
				</div>
			</ResponsiveDrawer>

			<ResponsiveDrawer
				open={isDeleteDrawerOpen}
				onOpenChange={(open) => {
					setIsDeleteDrawerOpen(open)
					if (!open) {
						setDeleteConfirmationName("")
					}
				}}
				title="Delete organization"
				description="This action cannot be undone."
			>
				<div className="space-y-5">
					<p className="text-muted-foreground text-sm">
						Type <strong>{currentOrganization.name}</strong> to confirm
						deletion.
					</p>
					<Input
						value={deleteConfirmationName}
						onChange={(event) => setDeleteConfirmationName(event.target.value)}
						placeholder={currentOrganization.name}
						className="h-11"
						disabled={!canDeleteOrganization || isSubmitting}
					/>
					<div className="flex justify-end">
						<ConfirmActionButton
							label="Delete permanently"
							confirmLabel="Delete"
							title="Delete organization permanently"
							description="Confirm you want to permanently delete this organization and its related records."
							onConfirm={submitDeleteOrganization}
							variant="destructive"
							disabled={
								!canDeleteOrganization ||
								deleteConfirmationName.trim() !== currentOrganization.name
							}
							isPending={isSubmitting}
							pendingLabel="Deleting..."
						/>
					</div>
					{!canDeleteOrganization ? (
						<p className="text-muted-foreground text-xs">
							Only organization owners can delete organizations.
						</p>
					) : null}
				</div>
			</ResponsiveDrawer>
		</div>
	)
}
