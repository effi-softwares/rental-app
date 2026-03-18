"use client"

import { Button } from "@/components/ui/button"
import type { RentalConditionRating } from "@/features/rentals"
import { cn } from "@/lib/utils"

const ratingOptions: Array<{
	value: RentalConditionRating
	label: string
	description: string
}> = [
	{
		value: "excellent",
		label: "Excellent",
		description: "No new wear worth calling out.",
	},
	{
		value: "good",
		label: "Good",
		description: "Minor wear, still ready for the next rental.",
	},
	{
		value: "fair",
		label: "Fair",
		description: "Visible issues that staff should review.",
	},
	{
		value: "poor",
		label: "Poor",
		description: "Serious condition concern or damage present.",
	},
]

type RentalConditionRatingSelectorProps = {
	value: RentalConditionRating | null
	onChange: (value: RentalConditionRating) => void
	className?: string
}

export function RentalConditionRatingSelector({
	value,
	onChange,
	className,
}: RentalConditionRatingSelectorProps) {
	return (
		<div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
			{ratingOptions.map((option) => {
				const active = value === option.value

				return (
					<Button
						key={option.value}
						type="button"
						variant="outline"
						className={cn(
							"h-auto min-h-24 flex-col items-start rounded-2xl px-4 py-4 text-left",
							active &&
								"border-primary bg-primary/10 text-foreground shadow-sm",
						)}
						onClick={() => {
							onChange(option.value)
						}}
					>
						<span className="text-sm font-semibold">{option.label}</span>
						<span className="text-muted-foreground mt-1 text-xs leading-5 whitespace-normal">
							{option.description}
						</span>
					</Button>
				)
			})}
		</div>
	)
}
