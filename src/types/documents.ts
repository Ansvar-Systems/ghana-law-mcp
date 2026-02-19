export type DocumentType = 'act' | 'legislative_instrument' | 'constitutional_instrument' | 'executive_instrument';
export type DocumentStatus = 'in_force' | 'amended' | 'repealed';

export interface LegalDocument {
  id: string;
  type: DocumentType;
  title: string;
  short_name?: string;
  act_number?: number;
  year: number;
  status: DocumentStatus;
  issued_date?: string;
  in_force_date?: string;
  url?: string;
}
