-- Migration: Integration Foundation
-- Description: Add tables for external integrations, n8n workflows, and data enrichment tracking
-- Phase: 1 - Integration Foundation

-- Integration configuration per tenant
CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL,  -- 'experian', 'plaid', 'socure', 'textract', 'kbb', etc.
  is_enabled BOOLEAN DEFAULT false,
  api_key_encrypted TEXT,
  endpoint_url VARCHAR(500),
  settings JSONB DEFAULT '{}',  -- Provider-specific config
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, provider)
);

-- Store integration execution results
CREATE TABLE IF NOT EXISTS integration_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  task_id UUID REFERENCES application_tasks(id),
  provider VARCHAR(100) NOT NULL,
  request_data JSONB,
  response_data JSONB,
  status VARCHAR(50),  -- 'success', 'failed', 'partial'
  error_message TEXT,
  confidence_score DECIMAL(5,2),
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Track data enrichment from integrations
CREATE TABLE IF NOT EXISTS data_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  source VARCHAR(100),  -- 'experian', 'plaid', 'socure', 'textract', 'kbb'
  field_path VARCHAR(255),  -- JSON path: 'applicant_data.credit_score'
  old_value JSONB,
  new_value JSONB,
  confidence_score DECIMAL(5,2),
  enriched_at TIMESTAMP DEFAULT NOW(),
  enriched_by VARCHAR(100)  -- 'system' or user_id
);

-- Store tenant-specific workflow configurations
CREATE TABLE IF NOT EXISTS organization_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_name VARCHAR(200) NOT NULL,  -- 'Application Processing', 'Underwriting', 'Closing'
  workflow_type VARCHAR(100) NOT NULL,  -- 'application_submitted', 'task_started', 'document_uploaded'
  n8n_workflow_id VARCHAR(100),  -- n8n's internal workflow ID
  is_active BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false,  -- true if tenant customized
  template_id VARCHAR(100),  -- Reference to base template
  version INTEGER DEFAULT 1,
  config JSONB DEFAULT '{}',  -- Workflow-specific parameters
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, workflow_type)
);

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_workflow_id UUID REFERENCES organization_workflows(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  task_id UUID REFERENCES application_tasks(id),
  trigger_event VARCHAR(100),
  status VARCHAR(50),  -- 'running', 'completed', 'failed'
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT,
  execution_data JSONB
);

-- Webhook logs for debugging
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(100),  -- 'n8n', 'external'
  event_type VARCHAR(100),
  payload JSONB,
  response_status INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_integration_configs_org ON integration_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_provider ON integration_configs(provider);
CREATE INDEX IF NOT EXISTS idx_integration_results_app ON integration_results(application_id);
CREATE INDEX IF NOT EXISTS idx_integration_results_task ON integration_results(task_id);
CREATE INDEX IF NOT EXISTS idx_data_enrichments_app ON data_enrichments(application_id);
CREATE INDEX IF NOT EXISTS idx_data_enrichments_source ON data_enrichments(source);
CREATE INDEX IF NOT EXISTS idx_org_workflows_org ON organization_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_workflows_type ON organization_workflows(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_app ON workflow_executions(application_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_configs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integration_configs_update_timestamp
    BEFORE UPDATE ON integration_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_configs_timestamp();

CREATE OR REPLACE FUNCTION update_organization_workflows_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organization_workflows_update_timestamp
    BEFORE UPDATE ON organization_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_workflows_timestamp();
