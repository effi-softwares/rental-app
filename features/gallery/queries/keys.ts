export const galleryQueryKeys = {
	all: ["organization-gallery"] as const,
	list: (organizationId: string) =>
		["organization-gallery", organizationId] as const,
}
