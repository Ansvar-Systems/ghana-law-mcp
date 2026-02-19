/**
 * Ghana statute identifier handling.
 *
 * Ghana statutes are identified by Act title + year + Act number,
 * e.g. "act-843-2012" for Data Protection Act 2012 (Act 843).
 * The ID in the database is a slug derived from the Act number and year.
 */

import type { Database } from '@ansvar/mcp-sqlite';

export function isValidStatuteId(id: string): boolean {
  return id.length > 0 && id.trim().length > 0;
}

export function statuteIdCandidates(id: string): string[] {
  const trimmed = id.trim().toLowerCase();
  const candidates = new Set<string>();
  candidates.add(trimmed);

  // Also try the original casing
  candidates.add(id.trim());

  // Convert spaces/dashes to the other form
  if (trimmed.includes(' ')) {
    candidates.add(trimmed.replace(/\s+/g, '-'));
  }
  if (trimmed.includes('-')) {
    candidates.add(trimmed.replace(/-/g, ' '));
  }

  return [...candidates];
}

export function resolveExistingStatuteId(
  db: Database,
  inputId: string,
): string | null {
  // Try exact match first
  const exact = db.prepare(
    "SELECT id FROM legal_documents WHERE id = ? LIMIT 1"
  ).get(inputId) as { id: string } | undefined;

  if (exact) return exact.id;

  // Try LIKE match on title
  const byTitle = db.prepare(
    "SELECT id FROM legal_documents WHERE title LIKE ? LIMIT 1"
  ).get(`%${inputId}%`) as { id: string } | undefined;

  return byTitle?.id ?? null;
}
