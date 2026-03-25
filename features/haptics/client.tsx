"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { useWebHaptics } from "web-haptics/react"

import { updateHapticsPreference } from "@/features/haptics/mutations/preferences"
import { mainQueryKeys } from "@/features/main/queries/keys"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import type { AuthContextResponse } from "@/features/main/types/auth-context"

type BaseHapticsValue = ReturnType<typeof useWebHaptics>

type HapticsContextValue = BaseHapticsValue & {
	isEnabled: boolean
	isSyncPending: boolean
	forceTrigger: BaseHapticsValue["trigger"]
	setEnabled: (enabled: boolean) => void
	toggleEnabled: () => void
}

const HapticsContext = createContext<HapticsContextValue | null>(null)

type HapticsProviderProps = {
	children: ReactNode
}

export function HapticsProvider({ children }: HapticsProviderProps) {
	const queryClient = useQueryClient()
	const authContextQuery = useAuthContextQuery()
	const {
		trigger: rawTrigger,
		cancel,
		isSupported,
	} = useWebHaptics({
		debug: true,
		showSwitch: false,
	})
	const persistedEnabled =
		authContextQuery.data?.user?.preferences.hapticsEnabled ?? true
	const [localEnabled, setLocalEnabled] = useState(persistedEnabled)
	const [hasLocalOverride, setHasLocalOverride] = useState(false)
	const latestEnabledRef = useRef(localEnabled)

	useEffect(() => {
		latestEnabledRef.current = localEnabled
	}, [localEnabled])

	useEffect(() => {
		if (hasLocalOverride) {
			return
		}

		setLocalEnabled(persistedEnabled)
	}, [hasLocalOverride, persistedEnabled])

	const persistEnabled = useCallback(
		async (enabledToPersist: boolean) => {
			try {
				const payload = await updateHapticsPreference(enabledToPersist)

				queryClient.setQueryData<AuthContextResponse>(
					mainQueryKeys.authContext(),
					(current) => {
						if (!current?.user) {
							return current
						}

						return {
							...current,
							user: {
								...current.user,
								preferences: {
									...current.user.preferences,
									hapticsEnabled: payload.hapticsEnabled,
								},
							},
						}
					},
				)

				void queryClient.invalidateQueries({
					queryKey: mainQueryKeys.authContext(),
				})

				if (latestEnabledRef.current === enabledToPersist) {
					setHasLocalOverride(false)
				}
			} catch {
				if (latestEnabledRef.current === enabledToPersist) {
					setHasLocalOverride(false)
					void queryClient.invalidateQueries({
						queryKey: mainQueryKeys.authContext(),
					})
				}
			}
		},
		[queryClient],
	)

	useEffect(() => {
		if (!hasLocalOverride) {
			return
		}

		const timeoutId = window.setTimeout(() => {
			void persistEnabled(latestEnabledRef.current)
		}, 5_000)

		return () => {
			window.clearTimeout(timeoutId)
		}
	}, [hasLocalOverride, persistEnabled])

	const trigger = useCallback<BaseHapticsValue["trigger"]>(
		(input, options) => {
			if (!localEnabled) {
				return undefined
			}

			return rawTrigger(input, options)
		},
		[localEnabled, rawTrigger],
	)
	const forceTrigger = useCallback<BaseHapticsValue["trigger"]>(
		(input, options) => rawTrigger(input, options),
		[rawTrigger],
	)
	const setEnabled = useCallback(
		(enabled: boolean) => {
			if (latestEnabledRef.current === enabled) {
				return
			}

			setLocalEnabled(enabled)
			setHasLocalOverride(true)

			if (enabled) {
				void rawTrigger("medium")
			}
		},
		[rawTrigger],
	)
	const toggleEnabled = useCallback(() => {
		setEnabled(!latestEnabledRef.current)
	}, [setEnabled])

	const value = useMemo(
		() => ({
			trigger,
			forceTrigger,
			cancel,
			isSupported,
			isEnabled: localEnabled,
			isSyncPending: hasLocalOverride,
			setEnabled,
			toggleEnabled,
		}),
		[
			cancel,
			forceTrigger,
			hasLocalOverride,
			isSupported,
			localEnabled,
			setEnabled,
			toggleEnabled,
			trigger,
		],
	)

	return (
		<HapticsContext.Provider value={value}>{children}</HapticsContext.Provider>
	)
}

export function useHaptics() {
	const context = useContext(HapticsContext)

	if (!context) {
		throw new Error("useHaptics must be used within a HapticsProvider.")
	}

	return context
}
