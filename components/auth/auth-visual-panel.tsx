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
		eyebrow: "Secure access",
		title: "A focused auth screen with a calm visual anchor.",
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

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(240,249,245,0.76))]",
				compact ? "min-h-55 p-5" : "min-h-160 p-8 xl:p-10",
			)}
		>
			<div className="auth-grid-lines absolute inset-0 opacity-50" />
			<div className="auth-svg-glow auth-svg-glow-a absolute left-8 top-12 size-48 rounded-full" />
			<div className="auth-svg-glow auth-svg-glow-b absolute bottom-10 right-10 size-64 rounded-full" />

			<div className="relative z-10 flex h-full flex-col justify-between">
				<div className={cn("space-y-3", compact ? "max-w-sm" : "max-w-md")}>
					<p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
						{content.eyebrow}
					</p>
					<h2
						className={cn(
							"font-semibold tracking-tight text-foreground",
							compact ? "text-xl" : "text-3xl xl:text-4xl",
						)}
					>
						{content.title}
					</h2>
				</div>

				<div
					className={cn("relative", compact ? "mt-8 h-44" : "mt-12 h-[420px]")}
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
								<stop offset="0%" stopColor="rgba(15,160,128,0.95)" />
								<stop offset="100%" stopColor="rgba(108,196,173,0.55)" />
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
							<circle cx="128" cy="140" r="74" fill="rgba(15,160,128,0.08)" />
							<circle
								cx="128"
								cy="140"
								r="52"
								fill="none"
								stroke="rgba(15,160,128,0.38)"
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
								fill="rgba(255,255,255,0.56)"
								stroke="rgba(15,23,42,0.08)"
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
								stroke="rgba(15,23,42,0.14)"
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
								fill="rgba(255,255,255,0.46)"
								stroke="rgba(15,160,128,0.2)"
							/>
							<circle
								cx="530"
								cy="182"
								r="20"
								fill="rgba(15,160,128,0.18)"
								filter={`url(#auth-blur-${variant})`}
							/>
						</g>

						<g className="auth-svg-float auth-svg-float-d">
							<path
								d="M120 378C198 336 258 344 338 396"
								stroke="rgba(15,160,128,0.28)"
								strokeWidth="3"
								strokeLinecap="round"
								fill="none"
							/>
							<path
								d="M118 414C208 396 296 408 382 450"
								stroke="rgba(15,23,42,0.08)"
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
