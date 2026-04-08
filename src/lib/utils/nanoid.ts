import { nanoid } from 'nanoid';

/**
 * Generate a 6-character table ID (URL-safe alphanumeric).
 * Produces ~56 bits of entropy — sufficient for short-lived table links.
 */
export function generateTableId(): string {
  return nanoid(6);
}
