import type { Metadata } from "next"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { InvitationSetupFlow } from "@/components/invitations/invitation-setup-flow"

type InvitationSetupPageProps = {
	params: Promise<{
		invitationId: string
	}>
}

export const metadata: Metadata = {
	title: "Invitation Setup",
}

export default async function InvitationSetupPage({
	params,
}: InvitationSetupPageProps) {
	const { invitationId } = await params

	return (
		<AuthPageShell
			eyebrow="Invited account"
			title="Create invited account"
			description="Create the invited account directly from this organization invitation."
			visualVariant="invitation"
			contentWidth="md"
		>
			<InvitationSetupFlow invitationId={invitationId} />
		</AuthPageShell>
	)
}
