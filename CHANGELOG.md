# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-02-22
### Added
- `data/census.json` — full corpus census (30 laws, 409 provisions)
- Streamable HTTP transport in `server.json` (`https://ghana-law-mcp.vercel.app/mcp`)
- Dual transport support (stdio + streamable-http) in MCP Registry metadata

### Changed
- Bumped version to 1.1.0 across `package.json` and `server.json`

## [1.0.0] - 2026-02-22
### Added
- Initial release of Ghana Law MCP
- `search_legislation` tool for full-text search across all Ghanaian statutes
- `get_provision` tool for retrieving specific articles/sections
- `get_provision_eu_basis` tool for international framework cross-references
- `validate_citation` tool for legal citation validation
- `check_statute_currency` tool for checking statute amendment status
- `list_laws` tool for browsing available legislation
- Contract tests with 12 golden test cases
- Drift detection with 6 stable provision anchors
- Health and version endpoints
- Vercel deployment (single tier bundled)
- npm package with stdio transport
- MCP Registry publishing

[Unreleased]: https://github.com/Ansvar-Systems/ghana-law-mcp/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Ansvar-Systems/ghana-law-mcp/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Ansvar-Systems/ghana-law-mcp/releases/tag/v1.0.0
