/**
 * Validation utilities for ENSIP-5 standard text records
 * Based on: https://docs.ens.domains/ensip/5/
 */

// Standard ENSIP-5 Global Keys (10)
export const GLOBAL_KEYS = [
  'avatar',      // URL to an image used as an avatar or logo
  'description', // A description of the name
  'display',     // Canonical display name (should match ENS name when case-folded)
  'email',       // An e-mail address
  'keywords',    // Comma-separated keywords
  'mail',        // A physical mailing address
  'notice',      // A notice regarding this name
  'location',    // A generic location (e.g., "Toronto, Canada")
  'phone',       // A phone number as an E.164 string
  'url',         // A website URL
] as const

// Standard ENSIP-5 Service Keys (6)
export const SERVICE_KEYS = [
  'com.github',    // GitHub username
  'com.peepeth',   // Peepeth username
  'com.linkedin',  // LinkedIn username
  'com.twitter',   // Twitter/X username
  'io.keybase',    // Keybase username
  'org.telegram',  // Telegram username
] as const

// Address record (not a text record, but we verify it)
export const ADDRESS_KEY = 'addr' as const

// All standard ENS keys (17 total)
export const STANDARD_ENS_KEYS = [
  ADDRESS_KEY,
  ...GLOBAL_KEYS,
  ...SERVICE_KEYS,
] as const

export type StandardENSKey = typeof STANDARD_ENS_KEYS[number]

// Validation rules
const VALIDATION_RULES: Record<string, { pattern: RegExp; error: string }> = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    error: 'Invalid email format. Must be a valid email address.',
  },
  phone: {
    pattern: /^\+[1-9]\d{1,14}$/,
    error: 'Phone must be in E.164 format (e.g., +1234567890). Must start with + and country code.',
  },
  url: {
    pattern: /^https?:\/\/.+/i,
    error: 'URL must start with http:// or https://',
  },
  avatar: {
    pattern: /^https?:\/\/.+/i,
    error: 'Avatar URL must start with http:// or https://',
  },
  addr: {
    pattern: /^0x[a-fA-F0-9]{40}$/,
    error: 'Invalid Ethereum address format. Must be 0x followed by 40 hexadecimal characters.',
  },
  'com.twitter': {
    pattern: /^[a-zA-Z0-9_]+$/,
    error: 'Twitter username must contain only letters, numbers, and underscores (no @ symbol, no spaces).',
  },
  'org.telegram': {
    pattern: /^[a-zA-Z0-9_]+$/,
    error: 'Telegram username must contain only letters, numbers, and underscores (no @ symbol, no spaces).',
  },
  'com.github': {
    pattern: /^[a-zA-Z0-9]([a-zA-Z0-9-])*$/,
    error: 'GitHub username must start with alphanumeric character and can contain hyphens (no spaces, no @ symbol).',
  },
}

// Free text fields (no validation required)
const FREE_TEXT_FIELDS = [
  'description',
  'display',
  'keywords',
  'mail',
  'notice',
  'location',
  'com.peepeth',
  'com.linkedin',
  'io.keybase',
] as const

/**
 * Validates a record value based on its key
 * @param key - The record key (e.g., 'email', 'com.twitter')
 * @param value - The value to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateRecord(
  key: string,
  value: string
): { valid: boolean; error?: string } {
  // Empty values are always valid (optional fields)
  if (!value || value.trim() === '') {
    return { valid: true }
  }

  // Free text fields - no validation
  if (FREE_TEXT_FIELDS.includes(key as any)) {
    return { valid: true }
  }

  // Check if key has validation rule
  const rule = VALIDATION_RULES[key]
  if (!rule) {
    // No validation rule - treat as valid
    return { valid: true }
  }

  // Apply validation rule
  if (rule.pattern.test(value.trim())) {
    return { valid: true }
  } else {
    return { valid: false, error: rule.error }
  }
}

/**
 * Validates multiple records at once
 * @param records - Object with key-value pairs to validate
 * @returns Object with validation results for each record
 */
export function validateRecords(records: Record<string, string>): {
  valid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(records)) {
    const result = validateRecord(key, value)
    if (!result.valid && result.error) {
      errors[key] = result.error
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Get human-readable label for a record key
 */
export function getRecordLabel(key: string): string {
  const labels: Record<string, string> = {
    addr: 'Address',
    avatar: 'Avatar URL',
    description: 'Description',
    display: 'Display Name',
    email: 'Email',
    keywords: 'Keywords',
    mail: 'Mailing Address',
    notice: 'Notice',
    location: 'Location',
    phone: 'Phone',
    url: 'Website URL',
    'com.github': 'GitHub',
    'com.peepeth': 'Peepeth',
    'com.linkedin': 'LinkedIn',
    'com.twitter': 'Twitter/X',
    'io.keybase': 'Keybase',
    'org.telegram': 'Telegram',
  }

  return labels[key] || key
}

/**
 * Get category for a record key (for grouping in UI)
 */
export function getRecordCategory(key: string): 'profile' | 'contact' | 'social' | 'other' {
  if (key === 'avatar' || key === 'display' || key === 'keywords') {
    return 'profile'
  }
  if (key === 'email' || key === 'phone' || key === 'location') {
    return 'contact'
  }
  if (key.startsWith('com.') || key.startsWith('org.') || key.startsWith('io.')) {
    return 'social'
  }
  return 'other'
}

/**
 * Get records grouped by category
 */
export function getRecordsByCategory(): Record<
  'profile' | 'contact' | 'social' | 'other',
  string[]
> {
  const categories: Record<
    'profile' | 'contact' | 'social' | 'other',
    string[]
  > = {
    profile: [],
    contact: [],
    social: [],
    other: [],
  }

  for (const key of STANDARD_ENS_KEYS) {
    if (key === 'addr') continue // Address is not a text record
    const category = getRecordCategory(key)
    categories[category].push(key)
  }

  return categories
}

