"use client"

import { AlertTriangle, LayoutDashboard, RotateCcw } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { routes } from "@/config/routes"

type AppErrorProps = {
	error: Error & { digest?: string }
	reset: () => void
}

export default function AppError({ error, reset }: AppErrorProps) {
	return (
		<div
			role="alert"
			aria-live="assertive"
			className="relative -mx-4 -my-6 flex min-h-[calc(100svh-7rem)] items-center justify-center overflow-hidden bg-linear-to-b from-background via-background to-muted/30 px-4 py-10 md:-mx-6 md:-my-8 md:min-h-[calc(100svh-8rem)] xl:-mx-8"
		>
			<div className="text-center">
				<div className="bg-destructive/10 text-destructive mx-auto inline-flex items-center gap-2 rounded-full border border-destructive/15 px-4 py-2 text-sm font-medium">
					<AlertTriangle className="size-4" />
					Dashboard error
				</div>

				<div className="mt-8 flex justify-center gap-1 sm:gap-2">
					<span className="inline-block bg-linear-to-r from-destructive/45 via-destructive to-destructive/45 bg-size-[200%_100%] bg-clip-text text-[5rem] leading-none font-black tracking-[-0.12em] text-transparent animate-[state-code-bob_2.4s_ease-in-out_infinite,state-gradient-shift_3.8s_linear_infinite] sm:text-[7rem]">
						5
					</span>
					<span
						className="inline-block bg-linear-to-r from-destructive/45 via-destructive to-destructive/45 bg-size-[200%_100%] bg-clip-text text-[5rem] leading-none font-black tracking-[-0.12em] text-transparent animate-[state-code-bob_2.4s_ease-in-out_infinite,state-gradient-shift_3.8s_linear_infinite] sm:text-[7rem]"
						style={{ animationDelay: "180ms, 0ms" }}
					>
						0
					</span>
					<span
						className="inline-block bg-linear-to-r from-destructive/45 via-destructive to-destructive/45 bg-size-[200%_100%] bg-clip-text text-[5rem] leading-none font-black tracking-[-0.12em] text-transparent animate-[state-code-bob_2.4s_ease-in-out_infinite,state-gradient-shift_3.8s_linear_infinite] sm:text-[7rem]"
						style={{ animationDelay: "360ms, 0ms" }}
					>
						0
					</span>
				</div>
				<h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
					Something broke in the workspace
				</h1>
				<p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-6 sm:text-base">
					The dashboard hit an unexpected problem while loading this page. Try
					the request again or return to the main workspace.
				</p>

				<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Button type="button" size="lg" className="min-w-40" onClick={reset}>
						<RotateCcw />
						Try again
					</Button>
					<Button
						asChild
						type="button"
						variant="outline"
						size="lg"
						className="min-w-40"
					>
						<Link href={routes.app.root}>
							<LayoutDashboard />
							Dashboard
						</Link>
					</Button>
				</div>

				<p className="text-muted-foreground/70 mt-8 text-xs tracking-[0.16em] uppercase">
					{error.digest ? `Reference: ${error.digest}` : "Error Code: 500"}
				</p>
			</div>
		</div>
	)
}
