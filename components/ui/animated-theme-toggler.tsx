"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import type * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ViewTransition = {
	ready?: Promise<void>
}

type DocumentWithViewTransition = Document & {
	startViewTransition?: (update: () => void) => ViewTransition
}

interface AnimatedThemeTogglerProps
	extends React.ComponentPropsWithoutRef<"button"> {
	duration?: number
	variant?:
		| "default"
		| "outline"
		| "secondary"
		| "ghost"
		| "destructive"
		| "link"
	size?:
		| "default"
		| "xs"
		| "sm"
		| "lg"
		| "icon"
		| "icon-xs"
		| "icon-sm"
		| "icon-lg"
}

export function AnimatedThemeToggler({
	className,
	duration = 400,
	variant = "outline",
	size = "icon-sm",
	...props
}: AnimatedThemeTogglerProps) {
	const { resolvedTheme, setTheme } = useTheme()
	const buttonRef = useRef<HTMLButtonElement>(null)
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	const toggleTheme = useCallback(() => {
		const button = buttonRef.current
		if (!button) {
			return
		}

		const isDark = resolvedTheme === "dark"
		const nextTheme = isDark ? "light" : "dark"
		const documentWithViewTransition = document as DocumentWithViewTransition

		const { top, left, width, height } = button.getBoundingClientRect()
		const x = left + width / 2
		const y = top + height / 2
		const viewportWidth = window.visualViewport?.width ?? window.innerWidth
		const viewportHeight = window.visualViewport?.height ?? window.innerHeight
		const maxRadius = Math.hypot(
			Math.max(x, viewportWidth - x),
			Math.max(y, viewportHeight - y),
		)

		const applyTheme = () => {
			document.documentElement.classList.remove("light", "dark")
			document.documentElement.classList.add(nextTheme)
			document.documentElement.style.colorScheme = nextTheme
			setTheme(nextTheme)
		}

		if (typeof documentWithViewTransition.startViewTransition !== "function") {
			applyTheme()
			return
		}

		const transition = documentWithViewTransition.startViewTransition(() => {
			flushSync(applyTheme)
		})

		transition.ready?.then(() => {
			document.documentElement.animate(
				{
					clipPath: [
						`circle(0px at ${x}px ${y}px)`,
						`circle(${maxRadius}px at ${x}px ${y}px)`,
					],
				},
				{
					duration,
					easing: "ease-in-out",
					pseudoElement: "::view-transition-new(root)",
				},
			)
		})
	}, [duration, resolvedTheme, setTheme])

	const isDark = mounted && resolvedTheme === "dark"
	const label = isDark ? "Switch to light theme" : "Switch to dark theme"

	return (
		<button
			type="button"
			ref={buttonRef}
			onClick={toggleTheme}
			className={cn(
				buttonVariants({ variant, size }),
				"relative overflow-hidden border-sidebar-border/70 bg-sidebar hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:bg-sidebar-accent/60",
				className,
			)}
			aria-label={label}
			title={label}
			disabled={!mounted}
			{...props}
		>
			<Sun
				className={cn(
					"size-4 transition-all duration-300",
					isDark ? "rotate-0 scale-100" : "-rotate-90 scale-0",
				)}
			/>
			<Moon
				className={cn(
					"absolute size-4 transition-all duration-300",
					isDark ? "rotate-90 scale-0" : "rotate-0 scale-100",
				)}
			/>
			<span className="sr-only">{label}</span>
		</button>
	)
}
