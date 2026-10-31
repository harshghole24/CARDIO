/**
 * Utility functions for securely masking and validating user identifiers (email, phone).
 * Strictly prevents storing or exposing full sensitive contact details or credentials.
 */

export type IdentifierType = 'EMAIL' | 'PHONE' | 'OTHER';

/**
 * Masks an email address: e.g. "alex.smith@example.com" -> "a***h@example.com"
 */
export function maskEmail(email: string): string {
  if (!email) return '';
  const trimmed = email.trim();
  if (trimmed.includes('***')) return trimmed; // Already masked

  const parts = trimmed.split('@');
  if (parts.length !== 2) return trimmed;

  const [local, domain] = parts;
  if (!local || !domain) return trimmed;

  if (local.length === 1) {
    return `${local}***@${domain}`;
  } else if (local.length === 2) {
    return `${local[0]}*@${domain}`;
  } else {
    const firstChar = local[0];
    const lastChar = local[local.length - 1];
    return `${firstChar}***${lastChar}@${domain}`;
  }
}

/**
 * Masks a phone number: e.g. "+91 9876543210" -> "+91 98*** **210" or "9876543210" -> "98*** **210"
 */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.includes('***')) return trimmed; // Already masked

  const cleanDigits = trimmed.replace(/\D/g, '');
  if (cleanDigits.length < 7) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }

  const prefix = trimmed.startsWith('+91') || trimmed.startsWith('+') ? trimmed.split(' ')[0] + ' ' : '';
  const localDigits = cleanDigits.slice(-10);
  const start = localDigits.slice(0, 2);
  const end = localDigits.slice(-3);

  return `${prefix}${start}*** **${end}`;
}

/**
 * Masks an identifier according to its designated type.
 */
export function maskIdentifier(raw: string, type: IdentifierType): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.includes('***')) return trimmed;

  if (type === 'EMAIL') {
    return maskEmail(trimmed);
  } else if (type === 'PHONE') {
    return maskPhone(trimmed);
  } else {
    // For OTHER/CUSTOM: sanitize label without exposing passwords/secrets
    if (trimmed.length > 20) {
      return `${trimmed.slice(0, 4)}***${trimmed.slice(-3)}`;
    }
    return trimmed;
  }
}

/**
 * Validates that an identifier matches the expected format for its type.
 */
export function validateIdentifier(identifier: string, type: IdentifierType): { valid: boolean; error?: string } {
  if (!identifier || !identifier.trim()) {
    return { valid: false, error: 'Identifier cannot be empty' };
  }
  const val = identifier.trim();

  // If already masked, check basic sanity
  if (val.includes('***')) {
    return { valid: true };
  }

  if (type === 'EMAIL') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }
  } else if (type === 'PHONE') {
    const phoneDigits = val.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return { valid: false, error: 'Please enter a valid phone number (7-15 digits)' };
    }
  }

  return { valid: true };
}
