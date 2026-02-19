#!/usr/bin/env tsx
/**
 * Ghana Law MCP — Ingestion Pipeline
 *
 * Two-phase ingestion of Ghana legislation from GhanaLII (ghalii.org):
 *   Phase 1 (Discovery): Scrape act index pages to build act list
 *   Phase 2 (Content): Fetch HTML for each act, parse, and write seed JSON
 *
 * Usage:
 *   npm run ingest                    # Full ingestion
 *   npm run ingest -- --limit 20      # Test with 20 acts
 *   npm run ingest -- --skip-discovery # Reuse cached act index
 *
 * Data is sourced from GhanaLII under open access principles.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchActIndex, fetchActContent } from './lib/fetcher.js';
import { parseActIndex, parseActContent, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const INDEX_PATH = path.join(SOURCE_DIR, 'act-index.json');

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(): { limit: number | null; skipDiscovery: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipDiscovery = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-discovery') {
      skipDiscovery = true;
    }
  }

  return { limit, skipDiscovery };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Discovery — Build act index from GhanaLII
// ─────────────────────────────────────────────────────────────────────────────

async function discoverActs(): Promise<ActIndexEntry[]> {
  console.log('Phase 1: Discovering Ghana Acts of Parliament from GhanaLII...\n');

  const allEntries: ActIndexEntry[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    process.stdout.write(`  Fetching index page ${page}...`);

    const result = await fetchActIndex(page);

    if (result.status !== 200) {
      console.log(` HTTP ${result.status} — stopping discovery.`);
      break;
    }

    const indexResult = parseActIndex(result.body);
    allEntries.push(...indexResult.entries);

    console.log(` ${indexResult.entries.length} entries`);

    hasMore = indexResult.hasNextPage;
    page++;

    // Safety limit to avoid infinite loops
    if (page > 200) {
      console.log('  WARNING: Hit page limit of 200, stopping discovery.');
      break;
    }
  }

  // Deduplicate by year+actNumber
  const seen = new Set<string>();
  const deduped: ActIndexEntry[] = [];
  for (const entry of allEntries) {
    const key = `${entry.year}-${entry.actNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(entry);
    }
  }

  console.log(`\n  Discovered ${deduped.length} unique acts (from ${allEntries.length} entries, ${page} pages)\n`);

  // Save index
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(deduped, null, 2));
  console.log(`  Index saved to ${INDEX_PATH}\n`);

  return deduped;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Content — Fetch and parse each act
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAndParseActs(acts: ActIndexEntry[], limit: number | null): Promise<void> {
  const toProcess = limit ? acts.slice(0, limit) : acts;
  console.log(`Phase 2: Fetching content for ${toProcess.length} acts...\n`);

  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalProvisions = 0;

  for (const act of toProcess) {
    const seedFile = path.join(SEED_DIR, `${act.year}_${act.actNumber}.json`);

    // Incremental: skip if seed already exists
    if (fs.existsSync(seedFile)) {
      skipped++;
      processed++;
      if (processed % 50 === 0) {
        console.log(`  Progress: ${processed}/${toProcess.length} (${skipped} skipped, ${failed} failed)`);
      }
      continue;
    }

    try {
      const result = await fetchActContent(act.url);

      if (result.status !== 200) {
        if (result.status === 404 || result.status === 301 || result.status === 302) {
          // Write a minimal seed so we don't retry
          const minimalSeed: ParsedAct = {
            id: `act-${act.actNumber}-${act.year}`,
            type: 'act',
            title: act.title,
            short_name: '',
            act_number: act.actNumber,
            year: act.year,
            status: 'in_force',
            issued_date: `${act.year}-01-01`,
            url: act.url,
            provisions: [],
            definitions: [],
          };
          fs.writeFileSync(seedFile, JSON.stringify(minimalSeed, null, 2));
          failed++;
        } else {
          console.log(`  ERROR: HTTP ${result.status} for ${act.year}/${act.actNumber}`);
          failed++;
        }
      } else {
        const parsed = parseActContent(result.body, act.year, act.actNumber, act.title);
        fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
        totalProvisions += parsed.provisions.length;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR parsing ${act.year}/${act.actNumber}: ${msg}`);
      failed++;
    }

    processed++;
    if (processed % 50 === 0) {
      console.log(`  Progress: ${processed}/${toProcess.length} (${skipped} skipped, ${failed} failed, ${totalProvisions} provisions)`);
    }
  }

  console.log(`\nPhase 2 complete:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped (already cached): ${skipped}`);
  console.log(`  Failed/No content: ${failed}`);
  console.log(`  Total provisions extracted: ${totalProvisions}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { limit, skipDiscovery } = parseArgs();

  console.log('Ghana Law MCP — Ingestion Pipeline');
  console.log('===================================\n');

  if (limit) console.log(`  --limit ${limit}`);
  if (skipDiscovery) console.log(`  --skip-discovery`);
  console.log('');

  let acts: ActIndexEntry[];

  if (skipDiscovery && fs.existsSync(INDEX_PATH)) {
    console.log(`Using cached act index from ${INDEX_PATH}\n`);
    acts = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
    console.log(`  ${acts.length} acts in index\n`);
  } else {
    acts = await discoverActs();
  }

  await fetchAndParseActs(acts, limit);

  console.log('\nIngestion complete.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
