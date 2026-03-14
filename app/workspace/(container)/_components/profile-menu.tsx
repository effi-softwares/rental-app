"use client"

import { LogOut, Settings, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { routes } from "@/config/routes"
import { useSignOutMutation } from "@/features/main/mutations/use-sign-out-mutation"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"

function getInitials(name?: string | null) {
	if (!name?.trim()) {
		return "U"
	}

	const nameParts = name.trim().split(/\s+/)
	const initials = nameParts
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("")

	return initials || "U"
}

export function ProfileMenu() {
	const router = useRouter()
	const authContextQuery = useAuthContextQuery()
	const signOutMutation = useSignOutMutation()

	const userName = authContextQuery.data?.user?.name
	const userEmail = authContextQuery.data?.user?.email

	async function onSignOut() {
		await signOutMutation.mutateAsync()
		router.replace(routes.auth.signIn)
		router.refresh()
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					aria-label="Open profile menu"
					className="rounded-full p-0"
				>
					<Avatar>
						<AvatarFallback>{getInitials(userName)}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel>
					<p className="truncate text-sm font-medium">{userName ?? "User"}</p>
					<p className="text-muted-foreground truncate text-xs">{userEmail}</p>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href={routes.app.profile}>
						<UserRound className="size-4" />
						Profile
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href={routes.app.settings}>
						<Settings className="size-4" />
						Settings
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					onSelect={(event) => {
						event.preventDefault()
						void onSignOut()
					}}
					disabled={signOutMutation.isPending}
				>
					<LogOut className="size-4" />
					{signOutMutation.isPending ? "Signing out..." : "Sign out"}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
