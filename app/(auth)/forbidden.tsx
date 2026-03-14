import { Home, LogIn } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { routes } from "@/config/routes"

export default function AuthForbidden() {
	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-b from-background via-background to-muted/30 px-4 py-10">
			<div className=" text-center">
				<div className="mt-8 flex justify-center gap-1 sm:gap-2">
					<span className="inline-block bg-linear-to-r from-destructive/45 via-destructive to-destructive/45 bg-size-[200%_100%] bg-clip-text text-[5rem] leading-none font-black tracking-[-0.12em] text-transparent animate-[state-code-bob_2.4s_ease-in-out_infinite,state-gradient-shift_3.8s_linear_infinite] sm:text-[7rem]">
						4
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
						3
					</span>
				</div>
				<h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
					Authentication access restricted
				</h1>
				<p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-6 sm:text-base">
					You do not have permission to open this authentication flow right now.
				</p>

				<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Button asChild size="lg" className="min-w-40">
						<Link href={routes.auth.signIn}>
							<LogIn />
							Go to sign in
						</Link>
					</Button>
					<Button asChild variant="outline" size="lg" className="min-w-40">
						<Link href={routes.home}>
							<Home />
							Home page
						</Link>
					</Button>
				</div>

				<p className="text-muted-foreground/70 mt-8 text-xs tracking-[0.16em] uppercase">
					Error Code: 403
				</p>
			</div>
		</div>
	)
}
