/**
 * Ghana legal citation parser.
 *
 * Parses citations like:
 *   "Section 1, Data Protection Act 2012 (Act 843)"
 *   "s. 1, DPA 2012"
 *   "Data Protection Act 2012, s. 1"
 *   "act-843-2012, s. 1"
 */

import type { ParsedCitation } from '../types/index.js';

// Full citation: "Section 1, Data Protection Act 2012 (Act 843)"
const FULL_WITH_ACT_NUMBER = /^(?:Section|s\.?)\s+(\d+(?:\(\d+\))*(?:\([a-z]\))*)\s*,?\s+(.+?)\s+(\d{4})\s*\(Act\s+(\d+)\)\s*$/i;

// Full citation without act number: "Section 1, Data Protection Act 2012"
const FULL_CITATION = /^(?:Section|s\.?)\s+(\d+(?:\(\d+\))*(?:\([a-z]\))*)\s*,?\s+(.+?)\s+(\d{4})\s*$/i;

// Short citation: "s. 1 DPA 2012"
const SHORT_CITATION = /^s\.?\s+(\d+(?:\(\d+\))*(?:\([a-z]\))*)\s+(.+?)\s+(\d{4})$/i;

// Trailing section with Act number: "Data Protection Act 2012 (Act 843), s. 1"
const TRAILING_WITH_ACT_NUMBER = /^(.+?)\s+(\d{4})\s*\(Act\s+(\d+)\)\s*,?\s*(?:Section|s\.?)\s*(\d+(?:\(\d+\))*(?:\([a-z]\))*)\s*$/i;

// Trailing section without Act number: "Data Protection Act 2012, s. 1"
const TRAILING_SECTION = /^(.+?)\s+(\d{4})\s*,?\s*(?:Section|s\.?)\s*(\d+(?:\(\d+\))*(?:\([a-z]\))*)\s*$/i;

// ID-based: "act-843-2012, s. 1"
const ID_BASED = /^(act-\d+-\d{4})\s*,?\s*(?:Section|s\.?)\s*(\d+(?:\(\d+\))*(?:\([a-z]\))*)\s*$/i;

// Section with subsection: "1(2)(a)"
const SECTION_REF = /^(\d+)(?:\((\d+)\))?(?:\(([a-z])\))?$/;

export function parseCitation(citation: string): ParsedCitation {
  const trimmed = citation.trim();

  // ID-based: "act-843-2012, s. 1"
  let match = trimmed.match(ID_BASED);
  if (match) {
    const idParts = match[1].match(/^act-(\d+)-(\d{4})$/i);
    if (idParts) {
      return parseSection(
        match[2],
        undefined,
        parseInt(idParts[2], 10),
        parseInt(idParts[1], 10),
        'act'
      );
    }
  }

  // Full with Act number: "Section 1, Data Protection Act 2012 (Act 843)"
  match = trimmed.match(FULL_WITH_ACT_NUMBER);
  if (match) {
    return parseSection(match[1], match[2], parseInt(match[3], 10), parseInt(match[4], 10), 'act');
  }

  // Full without Act number: "Section 1, Data Protection Act 2012"
  match = trimmed.match(FULL_CITATION);
  if (match) {
    return parseSection(match[1], match[2], parseInt(match[3], 10), undefined, 'act');
  }

  // Short citation: "s. 1 DPA 2012"
  match = trimmed.match(SHORT_CITATION);
  if (match) {
    return parseSection(match[1], match[2], parseInt(match[3], 10), undefined, 'act');
  }

  // Trailing with Act number: "Data Protection Act 2012 (Act 843), s. 1"
  match = trimmed.match(TRAILING_WITH_ACT_NUMBER);
  if (match) {
    return parseSection(match[4], match[1], parseInt(match[2], 10), parseInt(match[3], 10), 'act');
  }

  // Trailing without Act number: "Data Protection Act 2012, s. 1"
  match = trimmed.match(TRAILING_SECTION);
  if (match) {
    return parseSection(match[3], match[1], parseInt(match[2], 10), undefined, 'act');
  }

  return {
    valid: false,
    type: 'unknown',
    error: `Could not parse Ghana citation: "${trimmed}"`,
  };
}

function parseSection(
  sectionStr: string,
  title: string | undefined,
  year: number,
  actNumber: number | undefined,
  type: string
): ParsedCitation {
  const sectionMatch = sectionStr.match(SECTION_REF);
  if (!sectionMatch) {
    return {
      valid: true,
      type,
      title: title?.trim(),
      year,
      act_number: actNumber,
      section: sectionStr,
    };
  }

  return {
    valid: true,
    type,
    title: title?.trim(),
    year,
    act_number: actNumber,
    section: sectionMatch[1],
    subsection: sectionMatch[2] || undefined,
    paragraph: sectionMatch[3] || undefined,
  };
}
