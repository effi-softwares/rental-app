import type { Metadata } from "next"

import { OrganizationGallery } from "@/components/gallery/organization-gallery"
import { requireWorkspacePermission } from "@/lib/authorization/server"

export const metadata: Metadata = {
	title: "Gallery",
}

export default async function GalleryPage() {
	await requireWorkspacePermission({
		permission: "viewGalleryModule",
		reason: "gallery",
	})

	return <OrganizationGallery />
}
