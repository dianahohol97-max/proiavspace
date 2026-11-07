/**
 * Shared facts of the legal documents (every language version uses them).
 * Kept apart from copy.ts so the per-language files under ./locales can
 * import them without a circular import.
 */

/** The contracting party, as registered in Ukraine. Not translated. */
export const ENTITY = 'ФОП Гоголь Діана Іванівна'

/** Date of the current Ukrainian (legally binding) edition. */
export const UPDATED = '29.09.2026'
