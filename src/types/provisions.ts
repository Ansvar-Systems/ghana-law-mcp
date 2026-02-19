export interface LegalProvision {
  id: number;
  document_id: string;
  provision_ref: string;
  part?: string;
  chapter?: string;
  section: string;
  title?: string;
  content: string;
}

export type ProvisionRef = string;
