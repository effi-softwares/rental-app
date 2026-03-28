"use client"

import {
	WheelPicker,
	type WheelPickerClassNames,
	type WheelPickerOption,
	type WheelPickerProps,
	WheelPickerWrapper,
} from "@ncdai/react-wheel-picker"
import "@ncdai/react-wheel-picker/style.css"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type PickerValue = string | number

type AppWheelPickerProps<T extends PickerValue> = Omit<
	WheelPickerProps<T>,
	"classNames"
> & {
	className?: string
}

const appWheelPickerWrapperClassName = "w-full rounded-xl border p-3"

const appWheelPickerClassNames: WheelPickerClassNames = {
	highlightWrapper: "rounded-lg border bg-muted",
	highlightItem: "font-medium text-foreground",
	optionItem: "text-muted-foreground",
}

type AppWheelPickerWrapperProps = ComponentProps<typeof WheelPickerWrapper>

function AppWheelPickerWrapper({
	className,
	...props
}: AppWheelPickerWrapperProps) {
	return (
		<WheelPickerWrapper
			className={cn(appWheelPickerWrapperClassName, className)}
			{...props}
		/>
	)
}

type AppWheelPickerColumnProps<T extends PickerValue> = Omit<
	WheelPickerProps<T>,
	"classNames"
>

function AppWheelPickerColumn<T extends PickerValue>({
	...props
}: AppWheelPickerColumnProps<T>) {
	return <WheelPicker {...props} classNames={appWheelPickerClassNames} />
}

function AppWheelPicker<T extends PickerValue>({
	className,
	...props
}: AppWheelPickerProps<T>) {
	return (
		<AppWheelPickerWrapper className={className}>
			<AppWheelPickerColumn {...props} />
		</AppWheelPickerWrapper>
	)
}

export type { WheelPickerOption }
export { AppWheelPicker, AppWheelPickerColumn, AppWheelPickerWrapper }
