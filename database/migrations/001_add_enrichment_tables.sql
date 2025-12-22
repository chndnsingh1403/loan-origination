-- Migration: Add Phase 1, 2, and 3 tables adapted to existing schema
-- Adapted to use: tenant_id (not organization_id), loan_applications (not applications)

-- Phase 1: Integration Foundation Tables

-- Integration configuration per tenant
CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR NOT NULL,  -- 'experian', 'plaid', 'socure', etc.
  is_enabled BOOLEAN DEFAULT false,
  api_key_encrypted TEXT,
  endpoint_url VARCHAR,
  settings JSONB,  -- Provider-specific config
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3),
  UNIQUE(tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_tenant ON integration_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_enabled ON integration_configs(is_enabled) WHERE is_enabled = true;

-- Store integration execution results
CREATE TABLE IF NOT EXISTS integration_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  provider VARCHAR NOT NULL,
  request_data JSONB,
  response_data JSONB,
  status VARCHAR NOT NULL,  -- 'success', 'failed', 'partial'
  error_message TEXT,
  confidence_score DECIMAL(5,2),
  executed_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_integration_results_application ON integration_results(application_id);
CREATE INDEX IF NOT EXISTS idx_integration_results_provider ON integration_results(provider);
CREATE INDEX IF NOT EXISTS idx_integration_results_status ON integration_results(status);

-- Track data enrichment
CREATE TABLE IF NOT EXISTS data_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  source VARCHAR NOT NULL,  -- 'experian', 'plaid', 'socure', 'textract', 'kbb'
  field_path VARCHAR NOT NULL,  -- JSON path: 'form_data.credit_score'
  old_value JSONB,
  new_value JSONB,
  confidence_score DECIMAL(5,2),
  enriched_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  enriched_by VARCHAR  -- 'system' or user_id
);

CREATE INDEX IF NOT EXISTS idx_data_enrichments_application ON data_enrichments(application_id);
CREATE INDEX IF NOT EXISTS idx_data_enrichments_source ON data_enrichments(source);
CREATE INDEX IF NOT EXISTS idx_data_enrichments_enriched_at ON data_enrichments(enriched_at DESC);

-- Webhook logs for debugging
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR NOT NULL,  -- 'n8n', 'external'
  event_type VARCHAR,
  payload JSONB,
  response_status INTEGER,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- Phase 2: Workflow Management Tables

-- Store tenant-specific workflow configurations
CREATE TABLE IF NOT EXISTS tenant_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_name VARCHAR NOT NULL,  -- 'Application Processing', 'Underwriting', 'Closing'
  workflow_type VARCHAR NOT NULL,  -- 'application_submitted', 'task_started', 'document_uploaded'
  n8n_workflow_id VARCHAR,  -- n8n's internal workflow ID
  is_active BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false,  -- true if tenant customized
  template_id VARCHAR,  -- Reference to base template
  version INTEGER DEFAULT 1,
  config JSONB,  -- Workflow-specific parameters
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3),
  UNIQUE(tenant_id, workflow_type)
);

CREATE INDEX IF NOT EXISTS idx_tenant_workflows_tenant ON tenant_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_workflows_active ON tenant_workflows(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tenant_workflows_type ON tenant_workflows(workflow_type);

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_workflow_id UUID NOT NULL REFERENCES tenant_workflows(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  trigger_event VARCHAR NOT NULL,
  status VARCHAR NOT NULL,  -- 'running', 'completed', 'failed'
  started_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP(3),
  error_message TEXT,
  execution_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant_workflow ON workflow_executions(tenant_workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_application ON workflow_executions(application_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

-- Comments
COMMENT ON TABLE integration_configs IS 'Stores tenant-specific integration provider configurations with encrypted API keys';
COMMENT ON TABLE integration_results IS 'Logs all integration API calls and responses for audit trail';
COMMENT ON TABLE data_enrichments IS 'Tracks all automated data enrichments with source and confidence scores';
COMMENT ON TABLE webhook_logs IS 'Debugging log for all webhook calls from n8n and external sources';
COMMENT ON TABLE tenant_workflows IS 'Tenant-customized n8n workflows based on templates';
COMMENT ON TABLE workflow_executions IS 'Execution history of all workflow runs per application';

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
