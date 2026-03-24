function readBooleanFlag(value: string | undefined) {
    if (!value) {
        return false
    }

    switch (value.trim().toLowerCase()) {
        case "1":
        case "true":
        case "yes":
        case "on":
            return true
        default:
            return false
    }
}

export const isPlatformSignupEnabled = readBooleanFlag(
    process.env.NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED,
)
