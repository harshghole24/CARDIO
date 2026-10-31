import type { BrandRegistration } from './offerEngine';
import type { OfferRow } from '../data/schemas';
import { maskIdentifier, validateIdentifier, type IdentifierType } from '../utils/masking';

export interface RegistrationReminder {
  registrationId: string;
  brandName: string;
  status: 'PENDING' | 'NOT_REGISTERED' | string;
  maskedIdentifier?: string;
  portalUrl?: string;
  matchedOffer?: OfferRow;
  reminderMessage: string;
}

/**
 * Filters and searches brand registrations.
 */
export function filterBrandRegistrations(
  registrations: BrandRegistration[],
  searchQuery: string = '',
  statusFilter: string = 'ALL'
): BrandRegistration[] {
  const query = searchQuery.trim().toLowerCase();

  return registrations.filter(reg => {
    // Status Filter
    if (statusFilter !== 'ALL') {
      const regStatus = (reg.status || 'PENDING').toUpperCase();
      if (regStatus !== statusFilter.toUpperCase()) {
        return false;
      }
    }

    // Search Query
    if (query) {
      const brandMatch = reg.brand_name?.toLowerCase().includes(query);
      const campaignMatch = reg.campaign_name?.toLowerCase().includes(query);
      const identifierMatch = reg.masked_identifier?.toLowerCase().includes(query);
      const notesMatch = reg.notes?.toLowerCase().includes(query);
      return Boolean(brandMatch || campaignMatch || identifierMatch || notesMatch);
    }

    return true;
  });
}

/**
 * Scans user registrations and active promotional offers to generate actionable registration reminders.
 */
export function generateRegistrationReminders(
  registrations: BrandRegistration[],
  activeOffers: OfferRow[] = []
): RegistrationReminder[] {
  const reminders: RegistrationReminder[] = [];

  for (const reg of registrations) {
    const status = (reg.status || '').toUpperCase();
    if (status === 'PENDING' || status === 'NOT_REGISTERED') {
      const brandNorm = reg.brand_name.toLowerCase().trim();

      // Check if an active offer requires this brand
      const matchedOffer = activeOffers.find(o => {
        if (!o.registration_required) return false;
        const reqBrand = (o.required_brand_name || o.merchant_name).toLowerCase().trim();
        return reqBrand.includes(brandNorm) || brandNorm.includes(reqBrand);
      });

      let reminderMessage = '';
      if (matchedOffer) {
        reminderMessage = `Active promo detected on ${matchedOffer.merchant_name} (${matchedOffer.bank_name}). Complete enrollment with ${reg.brand_name} to unlock promotional terms.`;
      } else if (status === 'PENDING') {
        reminderMessage = `Registration with ${reg.brand_name} is marked as PENDING. Verify your enrollment status once confirmed.`;
      } else {
        reminderMessage = `You noted you are NOT registered with ${reg.brand_name}. Enroll to ensure access to accelerated card multipliers.`;
      }

      reminders.push({
        registrationId: reg.id || reg.brand_name,
        brandName: reg.brand_name,
        status,
        maskedIdentifier: reg.masked_identifier || undefined,
        portalUrl: reg.portal_url || matchedOffer?.portal_url || undefined,
        matchedOffer,
        reminderMessage,
      });
    }
  }

  return reminders;
}

/**
 * Validates brand registration input before submission.
 */
export function validateRegistrationInput(payload: {
  brand_name: string;
  identifier_type?: IdentifierType;
  raw_identifier?: string;
  status?: string;
  existingRegistrations?: BrandRegistration[];
  currentRegistrationId?: string;
}): { valid: boolean; error?: string; maskedIdentifier?: string } {
  if (!payload.brand_name || !payload.brand_name.trim()) {
    return { valid: false, error: 'Brand or merchant name is required.' };
  }

  const trimmedBrand = payload.brand_name.trim().toLowerCase();

  // Duplicate Check
  if (payload.existingRegistrations) {
    const duplicate = payload.existingRegistrations.find(r =>
      r.brand_name.trim().toLowerCase() === trimmedBrand &&
      r.id !== payload.currentRegistrationId
    );
    if (duplicate) {
      return {
        valid: false,
        error: `A registration for "${payload.brand_name.trim()}" already exists. Please update the existing entry.`,
      };
    }
  }

  // Status Check
  if (payload.status) {
    const validStatuses = ['REGISTERED', 'PENDING', 'NOT_REGISTERED', 'EXPIRED'];
    if (!validStatuses.includes(payload.status.toUpperCase())) {
      return { valid: false, error: 'Invalid registration status specified.' };
    }
  }

  // Identifier Check & Masking
  let maskedIdentifier: string | undefined = undefined;
  if (payload.raw_identifier && payload.raw_identifier.trim()) {
    const type: IdentifierType = payload.identifier_type || 'EMAIL';
    const validation = validateIdentifier(payload.raw_identifier, type);
    if (!validation.valid) {
      return { valid: false, error: validation.error };
    }
    maskedIdentifier = maskIdentifier(payload.raw_identifier, type);
  }

  return { valid: true, maskedIdentifier };
}
