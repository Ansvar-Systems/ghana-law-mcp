/**
 * Ghana legal citation validator.
 *
 * Validates a citation string against the database to ensure the document
 * and provision actually exist (zero-hallucination enforcement).
 */

import type { Database } from '@ansvar/mcp-sqlite';
import type { ValidationResult } from '../types/index.js';
import { parseCitation } from './parser.js';

export function validateCitation(db: Database, citation: string): ValidationResult {
  const parsed = parseCitation(citation);
  const warnings: string[] = [];

  if (!parsed.valid) {
    return {
      citation: parsed,
      document_exists: false,
      provision_exists: false,
      warnings: [parsed.error ?? 'Invalid citation format'],
    };
  }

  // Look up document by act number first, then by title match
  let doc: { id: string; title: string; status: string } | undefined;

  if (parsed.act_number) {
    doc = db.prepare(
      "SELECT id, title, status FROM legal_documents WHERE act_number = ? AND year = ? LIMIT 1"
    ).get(parsed.act_number, parsed.year) as { id: string; title: string; status: string } | undefined;
  }

  if (!doc && parsed.title) {
    doc = db.prepare(
      "SELECT id, title, status FROM legal_documents WHERE title LIKE ? LIMIT 1"
    ).get(`%${parsed.title}%${parsed.year ?? ''}%`) as { id: string; title: string; status: string } | undefined;
  }

  if (!doc) {
    const identifier = parsed.act_number
      ? `Act ${parsed.act_number} (${parsed.year})`
      : `${parsed.title} ${parsed.year}`;
    return {
      citation: parsed,
      document_exists: false,
      provision_exists: false,
      warnings: [`Document "${identifier}" not found in database`],
    };
  }

  if (doc.status === 'repealed') {
    warnings.push('This statute has been repealed');
  }

  // Check provision existence
  let provisionExists = false;
  if (parsed.section) {
    const pinpoint = [
      parsed.section,
      parsed.subsection ? `(${parsed.subsection})` : '',
      parsed.paragraph ? `(${parsed.paragraph})` : '',
    ].join('');
    const provisionRef = `s${pinpoint}`;
    const allowPrefixMatch = parsed.subsection == null && parsed.paragraph == null;

    const prov = db.prepare(
      `SELECT 1
       FROM legal_provisions
       WHERE document_id = ?
         AND (
           provision_ref = ?
           OR section = ?
           OR REPLACE(REPLACE(section, '((', '('), '))', ')') = ?
           OR (
             ? = 1
             AND (
               provision_ref LIKE ?
               OR REPLACE(REPLACE(section, '((', '('), '))', ')') LIKE ?
             )
           )
         )`
    ).get(
      doc.id,
      provisionRef,
      pinpoint,
      pinpoint,
      allowPrefixMatch ? 1 : 0,
      `${provisionRef}(%`,
      `${pinpoint}(%`,
    );
    provisionExists = !!prov;

    if (!provisionExists) {
      warnings.push(`Section ${pinpoint} not found in ${doc.title}`);
    }
  }

  return {
    citation: parsed,
    document_exists: true,
    provision_exists: provisionExists,
    document_title: doc.title,
    status: doc.status,
    warnings,
  };
}
