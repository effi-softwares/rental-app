"use client"

import { Toaster as Sonner } from "sonner"

function Toaster() {
	return <Sonner position="top-right" richColors closeButton duration={3500} />
}

export { Toaster }
