/**
 * list_sources — Returns metadata about data sources, coverage, and freshness.
 */

import type { Database } from '@ansvar/mcp-sqlite';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface ListSourcesResult {
  jurisdiction: string;
  sources: Array<{
    name: string;
    authority: string;
    url: string;
    license: string;
    coverage: string;
    languages: string[];
  }>;
  database: {
    tier: string;
    schema_version: string;
    built_at: string;
    document_count: number;
    provision_count: number;
    eu_document_count: number;
  };
  limitations: string[];
}

function safeCount(db: Database, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

function safeMetaValue(db: Database, key: string): string {
  try {
    const row = db.prepare('SELECT value FROM db_metadata WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function listSources(db: Database): Promise<ToolResponse<ListSourcesResult>> {
  const documentCount = safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents');
  const provisionCount = safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions');
  const euDocumentCount = safeCount(db, 'SELECT COUNT(*) as count FROM eu_documents');

  return {
    results: {
      jurisdiction: 'Ghana (GH)',
      sources: [
        {
          name: 'GhanaLII',
          authority: 'African Legal Information Institute (AfricanLII)',
          url: 'https://ghalii.org',
          license: 'Free Access (AfricanLII open access principles)',
          coverage: 'Ghana Acts of Parliament, Legislative Instruments, Constitutional Instruments, Executive Instruments. Key legislation: Data Protection Act 2012 (Act 843), Cybersecurity Act 2020 (Act 1038), Electronic Transactions Act 2008 (Act 772), Companies Act 2019 (Act 992).',
          languages: ['en'],
        },
        {
          name: 'Ghana Government Gazette',
          authority: 'Ghana Publishing Company, Republic of Ghana',
          url: 'https://www.ghana.gov.gh',
          license: 'Government Public Data',
          coverage: 'Official gazette versions of Acts and subsidiary legislation.',
          languages: ['en'],
        },
      ],
      database: {
        tier: safeMetaValue(db, 'tier'),
        schema_version: safeMetaValue(db, 'schema_version'),
        built_at: safeMetaValue(db, 'built_at'),
        document_count: documentCount,
        provision_count: provisionCount,
        eu_document_count: euDocumentCount,
      },
      limitations: [
        `Covers ${documentCount.toLocaleString()} Ghanaian Acts of Parliament. Subsidiary legislation (LIs, CIs, EIs) coverage may be partial.`,
        'Historical legislation before GhanaLII digitisation may be incomplete.',
        'International cross-references (GDPR, Malabo Convention, Budapest Convention) are auto-extracted from statute text.',
        'Case law and judicial decisions are not yet included.',
        'Always verify against official Ghana Gazette publications when legal certainty is required.',
      ],
    },
    _metadata: generateResponseMetadata(db),
  };
}
