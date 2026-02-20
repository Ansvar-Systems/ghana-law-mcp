/**
 * GhanaLII HTML parser for Ghana legislation.
 *
 * Parses HTML pages from ghalii.org to extract structured legislation data.
 * Uses cheerio for HTML parsing. GhanaLII uses the AfricanLII / Laws.Africa
 * platform with Akoma Ntoso (AKN) markup.
 *
 * Act index URL: /legislation/ (paginated with ?page=N)
 * Act content URL: /akn/gh/act/YYYY/NNN/eng@DATE
 * Content uses: <section class="akn-section"> with nested akn-subsection/akn-paragraph
 * TOC available as: <script id="akn_toc_json">
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
 * Parse the GhanaLII legislation listing page to extract act entries.
 * Links follow the Akoma Ntoso pattern: /akn/gh/act/YYYY/NNN/eng@DATE
 * Some have subtypes: /akn/gh/act/ca/YYYY/NNN/eng@DATE or /akn/gh/act/pndcl/YYYY/NNN/eng@DATE
 */
export function parseActIndex(html: string): ActIndexResult {
  const $ = cheerio.load(html);
  const entries: ActIndexEntry[] = [];

  // GhanaLII lists legislation with links to AKN URIs
  $('a[href*="/akn/gh/act/"]').each((_i, el) => {
    const link = $(el);
    const href = link.attr('href') ?? '';
    const text = link.text().trim();

    if (!text || !href) return;

    // Extract year and act number from AKN URL patterns:
    //   /akn/gh/act/YYYY/NNN/eng@DATE
    //   /akn/gh/act/ca/YYYY/NNN/eng@DATE
    //   /akn/gh/act/pndcl/YYYY/NNN/eng@DATE
    const urlMatch = href.match(/\/akn\/gh\/act\/(?:[a-z]+\/)?(\d{4})\/(\d+)\/eng@/);
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

  // Also check for a page=N+1 link as a fallback (GhanaLII uses numbered pagination)
  const hasNumberedNext = $('a[href*="page="]').length > 0 && entries.length > 0;

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

  return { entries: deduped, hasNextPage: hasNextPage || hasNumberedNext };
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
 *
 * GhanaLII uses Akoma Ntoso markup:
 *   <section class="akn-section" id="...sec_N">
 *     <h3>N. Section Title</h3>
 *     <section class="akn-subsection">
 *       <span class="akn-num">(1)</span>
 *       <span class="akn-content"><span class="akn-p">...</span></span>
 *     </section>
 *   </section>
 *
 * Also has embedded TOC JSON in <script id="akn_toc_json">.
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
  const pageTitle = $('title').first().text().trim().replace(/\s*[–—-]\s*GhaLII\s*$/, '') || actTitle;
  const title = pageTitle.replace(/\s+/g, ' ').trim();
  const shortName = buildShortName(title, year);

  // Extract the issued date from the URL (if available in the page's AKN metadata)
  let issuedDate = `${year}-01-01`;
  const trackProps = $('script#track-page-properties');
  if (trackProps.length > 0) {
    try {
      const props = JSON.parse(trackProps.text());
      if (props.expression_frbr_uri) {
        const dateMatch = props.expression_frbr_uri.match(/@(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) issuedDate = dateMatch[1];
      }
    } catch { /* ignore parse errors */ }
  }

  // Build the canonical URL
  const canonicalUrl = `https://ghalii.org/akn/gh/act/${year}/${actNumber}`;

  // Track current part/chapter context from subpart headings
  let currentPart: string | undefined;
  let currentChapter: string | undefined;

  // Primary strategy: Parse AKN section elements
  const sections = $('section.akn-section');

  if (sections.length > 0) {
    sections.each((_i, el) => {
      const section = $(el);
      const sectionId = section.attr('id') || section.attr('data-eid') || '';

      // Extract section number from the id (e.g., "subpart_nn_1__sec_1" -> "1")
      const secMatch = sectionId.match(/(?:^|__)sec_(\d+)/);
      if (!secMatch) return;

      const sectionNum = secMatch[1];
      const provisionRef = `s${sectionNum}`;

      // Get section heading from h3/h4
      const heading = section.children('h3, h4').first();
      let sectionTitle = heading.text().replace(/\s+/g, ' ').trim();
      // Remove leading section number (e.g., "1. Application" -> "Application")
      sectionTitle = sectionTitle.replace(/^\d+\.\s*/, '').trim();

      // Determine parent part/chapter context
      const parentSubpart = section.closest('section.akn-subpart, section[class*="akn-part"], section[class*="akn-chapter"]');
      if (parentSubpart.length > 0) {
        const partHeading = parentSubpart.children('h2, h3').first().text().trim();
        if (/^PART\s/i.test(partHeading)) currentPart = partHeading;
        if (/^CHAPTER\s/i.test(partHeading)) currentChapter = partHeading;
      }

      // Extract content: get all text from subsections and paragraphs
      const contentParts: string[] = [];
      section.find('section.akn-subsection').each((_j, sub) => {
        const subsection = $(sub);
        const num = subsection.children('.akn-num').text().trim();
        const text = subsection.find('.akn-p, .akn-content, .akn-intro, .akn-listIntroduction')
          .map((_k, p) => $(p).text().replace(/\s+/g, ' ').trim())
          .get()
          .filter(t => t)
          .join(' ');

        if (text) {
          contentParts.push(num ? `${num} ${text}` : text);
        }
      });

      // If no subsections found, get direct content
      if (contentParts.length === 0) {
        const directContent = section.find('.akn-p, .akn-content').not('section.akn-subsection .akn-p, section.akn-subsection .akn-content')
          .map((_j, p) => $(p).text().replace(/\s+/g, ' ').trim())
          .get()
          .filter(t => t)
          .join(' ');

        if (directContent) {
          contentParts.push(directContent);
        }
      }

      const content = contentParts.join(' ').replace(/\s+/g, ' ').trim();

      if (content) {
        provisions.push({
          provision_ref: provisionRef,
          part: currentPart,
          chapter: currentChapter,
          section: sectionNum,
          title: sectionTitle,
          content,
        });

        // Check for definitions section
        if (/\b(?:interpretation|definitions?)\b/i.test(sectionTitle)) {
          extractDefinitionsFromContent(content, definitions, provisionRef);
        }
      }
    });
  }

  // Fallback: use TOC JSON + text extraction
  if (provisions.length === 0) {
    const tocScript = $('script#akn_toc_json');
    if (tocScript.length > 0) {
      try {
        const toc = JSON.parse(tocScript.text()) as Array<{
          id: string;
          num: string;
          type: string;
          title: string;
          heading: string;
          children: Array<any>;
          basic_unit: boolean;
        }>;

        function extractSectionsFromToc(items: typeof toc): void {
          for (const item of items) {
            if (item.type === 'section' && item.id) {
              const secMatch = item.id.match(/(?:^|__)sec_(\d+)/);
              if (secMatch) {
                const sectionNum = secMatch[1];
                const sectionEl = $(`#${item.id}`);
                if (sectionEl.length > 0) {
                  const content = sectionEl.text().replace(/\s+/g, ' ').trim();
                  // Remove the heading text from the content
                  const headingText = item.title || '';
                  const cleanContent = content.replace(headingText, '').trim();

                  if (cleanContent) {
                    provisions.push({
                      provision_ref: `s${sectionNum}`,
                      section: sectionNum,
                      title: (item.heading || '').trim(),
                      content: cleanContent,
                    });
                  }
                }
              }
            }
            if (item.children) {
              extractSectionsFromToc(item.children);
            }
          }
        }

        extractSectionsFromToc(toc);
      } catch { /* ignore parse errors */ }
    }
  }

  // Final fallback: regex-based extraction
  if (provisions.length === 0) {
    const fullText = $('body').text();
    const sectionPattern = /(?:Section|SECTION)\s+(\d+)[\.\s\u2014\u2013-]+(.+?)(?=(?:Section|SECTION)\s+\d+|$)/gs;
    let sectionMatch: RegExpExecArray | null;

    while ((sectionMatch = sectionPattern.exec(fullText)) !== null) {
      const sectionNum = sectionMatch[1];
      const sectionBody = sectionMatch[2].trim();
      const provisionRef = `s${sectionNum}`;

      const titleEndIdx = sectionBody.search(/[.\n]/);
      const sectionTitle = titleEndIdx > 0 ? sectionBody.substring(0, titleEndIdx).trim() : '';
      const content = titleEndIdx > 0 ? sectionBody.substring(titleEndIdx + 1).trim() : sectionBody;

      if (content.trim()) {
        provisions.push({
          provision_ref: provisionRef,
          section: sectionNum,
          title: sectionTitle,
          content: content.trim(),
        });
      }
    }
  }

  return {
    id: `act-${actNumber}-${year}`,
    type: 'act',
    title,
    short_name: shortName,
    act_number: actNumber,
    year,
    status: 'in_force',
    issued_date: issuedDate,
    url: canonicalUrl,
    provisions,
    definitions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractDefinitionsFromContent(
  content: string,
  definitions: ParsedDefinition[],
  sourceProvision: string,
): void {
  // Match patterns like: "term" means ... ;
  const defPattern = /[\u201C"\u201E]([^\u201D"\u201F]+)[\u201D"\u201F]\s+means\s+([^;]+);/gi;
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
