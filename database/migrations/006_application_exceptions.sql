-- Migration 006: Application Exceptions Table
-- Purpose: Track issues, flags, and exceptions that require attention during application processing

CREATE TABLE IF NOT EXISTS application_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    
    -- Exception details
    type VARCHAR(100) NOT NULL,  -- e.g., 'credit_score_low', 'income_verification_failed', 'duplicate_application'
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    message TEXT NOT NULL,
    details JSONB,  -- Additional context and data
    
    -- Resolution tracking
    resolved BOOLEAN DEFAULT false,
    resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_application_exceptions_application ON application_exceptions(application_id);
CREATE INDEX IF NOT EXISTS idx_application_exceptions_severity ON application_exceptions(severity);
CREATE INDEX IF NOT EXISTS idx_application_exceptions_resolved ON application_exceptions(resolved);
CREATE INDEX IF NOT EXISTS idx_application_exceptions_type ON application_exceptions(type);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_exception_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_exception_timestamp
    BEFORE UPDATE ON application_exceptions
    FOR EACH ROW
    EXECUTE FUNCTION update_exception_updated_at();

COMMENT ON TABLE application_exceptions IS 'Tracks issues, flags, and exceptions that require attention during loan application processing';
COMMENT ON COLUMN application_exceptions.type IS 'Exception category (e.g., credit_score_low, duplicate_application)';
COMMENT ON COLUMN application_exceptions.severity IS 'Impact level: info, warning, error, critical';
COMMENT ON COLUMN application_exceptions.details IS 'Additional structured data about the exception';
