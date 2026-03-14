import type { Metadata } from "next"

import { PaymentsLedger } from "@/components/payments/payments-ledger"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Payments",
}

export default async function PaymentsPage() {
	await requireWorkspacePermission({
		permission: "managePaymentsModule",
		reason: "payments",
	})

	return <PaymentsLedger />
}
