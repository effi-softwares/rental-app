import type { Metadata } from "next"

import { EmployeeInvitations } from "@/components/employees/employee-invitations"

export const metadata: Metadata = {
	title: "Employee Invitations",
}

export default async function EmployeeInvitationsPage() {
	return <EmployeeInvitations />
}
