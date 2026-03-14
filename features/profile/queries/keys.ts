export const profileQueryKeys = {
	all: ["profile"] as const,
	passkeys: () => [...profileQueryKeys.all, "passkeys"] as const,
}
