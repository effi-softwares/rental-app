export const invitationsQueryKeys = {
	all: ["invitations"] as const,
	detail: (invitationId: string) =>
		[...invitationsQueryKeys.all, invitationId] as const,
}
