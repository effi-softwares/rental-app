"use client"

import { ArrowLeft, Home } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { routes } from "@/config/routes"

export default function NotFound() {
	const router = useRouter()

	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-b from-background via-background to-muted/30 px-4 py-10">
			<div className=" text-center">
				<div className="mt-8 flex justify-center gap-1 sm:gap-2">
					<span className="inline-block bg-linear-to-r from-chart-1 via-primary to-chart-2 bg-size-[200%_100%] bg-clip-text text-[5rem] leading-none font-black tracking-[-0.12em] text-transparent animate-[state-code-bob_2.4s_ease-in-out_infinite,state-gradient-shift_3.8s_linear_infinite] sm:text-[7rem]">
						4
					</span>
					<span
						className="inline-block bg-linear-to-r from-chart-1 via-primary to-chart-2 bg-size-[200%_100%] bg-clip-text text-[5rem] leading-none font-black tracking-[-0.12em] text-transparent animate-[state-code-bob_2.4s_ease-in-out_infinite,state-gradient-shift_3.8s_linear_infinite] sm:text-[7rem]"
						style={{ animationDelay: "180ms, 0ms" }}
					>
						0
					</span>
					<span
						className="inline-block bg-linear-to-r from-chart-1 via-primary to-chart-2 bg-size-[200%_100%] bg-clip-text text-[5rem] leading-none font-black tracking-[-0.12em] text-transparent animate-[state-code-bob_2.4s_ease-in-out_infinite,state-gradient-shift_3.8s_linear_infinite] sm:text-[7rem]"
						style={{ animationDelay: "360ms, 0ms" }}
					>
						4
					</span>
				</div>
				<h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
					Page not found
				</h1>
				<p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-6 sm:text-base">
					The page you requested does not exist, may have moved, or the link is
					no longer active.
				</p>

				<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Button
						type="button"
						variant="outline"
						size="lg"
						className="min-w-36"
						onClick={() => router.back()}
					>
						<ArrowLeft />
						Go back
					</Button>
					<Button asChild size="lg" className="min-w-36">
						<Link href={routes.home}>
							<Home />
							Home page
						</Link>
					</Button>
				</div>

				<p className="text-muted-foreground/70 mt-8 text-xs tracking-[0.16em] uppercase">
					Error Code: 404
				</p>
			</div>
		</div>
	)
}
