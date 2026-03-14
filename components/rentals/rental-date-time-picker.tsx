"use client"

import { CalendarClock, ChevronDown, Clock3 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group"
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
import {
	AppWheelPicker,
	type WheelPickerOption,
} from "@/components/ui/wheel-picker"

type RentalDateTimePickerProps = {
	title: string
	description?: string
	value: string
	placeholder: string
	onValueChange: (value: string) => void
}

function padNumber(value: number) {
	return value.toString().padStart(2, "0")
}

function parseLocalDatetime(value: string) {
	if (!value) {
		return null
	}

	const [datePart, timePart = "00:00"] = value.split("T")
	const [year, month, day] = datePart.split("-").map(Number)
	const [hours, minutes] = timePart.split(":").map(Number)

	if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) {
		return null
	}

	const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toDateValue(date: Date) {
	return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
		date.getDate(),
	)}`
}

function toTimeValue(date: Date) {
	return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`
}

function toLocalDatetimeValue(dateValue: string, timeValue: string) {
	return `${dateValue}T${timeValue}`
}

function roundToQuarterHour(date: Date) {
	const rounded = new Date(date)
	rounded.setSeconds(0, 0)

	const minutes = rounded.getMinutes()
	const nextQuarter = Math.ceil(minutes / 15) * 15

	if (nextQuarter === 60) {
		rounded.setHours(rounded.getHours() + 1, 0, 0, 0)
		return rounded
	}

	rounded.setMinutes(nextQuarter, 0, 0)
	return rounded
}

function buildDateOptions(anchor: Date) {
	const start = new Date(anchor)
	start.setDate(start.getDate() - 30)
	start.setHours(0, 0, 0, 0)

	return Array.from({ length: 396 }, (_, index) => {
		const current = new Date(start)
		current.setDate(start.getDate() + index)

		return {
			value: toDateValue(current),
			label: current.toLocaleDateString("en-AU", {
				weekday: "short",
				day: "numeric",
				month: "short",
			}),
		}
	}) satisfies WheelPickerOption<string>[]
}

function buildTimeOptions() {
	return Array.from({ length: 24 * 4 }, (_, index) => {
		const hours = Math.floor(index / 4)
		const minutes = (index % 4) * 15
		const value = `${padNumber(hours)}:${padNumber(minutes)}`

		return {
			value,
			label: new Date(2024, 0, 1, hours, minutes).toLocaleTimeString("en-AU", {
				hour: "numeric",
				minute: "2-digit",
			}),
		}
	}) satisfies WheelPickerOption<string>[]
}

function formatDisplayValue(value: string) {
	const parsed = parseLocalDatetime(value)
	if (!parsed) {
		return ""
	}

	return parsed.toLocaleString("en-AU", {
		dateStyle: "medium",
		timeStyle: "short",
	})
}

export function RentalDateTimePicker({
	title,
	description,
	value,
	placeholder,
	onValueChange,
}: RentalDateTimePickerProps) {
	const [open, setOpen] = useState(false)

	const resolvedDate = useMemo(() => {
		return parseLocalDatetime(value) ?? roundToQuarterHour(new Date())
	}, [value])

	const dateOptions = useMemo(
		() => buildDateOptions(resolvedDate),
		[resolvedDate],
	)
	const timeOptions = useMemo(() => buildTimeOptions(), [])
	const fallbackDateValue =
		dateOptions[30]?.value ?? dateOptions[0]?.value ?? ""
	const fallbackTimeValue =
		timeOptions.find((option) => option.value === toTimeValue(resolvedDate))
			?.value ??
		timeOptions[0]?.value ??
		"00:00"

	const [pendingDateValue, setPendingDateValue] = useState(
		toDateValue(resolvedDate),
	)
	const [pendingTimeValue, setPendingTimeValue] = useState(fallbackTimeValue)

	useEffect(() => {
		if (!open) {
			setPendingDateValue(toDateValue(resolvedDate))
			setPendingTimeValue(fallbackTimeValue)
		}
	}, [fallbackTimeValue, open, resolvedDate])

	const safeDateValue = dateOptions.some(
		(option) => option.value === pendingDateValue,
	)
		? pendingDateValue
		: (dateOptions.find((option) => option.value === toDateValue(resolvedDate))
				?.value ?? fallbackDateValue)

	const safeTimeValue = timeOptions.some(
		(option) => option.value === pendingTimeValue,
	)
		? pendingTimeValue
		: fallbackTimeValue

	return (
		<>
			<InputGroup className="h-12">
				<InputGroupAddon align="inline-start">
					<InputGroupText>
						<CalendarClock className="size-4" />
					</InputGroupText>
				</InputGroupAddon>
				<InputGroupInput
					readOnly
					value={formatDisplayValue(value)}
					placeholder={placeholder}
					onClick={() => {
						setOpen(true)
					}}
					className="h-full cursor-pointer"
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						size="icon-sm"
						onClick={() => {
							setOpen(true)
						}}
					>
						<ChevronDown className="size-4" />
						<span className="sr-only">Open date and time selector</span>
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>

			<ResponsiveDrawer
				open={open}
				onOpenChange={setOpen}
				title={title}
				description={description}
				desktopClassName="max-h-[90vh] overflow-hidden p-0 sm:max-w-4xl"
				mobileClassName="max-h-[92vh] rounded-t-3xl p-0"
			>
				<div className="space-y-5 px-4 pb-5 md:px-6">
					<div className="rounded-2xl border bg-muted/30 p-4">
						<p className="text-sm font-medium">
							{formatDisplayValue(
								toLocalDatetimeValue(safeDateValue, safeTimeValue),
							)}
						</p>
						<p className="text-muted-foreground mt-1 text-sm">
							Use the wheel selectors to choose the rental date and time.
						</p>
					</div>

					<div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
						<div className="space-y-3">
							<p className="text-sm font-medium">Date</p>
							<AppWheelPicker
								value={safeDateValue}
								onValueChange={setPendingDateValue}
								options={dateOptions}
								visibleCount={16}
								optionItemHeight={40}
								className="rounded-3xl p-4"
							/>
						</div>
						<div className="space-y-3">
							<p className="flex items-center gap-2 text-sm font-medium">
								<Clock3 className="size-4" />
								Time
							</p>
							<AppWheelPicker
								value={safeTimeValue}
								onValueChange={setPendingTimeValue}
								options={timeOptions}
								visibleCount={16}
								optionItemHeight={40}
								className="rounded-3xl p-4"
							/>
						</div>
					</div>

					<button
						type="button"
						onClick={() => {
							onValueChange(toLocalDatetimeValue(safeDateValue, safeTimeValue))
							setOpen(false)
						}}
						className="bg-primary text-primary-foreground h-12 w-full rounded-2xl px-4 text-sm font-medium"
					>
						Confirm date and time
					</button>
				</div>
			</ResponsiveDrawer>
		</>
	)
}
