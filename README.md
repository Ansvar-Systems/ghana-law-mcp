# Ghana Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/ghana-law-mcp)](https://www.npmjs.com/package/@ansvar/ghana-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/ghana-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/ghana-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/ghana-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/ghana-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to Ghanaian legislation, including data protection, cybersecurity, electronic transactions, companies, and communications law with full-text search.

## Deployment Tier

**SMALL** -- Single tier, bundled SQLite database shipped with the npm package.

**Estimated database size:** ~50-100 MB (Ghana has a smaller legal corpus compared to larger African jurisdictions)

## Key Legislation Covered

| Act | Year | Act Number | Significance |
|-----|------|-----------|-------------|
| **Data Protection Act** | 2012 | Act 843 | One of the first comprehensive data protection laws in Africa; established the Data Protection Commission |
| **Cybersecurity Act** | 2020 | Act 1038 | Established the Cyber Security Authority as a dedicated national cybersecurity body |
| **Electronic Transactions Act** | 2008 | Act 772 | Governs electronic commerce, electronic signatures, and electronic records |
| **Companies Act** | 2019 | Act 992 | Modern company law framework replacing the Companies Code 1963 (Act 179) |
| **National Communications Authority Act** | 2008 | Act 769 | Regulates telecommunications and electronic communications sector |
| **Right to Information Act** | 2019 | Act 989 | Enacted after a 20-year advocacy campaign; provides access to government-held information |
| **Constitution of Ghana** | 1992 | -- | Supreme law; Article 18(2) guarantees the right to privacy |

## Regulatory Context

- **Data Protection Supervisory Authority:** Data Protection Commission (DPC), established under the Data Protection Act 2012 (Act 843)
- **Ghana was one of the first African countries** to enact a comprehensive data protection law (2012), predating the EU GDPR by six years
- The DPA 2012 was influenced by the EU Data Protection Directive 95/46/EC and shares many principles later codified in the GDPR
- **Cyber Security Authority** was established under the Cybersecurity Act 2020 (Act 1038) as a dedicated national cybersecurity body
- Ghana is a signatory to the African Union Convention on Cyber Security and Personal Data Protection (Malabo Convention, 2014)
- Ghana uses a common law legal system inherited from British colonial administration
- English is Ghana's official and sole legal language

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [GhanaLII](https://ghalii.org) | AfricanLII | HTML Scrape | On change | Free Access (AfricanLII) | All Acts of Parliament, Legislative Instruments, Constitutional Instruments, superior court decisions |
| [Laws of Ghana](https://www.ghana.gov.gh) | Ghana Publishing Company | PDF | On change | Government Public Data | Gazette versions of Acts, Legislative Instruments, Constitutional Instruments |
| [Data Protection Commission](https://dpc.org.gh) | DPC, Republic of Ghana | HTML Scrape | On change | Government Public Data | DPC guidelines, registration requirements, enforcement notices |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Installation

```bash
npm install -g @ansvar/ghana-law-mcp
```

## Usage

### As stdio MCP server

```bash
ghana-law-mcp
```

### In Claude Desktop / MCP client configuration

```json
{
  "mcpServers": {
    "ghana-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/ghana-law-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_provision` | Retrieve a specific section/article from a Ghanaian Act |
| `search_legislation` | Full-text search across all Ghanaian legislation |
| `get_provision_eu_basis` | Cross-reference lookup for international framework relationships (GDPR, Malabo Convention, etc.) |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Run all validation
npm run validate

# Build database from sources
npm run build:db

# Start server
npm start
```

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 3 article retrieval tests (Data Protection Act 2012, Cybersecurity Act 2020, Companies Act 2019)
- 3 search tests (personal data, cybersecurity, electronic transaction)
- 2 citation roundtrip tests (official URL patterns)
- 2 cross-reference tests (GDPR/EU Directive 95/46 relationship, AU Malabo Convention)
- 2 negative tests (non-existent Act, malformed section)

Run with: `npm run test:contract`

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure policy.

Report data errors: [Open an issue](https://github.com/Ansvar-Systems/ghana-law-mcp/issues/new?template=data-error.md)

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

---

Built by [Ansvar Systems](https://ansvar.eu) -- Cybersecurity compliance through AI-powered analysis.
