#!/usr/bin/env tsx
/**
 * Check GhanaLII for newly published or updated Ghana Acts.
 *
 * Exits:
 *   0 = no updates
 *   1 = updates found
 *   2 = check failed (network/parse/database error)
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseActIndex, type ActIndexEntry } from './lib/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../data/database.db');
const INDEX_PATH = resolve(__dirname, '../data/source/act-index.json');

const USER_AGENT = 'GhanaLawMCP/1.0';
const PAGE_LIMIT = 3;
const REQUEST_TIMEOUT_MS = 15_000;

interface UpdateHit {
  document_id: string;
  title: string;
  year: number;
  actNumber: number;
}

function toDocumentId(entry: Pick<ActIndexEntry, 'year' | 'actNumber'>): string {
  return `act-${entry.actNumber}-${entry.year}`;
}

async function fetchIndexPage(page: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = page === 0
    ? 'https://ghalii.org/gh/legislation/act/'
    : `https://ghalii.org/gh/legislation/act/?page=${page}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} on page ${page}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRecentEntries(pageLimit: number): Promise<ActIndexEntry[]> {
  const entries: ActIndexEntry[] = [];

  for (let page = 0; page < pageLimit; page++) {
    const html = await fetchIndexPage(page);
    const parsed = parseActIndex(html);
    entries.push(...parsed.entries);
    if (!parsed.hasNextPage) {
      break;
    }
  }

  return entries;
}

async function main(): Promise<void> {
  console.log('Ghana Law MCP - Update checker');
  console.log('');

  if (!existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(2);
  }

  const db = new Database(DB_PATH, { readonly: true });
  const localDocs = new Set<string>(
    (db.prepare("SELECT id FROM legal_documents").all() as { id: string }[])
      .map((row) => row.id),
  );
  db.close();

  const recentEntries = await fetchRecentEntries(PAGE_LIMIT);
  console.log(`Checked ${recentEntries.length} upstream entries from ${PAGE_LIMIT} page(s).`);

  const newActs: UpdateHit[] = [];

  for (const entry of recentEntries) {
    const documentId = toDocumentId(entry);

    if (!localDocs.has(documentId)) {
      newActs.push({
        document_id: documentId,
        title: entry.title,
        year: entry.year,
        actNumber: entry.actNumber,
      });
    }
  }

  console.log('');
  console.log(`New acts: ${newActs.length}`);

  if (newActs.length > 0) {
    console.log('');
    console.log('New upstream acts missing locally:');
    for (const hit of newActs.slice(0, 20)) {
      console.log(`  - ${hit.document_id} (${hit.title})`);
    }
    process.exit(1);
  }

  console.log('');
  console.log('No recent upstream changes detected in the checked window.');
}

main().catch((error) => {
  console.error(`Update check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
