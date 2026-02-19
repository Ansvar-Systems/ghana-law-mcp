/**
 * Ghana legal citation formatter.
 *
 * Formats:
 *   full:     "Section 1, Data Protection Act 2012 (Act 843)"
 *   short:    "s. 1, DPA 2012"
 *   pinpoint: "s. 1"
 */

import type { ParsedCitation, CitationFormat } from '../types/index.js';

export function formatCitation(
  parsed: ParsedCitation,
  format: CitationFormat = 'full'
): string {
  if (!parsed.valid || !parsed.section) {
    return '';
  }

  const pinpoint = buildPinpoint(parsed);
  const actSuffix = parsed.act_number ? ` (Act ${parsed.act_number})` : '';

  switch (format) {
    case 'full':
      return `Section ${pinpoint}, ${parsed.title ?? ''} ${parsed.year ?? ''}${actSuffix}`.trim();

    case 'short':
      return `s. ${pinpoint}, ${parsed.title ?? ''} ${parsed.year ?? ''}`.trim();

    case 'pinpoint':
      return `s. ${pinpoint}`;

    default:
      return `Section ${pinpoint}, ${parsed.title ?? ''} ${parsed.year ?? ''}${actSuffix}`.trim();
  }
}

function buildPinpoint(parsed: ParsedCitation): string {
  let ref = parsed.section ?? '';
  if (parsed.subsection) {
    ref += `(${parsed.subsection})`;
  }
  if (parsed.paragraph) {
    ref += `(${parsed.paragraph})`;
  }
  return ref;
}
