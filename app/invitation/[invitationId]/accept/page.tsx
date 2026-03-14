import type { Metadata } from "next"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { InvitationAcceptFlow } from "@/components/invitations/invitation-accept-flow"

type InvitationAcceptPageProps = {
	params: Promise<{
		invitationId: string
	}>
}

export const metadata: Metadata = {
	title: "Invitation",
}

export default async function InvitationAcceptPage({
	params,
}: InvitationAcceptPageProps) {
	const { invitationId } = await params

	return (
		<AuthPageShell
			eyebrow="Team invitation"
			title="Organization invitation"
			description="Review the invitation, sign in with the invited account, or continue to account setup."
			visualVariant="invitation"
			contentWidth="md"
		>
			<InvitationAcceptFlow invitationId={invitationId} />
		</AuthPageShell>
	)
}
