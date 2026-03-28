"use client"

import { CalendarClock, ChevronDown } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group"
import {
	AppWheelPicker,
	AppWheelPickerColumn,
	AppWheelPickerWrapper,
	type WheelPickerOption,
} from "@/components/ui/wheel-picker"
import type { VehicleColor } from "@/features/vehicles"
import { useIsMobile } from "@/hooks/use-mobile"

export type DrawerOption = {
	value: string
	label: string
}

type ResponsivePickerShellProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	children: ReactNode
}

function ResponsivePickerShell({
	open,
	onOpenChange,
	title,
	children,
}: ResponsivePickerShellProps) {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={onOpenChange}>
				<DrawerContent className="max-h-[88vh]">
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
						<DrawerDescription>Choose one option.</DrawerDescription>
					</DrawerHeader>
					{children}
				</DrawerContent>
			</Drawer>
		)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl p-0">
				<DialogHeader className="border-b px-5 py-4">
					<DialogTitle className="text-3xl font-semibold tracking-tight">
						{title}
					</DialogTitle>
				</DialogHeader>
				{children}
			</DialogContent>
		</Dialog>
	)
}

type DrawerSelectInputProps = {
	value?: string
	placeholder: string
	drawerTitle: string
	options: DrawerOption[]
	onValueChange: (value: string) => void
	disabled?: boolean
}

export function DrawerSelectInput({
	value,
	placeholder,
	drawerTitle,
	options,
	onValueChange,
	disabled = false,
}: DrawerSelectInputProps) {
	const wheelOptions = options as WheelPickerOption<string>[]
	const hasOptions = options.length > 0
	const selectedOrFirstValue = useMemo(() => {
		if (!hasOptions) {
			return ""
		}

		if (value && options.some((option) => option.value === value)) {
			return value
		}

		return options[0]?.value ?? ""
	}, [value, options, hasOptions])
	const [isOpen, setIsOpen] = useState(false)
	const selectedOption = options.find((option) => option.value === value)
	const [pendingValue, setPendingValue] = useState(selectedOrFirstValue)
	const validPendingValue = useMemo(() => {
		if (!hasOptions) {
			return ""
		}

		if (options.some((option) => option.value === pendingValue)) {
			return pendingValue
		}

		return options[0]?.value ?? ""
	}, [pendingValue, options, hasOptions])

	useEffect(() => {
		if (!isOpen) {
			setPendingValue(selectedOrFirstValue)
		}
	}, [isOpen, selectedOrFirstValue])

	return (
		<>
			<InputGroup className="h-12" disabled={disabled || !hasOptions}>
				<InputGroupInput
					readOnly
					value={selectedOption?.label ?? ""}
					placeholder={placeholder}
					onClick={() => {
						if (!disabled && hasOptions) {
							setIsOpen(true)
						}
					}}
					className="h-full cursor-pointer"
					disabled={disabled || !hasOptions}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						size="icon-sm"
						onClick={() => setIsOpen(true)}
						disabled={disabled || !hasOptions}
					>
						<ChevronDown />
						<span className="sr-only">Open selector</span>
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>

			<ResponsivePickerShell
				open={isOpen}
				onOpenChange={setIsOpen}
				title={drawerTitle}
			>
				<div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
					{hasOptions ? (
						<AppWheelPicker
							value={validPendingValue}
							onValueChange={(nextValue) => setPendingValue(nextValue)}
							options={wheelOptions}
							visibleCount={18}
							optionItemHeight={44}
						/>
					) : (
						<p className="text-sm text-muted-foreground">
							No options available.
						</p>
					)}
					<Button
						type="button"
						className="h-12 w-full"
						disabled={!hasOptions}
						onClick={() => {
							onValueChange(validPendingValue)
							setIsOpen(false)
						}}
					>
						Confirm
					</Button>
				</div>
			</ResponsivePickerShell>
		</>
	)
}

type ColorDrawerInputProps = {
	value: VehicleColor
	colors: VehicleColor[]
	placeholder: string
	onValueChange: (value: VehicleColor) => void
}

