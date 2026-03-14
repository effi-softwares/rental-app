import type { Metadata } from "next"

import { EmployeeManagement } from "@/components/employees/employee-management"

export const metadata: Metadata = {
	title: "Employee Management",
}

export default async function EmployeesPage() {
	return <EmployeeManagement />
}
