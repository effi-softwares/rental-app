import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

import { CUSTOMER_VERIFICATION_STATUSES } from "@/features/customers/constants"
import {
	normalizeCustomerEmail,
	normalizeCustomerPhone,
} from "@/features/customers/lib/normalize"
import type { CustomerListResponse } from "@/features/customers/types"
import { jsonError } from "@/lib/api/errors"
import { requireViewer } from "@/lib/api/guards"
import { viewerHasPermission } from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { customer } from "@/lib/db/schema/customers"
import {
	buildBranchScopedPredicate,
	CUSTOMER_PAGE_SIZE,
	normalizeCustomerListRow,
	parseCustomerStatusFilter,
	parseCustomerVerificationFilter,
	parsePageParam,
	parsePageSizeParam,
	resolveAssignableBranch,
	resolveScopedBranchIds,
} from "./_lib"

function buildSearchPredicate(search: string) {
	if (!search) {
		return undefined
	}

	const pattern = `%${search}%`
	return or(
		ilike(customer.fullName, pattern),
		ilike(customer.email, pattern),
		ilike(customer.phone, pattern),
	)
}

export async function GET(request: Request) {
	const guard = await requireViewer({ permission: "viewCustomerModule" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const scopedBranchIds = await resolveScopedBranchIds(viewer)
	const canManageCustomers = await viewerHasPermission(
		viewer,
		"manageCustomers",
	)

	if (scopedBranchIds !== null && scopedBranchIds.length === 0) {
		const emptyResponse: CustomerListResponse = {
			rows: [],
			page: {
				page: 1,
				pageSize: CUSTOMER_PAGE_SIZE,
				total: 0,
				pageCount: 1,
			},
			filters: {
				page: 1,
				pageSize: CUSTOMER_PAGE_SIZE,
				search: "",
				branchId: "",
				verificationStatus: "",
				status: "all",
			},
			meta: {
				branches: [],
				canManageCustomers,
				summary: {
					total: 0,
					active: 0,
					banned: 0,
					verified: 0,
				},
			},
		}

		return NextResponse.json(emptyResponse)
	}

	const url = new URL(request.url)
	const search = url.searchParams.get("search")?.trim() ?? ""
	const page = parsePageParam(url.searchParams.get("page"), 1)
	const pageSize = parsePageSizeParam(
		url.searchParams.get("pageSize"),
		CUSTOMER_PAGE_SIZE,
	)
	const branchId = url.searchParams.get("branchId")?.trim() ?? ""
	const verificationStatus = parseCustomerVerificationFilter(
		url.searchParams.get("verificationStatus"),
	)
	const statusFilter = parseCustomerStatusFilter(url.searchParams.get("status"))

	const accessibleBranches = await db
		.select({ id: branch.id, name: branch.name, code: branch.code })
		.from(branch)
		.where(
			and(
				eq(branch.organizationId, viewer.activeOrganizationId),
				buildBranchScopedPredicate(branch.id, scopedBranchIds),
			),
		)
		.orderBy(asc(branch.name))

	const effectiveBranchId = accessibleBranches.some(
		(item) => item.id === branchId,
	)
		? branchId
		: ""

	const basePredicates = [
		eq(customer.organizationId, viewer.activeOrganizationId),
		buildBranchScopedPredicate(customer.branchId, scopedBranchIds),
		effectiveBranchId ? eq(customer.branchId, effectiveBranchId) : undefined,
		verificationStatus
			? eq(customer.verificationStatus, verificationStatus)
			: undefined,
		statusFilter !== "all" ? eq(customer.status, statusFilter) : undefined,
		buildSearchPredicate(search),
	].filter(Boolean)

	const summaryPredicates = [
		eq(customer.organizationId, viewer.activeOrganizationId),
		buildBranchScopedPredicate(customer.branchId, scopedBranchIds),
	].filter(Boolean)

	const [summaryRows, totalRows, rows] = await Promise.all([
		db
			.select({
				total: count(),
				active: sql<number>`coalesce(sum(case when ${customer.status} = 'active' then 1 else 0 end), 0)`,
				banned: sql<number>`coalesce(sum(case when ${customer.status} = 'banned' then 1 else 0 end), 0)`,
				verified: sql<number>`coalesce(sum(case when ${customer.verificationStatus} = 'verified' then 1 else 0 end), 0)`,
			})
			.from(customer)
			.where(and(...summaryPredicates)),
		db
			.select({ value: count() })
			.from(customer)
			.where(and(...basePredicates)),
		db
			.select({
				id: customer.id,
				fullName: customer.fullName,
				email: customer.email,
				phone: customer.phone,
				branchId: customer.branchId,
				branchName: branch.name,
				verificationStatus: customer.verificationStatus,
				status: customer.status,
				bannedAt: customer.bannedAt,
				createdAt: customer.createdAt,
				updatedAt: customer.updatedAt,
			})
			.from(customer)
			.leftJoin(branch, eq(customer.branchId, branch.id))
			.where(and(...basePredicates))
			.orderBy(asc(customer.fullName), asc(customer.createdAt))
			.limit(pageSize)
			.offset((page - 1) * pageSize),
	])

	const total = Number(totalRows[0]?.value ?? 0)
	const summary = summaryRows[0]

	return NextResponse.json({
		rows: rows.map(normalizeCustomerListRow),
		page: {
			page,
			pageSize,
			total,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
		},
		filters: {
			page,
			pageSize,
			search,
			branchId: effectiveBranchId,
			verificationStatus,
			status: statusFilter,
		},
		meta: {
			branches: accessibleBranches,
			canManageCustomers,
			summary: {
				total: Number(summary?.total ?? 0),
				active: Number(summary?.active ?? 0),
				banned: Number(summary?.banned ?? 0),
				verified: Number(summary?.verified ?? 0),
			},
		},
	} satisfies CustomerListResponse)
}

export async function POST(request: Request) {
	const guard = await requireViewer({ permission: "manageCustomers" })

	if (guard.response) {
		return guard.response
	}

	const viewer = guard.viewer
	const payload = (await request.json().catch(() => null)) as {
		fullName?: string
		email?: string
		phone?: string
		branchId?: string
		verificationStatus?: string
		verificationMetadata?: Record<string, unknown>
	} | null

	const fullName = payload?.fullName?.trim()
	const branchId = payload?.branchId?.trim() || null
	const verificationStatus = payload?.verificationStatus?.trim() || "pending"

	if (!fullName) {
		return jsonError("Customer full name is required.", 400)
	}

	if (
		!CUSTOMER_VERIFICATION_STATUSES.includes(
			verificationStatus as (typeof CUSTOMER_VERIFICATION_STATUSES)[number],
		)
	) {
		return jsonError("Invalid verification status.", 400)
	}

	const branchResult = await resolveAssignableBranch({
		viewer,
		branchId,
	})

	if (branchResult.error) {
		return branchResult.error
	}

	const created = await db
		.insert(customer)
		.values({
			organizationId: viewer.activeOrganizationId,
			branchId: branchResult.branch?.id ?? null,
			fullName,
			email: payload?.email?.trim() || null,
			emailNormalized: normalizeCustomerEmail(payload?.email),
			phone: payload?.phone?.trim() || null,
			phoneNormalized: normalizeCustomerPhone(payload?.phone),
			status: "active",
			bannedAt: null,
			verificationStatus,
			verificationMetadata: payload?.verificationMetadata ?? {},
		})
		.returning({ id: customer.id })

	return NextResponse.json({ id: created[0].id }, { status: 201 })
}
