"use client"

import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FormEvent, useMemo, useRef, useState } from "react"

import { AuthInlineMessage, AuthPanel } from "@/components/auth/auth-panel"
import {
	OrganizationLogoPicker,
	type OrganizationLogoPickerHandle,
} from "@/components/organizations/organization-logo-picker"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { routes } from "@/config/routes"
import { useCreateOrganizationMutation } from "@/features/main/mutations/use-create-organization-mutation"
import { signUpOnboardingGateApiPath } from "@/lib/auth-flow"
import { toSlug } from "@/lib/utils"

type OnboardingFormProps = {
	userName: string
	flow: "sign-up" | "app-setup"
}

const onboardingStepCount = 3

export function OnboardingForm({ userName, flow }: OnboardingFormProps) {
	const router = useRouter()
	const createOrganizationMutation = useCreateOrganizationMutation()
	const [currentStep, setCurrentStep] = useState(1)
	const [orgName, setOrgName] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const logoPickerRef = useRef<OrganizationLogoPickerHandle | null>(null)

	const slug = useMemo(() => toSlug(orgName), [orgName])

	const badgeLabel = flow === "sign-up" ? "Sign-up flow" : "Workspace setup"
	const description =
		flow === "sign-up"
			? "Create your first organization to finish owner setup."
			: "Create your first organization to start using the app."

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError(null)

		if (!slug) {
			setError("Organization name is required.")
			return
		}

		setIsSubmitting(true)

		try {
			const logoResult = await logoPickerRef.current?.resolveLogo()
			if (!logoResult?.logoUrl) {
				setError("Please choose or upload an organization logo.")
				return
			}

			await createOrganizationMutation.mutateAsync({
				name: orgName.trim(),
				slug,
				logo: logoResult.logoUrl,
				logoBlurDataUrl: logoResult.blurDataUrl,
			})

			if (flow === "sign-up") {
				await fetch(signUpOnboardingGateApiPath, {
					method: "DELETE",
				}).catch(() => undefined)
			}

			router.replace(routes.app.root)
			router.refresh()
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Unable to create organization. Please try again.",
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	function onNextStep() {
		setError(null)

		if (currentStep === 1 && !slug) {
			setError("Organization name is required.")
			return
		}

		setCurrentStep((step) => Math.min(step + 1, onboardingStepCount))
	}

	function onPreviousStep() {
		setError(null)
		setCurrentStep((step) => Math.max(step - 1, 1))
	}

	return (
		<AuthPanel className="space-y-6">
			<div className="space-y-3">
				<div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
					<Sparkles className="size-4" />
					{badgeLabel}
				</div>
				<div>
					<p className="text-xl font-semibold tracking-tight text-foreground">
						Welcome, {userName}
					</p>
					<p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
						{description}
					</p>
				</div>
			</div>

			<form onSubmit={onSubmit}>
				<FieldGroup className="gap-5">
					{currentStep === 1 ? (
						<>
							<Field>
								<FieldLabel htmlFor="organizationName">
									Organization name
								</FieldLabel>
								<Input
									id="organizationName"
									name="organizationName"
									value={orgName}
									onChange={(event) => setOrgName(event.target.value)}
									placeholder="Acme Rentals"
									required
									className="h-12 rounded-xl"
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor="organizationSlug">Slug preview</FieldLabel>
								<Input
									id="organizationSlug"
									value={slug || "-"}
									readOnly
									className="h-12 rounded-xl text-muted-foreground"
								/>
							</Field>

							<AuthInlineMessage>
								The slug identifies your organization in workspace links and API
								scope.
							</AuthInlineMessage>
						</>
					) : null}

					{currentStep >= 2 ? (
						<div className={currentStep === 2 ? "" : "hidden"}>
							<OrganizationLogoPicker
								ref={logoPickerRef}
								organizationName={orgName}
							/>
						</div>
					) : null}

					{currentStep === 3 ? (
						<div className="space-y-4">
							<div className="rounded-[1.5rem] border border-border/70 bg-muted/25 p-5">
								<p className="text-sm font-semibold text-foreground">
									Review organization setup
								</p>
								<dl className="mt-4 space-y-3 text-sm">
									<div className="flex justify-between gap-3">
										<dt className="text-muted-foreground">Organization name</dt>
										<dd className="font-medium">{orgName || "-"}</dd>
									</div>
									<div className="flex justify-between gap-3">
										<dt className="text-muted-foreground">Slug</dt>
										<dd className="font-medium">{slug || "-"}</dd>
									</div>
								</dl>
							</div>

							<AuthInlineMessage>
								When you create the organization, your selected logo becomes the
								workspace identity for navigation and invite surfaces.
							</AuthInlineMessage>
						</div>
					) : null}

					{error ? (
						<AuthInlineMessage variant="destructive">{error}</AuthInlineMessage>
					) : null}

					<div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
						<Button
							type="button"
							variant="outline"
							size="lg"
							className="h-12 rounded-xl"
							disabled={currentStep === 1 || isSubmitting}
							onClick={onPreviousStep}
						>
							<ChevronLeft className="size-4" />
							Back
						</Button>

						<div className="flex items-center justify-between gap-3 sm:justify-end">
							<p className="text-sm font-medium text-muted-foreground">
								{currentStep} of {onboardingStepCount}
							</p>

							{currentStep < onboardingStepCount ? (
								<Button
									type="button"
									size="lg"
									className="h-12 rounded-xl"
									onClick={onNextStep}
								>
									Next
									<ChevronRight className="size-4" />
								</Button>
							) : (
								<Button
									type="submit"
									size="lg"
									className="h-12 rounded-xl"
									disabled={isSubmitting}
								>
									{isSubmitting
										? "Creating organization..."
										: "Create organization"}
								</Button>
							)}
						</div>
					</div>
				</FieldGroup>
			</form>
		</AuthPanel>
	)
}
