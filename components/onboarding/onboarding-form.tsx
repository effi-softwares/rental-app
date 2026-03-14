"use client"

import {
	Building2,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ImagePlus,
	Sparkles,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { type FormEvent, useMemo, useRef, useState } from "react"

import {
	OrganizationLogoPicker,
	type OrganizationLogoPickerHandle,
} from "@/components/organizations/organization-logo-picker"
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
import { useCreateOrganizationMutation } from "@/features/main/mutations/use-create-organization-mutation"
import { signUpOnboardingGateApiPath } from "@/lib/auth-flow"
import { toSlug } from "@/lib/utils"

type OnboardingFormProps = {
	userName: string
	flow: "sign-up" | "app-setup"
}

const onboardingSteps = [
	{
		key: "details",
		label: "Organization",
		icon: Building2,
	},
	{
		key: "logo",
		label: "Logo",
		icon: ImagePlus,
	},
	{
		key: "review",
		label: "Review",
		icon: CheckCircle2,
	},
] as const

export function OnboardingForm({ userName, flow }: OnboardingFormProps) {
	const router = useRouter()
	const createOrganizationMutation = useCreateOrganizationMutation()
	const [currentStep, setCurrentStep] = useState(1)
	const [orgName, setOrgName] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const logoPickerRef = useRef<OrganizationLogoPickerHandle | null>(null)

	const slug = useMemo(() => toSlug(orgName), [orgName])
	const progressPercent = Math.round(
		(currentStep / onboardingSteps.length) * 100,
	)

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

		setCurrentStep((step) => Math.min(step + 1, onboardingSteps.length))
	}

	function onPreviousStep() {
		setError(null)
		setCurrentStep((step) => Math.max(step - 1, 1))
	}

	return (
		<Card className="w-full max-w-lg border-border/70">
			<CardHeader>
				<div className="mb-1 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary/10 px-4 text-primary text-sm font-medium">
					<Sparkles className="size-4" />
					{badgeLabel}
				</div>
				<CardTitle className="text-xl">Welcome, {userName}</CardTitle>
				<CardDescription>{description}</CardDescription>

				<div className="space-y-3 pt-2">
					<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all duration-300"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>

					<div className="grid grid-cols-3 gap-2">
						{onboardingSteps.map((step, index) => {
							const stepNumber = index + 1
							const isActive = currentStep === stepNumber
							const isComplete = currentStep > stepNumber
							const StepIcon = step.icon

							return (
								<div
									key={step.key}
									className={`flex h-11 items-center justify-center gap-2 rounded-md border px-2 text-xs font-medium sm:text-sm ${
										isActive
											? "border-primary bg-primary/10 text-primary"
											: isComplete
												? "border-primary/40 bg-primary/5 text-primary"
												: "border-border text-muted-foreground"
									}`}
								>
									<StepIcon className="size-4" />
									{step.label}
								</div>
							)
						})}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit}>
					<FieldGroup>
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
										className="h-11"
									/>
								</Field>

								<Field>
									<FieldLabel htmlFor="organizationSlug">
										Slug preview
									</FieldLabel>
									<Input
										id="organizationSlug"
										value={slug || "-"}
										readOnly
										className="text-muted-foreground h-11"
									/>
								</Field>

								<div className="rounded-lg border bg-muted/30 p-3">
									<p className="text-muted-foreground text-xs">
										The slug is used to identify your organization in links and
										API scope.
									</p>
								</div>
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
								<div className="rounded-lg border p-4">
									<p className="text-sm font-medium">
										Review organization setup
									</p>
									<dl className="mt-3 space-y-2 text-sm">
										<div className="flex justify-between gap-3">
											<dt className="text-muted-foreground">
												Organization name
											</dt>
											<dd className="font-medium">{orgName || "-"}</dd>
										</div>
										<div className="flex justify-between gap-3">
											<dt className="text-muted-foreground">Slug</dt>
											<dd className="font-medium">{slug || "-"}</dd>
										</div>
									</dl>
								</div>

								<div className="rounded-lg border bg-muted/30 p-3">
									<p className="text-muted-foreground text-xs">
										When you create the organization, your selected logo will be
										uploaded and used as the organization identity.
									</p>
								</div>
							</div>
						) : null}

						{error ? <p className="text-destructive text-sm">{error}</p> : null}

						<Separator />

						<div className="flex flex-wrap items-center justify-between gap-2">
							<Button
								type="button"
								variant="outline"
								className="h-11"
								disabled={currentStep === 1 || isSubmitting}
								onClick={onPreviousStep}
							>
								<ChevronLeft className="size-4" />
								Back
							</Button>

							{currentStep < onboardingSteps.length ? (
								<Button type="button" className="h-11" onClick={onNextStep}>
									Next
									<ChevronRight className="size-4" />
								</Button>
							) : (
								<Button type="submit" className="h-11" disabled={isSubmitting}>
									{isSubmitting
										? "Creating organization..."
										: "Create organization"}
								</Button>
							)}
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	)
}
