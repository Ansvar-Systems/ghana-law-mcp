export type CitationFormat = 'full' | 'short' | 'pinpoint';

export interface ParsedCitation {
  valid: boolean;
  type: string;
  title?: string;
  act_number?: number;
  year?: number;
  section?: string;
  subsection?: string;
  paragraph?: string;
  error?: string;
}

export interface ValidationResult {
  citation: ParsedCitation;
  document_exists: boolean;
  provision_exists: boolean;
  document_title?: string;
  status?: string;
  warnings: string[];
}
