-- Migration 007: Notification System
-- Create tables for managing notification templates and logs

-- Notification templates configured by tenant admins
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,  -- 'application_submitted', 'approved', 'declined', 'under_review', 'documents_required', 'task_completed'
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  recipient_role VARCHAR(50) NOT NULL CHECK (recipient_role IN ('broker', 'customer', 'underwriter', 'tenant_admin')),
  subject VARCHAR(500),  -- For email notifications
  body_template TEXT NOT NULL,  -- Handlebars template with variables like {{application_number}}, {{applicant_name}}, {{status}}
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id),
  UNIQUE(organization_id, event_type, channel, recipient_role)
);

-- Log all sent notifications for audit trail
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(50),
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(500),
  body TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  external_message_id VARCHAR(255)  -- ID from email/SMS provider
);

-- Notification settings per organization
CREATE TABLE IF NOT EXISTS notification_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  email_provider VARCHAR(50) DEFAULT 'sendgrid' CHECK (email_provider IN ('sendgrid', 'ses', 'smtp')),
  email_api_key_encrypted TEXT,
  email_from_address VARCHAR(255),
  email_from_name VARCHAR(255),
  sms_provider VARCHAR(50) DEFAULT 'twilio' CHECK (sms_provider IN ('twilio', 'sns')),
  sms_api_key_encrypted TEXT,
  sms_account_sid VARCHAR(255),
  sms_from_number VARCHAR(50),
  is_email_enabled BOOLEAN DEFAULT false,
  is_sms_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_notification_templates_org ON notification_templates(organization_id);
CREATE INDEX idx_notification_templates_event ON notification_templates(event_type);
CREATE INDEX idx_notification_logs_app ON notification_logs(application_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created ON notification_logs(created_at);

-- Insert default notification templates for organizations
-- This will be done via API when tenant admin sets up notifications

COMMENT ON TABLE notification_templates IS 'Configurable notification templates for various application events';
COMMENT ON TABLE notification_logs IS 'Audit log of all notifications sent through the system';
COMMENT ON TABLE notification_settings IS 'Email and SMS provider configuration per organization';
