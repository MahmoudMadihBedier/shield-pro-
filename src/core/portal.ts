/**
 * CRM client-portal auth primitives (Implementation Plan §1 Phase 3, Story
 * 3.1). The auth-hardening decision: a customer's PIN **is** the password on
 * their own Appwrite Auth account — Appwrite owns hashing, rate-limiting and
 * session management, so Shield Pro never stores or checks a credential
 * itself. This module is imported by BOTH the `functions/` Function code and
 * the client, so it must stay zero-dependency: no react, no appwrite, no
 * node-appwrite.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

/** Fake email domain used to derive a synthetic Appwrite Auth email for a
 *  customer's portal account — customers never see or type an email. */
export const PORTAL_EMAIL_DOMAIN = 'portal.shieldpro.local'

/**
 * The single source of truth for deriving a customer's synthetic portal
 * email from their `customers.code`. Both the account-creation Function and
 * the client login form call this — they can never drift apart.
 */
export function portalEmailForCode(code: string): string {
  return `${code.trim().toLowerCase()}@${PORTAL_EMAIL_DOMAIN}`
}

/** A portal PIN is always exactly this many digits. */
export const PIN_LENGTH = 8

const PIN_PATTERN = /^\d{8}$/

/** Exactly `PIN_LENGTH` digits, no whitespace, no other characters. */
export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin)
}
