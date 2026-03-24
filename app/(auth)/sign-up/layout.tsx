import { notFound } from "next/navigation"
import type { ReactNode } from "react"

import { isPlatformSignupEnabled } from "@/config/feature-flags"

type SignUpLayoutProps = {
	children: ReactNode
}

export default function SignUpLayout({ children }: SignUpLayoutProps) {
	if (!isPlatformSignupEnabled) {
		notFound()
	}

	return children
}
