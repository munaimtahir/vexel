/**
 * Normalizes a mobile number to the format XXXX-XXXXXXX.
 * If the input is not an 11-digit number, it returns the digits as-is.
 */
export function normalizeMobile(mobile: string | null | undefined): string | null | undefined {
    if (!mobile) return mobile;

    // Strip all non-digit characters
    const digits = mobile.replace(/\D/g, '');

    if (digits.length === 11) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }

    // If it's already in the correct format with a dash, but might have other chars
    // we check if it matches the pattern exactly after stripping extra stuff
    const match = mobile.match(/^(\d{4})-(\d{7})$/);
    if (match) return mobile;

    return digits || mobile;
}

/**
 * Checks if a string looks like a mobile number (at least 7 digits)
 */
export function isLookLikeMobile(query: string): boolean {
    const digits = query.replace(/\D/g, '');
    return digits.length >= 7;
}
