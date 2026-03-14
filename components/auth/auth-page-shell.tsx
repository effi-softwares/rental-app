import type { ReactNode } from "react"

import { AuthBrand } from "@/components/auth/auth-brand"
import {
	AuthVisualPanel,
	type AuthVisualVariant,
} from "@/components/auth/auth-visual-panel"
import { cn } from "@/lib/utils"

type AuthPageShellProps = {
	eyebrow?: string
	title: string
	description: string
	children: ReactNode
	className?: string
	contentClassName?: string
	contentWidth?: "sm" | "md" | "lg"
	visualVariant?: AuthVisualVariant
}

export function AuthPageShell({
	eyebrow,
	title,
	description,
	children,
	className,
	contentClassName,
	contentWidth = "sm",
	visualVariant = "sign-in",
}: AuthPageShellProps) {
	const contentWidthClassName =
		contentWidth === "sm"
			? "max-w-lg lg:max-w-lg"
			: contentWidth === "md"
				? "max-w-xl lg:max-w-2xl"
				: "max-w-xl lg:max-w-3xl"

	return (
		<main className="auth-shell-background min-h-screen">
			<div className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-7xl p-12 grid w-full items-center gap-8 grid-cols-1 lg:grid-cols-2 lg:gap-18 xl:gap-24">
					<section
						className={cn("flex justify-center lg:justify-start", className)}
					>
						<div
							className={cn("w-full", contentWidthClassName, contentClassName)}
						>
							<div className="space-y-5">
								<AuthBrand />
								<div className="space-y-3">
									{eyebrow ? (
										<div className="hidden w-fit rounded-full border border-border/70 bg-muted/45 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase sm:inline-flex">
											{eyebrow}
										</div>
									) : null}
									<div className="space-y-3">
										<h1 className="max-w-xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
											{title}
										</h1>
										<p className="hidden max-w-xl text-sm leading-7 text-muted-foreground sm:block sm:text-base">
											{description}
										</p>
									</div>
								</div>

								{children}
							</div>
						</div>
					</section>

					<aside className="relative hidden lg:block">
						<AuthVisualPanel variant={visualVariant} />
					</aside>
				</div>
			</div>
		</main>
	)
}
