import { z } from "zod"

import { toSlug } from "@/lib/utils"

export const organizationSettingsFormSchema = z
	.object({
		name: z.string().trim().min(1, "Organization name is required."),
		slug: z.string().trim().min(1, "Organization slug is required."),
		supportEmail: z.string(),
		supportPhone: z.string(),
		website: z.string(),
	})
	.transform((value) => ({
		name: value.name.trim(),
		slug: toSlug(value.slug),
		supportEmail: value.supportEmail.trim(),
		supportPhone: value.supportPhone.trim(),
		website: value.website.trim(),
	}))
	.superRefine((value, context) => {
		if (!value.slug) {
			context.addIssue({
				code: "custom",
				message: "Organization slug is required.",
				path: ["slug"],
			})
		}
	})

export type OrganizationSettingsFormValues = z.input<
	typeof organizationSettingsFormSchema
>
