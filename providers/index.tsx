import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryProvider } from "@/providers/query-provider"

function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider
		attribute="class"
		defaultTheme="system"
		enableSystem
		disableTransitionOnChange >
			<TooltipProvider>
				<QueryProvider>
					{children}
					<Toaster />
				</QueryProvider>
			</TooltipProvider>
		</ThemeProvider>
	)
}

export default Providers
