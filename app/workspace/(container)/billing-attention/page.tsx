import type { Metadata } from "next"

import { BillingAttentionOperations } from "@/components/billing-attention/billing-attention-operations"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Billing Attention",
}

export default async function BillingAttentionPage() {
	await requireWorkspacePermission({
		permission: "manageBillingAttentionModule",
		reason: "billingAttention",
	})

	return <BillingAttentionOperations />
}
