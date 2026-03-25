import { cn } from "@/lib/utils"

export type AuthVisualVariant =
	| "sign-in"
	| "sign-up"
	| "two-factor"
	| "onboarding"
	| "invitation"
	| "status"

const visualLabels: Record<
	AuthVisualVariant,
	{ eyebrow: string; title: string; accent: string }
> = {
	"sign-in": {
		eyebrow: "",
		title: "",
		accent: "Sign in",
	},
	"sign-up": {
		eyebrow: "Create account",
		title: "Simple entry on the left, brand illustration on the right.",
		accent: "Sign up",
	},
	"two-factor": {
		eyebrow: "Verification",
		title: "Clear step-up authentication without crowding the form side.",
		accent: "2FA",
	},
	onboarding: {
		eyebrow: "Workspace setup",
		title: "The same split layout carries setup screens cleanly.",
		accent: "Setup",
	},
	invitation: {
		eyebrow: "Invitation",
		title: "Invitation flows stay visually consistent with core auth.",
		accent: "Invite",
	},
	status: {
		eyebrow: "Auth state",
		title: "Loading and recovery states still belong to the same system.",
		accent: "State",
	},
}

type AuthVisualPanelProps = {
	variant: AuthVisualVariant
	compact?: boolean
}

export function AuthVisualPanel({
	variant,
	compact = false,
}: AuthVisualPanelProps) {
	const content = visualLabels[variant]
	const hasCopy = Boolean(content.eyebrow || content.title)

	return (
		<div
			className={cn(
				"relative h-full overflow-hidden",
				compact
					? "min-h-55 p-5"
					: "min-h-0 p-6 lg:max-h-[calc(100dvh-5rem)] xl:p-8",
			)}
		>
			<div className="auth-grid-lines absolute inset-0 opacity-50" />
			<div className="auth-svg-glow auth-svg-glow-a absolute left-8 top-12 size-48 rounded-full" />
			<div className="auth-svg-glow auth-svg-glow-b absolute bottom-10 right-10 size-64 rounded-full" />

			<div
				className={cn(
					"relative z-10 flex h-full flex-col",
					hasCopy ? "justify-between" : "items-center justify-center",
				)}
			>
				{hasCopy ? (
					<div className={cn("space-y-3", compact ? "max-w-sm" : "max-w-md")}>
						{content.eyebrow ? (
							<p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
								{content.eyebrow}
							</p>
						) : null}
						{content.title ? (
							<h2
								className={cn(
									"font-semibold tracking-tight text-foreground",
									compact ? "text-xl" : "text-3xl xl:text-4xl",
								)}
							>
								{content.title}
							</h2>
						) : null}
					</div>
				) : null}

				<div
					className={cn(
						"relative w-full",
						compact
							? "mt-8 h-44"
							: hasCopy
								? "mt-8 h-[clamp(16rem,38vh,26rem)]"
								: "mx-auto h-[clamp(20rem,52vh,34rem)] max-w-[36rem]",
					)}
				>
					<svg
						viewBox="0 0 680 520"
						className="h-full w-full"
						aria-hidden="true"
						role="presentation"
					>
						<defs>
							<linearGradient
								id={`auth-line-${variant}`}
								x1="0%"
								y1="0%"
								x2="100%"
								y2="100%"
							>
								<stop offset="0%" stopColor="var(--auth-visual-accent-start)" />
								<stop offset="100%" stopColor="var(--auth-visual-accent-end)" />
							</linearGradient>
							<filter
								id={`auth-blur-${variant}`}
								x="-20%"
								y="-20%"
								width="140%"
								height="140%"
							>
								<feGaussianBlur stdDeviation="10" />
							</filter>
						</defs>

						<g className="auth-svg-float auth-svg-float-a">
							<circle
								cx="128"
								cy="140"
								r="74"
								fill="var(--auth-visual-orb-fill)"
							/>
							<circle
								cx="128"
								cy="140"
								r="52"
								fill="none"
								stroke="var(--auth-visual-orb-stroke)"
								strokeWidth="2"
							/>
						</g>

						<g className="auth-svg-float auth-svg-float-b">
							<rect
								x="256"
								y="92"
								width="228"
								height="228"
								rx="42"
								fill="var(--auth-visual-card-fill)"
								stroke="var(--auth-visual-card-stroke)"
							/>
							<path
								d="M302 246C340 170 378 150 438 170"
								stroke={`url(#auth-line-${variant})`}
								strokeWidth="18"
								strokeLinecap="round"
								fill="none"
							/>
							<path
								d="M302 286C348 244 390 228 446 236"
								stroke="var(--auth-visual-muted-stroke)"
								strokeWidth="10"
								strokeLinecap="round"
								fill="none"
							/>
						</g>

						<g className="auth-svg-float auth-svg-float-c">
							<circle
								cx="530"
								cy="182"
								r="72"
								fill="var(--auth-visual-card-fill)"
								stroke="var(--auth-visual-orb-stroke)"
							/>
							<circle
								cx="530"
								cy="182"
								r="20"
								fill="var(--auth-visual-orb-fill)"
								filter={`url(#auth-blur-${variant})`}
							/>
						</g>

						<g className="auth-svg-float auth-svg-float-d">
							<path
								d="M120 378C198 336 258 344 338 396"
								stroke="var(--auth-visual-curve-a)"
								strokeWidth="3"
								strokeLinecap="round"
								fill="none"
							/>
							<path
								d="M118 414C208 396 296 408 382 450"
								stroke="var(--auth-visual-curve-b)"
								strokeWidth="2"
								strokeLinecap="round"
								fill="none"
							/>
						</g>
					</svg>
				</div>
			</div>
		</div>
	)
}
