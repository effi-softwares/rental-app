import { z } from "zod"

import type { Permission } from "@/lib/authorization/policies"

export type EmployeeInviteFormValues = {
	email: string
	role: string
}

export const defaultEmployeeInviteFormValues: EmployeeInviteFormValues = {
	email: "",
	role: "member",
}

export const employeeInviteFormSchema = z.object({
	email: z
		.string()
		.trim()
		.min(1, "Employee email is required.")
		.email("Enter a valid employee email."),
	role: z.string().trim().min(1, "Role is required."),
})

export type EmployeeRoleCreateFormValues = {
	roleName: string
	selectedPolicies: Permission[]
}

const defaultRolePolicies: Permission[] = ["viewDashboardModule"]

const employeeRolePoliciesSchema = z.object({
	roleName: z.string().trim().min(1, "Role name is required."),
	selectedPolicies: z
		.array(z.string().trim().min(1))
		.min(1, "Select at least one policy."),
})

export const defaultEmployeeRoleCreateFormValues: EmployeeRoleCreateFormValues =
	{
		roleName: "",
		selectedPolicies: [...defaultRolePolicies],
	}

export const employeeRoleCreateFormSchema = employeeRolePoliciesSchema

export type EmployeeRoleEditFormValues = {
	roleName: string
	selectedPolicies: Permission[]
}

export const defaultEmployeeRoleEditFormValues: EmployeeRoleEditFormValues = {
	roleName: "",
	selectedPolicies: [...defaultRolePolicies],
}

export const employeeRoleEditFormSchema = employeeRolePoliciesSchema
