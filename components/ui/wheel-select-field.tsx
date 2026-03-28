"use client"

import { ChevronDown } from "lucide-react"
import { useEffect, useState } from "react"

import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group"
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer"
import {
	AppWheelPicker,
	type WheelPickerOption,
} from "@/components/ui/wheel-picker"

export type WheelSelectOption = {
	value: string
	label: string
}

type WheelSelectFieldProps = {
	value: string
	options: WheelSelectOption[]
	placeholder: string
	title: string
	description?: string
	onValueChange: (value: string) => void
	triggerClassName?: string
	visibleCount?: number
	optionItemHeight?: number
	applyLabel?: string
}

export function WheelSelectField({
	value,
	options,
	placeholder,
	title,
	description,
	onValueChange,
	triggerClassName,
	visibleCount = 14,
	optionItemHeight = 42,
	applyLabel = "Apply",
}: WheelSelectFieldProps) {
	const [open, setOpen] = useState(false)
	const wheelOptions = options as WheelPickerOption<string>[]
	const safeValue =
		options.find((option) => option.value === value)?.value ??
		options[0]?.value ??
		""
	const selectedOption =
		options.find((option) => option.value === safeValue) ?? options[0] ?? null
	const [pendingValue, setPendingValue] = useState(safeValue)

	useEffect(() => {
		if (!open) {
			setPendingValue(safeValue)
		}
	}, [open, safeValue])

	return (
		<>
			<InputGroup className={triggerClassName ?? "h-11"}>
				<InputGroupInput
					readOnly
					value={selectedOption?.label ?? ""}
					placeholder={placeholder}
					onClick={() => setOpen(true)}
					className="h-full cursor-pointer"
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton size="icon-sm" onClick={() => setOpen(true)}>
						<ChevronDown className="size-4" />
						<span className="sr-only">Open selector</span>
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>

			<ResponsiveDrawer
				open={open}
				onOpenChange={setOpen}
				title={title}
				description={description}
				desktopClassName="max-h-[88vh] overflow-hidden sm:max-w-sm"
				mobileClassName="max-h-[88vh] rounded-t-3xl p-0"
			>
				<div className="space-y-4 pt-1">
					<AppWheelPicker
						value={pendingValue}
						onValueChange={setPendingValue}
						options={wheelOptions}
						visibleCount={visibleCount}
						optionItemHeight={optionItemHeight}
						className="rounded-3xl p-4"
					/>
					<button
						type="button"
						className="bg-primary text-primary-foreground h-12 w-full rounded-2xl px-4 text-sm font-medium"
						onClick={() => {
							onValueChange(pendingValue)
							setOpen(false)
						}}
					>
						{applyLabel}
					</button>
				</div>
			</ResponsiveDrawer>
		</>
	)
}
