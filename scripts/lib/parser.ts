/**
 * GhanaLII HTML parser for Ghana legislation.
 *
 * Parses HTML pages from ghalii.org to extract structured legislation data.
 * Uses cheerio for HTML parsing (AfricanLII platform structure).
 */

import * as cheerio from 'cheerio';

// ─────────────────────────────────────────────────────────────────────────────
// Act Index Parsing
// ─────────────────────────────────────────────────────────────────────────────

export interface ActIndexEntry {
  title: string;
  year: number;
  actNumber: number;
  url: string;
}

export interface ActIndexResult {
  entries: ActIndexEntry[];
  hasNextPage: boolean;
}

/**
 * Parse the GhanaLII act index page to extract act listings.
 */
export function parseActIndex(html: string): ActIndexResult {
  const $ = cheerio.load(html);
  const entries: ActIndexEntry[] = [];

  // GhanaLII lists legislation in tables or lists with links
  $('a[href*="/gh/legislation/act/"]').each((_i, el) => {
    const link = $(el);
    const href = link.attr('href') ?? '';
    const text = link.text().trim();

    if (!text || !href) return;

    // Extract year and act number from URL pattern: /gh/legislation/act/YYYY/NNN
    const urlMatch = href.match(/\/gh\/legislation\/act\/(\d{4})\/(\d+)/);
    if (!urlMatch) return;

    const year = parseInt(urlMatch[1], 10);
    const actNumber = parseInt(urlMatch[2], 10);

    // Extract clean title from link text
    const title = text.replace(/\s+/g, ' ').trim();

    entries.push({
      title,
      year,
      actNumber,
      url: href,
    });
  });

  // Check for next page link
  const hasNextPage = $('a[href*="page="]').filter((_i, el) => {
    const text = $(el).text().trim().toLowerCase();
    return text === 'next' || text === '>' || text === '\u203a' || text.includes('next');
  }).length > 0;

  // Deduplicate by year+actNumber
  const seen = new Set<string>();
  const deduped: ActIndexEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.year}-${entry.actNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(entry);
    }
  }

  return { entries: deduped, hasNextPage };
}

