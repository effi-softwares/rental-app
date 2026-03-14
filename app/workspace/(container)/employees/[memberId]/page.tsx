import type { Metadata } from "next"

import { EmployeeDetails } from "@/components/employees/employee-details"

export const metadata: Metadata = {
	title: "Employee Details",
}

type EmployeeDetailsPageProps = {
	params: Promise<{
		memberId: string
	}>
}

export default async function EmployeeDetailsPage({
	params,
}: EmployeeDetailsPageProps) {
	const { memberId } = await params

	return <EmployeeDetails memberId={memberId} />
}
