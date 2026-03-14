"use client"

import {
	WheelPicker,
	type WheelPickerOption,
	type WheelPickerProps,
	WheelPickerWrapper,
} from "@ncdai/react-wheel-picker"
import "@ncdai/react-wheel-picker/style.css"

import { cn } from "@/lib/utils"

type PickerValue = string | number

type AppWheelPickerProps<T extends PickerValue> = Omit<
	WheelPickerProps<T>,
	"classNames"
> & {
	className?: string
}

function AppWheelPicker<T extends PickerValue>({
	className,
	...props
}: AppWheelPickerProps<T>) {
	return (
		<WheelPickerWrapper
			className={cn("w-full rounded-xl border p-3", className)}
		>
			<WheelPicker
				{...props}
				classNames={{
					highlightWrapper: "rounded-lg border bg-muted",
					highlightItem: "font-medium text-foreground",
					optionItem: "text-muted-foreground",
				}}
			/>
		</WheelPickerWrapper>
	)
}

export type { WheelPickerOption }
export { AppWheelPicker }
