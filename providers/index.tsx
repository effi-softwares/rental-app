import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryProvider } from "@/providers/query-provider"

function Providers({ children }: { children: React.ReactNode }) {
	return (
		<TooltipProvider>
			<QueryProvider>
				{children}
				<Toaster />
			</QueryProvider>
		</TooltipProvider>
	)
}

export default Providers
