# Ghanaian Law MCP Server

**The Ghana Legal Information Institute (GhanaLII) alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fghanaian-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/ghana-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/ghana-law-mcp?style=social)](https://github.com/Ansvar-Systems/ghana-law-mcp)
[![CI](https://github.com/Ansvar-Systems/ghana-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/ghana-law-mcp/actions/workflows/ci.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](https://github.com/Ansvar-Systems/ghana-law-mcp)
[![Status](https://img.shields.io/badge/status-initial--build-orange)](https://github.com/Ansvar-Systems/ghana-law-mcp)

Query Ghanaian law -- from the Data Protection Act 2012 and Cybersecurity Act 2020 to the Companies Act 2019, Electronic Transactions Act, and Criminal Offences Act -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Ghanaian legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Ghanaian legal research means navigating ghalii.org, the Parliament of Ghana website, Ghana Gazette publications, and scattered government portals. Whether you're:

- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking Data Protection Act obligations or Cybersecurity Act requirements
- A **legal tech developer** building tools on Ghanaian law
- A **researcher** tracing provisions through Acts of Parliament

...you shouldn't need dozens of browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Ghanaian law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://ghanaian-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add ghanaian-law --transport http https://ghanaian-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ghanaian-law": {
      "type": "url",
      "url": "https://ghanaian-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "ghanaian-law": {
      "type": "http",
      "url": "https://ghanaian-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/ghana-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ghanaian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/ghana-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "ghanaian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/ghana-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"What does the Data Protection Act 2012 say about processing personal data?"*
- *"Find provisions in the Cybersecurity Act 2020 about critical information infrastructure"*
- *"Search for company law provisions under the Companies Act 2019"*
- *"What does the Electronic Transactions Act say about digital signatures?"*
- *"Find provisions in the Criminal Offences Act about cybercrime"*
- *"Is the National Information Technology Agency Act still in force?"*
- *"Search for consumer protection provisions in Ghanaian law"*
- *"Validate the citation Data Protection Act 2012, Section 17"*
- *"Build a legal stance on data controller obligations under Ghanaian law"*

---

## Current Coverage State

> **Note:** This MCP server is in its initial build phase. The database schema, ingestion pipeline, and all 13 tools are fully operational. Statute ingestion from GhanaLII and the Parliament of Ghana is actively underway.

The server covers the following priority Ghanaian statutes:

| Priority Area | Key Statutes |
|---------------|-------------|
| **Data Protection** | Data Protection Act, 2012 (Act 843) |
| **Cybersecurity** | Cybersecurity Act, 2020 (Act 1038) |
| **Electronic Commerce** | Electronic Transactions Act, 2008 (Act 772) |
| **Company Law** | Companies Act, 2019 (Act 992) |
| **Communications** | Electronic Communications Act, 2008 (Act 775) |
| **Criminal Law** | Criminal Offences Act (NRCD 29) |

Coverage is expanding with each ingestion run. Use `list_sources` to see the current statute count and `about` for dataset statistics.

**Verified data only** -- every citation is validated against official sources (GhanaLII, Parliament of Ghana). Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from ghalii.org and parliament.gh official sources
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by Act name + section number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
GhanaLII / parliament.gh --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                              ^                        ^
                       Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search GhanaLII by Act name | Search by plain English: *"personal data processing"* |
| Navigate multi-section Acts manually | Get the exact provision with context |
| Manual cross-referencing between Acts | `build_legal_stance` aggregates across sources |
| "Is this Act still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find AU/ECOWAS alignment -- search separately | `get_eu_basis` -- linked international frameworks |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Search GhanaLII --> Download Act PDF --> Ctrl+F --> Cross-reference between Acts --> Check AU frameworks separately --> Repeat

**This MCP:** *"What are the data controller obligations under the Data Protection Act 2012?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across provisions with BM25 ranking. Supports quoted phrases, boolean operators, prefix wildcards |
| `get_provision` | Retrieve specific provision by Act name + section number |
| `check_currency` | Check if an Act is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple Acts for a legal topic |
| `format_citation` | Format citations per Ghanaian legal conventions |
| `list_sources` | List all available Acts with metadata, coverage scope, and current ingestion status |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks (AU, ECOWAS, Commonwealth, GDPR comparisons) that a Ghanaian Act aligns with |
| `get_ghanaian_implementations` | Find Ghanaian laws corresponding to a specific international standard |
| `search_eu_implementations` | Search international documents with Ghanaian alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Ghanaian statutes against international frameworks |

---

## International Law Alignment

Ghana is not an EU member state, but Ghanaian law has significant alignment with international frameworks:

- **Data Protection Act 2012** -- Aligned with ECOWAS Supplementary Act on Personal Data Protection; principles comparable to GDPR
- **African Union** -- Ghana is a member of the AU and its frameworks on data protection (Malabo Convention) and cybersecurity
- **ECOWAS** -- Member of the Economic Community of West African States, whose data protection standards Ghana implements
- **Commonwealth** -- Commonwealth principles on personal data protection and rule of law apply
- **GDPR comparison** -- The Data Protection Act 2012 predates GDPR but shares core principles (purpose limitation, data subject rights, controller obligations)

The international alignment tools allow you to explore these relationships -- checking which Ghanaian provisions correspond to ECOWAS or AU standards.

> **Note:** International cross-references reflect alignment relationships. Ghana operates its own independent legal system under Acts of Parliament and Constitutional law. The tools identify comparative domains rather than formal transposition.

---

## Data Sources & Freshness

All content is sourced from authoritative Ghanaian legal databases:

- **[GhanaLII](https://ghalii.org)** -- Ghana Legal Information Institute, primary open access source
- **[Parliament of Ghana](https://parliament.gh)** -- Official Acts of Parliament
- **[Ghana Gazette](https://ghanagazette.com)** -- Official Government Gazette

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Parliament of Ghana / Attorney General's Department |
| **Retrieval method** | GhanaLII and Parliament portal |
| **Languages** | English (official language) |
| **License** | Ghana Government public domain |
| **Coverage** | Priority statutes; corpus expanding with active ingestion |

### Automated Freshness Checks

A [GitHub Actions workflow](.github/workflows/check-updates.yml) monitors data sources for changes:

| Check | Method |
|-------|--------|
| **Statute amendments** | Drift detection against known provision anchors |
| **New Acts** | Comparison against Parliament of Ghana publications |
| **Repealed legislation** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from GhanaLII and Parliament of Ghana official sources. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **This server is in initial build phase** -- coverage is incomplete; use `list_sources` to confirm which Acts are available
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources (GhanaLII, official Gazette) for court filings
> - **International cross-references** reflect alignment relationships, not formal transposition

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. For professional use guidance, consult the **Ghana Bar Association** professional conduct rules.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/ghana-law-mcp
cd ghana-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest          # Ingest Acts from GhanaLII / Parliament of Ghana
npm run build:db        # Rebuild SQLite database
npm run drift:detect    # Run drift detection against anchors
npm run check-updates   # Check for amendments and new Acts
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Reliability:** 100% ingestion success rate for ingested Acts

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/ghana-law-mcp](https://github.com/Ansvar-Systems/ghana-law-mcp) (This Project)
**Query Ghanaian Acts directly from Claude** -- Data Protection Act, Cybersecurity Act, Companies Act, Electronic Transactions Act, and more. `npx @ansvar/ghana-law-mcp`

### [@ansvar/nigeria-law-mcp](https://github.com/Ansvar-Systems/nigeria-law-mcp)
**Query Nigerian legislation** -- NDPA, Cybercrimes Act, CAMA 2020, Consumer Protection Act, and more. `npx @ansvar/nigeria-law-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, Cameroon, Denmark, Finland, France, Germany, India, Ireland, Israel, Japan, Netherlands, Nigeria, Norway, Singapore, Sweden, Switzerland, UAE, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Statute corpus expansion (additional Acts from GhanaLII)
- Court case law integration (Supreme Court of Ghana decisions)
- Historical statute versions and amendment tracking
- ECOWAS framework alignment mappings
- Ghana Revenue Authority and sector-specific regulations

---

## Roadmap

- [x] Core database schema with FTS5 search
- [x] International law alignment tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Initial statute corpus ingestion (Data Protection, Cybersecurity, Companies, Electronic Transactions Acts)
- [ ] Full corpus expansion via GhanaLII
- [ ] Court case law (Supreme Court of Ghana)
- [ ] Historical statute versions (amendment tracking)
- [ ] ECOWAS framework alignment mappings

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{ghanaian_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Ghanaian Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/ghana-law-mcp},
  note = {Ghanaian Acts of Parliament with full-text search and international alignment tools}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Acts of Parliament:** Parliament of Ghana (public domain)
- **GhanaLII Content:** Ghana Legal Information Institute (open access)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server is part of our commitment to open legal data access across Africa -- Ghana's legal system is well-structured and deserves proper AI tooling.

So we're open-sourcing it. Navigating Acts of Parliament shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