export function ColorDrawerInput({
	value,
	colors,
	placeholder,
	onValueChange,
}: ColorDrawerInputProps) {
	const [isOpen, setIsOpen] = useState(false)
	const isLightColor = (hex: string) => {
		const normalized = hex.replace("#", "")
		const expanded =
			normalized.length === 3
				? normalized
						.split("")
						.map((char) => `${char}${char}`)
						.join("")
				: normalized
		const red = Number.parseInt(expanded.slice(0, 2), 16)
		const green = Number.parseInt(expanded.slice(2, 4), 16)
		const blue = Number.parseInt(expanded.slice(4, 6), 16)
		const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
		return luminance > 0.7
	}

	return (
		<>
			<InputGroup className="h-12">
				<InputGroupInput
					readOnly
					value={value.label}
					placeholder={placeholder}
					onClick={() => setIsOpen(true)}
					className="h-full cursor-pointer"
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton size="icon-sm" onClick={() => setIsOpen(true)}>
						<ChevronDown />
						<span className="sr-only">Open color selector</span>
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>

			<ResponsivePickerShell
				open={isOpen}
				onOpenChange={setIsOpen}
				title="Select color"
			>
				<div className="px-4 pb-4 sm:px-5 sm:pb-5">
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{colors.map((color) => {
							const selected = color.name === value.name
							const lightColor = isLightColor(color.hex)
							return (
								<button
									key={color.name}
									type="button"
									onClick={() => {
										onValueChange(color)
										setIsOpen(false)
									}}
									className="h-20 rounded-2xl border text-base font-medium"
									style={{
										backgroundColor: color.hex,
										color: lightColor ? "#111827" : "#ffffff",
										boxShadow: selected ? "inset 0 0 0 2px #111827" : undefined,
									}}
								>
									{color.label}
								</button>
							)
						})}
					</div>
				</div>
			</ResponsivePickerShell>
		</>
	)
}

type DrawerDateInputProps = {
	value?: string
	placeholder: string
	drawerTitle: string
	drawerDescription?: string
	onValueChange: (value: string) => void
	disabled?: boolean
}

function padNumber(value: number) {
	return value.toString().padStart(2, "0")
}

function parseDateValue(value?: string) {
	if (!value) {
		return null
	}

	const [year, month, day] = value.split("-").map(Number)
	if (!year || !month || !day) {
		return null
	}

	const parsed = new Date(year, month - 1, day, 12, 0, 0, 0)
	if (Number.isNaN(parsed.getTime())) {
		return null
	}

	return toDateValue(parsed) === value ? parsed : null
}

