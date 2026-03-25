import { z } from "zod"

import { CUSTOMER_VERIFICATION_STATUSES } from "@/features/customers/constants"

export const createCustomerFormSchema = z.object({
	fullName: z.string().trim().min(1, "Customer full name is required."),
	email: z
		.string()
		.trim()
		.email("Enter a valid email address.")
		.or(z.literal("")),
	phone: z.string().trim(),
	branchId: z.string().trim(),
	verificationStatus: z.enum(CUSTOMER_VERIFICATION_STATUSES),
	licenseNumber: z.string().trim(),
	idDocumentType: z.string().trim(),
	idDocumentNumber: z.string().trim(),
})

export type CreateCustomerFormValues = z.infer<typeof createCustomerFormSchema>
