export type MainOrganization = {
	id: string
	name: string
	slug: string
	logo?: string | null
	isVisible: boolean
	metadata?: {
		logoBlurDataUrl?: string | null
		supportEmail?: string | null
		supportPhone?: string | null
		website?: string | null
	} | null
}