function toDateValue(date: Date) {
	return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
		date.getDate(),
	)}`
}

function getDaysInMonth(year: number, month: number) {
	return new Date(year, month, 0).getDate()
}

function buildYearOptions(referenceYear: number) {
	return Array.from({ length: 21 }, (_, index) => {
		const value = referenceYear - 10 + index

		return {
			value,
			label: String(value),
		}
	}) satisfies WheelPickerOption<number>[]
}

function buildMonthOptions() {
	return Array.from({ length: 12 }, (_, index) => {
		const value = index + 1

		return {
			value,
			label: new Date(2024, index, 1).toLocaleDateString("en-AU", {
				month: "short",
			}),
		}
	}) satisfies WheelPickerOption<number>[]
}

function buildDayOptions(year: number, month: number) {
	return Array.from({ length: getDaysInMonth(year, month) }, (_, index) => {
		const value = index + 1

		return {
			value,
			label: String(value),
		}
	}) satisfies WheelPickerOption<number>[]
}

function toDateValueFromParts(year: number, month: number, day: number) {
	return `${year}-${padNumber(month)}-${padNumber(day)}`
}

function formatDateDisplayValue(value?: string) {
	const parsed = parseDateValue(value)
	if (!parsed) {
		return ""
	}

	return parsed.toLocaleDateString("en-AU", {
		dateStyle: "medium",
	})
}

export function DrawerDateInput({
	value,
	placeholder,
	drawerTitle,
	drawerDescription = "Choose a date using the wheel selector.",
	onValueChange,
	disabled = false,
}: DrawerDateInputProps) {
	const [isOpen, setIsOpen] = useState(false)
	const anchorDate = useMemo(() => parseDateValue(value) ?? new Date(), [value])
	const currentYear = useMemo(() => new Date().getFullYear(), [])
	const yearOptions = useMemo(
		() => buildYearOptions(currentYear),
		[currentYear],
	)
	const monthOptions = useMemo(() => buildMonthOptions(), [])
	const resolvedYear =
		yearOptions.find((option) => option.value === anchorDate.getFullYear())
			?.value ??
		yearOptions[10]?.value ??
		anchorDate.getFullYear()
	const resolvedMonth =
		monthOptions.find((option) => option.value === anchorDate.getMonth() + 1)
			?.value ?? 1
	const resolvedDay = Math.min(
		anchorDate.getDate(),
		getDaysInMonth(resolvedYear, resolvedMonth),
	)
	const [pendingYear, setPendingYear] = useState(resolvedYear)
	const [pendingMonth, setPendingMonth] = useState(resolvedMonth)
	const [pendingDay, setPendingDay] = useState(resolvedDay)
	const dayOptions = useMemo(
		() => buildDayOptions(pendingYear, pendingMonth),
		[pendingYear, pendingMonth],
	)
	const safePendingDay = Math.min(
		pendingDay,
		dayOptions[dayOptions.length - 1]?.value ?? 1,
	)

	useEffect(() => {
		if (!isOpen) {
			setPendingYear(resolvedYear)
			setPendingMonth(resolvedMonth)
			setPendingDay(resolvedDay)
		}
	}, [isOpen, resolvedDay, resolvedMonth, resolvedYear])

	useEffect(() => {
		if (pendingDay !== safePendingDay) {
			setPendingDay(safePendingDay)
		}
	}, [pendingDay, safePendingDay])

	return (
		<>
			<InputGroup className="h-12" disabled={disabled}>
				<InputGroupAddon align="inline-start">
					<InputGroupButton
						size="icon-sm"
						onClick={() => {
							if (!disabled) {
								setIsOpen(true)
							}
						}}
						disabled={disabled}
					>
						<CalendarClock className="size-4" />
						<span className="sr-only">Open date selector</span>
					</InputGroupButton>
				</InputGroupAddon>
				<InputGroupInput
					readOnly
					value={formatDateDisplayValue(value)}
					placeholder={placeholder}
					onClick={() => {
						if (!disabled) {
							setIsOpen(true)
						}
					}}
					className="h-full cursor-pointer"
					disabled={disabled}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						size="icon-sm"
						onClick={() => {
							if (!disabled) {
								setIsOpen(true)
							}
						}}
						disabled={disabled}
					>
						<ChevronDown className="size-4" />
						<span className="sr-only">Open date selector</span>
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>

			<ResponsivePickerShell
				open={isOpen}
				onOpenChange={setIsOpen}
				title={drawerTitle}
			>
				<div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
					<p className="text-sm text-muted-foreground">{drawerDescription}</p>
					<AppWheelPickerWrapper className="rounded-3xl p-4">
						<AppWheelPickerColumn
							value={pendingYear}
							onValueChange={setPendingYear}
							options={yearOptions}
							visibleCount={18}
							optionItemHeight={44}
						/>
						<AppWheelPickerColumn
							value={pendingMonth}
							onValueChange={setPendingMonth}
							options={monthOptions}
							visibleCount={18}
							optionItemHeight={44}
						/>
						<AppWheelPickerColumn
							value={safePendingDay}
							onValueChange={setPendingDay}
							options={dayOptions}
							visibleCount={18}
							optionItemHeight={44}
						/>
					</AppWheelPickerWrapper>
					<Button
						type="button"
						className="h-12 w-full"
						onClick={() => {
							onValueChange(
								toDateValueFromParts(pendingYear, pendingMonth, safePendingDay),
							)
							setIsOpen(false)
						}}
					>
						Confirm date
					</Button>
				</div>
			</ResponsivePickerShell>
		</>
	)
}
