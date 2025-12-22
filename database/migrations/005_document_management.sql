-- Phase 5: Document Management
-- Add OCR and processing fields to application_documents table

-- Add OCR-related columns to existing application_documents table
ALTER TABLE application_documents
ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(50) DEFAULT 'pending' 
  CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed', 'not_applicable')),
ADD COLUMN IF NOT EXISTS extracted_data JSONB,
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processing_error TEXT,
ADD COLUMN IF NOT EXISTS storage_url VARCHAR(1000);

-- Create index for OCR status queries
CREATE INDEX IF NOT EXISTS idx_documents_ocr_status ON application_documents(ocr_status);

-- Update existing documents to set ocr_status appropriately
UPDATE application_documents 
SET ocr_status = 'not_applicable' 
WHERE mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/tiff')
  AND ocr_status = 'pending';

-- Add comments for documentation
COMMENT ON COLUMN application_documents.ocr_status IS 'Status of OCR processing: pending, processing, completed, failed, not_applicable';
COMMENT ON COLUMN application_documents.extracted_data IS 'JSON data extracted from document via OCR (AWS Textract)';
COMMENT ON COLUMN application_documents.confidence_score IS 'OCR confidence score (0-100)';
COMMENT ON COLUMN application_documents.processed_at IS 'Timestamp when OCR processing completed';
COMMENT ON COLUMN application_documents.processing_error IS 'Error message if OCR processing failed';
COMMENT ON COLUMN application_documents.storage_url IS 'Pre-signed URL for document access (temporary)';
