-- Phase 1: Integration Foundation Database Schema
-- This migration adds tables for external integrations, data enrichment tracking, and webhook logging

-- Integration configuration per tenant (API keys, credentials)
CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL,  -- 'experian', 'plaid', 'socure', 'textract', 'kbb', 'twilio', 'sendgrid'
  is_enabled BOOLEAN DEFAULT false,
  api_key_encrypted TEXT,
  endpoint_url VARCHAR(500),
  settings JSONB DEFAULT '{}',  -- Provider-specific configuration
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, provider)
);

-- Store integration execution results
CREATE TABLE IF NOT EXISTS integration_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  task_id UUID REFERENCES application_tasks(id) ON DELETE SET NULL,
  provider VARCHAR(100) NOT NULL,
  request_data JSONB,
  response_data JSONB,
  status VARCHAR(50) DEFAULT 'pending',  -- 'success', 'failed', 'partial', 'pending'
  error_message TEXT,
  confidence_score DECIMAL(5,2),  -- 0.00 to 100.00
  executed_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_integration_results_application (application_id),
  INDEX idx_integration_results_provider (provider)
);

-- Track data enrichment (what fields were auto-populated)
CREATE TABLE IF NOT EXISTS data_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  source VARCHAR(100) NOT NULL,  -- 'experian', 'plaid', 'socure', 'textract', 'kbb', 'manual'
  field_path VARCHAR(255) NOT NULL,  -- JSON path: 'applicant_data.credit_score'
  old_value JSONB,
  new_value JSONB,
  confidence_score DECIMAL(5,2),  -- 0.00 to 100.00
  enriched_at TIMESTAMP DEFAULT NOW(),
  enriched_by VARCHAR(100),  -- 'system' or user_id
  INDEX idx_data_enrichments_application (application_id),
  INDEX idx_data_enrichments_source (source)
);

-- Webhook logs for debugging and audit trail
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(100) NOT NULL,  -- 'n8n', 'experian', 'plaid', etc.
  event_type VARCHAR(100),
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_webhook_logs_source (source),
  INDEX idx_webhook_logs_created (created_at)
);

-- Workflow execution logs (track n8n workflow runs)
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_workflow_id UUID REFERENCES organization_workflows(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  task_id UUID REFERENCES application_tasks(id) ON DELETE SET NULL,
  trigger_event VARCHAR(100),  -- 'application_submitted', 'task_started', 'document_uploaded'
  status VARCHAR(50) DEFAULT 'running',  -- 'running', 'completed', 'failed', 'timeout'
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT,
  execution_data JSONB DEFAULT '{}',
  INDEX idx_workflow_executions_org_workflow (organization_workflow_id),
  INDEX idx_workflow_executions_application (application_id),
  INDEX idx_workflow_executions_status (status)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_integration_configs_org ON integration_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_enabled ON integration_configs(is_enabled) WHERE is_enabled = true;

-- Comments for documentation
COMMENT ON TABLE integration_configs IS 'Stores tenant-specific integration credentials and settings';
COMMENT ON TABLE integration_results IS 'Logs all external API calls and their responses';
COMMENT ON TABLE data_enrichments IS 'Tracks which application fields were auto-populated from integrations';
COMMENT ON TABLE webhook_logs IS 'Audit trail for all incoming webhook calls';
COMMENT ON TABLE workflow_executions IS 'Tracks n8n workflow execution history per application';

-- Sample data for testing (optional - remove in production)
-- INSERT INTO integration_configs (organization_id, provider, is_enabled, settings) 
-- VALUES 
--   ((SELECT id FROM organizations LIMIT 1), 'experian', false, '{"environment": "sandbox"}'),
--   ((SELECT id FROM organizations LIMIT 1), 'plaid', false, '{"environment": "sandbox"}');
