#!/usr/bin/env tsx
/**
 * Database builder for Ghana Law MCP server.
 *
 * Builds the SQLite database from seed JSON files in data/seed/.
 *
 * Usage: npm run build:db
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '../data/seed');
const DB_PATH = path.resolve(__dirname, '../data/database.db');

// ─────────────────────────────────────────────────────────────────────────────
// Seed file types
// ─────────────────────────────────────────────────────────────────────────────

interface DocumentSeed {
  id: string;
  type: 'act' | 'legislative_instrument' | 'constitutional_instrument' | 'executive_instrument';
  title: string;
  short_name?: string;
  act_number?: number;
  year: number;
  status: 'in_force' | 'amended' | 'repealed';
  issued_date?: string;
  in_force_date?: string;
  url?: string;
  provisions?: ProvisionSeed[];
  definitions?: DefinitionSeed[];
}

interface ProvisionSeed {
  provision_ref: string;
  part?: string;
  chapter?: string;
  section: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface DefinitionSeed {
  term: string;
  definition: string;
  source_provision?: string;
}

interface ProvisionDedupStats {
  duplicate_refs: number;
  conflicting_duplicates: number;
}

type EUDocumentType = 'directive' | 'regulation';
type EUCommunity = 'EU' | 'EC' | 'EEC' | 'Euratom' | 'AU' | 'ECOWAS';
type EUReferenceType = 'implements' | 'references';

interface ExtractedEUReference {
  type: EUDocumentType;
  community: EUCommunity;
  year: number;
  number: number;
  euDocumentId: string;
  euArticle: string | null;
  fullCitation: string;
  referenceContext: string;
  referenceType: EUReferenceType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database schema
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = `
-- Legal documents (acts, legislative instruments, etc.)
CREATE TABLE legal_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('act', 'legislative_instrument', 'constitutional_instrument', 'executive_instrument')),
  title TEXT NOT NULL,
  short_name TEXT,
  act_number INTEGER,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_force'
    CHECK(status IN ('in_force', 'amended', 'repealed')),
  issued_date TEXT,
  in_force_date TEXT,
  url TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_documents_year ON legal_documents(year);
CREATE INDEX idx_documents_act_number ON legal_documents(act_number);

-- Individual provisions from statutes
CREATE TABLE legal_provisions (
  id INTEGER PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  provision_ref TEXT NOT NULL,
  part TEXT,
  chapter TEXT,
  section TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  metadata TEXT,
  UNIQUE(document_id, provision_ref)
);

CREATE INDEX idx_provisions_doc ON legal_provisions(document_id);
CREATE INDEX idx_provisions_section ON legal_provisions(document_id, section);

-- FTS5 for provision search
CREATE VIRTUAL TABLE provisions_fts USING fts5(
  content, title,
  content='legal_provisions',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER provisions_ai AFTER INSERT ON legal_provisions BEGIN
  INSERT INTO provisions_fts(rowid, content, title)
  VALUES (new.id, new.content, new.title);
END;

CREATE TRIGGER provisions_ad AFTER DELETE ON legal_provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, content, title)
  VALUES ('delete', old.id, old.content, old.title);
END;

CREATE TRIGGER provisions_au AFTER UPDATE ON legal_provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, content, title)
  VALUES ('delete', old.id, old.content, old.title);
  INSERT INTO provisions_fts(rowid, content, title)
  VALUES (new.id, new.content, new.title);
END;

-- Cross-references between provisions/documents
CREATE TABLE cross_references (
  id INTEGER PRIMARY KEY,
  source_document_id TEXT NOT NULL REFERENCES legal_documents(id),
  source_provision_id INTEGER,
  target_document_id TEXT NOT NULL REFERENCES legal_documents(id),
  target_provision_ref TEXT,
  context TEXT
);

CREATE INDEX idx_xref_source ON cross_references(source_document_id);
CREATE INDEX idx_xref_target ON cross_references(target_document_id);

-- Legal term definitions
CREATE TABLE definitions (
  id INTEGER PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  source_provision TEXT,
  UNIQUE(document_id, term)
);

-- FTS5 for definition search
CREATE VIRTUAL TABLE definitions_fts USING fts5(
  term, definition,
  content='definitions',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER definitions_ai AFTER INSERT ON definitions BEGIN
  INSERT INTO definitions_fts(rowid, term, definition)
  VALUES (new.id, new.term, new.definition);
END;

CREATE TRIGGER definitions_ad AFTER DELETE ON definitions BEGIN
  INSERT INTO definitions_fts(definitions_fts, rowid, term, definition)
  VALUES ('delete', old.id, old.term, old.definition);
END;

CREATE TRIGGER definitions_au AFTER UPDATE ON definitions BEGIN
  INSERT INTO definitions_fts(definitions_fts, rowid, term, definition)
  VALUES ('delete', old.id, old.term, old.definition);
  INSERT INTO definitions_fts(rowid, term, definition)
  VALUES (new.id, new.term, new.definition);
END;

-- =============================================================================
-- INTERNATIONAL REFERENCES SCHEMA (EU, AU, ECOWAS conventions)
-- =============================================================================

CREATE TABLE eu_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('directive', 'regulation')),
  year INTEGER NOT NULL CHECK (year >= 1957 AND year <= 2100),
  number INTEGER NOT NULL CHECK (number > 0),
  community TEXT CHECK (community IN ('EU', 'EC', 'EEC', 'Euratom', 'AU', 'ECOWAS')),
  celex_number TEXT,
  title TEXT,
  short_name TEXT,
  adoption_date TEXT,
  entry_into_force_date TEXT,
  in_force BOOLEAN DEFAULT 1,
  url_eur_lex TEXT,
  description TEXT,
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_eu_documents_type_year ON eu_documents(type, year DESC);

CREATE TABLE eu_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK (source_type IN ('provision', 'document', 'case_law')),
  source_id TEXT NOT NULL,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  provision_id INTEGER REFERENCES legal_provisions(id),
  eu_document_id TEXT NOT NULL REFERENCES eu_documents(id),
  eu_article TEXT,
  reference_type TEXT NOT NULL CHECK (reference_type IN (
    'implements', 'supplements', 'applies', 'references', 'complies_with',
    'derogates_from', 'amended_by', 'repealed_by', 'cites_article'
  )),
  reference_context TEXT,
  full_citation TEXT,
  is_primary_implementation BOOLEAN DEFAULT 0,
  implementation_status TEXT CHECK (implementation_status IN ('complete', 'partial', 'pending', 'unknown')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_verified TEXT,
  UNIQUE(source_id, eu_document_id, eu_article)
);

CREATE INDEX idx_eu_references_document ON eu_references(document_id, eu_document_id);
CREATE INDEX idx_eu_references_eu_document ON eu_references(eu_document_id, document_id);
CREATE INDEX idx_eu_references_provision ON eu_references(provision_id, eu_document_id);

-- Build metadata
CREATE TABLE db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function pickPreferredProvision(existing: ProvisionSeed, incoming: ProvisionSeed): ProvisionSeed {
  const existingContent = normalizeWhitespace(existing.content);
  const incomingContent = normalizeWhitespace(incoming.content);

  if (incomingContent.length > existingContent.length) {
    return {
      ...incoming,
      title: incoming.title ?? existing.title,
    };
  }

  return {
    ...existing,
    title: existing.title ?? incoming.title,
  };
}

function dedupeProvisions(provisions: ProvisionSeed[]): { deduped: ProvisionSeed[]; stats: ProvisionDedupStats } {
  const byRef = new Map<string, ProvisionSeed>();
  const stats: ProvisionDedupStats = {
    duplicate_refs: 0,
    conflicting_duplicates: 0,
  };

  for (const provision of provisions) {
    const ref = provision.provision_ref.trim();
    const existing = byRef.get(ref);

    if (!existing) {
      byRef.set(ref, { ...provision, provision_ref: ref });
      continue;
    }

    stats.duplicate_refs++;

    const existingContent = normalizeWhitespace(existing.content);
    const incomingContent = normalizeWhitespace(provision.content);

    if (existingContent !== incomingContent) {
      stats.conflicting_duplicates++;
    }

    byRef.set(ref, pickPreferredProvision(existing, provision));
  }

  return {
    deduped: Array.from(byRef.values()),
    stats,
  };
}

function normalizeEuYear(rawYear: string): number {
  const parsed = Number.parseInt(rawYear, 10);
  if (Number.isNaN(parsed)) return 0;
  if (rawYear.length === 2) {
    return parsed >= 50 ? 1900 + parsed : 2000 + parsed;
  }
  return parsed;
}

function buildEuDocumentId(type: EUDocumentType, year: number, number: number): string {
  return `${type}:${year}/${number}`;
}

function inferReferenceType(context: string): EUReferenceType {
  return /\b(implement|implemented|implements|transpos|supplement|complies?|gives effect)\b/i.test(context)
    ? 'implements'
    : 'references';
}

function extractArticleReference(context: string): string | null {
  const match = context.match(/\bArticle\s+(\d+[A-Za-z]?(?:\(\d+\))?)/i);
  return match ? match[1] : null;
}

function normalizeCommunity(value: string | undefined): EUCommunity {
  if (!value) return 'EU';
  const upper = value.toUpperCase();
  if (upper === 'EC') return 'EC';
  if (upper === 'EEC') return 'EEC';
  if (upper === 'EURATOM') return 'Euratom';
  if (upper === 'AU') return 'AU';
  if (upper === 'ECOWAS') return 'ECOWAS';
  return 'EU';
}

function extractEuReferences(text: string): ExtractedEUReference[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const refs: ExtractedEUReference[] = [];
  const seen = new Set<string>();

  // Standard EU patterns
  const euPatterns: RegExp[] = [
    /\b(Regulation|Directive)\s*\((EU|EC|EEC|Euratom)\)\s*(?:No\.?\s*)?(\d{2,4})\/(\d{1,4})\b/gi,
    /\b(Regulation|Directive)\s*(?:No\.?\s*)?(\d{2,4})\/(\d{1,4})\/(EU|EC|EEC|Euratom)\b/gi,
    /\b(Regulation|Directive)\s*(?:No\.?\s*)?(\d{2,4})\/(\d{1,4})\b/gi,
  ];

  for (const pattern of euPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const type = match[1].toLowerCase() as EUDocumentType;

      let rawYear: string;
      let rawNumber: string;
      let communityRaw: string | undefined;

      if (pattern === euPatterns[0]) {
        communityRaw = match[2];
        rawYear = match[3];
        rawNumber = match[4];
      } else if (pattern === euPatterns[1]) {
        rawYear = match[2];
        rawNumber = match[3];
        communityRaw = match[4];
      } else {
        rawYear = match[2];
        rawNumber = match[3];
        communityRaw = undefined;
      }

      const year = normalizeEuYear(rawYear);
      const number = Number.parseInt(rawNumber, 10);
      if (year <= 0 || Number.isNaN(number) || number <= 0) continue;

      const community = normalizeCommunity(communityRaw);
      const start = Math.max(0, match.index - 120);
      const end = Math.min(text.length, match.index + match[0].length + 120);
      const referenceContext = text.slice(start, end).replace(/\s+/g, ' ').trim();
      const euArticle = extractArticleReference(referenceContext);
      const referenceType = inferReferenceType(referenceContext);
      const euDocumentId = buildEuDocumentId(type, year, number);

      const dedupeKey = `${euDocumentId}:${euArticle ?? ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      refs.push({
        type, community, year, number,
        euDocumentId, euArticle, fullCitation: match[0],
        referenceContext, referenceType,
      });
    }
  }

  // African Union / international convention patterns
  const conventionPatterns: Array<{ pattern: RegExp; id: string; type: EUDocumentType; community: EUCommunity; year: number; number: number; title: string }> = [
    {
      pattern: /\b(?:GDPR|General Data Protection Regulation)\b/gi,
      id: 'regulation:2016/679', type: 'regulation', community: 'EU', year: 2016, number: 679,
      title: 'General Data Protection Regulation (GDPR)',
    },
    {
      pattern: /\bEU\s*(?:Data Protection\s*)?Directive\s*95\/46\b/gi,
      id: 'directive:1995/46', type: 'directive', community: 'EC', year: 1995, number: 46,
      title: 'EU Data Protection Directive 95/46/EC',
    },
    {
      pattern: /\b(?:Malabo Convention|AU Convention on Cyber Security|African Union Convention on Cyber Security and Personal Data Protection)\b/gi,
      id: 'directive:2014/1', type: 'directive', community: 'AU', year: 2014, number: 1,
      title: 'AU Convention on Cyber Security and Personal Data Protection (Malabo Convention)',
    },
    {
      pattern: /\b(?:Budapest Convention|Convention on Cybercrime)\b/gi,
      id: 'directive:2001/185', type: 'directive', community: 'EU', year: 2001, number: 185,
      title: 'Convention on Cybercrime (Budapest Convention)',
    },
    {
      pattern: /\bConvention\s*108\b/gi,
      id: 'directive:1981/108', type: 'directive', community: 'EU', year: 1981, number: 108,
      title: 'Convention for the Protection of Individuals with regard to Automatic Processing of Personal Data (Convention 108)',
    },
  ];

  for (const { pattern, id, type, community, year, number, title } of conventionPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const dedupeKey = `${id}:`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const start = Math.max(0, match.index - 120);
      const end = Math.min(text.length, match.index + match[0].length + 120);
      const referenceContext = text.slice(start, end).replace(/\s+/g, ' ').trim();
      const referenceType = inferReferenceType(referenceContext);

      refs.push({
        type, community, year, number,
        euDocumentId: id,
        euArticle: null,
        fullCitation: match[0],
        referenceContext,
        referenceType,
      });
    }
  }

  return refs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────────────────────

function buildDatabase(): void {
  console.log('Building Ghana Law MCP database...\n');

  // Delete existing database
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('  Deleted existing database.\n');
  }

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(SCHEMA);

  // Prepared statements
  const insertDoc = db.prepare(`
    INSERT INTO legal_documents (id, type, title, short_name, act_number, year, status, issued_date, in_force_date, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProvision = db.prepare(`
    INSERT INTO legal_provisions (document_id, provision_ref, part, chapter, section, title, content, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDefinition = db.prepare(`
    INSERT INTO definitions (document_id, term, definition, source_provision)
    VALUES (?, ?, ?, ?)
  `);

  const insertEuDocument = db.prepare(`
    INSERT OR IGNORE INTO eu_documents
      (id, type, year, number, community, title, short_name, url_eur_lex, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEuReference = db.prepare(`
    INSERT INTO eu_references
      (
        source_type, source_id, document_id, provision_id, eu_document_id, eu_article,
        reference_type, reference_context, full_citation, is_primary_implementation,
        implementation_status, last_verified
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Load seed files
  if (!fs.existsSync(SEED_DIR)) {
    console.log(`No seed directory at ${SEED_DIR} — creating empty database.`);
    db.close();
    return;
  }

  const seedFiles = fs.readdirSync(SEED_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('.') && !f.startsWith('_'));

  if (seedFiles.length === 0) {
    console.log('No seed files found. Database created with empty schema.');
    db.close();
    return;
  }

  let totalDocs = 0;
  let totalProvisions = 0;
  let totalDefs = 0;
  let totalDuplicateRefs = 0;
  let totalConflictingDuplicates = 0;
  let emptyDocs = 0;
  let totalEuDocuments = 0;
  let totalEuReferences = 0;
  const primaryImplementationByDocument = new Set<string>();

  const loadAll = db.transaction(() => {
    for (const file of seedFiles) {
      const filePath = path.join(SEED_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const seed = JSON.parse(content) as DocumentSeed;

      insertDoc.run(
        seed.id,
        seed.type ?? 'act',
        seed.title,
        seed.short_name ?? null,
        seed.act_number ?? null,
        seed.year,
        seed.status ?? 'in_force',
        seed.issued_date ?? null,
        seed.in_force_date ?? null,
        seed.url ?? null,
      );
      totalDocs++;

      if (!seed.provisions || seed.provisions.length === 0) {
        emptyDocs++;
        continue;
      }

      const { deduped, stats } = dedupeProvisions(seed.provisions);
      totalDuplicateRefs += stats.duplicate_refs;
      totalConflictingDuplicates += stats.conflicting_duplicates;
      if (stats.duplicate_refs > 0) {
        console.log(
          `    WARNING: ${stats.duplicate_refs} duplicate refs in ${seed.id} ` +
          `(${stats.conflicting_duplicates} with different text).`
        );
      }

      for (const prov of deduped) {
        const insertResult = insertProvision.run(
          seed.id,
          prov.provision_ref,
          prov.part ?? null,
          prov.chapter ?? null,
          prov.section,
          prov.title ?? null,
          prov.content,
          prov.metadata ? JSON.stringify(prov.metadata) : null,
        );
        totalProvisions++;

        const provisionId = Number(insertResult.lastInsertRowid);
        const extractedRefs = extractEuReferences(prov.content);
        if (extractedRefs.length > 0) {
          const sourceId = `${seed.id}:${prov.provision_ref}`;
          const lastVerified = new Date().toISOString();

          for (const ref of extractedRefs) {
            const shortName = ref.euDocumentId.includes(':')
              ? `${ref.type === 'regulation' ? 'Regulation' : 'Directive'} ${ref.year}/${ref.number}`
              : ref.euDocumentId;

            const eurLexType = ref.type === 'regulation' ? 'reg' : 'dir';
            const eurLexUrl = ref.community === 'AU' || ref.community === 'ECOWAS'
              ? null
              : `https://eur-lex.europa.eu/eli/${eurLexType}/${ref.year}/${ref.number}/oj`;

            const euInsert = insertEuDocument.run(
              ref.euDocumentId,
              ref.type,
              ref.year,
              ref.number,
              ref.community,
              shortName,
              shortName,
              eurLexUrl,
              'Auto-extracted from Ghana statute text',
            );
            if (euInsert.changes > 0) {
              totalEuDocuments++;
            }

            const primaryKey = `${seed.id}:${ref.euDocumentId}`;
            const isPrimary =
              ref.referenceType === 'implements' && !primaryImplementationByDocument.has(primaryKey)
                ? 1
                : 0;
            if (isPrimary === 1) {
              primaryImplementationByDocument.add(primaryKey);
            }

            try {
              const refInsert = insertEuReference.run(
                'provision',
                sourceId,
                seed.id,
                provisionId,
                ref.euDocumentId,
                ref.euArticle,
                ref.referenceType,
                ref.referenceContext,
                ref.fullCitation,
                isPrimary,
                isPrimary === 1 ? 'complete' : 'unknown',
                lastVerified,
              );
              if (refInsert.changes > 0) {
                totalEuReferences++;
              }
            } catch {
              // Ignore duplicate references that violate UNIQUE constraints.
            }
          }
        }
      }

      for (const def of seed.definitions ?? []) {
        try {
          insertDefinition.run(
            seed.id,
            def.term,
            def.definition,
            def.source_provision ?? null,
          );
          totalDefs++;
        } catch {
          // Ignore duplicate definitions
        }
      }
    }
  });

  loadAll();

  // Write build metadata
  const insertMeta = db.prepare('INSERT INTO db_metadata (key, value) VALUES (?, ?)');
  const writeMeta = db.transaction(() => {
    insertMeta.run('tier', 'free');
    insertMeta.run('schema_version', '2');
    insertMeta.run('built_at', new Date().toISOString());
    insertMeta.run('builder', 'build-db.ts');
    insertMeta.run('jurisdiction', 'GH');
    insertMeta.run('source', 'ghalii.org');
    insertMeta.run('licence', 'GhanaLII open access');
  });
  writeMeta();

  // CRITICAL: Set journal_mode to DELETE for WASM compatibility
  db.pragma('journal_mode = DELETE');

  db.exec('ANALYZE');
  db.exec('VACUUM');
  db.close();

  const size = fs.statSync(DB_PATH).size;
  console.log(
    `\nBuild complete: ${totalDocs} documents, ${totalProvisions} provisions, ` +
    `${totalDefs} definitions, ${totalEuDocuments} EU/intl documents, ${totalEuReferences} intl references`
  );
  if (emptyDocs > 0) {
    console.log(`  ${emptyDocs} documents with no provisions (content unavailable).`);
  }
  if (totalDuplicateRefs > 0) {
    console.log(
      `Data quality: ${totalDuplicateRefs} duplicate refs detected ` +
      `(${totalConflictingDuplicates} with conflicting text).`
    );
  }
  console.log(`Output: ${DB_PATH} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

buildDatabase();
