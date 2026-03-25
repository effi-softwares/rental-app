import type { ReactNode } from "react"

import {
	AuthVisualPanel,
	type AuthVisualVariant,
} from "@/components/auth/auth-visual-panel"
import { cn } from "@/lib/utils"

type AuthPageShellProps = {
	title: string
	description: string
	children: ReactNode
	className?: string
	contentClassName?: string
	contentWidth?: "sm" | "md" | "lg"
	visualVariant?: AuthVisualVariant
}

export function AuthPageShell({
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
		<main className="auth-shell-background h-dvh overflow-hidden">
			<div className="flex h-full items-center justify-center px-4 py-4 sm:px-6 lg:px-8">
				<div className="mx-auto grid h-full max-h-full w-full max-w-7xl grid-cols-1 items-center gap-6 p-4 sm:p-6 lg:grid-cols-2 lg:gap-12 lg:p-8 xl:gap-18 xl:p-10">
					<section
						className={cn(
							"flex min-h-0 justify-center lg:justify-start",
							className,
						)}
					>
						<div
							className={cn(
								"flex w-full min-h-0 flex-col justify-center lg:max-h-full",
								contentWidthClassName,
								contentClassName,
							)}
						>
							<div className="space-y-4 lg:space-y-5">
								<div className="space-y-3">
									<h1 className="max-w-xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
										{title}
									</h1>
									<p className="hidden max-w-xl text-sm leading-7 text-muted-foreground sm:block sm:text-base">
										{description}
									</p>
								</div>

								{children}
							</div>
						</div>
					</section>

					<aside className="relative hidden h-full min-h-0 lg:block">
						<AuthVisualPanel variant={visualVariant} />
					</aside>
				</div>
			</div>
		</main>
	)
}