// ─────────────────────────────────────────────────────────────────────────────
// Act Content Parsing
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedProvision {
  provision_ref: string;
  part?: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'act';
  title: string;
  short_name: string;
  act_number: number;
  year: number;
  status: 'in_force';
  issued_date: string;
  url: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Parse a GhanaLII act content page into a structured act with provisions.
 */
export function parseActContent(
  html: string,
  year: number,
  actNumber: number,
  actTitle: string
): ParsedAct {
  const $ = cheerio.load(html);
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Extract title from page if available
  const pageTitle = $('h1').first().text().trim() || actTitle;
  const title = pageTitle.replace(/\s+/g, ' ').trim();
  const shortName = buildShortName(title, year);

  let currentPart: string | undefined;
  let currentChapter: string | undefined;
  let isDefinitionSection = false;

  // GhanaLII uses AfricanLII platform structure
  // Sections are typically marked with anchors and heading elements
  // Look for section anchors: <a name="sec_N"> or <a id="sec_N">
  const sectionAnchors = $('a[name^="sec_"], a[id^="sec_"]');

  if (sectionAnchors.length > 0) {
    // Parse using anchor-based structure
    sectionAnchors.each((_i, el) => {
      const anchor = $(el);
      const nameAttr = anchor.attr('name') || anchor.attr('id') || '';
      const secMatch = nameAttr.match(/sec_(\d+)/);
      if (!secMatch) return;

      const sectionNum = secMatch[1];
      const provisionRef = `s${sectionNum}`;

      // Get section heading and content
      // Content typically follows the anchor in sibling or parent elements
      const parent = anchor.parent();
      const sectionTitle = extractSectionTitle($, anchor);
      const content = extractSectionContent($, anchor);

      if (content.trim()) {
        provisions.push({
          provision_ref: provisionRef,
          part: currentPart,
          chapter: currentChapter,
          section: sectionNum,
          title: sectionTitle,
          content: content.trim(),
        });

        // Check if this is a definitions section
        if (/\b(?:interpretation|definitions?)\b/i.test(sectionTitle)) {
          isDefinitionSection = true;
          extractDefinitionsFromContent(content, definitions, provisionRef);
        }
      }
    });
  }

  // Fallback: parse using heading-based structure
  if (provisions.length === 0) {
    // Look for section headings in the main content
    const contentArea = $('.field-name-body, .content, .legislation-content, #content, main').first();
    const textContent = contentArea.length > 0 ? contentArea : $('body');

    // Find section patterns in text
    const fullText = textContent.text();
    const sectionPattern = /(?:Section|SECTION)\s+(\d+)[\.\s—–-]+(.+?)(?=(?:Section|SECTION)\s+\d+|$)/gs;
    let sectionMatch: RegExpExecArray | null;

    while ((sectionMatch = sectionPattern.exec(fullText)) !== null) {
      const sectionNum = sectionMatch[1];
      const sectionBody = sectionMatch[2].trim();
      const provisionRef = `s${sectionNum}`;

      // Split into title and content at first period or newline
      const titleEndIdx = sectionBody.search(/[.\n]/);
      const sectionTitle = titleEndIdx > 0 ? sectionBody.substring(0, titleEndIdx).trim() : '';
      const content = titleEndIdx > 0 ? sectionBody.substring(titleEndIdx + 1).trim() : sectionBody;

      if (content.trim()) {
        provisions.push({
          provision_ref: provisionRef,
          part: currentPart,
          chapter: currentChapter,
          section: sectionNum,
          title: sectionTitle,
          content: content.trim(),
        });
      }
    }
  }

  // Extract part/chapter context by looking at heading elements
  $('h2, h3, h4, .part-heading, .chapter-heading').each((_i, el) => {
    const text = $(el).text().trim();
    const partMatch = text.match(/^PART\s+([IVXLCDM]+|\d+)/i);
    const chapterMatch = text.match(/^CHAPTER\s+([IVXLCDM]+|\d+)/i);
    if (partMatch) currentPart = text;
    if (chapterMatch) currentChapter = text;
  });

  return {
    id: `act-${actNumber}-${year}`,
    type: 'act',
    title,
    short_name: shortName,
    act_number: actNumber,
    year,
    status: 'in_force',
    issued_date: `${year}-01-01`,
    url: `https://ghalii.org/gh/legislation/act/${year}/${actNumber}`,
    provisions,
    definitions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractSectionTitle($: cheerio.CheerioAPI, anchor: cheerio.Cheerio<cheerio.Element>): string {
  // Look for heading text near the anchor
  const parent = anchor.parent();
  const heading = parent.find('b, strong, .section-title, h4, h5').first();
  if (heading.length > 0) {
    return heading.text().replace(/\s+/g, ' ').trim();
  }

  // Try the text of the parent element up to the first period
  const parentText = parent.text().trim();
  const firstLine = parentText.split(/[.\n]/)[0] ?? '';
  // Remove the section number prefix
  return firstLine.replace(/^\d+\.\s*/, '').trim();
}

function extractSectionContent($: cheerio.CheerioAPI, anchor: cheerio.Cheerio<cheerio.Element>): string {
  const parts: string[] = [];

  // Get text from parent and following siblings until next section anchor
  let current = anchor.parent();

  // Collect text from the parent element
  const parentText = current.text().replace(/\s+/g, ' ').trim();
  if (parentText) {
    parts.push(parentText);
  }

  // Walk through following siblings
  let next = current.next();
  let safety = 0;
  while (next.length > 0 && safety < 100) {
    // Stop if we hit another section anchor
    if (next.find('a[name^="sec_"], a[id^="sec_"]').length > 0) break;
    if (next.is('a[name^="sec_"], a[id^="sec_"]')) break;

    const text = next.text().replace(/\s+/g, ' ').trim();
    if (text) {
      parts.push(text);
    }

    next = next.next();
    safety++;
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function extractDefinitionsFromContent(
  content: string,
  definitions: ParsedDefinition[],
  sourceProvision: string,
): void {
  // Match patterns like: "term" means ... ;
  const defPattern = /["\u201C]([^"\u201D]+)["\u201D]\s+means\s+([^;]+);/gi;
  let match: RegExpExecArray | null;

  while ((match = defPattern.exec(content)) !== null) {
    definitions.push({
      term: match[1].trim(),
      definition: match[2].trim(),
      source_provision: sourceProvision,
    });
  }
}

function buildShortName(title: string, year: number): string {
  // Try to create an abbreviation like "DPA 2012"
  const words = title
    .replace(/[()]/g, '')
    .replace(/,\s*\d{4}.*$/, '')  // Remove ", 2012 (Act 843)" suffix
    .split(/\s+/);

  if (words.length <= 3) return `${title} ${year}`;

  // Take significant capitalized words (exclude common words and "Act")
  const significant = words.filter(w =>
    w.length > 2 &&
    w[0] === w[0].toUpperCase() &&
    !['The', 'And', 'For', 'Act', 'Of', 'In', 'To', 'With'].includes(w)
  );

  if (significant.length >= 2) {
    const initials = significant.slice(0, 4).map(w => w[0]).join('');
    return `${initials} ${year}`;
  }

  return `${title.substring(0, 30).trim()} ${year}`;
}
