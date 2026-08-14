ALTER TABLE ncr_records ADD COLUMN IF NOT EXISTS guideline text;

ALTER TABLE audit_documents ADD COLUMN IF NOT EXISTS content jsonb;
