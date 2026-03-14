"use client"

import { ImagePlus } from "lucide-react"
import {
	type ClipboardEvent,
	type DragEvent,
	useId,
	useRef,
	useState,
} from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MediaDropzoneProps = {
	onFilesSelected: (files: File[]) => void
	accept?: string
	multiple?: boolean
	disabled?: boolean
	className?: string
	label?: string
	description?: string
}

export function MediaDropzone({
	onFilesSelected,
	accept = "image/*,video/*,application/pdf",
	multiple = true,
	disabled = false,
	className,
	label = "Upload files",
	description = "Tap to pick, drag files in, or paste from clipboard.",
}: MediaDropzoneProps) {
	const inputId = useId()
	const inputRef = useRef<HTMLInputElement | null>(null)
	const [isDragging, setIsDragging] = useState(false)

	const pushFiles = (fileList: FileList | null) => {
		if (disabled || !fileList || fileList.length === 0) {
			return
		}

		onFilesSelected(Array.from(fileList))
	}

	const openFilePicker = () => {
		if (!disabled) {
			inputRef.current?.click()
		}
	}

	const onDrop = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault()
		setIsDragging(false)
		pushFiles(event.dataTransfer.files)
	}

	const onPaste = (event: ClipboardEvent<HTMLButtonElement>) => {
		if (disabled) {
			return
		}

		const files = event.clipboardData.files
		if (files.length > 0) {
			event.preventDefault()
			pushFiles(files)
		}
	}

	return (
		<button
			type="button"
			onDragOver={(event) => {
				event.preventDefault()
				if (!disabled) {
					setIsDragging(true)
				}
			}}
			onDragLeave={() => setIsDragging(false)}
			onDrop={onDrop}
			onPaste={onPaste}
			onClick={openFilePicker}
			disabled={disabled}
			className={cn(
				"border-input bg-background focus-visible:ring-ring w-full rounded-lg border-2 border-dashed p-5 text-left transition-colors outline-none focus-visible:ring-2",
				isDragging && "border-primary bg-primary/5",
				disabled && "opacity-60",
				className,
			)}
		>
			<input
				id={inputId}
				ref={inputRef}
				type="file"
				className="hidden"
				accept={accept}
				multiple={multiple}
				disabled={disabled}
				onChange={(event) => {
					pushFiles(event.target.files)
					event.currentTarget.value = ""
				}}
			/>

			<div className="flex items-start gap-3">
				<div className="bg-muted mt-0.5 rounded-md p-2">
					<ImagePlus className="text-muted-foreground size-5" />
				</div>
				<div className="space-y-1">
					<p className="text-sm font-medium">{label}</p>
					<p className="text-muted-foreground text-sm">{description}</p>
					<span
						aria-hidden="true"
						className={cn(
							buttonVariants({ variant: "secondary" }),
							"h-10 pointer-events-none",
							disabled && "opacity-50",
						)}
					>
						Choose files
					</span>
				</div>
			</div>
		</button>
	)
}
