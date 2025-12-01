-- Originate Lite Database Schema
-- PostgreSQL schema for complete loan origination system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================== Core System Tables =====================

-- Organizations/Tenants
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    branding JSONB DEFAULT '{}',
    feature_flags JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users with role-based access
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'tenant_admin', 'broker', 'underwriter', 'processor')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions for authentication
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    logout_reason VARCHAR(50), -- 'manual', 'timeout', 'expired', 'revoked'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email verification tokens for user account activation
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id) -- One active verification per user
);

-- Organization invitations for multi-tenant user onboarding
CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'tenant_admin', 'broker', 'underwriter', 'processor')),
    token VARCHAR(255) UNIQUE NOT NULL,
    invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_email VARCHAR(255),
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs for security and compliance tracking
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'user_signup', 'email_verified', 'login', 'logout', etc.
    resource_type VARCHAR(100), -- 'user', 'application', 'lead', etc.
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update users table to support additional sign-up fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_source VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;

-- Role Definitions (custom roles beyond the basic 5)
CREATE TABLE IF NOT EXISTS role_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false, -- Built-in roles that can't be deleted
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Permissions catalog
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'users.create', 'loans.approve'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- e.g., 'User Management', 'Loan Processing'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Role to Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_definition_id UUID REFERENCES role_definitions(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_definition_id, permission_id)
);

-- User custom role assignments (in addition to base role)
CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_definition_id UUID REFERENCES role_definitions(id) ON DELETE CASCADE,
    assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, role_definition_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_organization_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_expires_at ON organization_invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);

CREATE INDEX IF NOT EXISTS idx_role_definitions_organization_id ON role_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_definition_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role_id ON user_role_assignments(role_definition_id);

-- ===================== Product Configuration =====================

-- Loan products (mortgage, auto, personal, etc.)
CREATE TABLE loan_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    product_type VARCHAR(100) NOT NULL CHECK (product_type IN ('personal', 'auto', 'mortgage', 'business')),
    min_amount DECIMAL(15,2) NOT NULL,
    max_amount DECIMAL(15,2) NOT NULL,
    min_term_months INTEGER NOT NULL,
    max_term_months INTEGER NOT NULL,
    base_rate DECIMAL(5,4) NOT NULL, -- Base interest rate (e.g., 0.0599 for 5.99%)
    max_rate DECIMAL(5,4) NOT NULL, -- Maximum interest rate (e.g., 0.1599 for 15.99%)
    processing_fee DECIMAL(10,2) DEFAULT 0, -- Processing fee in dollars
    credit_score_requirement INTEGER DEFAULT 600, -- Minimum credit score
    income_requirement DECIMAL(15,2) DEFAULT 0, -- Minimum annual income
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_amount_range CHECK (min_amount < max_amount),
    CONSTRAINT valid_term_range CHECK (min_term_months < max_term_months),
    CONSTRAINT valid_rate_range CHECK (base_rate < max_rate)
);

-- Application templates/forms
CREATE TABLE application_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    loan_product_id UUID REFERENCES loan_products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version INTEGER DEFAULT 1,
    form_schema JSONB NOT NULL, -- JSON schema for form fields
    validation_rules JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================== Lead Management =====================

-- Marketing leads (before application)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    assigned_broker_id UUID REFERENCES users(id) ON DELETE SET NULL,
    loan_product_id UUID REFERENCES loan_products(id) ON DELETE SET NULL,
    
    -- Contact information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    
    -- Lead details
    requested_amount DECIMAL(15,2),
    purpose TEXT,
    source VARCHAR(100), -- 'website', 'referral', 'advertising', etc.
    source_details JSONB DEFAULT '{}',
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    qualification_score INTEGER, -- 0-100
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    converted_at TIMESTAMP WITH TIME ZONE, -- When converted to application
    last_contacted TIMESTAMP WITH TIME ZONE
);

-- Lead activities/communications
CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL, -- 'call', 'email', 'meeting', 'note', 'status_change'
    subject VARCHAR(255),
    description TEXT,
    outcome VARCHAR(100), -- 'interested', 'not_interested', 'callback_requested', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================== Application Management =====================

-- Loan applications
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL, -- If converted from lead
    loan_product_id UUID REFERENCES loan_products(id) ON DELETE RESTRICT,
    template_id UUID REFERENCES application_templates(id) ON DELETE RESTRICT,
    assigned_broker_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_underwriter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Application details
    application_number VARCHAR(50) UNIQUE NOT NULL, -- Auto-generated
    requested_amount DECIMAL(15,2) NOT NULL,
    requested_term_months INTEGER NOT NULL,
    purpose TEXT,
    
    -- Applicant information (structured data from form)
    applicant_data JSONB NOT NULL DEFAULT '{}',
    
    -- Status and workflow
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft', 'submitted', 'under_review', 'additional_info_required',
        'underwriting', 'approved', 'declined', 'withdrawn', 'funded'
    )),
    stage VARCHAR(50) DEFAULT 'application' CHECK (stage IN (
        'application', 'verification', 'underwriting', 'approval', 'funding', 'closed'
    )),
    
    -- Approval details
    approved_amount DECIMAL(15,2),
    approved_rate DECIMAL(5,4), -- e.g., 0.0675 for 6.75%
    approved_term_months INTEGER,
    conditions TEXT,
    
    -- Important dates
    submitted_at TIMESTAMP WITH TIME ZONE,
    decision_date TIMESTAMP WITH TIME ZONE,
    funding_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document management
CREATE TABLE application_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    document_type VARCHAR(100) NOT NULL, -- 'income_verification', 'id_document', 'bank_statement', etc.
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path VARCHAR(500) NOT NULL, -- MinIO path
    
    -- Verification status
    is_verified BOOLEAN DEFAULT false,
    verified_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application status history
CREATE TABLE application_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    action VARCHAR(100) NOT NULL, -- 'created', 'submitted', 'status_changed', 'assigned', etc.
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    old_stage VARCHAR(50),
    new_stage VARCHAR(50),
    comment TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================== Underwriting & Decision Engine =====================

-- Underwriting queues
CREATE TABLE underwriting_queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB DEFAULT '{}', -- Auto-assignment rules
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queue assignments
CREATE TABLE queue_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_id UUID REFERENCES underwriting_queues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(queue_id, user_id)
);

-- Underwriting decisions
CREATE TABLE underwriting_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    underwriter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    decision VARCHAR(50) NOT NULL CHECK (decision IN ('approved', 'declined', 'refer', 'counter_offer')),
    decision_reason TEXT,
    risk_score INTEGER, -- 0-1000
    recommended_amount DECIMAL(15,2),
    recommended_rate DECIMAL(5,4),
    recommended_term_months INTEGER,
    conditions TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================== Workflow Engine =====================

-- Workflow definitions
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'application_processing', 'underwriting', 'funding'
    definition JSONB NOT NULL, -- Workflow steps, conditions, rules
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow instances (execution)
CREATE TABLE workflow_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE RESTRICT,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    
    current_step VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'paused')),
    context JSONB DEFAULT '{}', -- Runtime variables
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow step execution log
CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error_message TEXT,
    
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================== Offers & Pricing =====================

-- Loan offers (can have multiple per application)
CREATE TABLE loan_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    offer_type VARCHAR(50) DEFAULT 'standard' CHECK (offer_type IN ('standard', 'counter_offer', 'pre_approval')),
    loan_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,4) NOT NULL,
    term_months INTEGER NOT NULL,
    
    -- Calculated fields
    monthly_payment DECIMAL(10,2) NOT NULL,
    total_interest DECIMAL(15,2) NOT NULL,
    apr DECIMAL(5,4) NOT NULL,
    
    -- Offer details
    conditions TEXT,
    fees JSONB DEFAULT '{}', -- {origination_fee: 500, processing_fee: 100}
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'withdrawn')),
    responded_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================== Communication & Notifications =====================

-- Email/SMS templates
CREATE TABLE communication_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'email', 'sms', 'push'
    trigger_event VARCHAR(100) NOT NULL, -- 'application_submitted', 'document_required', etc.
    subject VARCHAR(255),
    body_template TEXT NOT NULL, -- With variable placeholders
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Communication log
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    template_id UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    type VARCHAR(50) NOT NULL, -- 'email', 'sms', 'call', 'letter'
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    subject VARCHAR(255),
    content TEXT,
    
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    external_id VARCHAR(255), -- Provider-specific ID
    
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================== Indexes for Performance =====================

-- User lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization_role ON users(organization_id, role);
CREATE INDEX IF NOT EXISTS idx_users_organization_active ON users(organization_id, is_active);

-- Organization lookups
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain ON organizations(subdomain);
CREATE INDEX IF NOT EXISTS idx_organizations_created ON organizations(created_at);

-- Lead management
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_broker ON leads(assigned_broker_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

-- Application lookups
CREATE INDEX IF NOT EXISTS idx_applications_number ON applications(application_number);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON applications(stage);
CREATE INDEX IF NOT EXISTS idx_applications_broker ON applications(assigned_broker_id);
CREATE INDEX IF NOT EXISTS idx_applications_underwriter ON applications(assigned_underwriter_id);
CREATE INDEX IF NOT EXISTS idx_applications_submitted ON applications(submitted_at);

-- Document management
CREATE INDEX IF NOT EXISTS idx_documents_application ON application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON application_documents(document_type);

-- Queue management
CREATE INDEX IF NOT EXISTS idx_queues_organization ON underwriting_queues(organization_id);
CREATE INDEX IF NOT EXISTS idx_queues_active ON underwriting_queues(is_active);
CREATE INDEX IF NOT EXISTS idx_queue_assignments_queue ON queue_assignments(queue_id);
CREATE INDEX IF NOT EXISTS idx_queue_assignments_user ON queue_assignments(user_id);

-- Session management
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON user_sessions(last_activity);

-- ===================== Task Management =====================

-- Task setups (created by admin, linked to loan products)
CREATE TABLE task_setups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_product_id UUID REFERENCES loan_products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(100) NOT NULL, -- 'verification', 'underwriting', 'approval', 'document_collection', etc.
    assigned_role VARCHAR(50) NOT NULL CHECK (assigned_role IN ('broker', 'underwriter', 'processor', 'tenant_admin')),
    sequence_order INTEGER DEFAULT 1, -- Order of task execution
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    estimated_duration_minutes INTEGER DEFAULT 30,
    instructions TEXT,
    checklist_items JSONB DEFAULT '[]', -- Array of checklist items for the task
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application tasks (auto-generated from task_setups when application is created)
CREATE TABLE application_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    task_setup_id UUID REFERENCES task_setups(id) ON DELETE SET NULL,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(100) NOT NULL,
    assigned_role VARCHAR(50) NOT NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
    sequence_order INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT true,
    
    -- Task completion details
    completed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    checklist_progress JSONB DEFAULT '{}', -- Track checklist item completion
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    due_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task comments/notes
CREATE TABLE task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES application_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT true, -- Internal notes vs customer-visible
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for task management
CREATE INDEX IF NOT EXISTS idx_task_setups_product ON task_setups(loan_product_id);
CREATE INDEX IF NOT EXISTS idx_task_setups_active ON task_setups(is_active);
CREATE INDEX IF NOT EXISTS idx_application_tasks_application ON application_tasks(application_id);
CREATE INDEX IF NOT EXISTS idx_application_tasks_status ON application_tasks(status);
CREATE INDEX IF NOT EXISTS idx_application_tasks_assigned_user ON application_tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_application_tasks_assigned_role ON application_tasks(assigned_role);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
-- ===================== Bootstrap Data =====================
-- System Admin User (for initial setup)
-- Username: admin@system.local
-- Password: Admin@123
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, organization_id)
VALUES ('admin@system.local', 'demo_hash_Admin@123', 'System', 'Admin', 'admin', true, NULL)
ON CONFLICT (email) DO NOTHING;

-- Sample Loan Products - REMOVED
-- Organizations should create their own loan products via the UI/API

-- ===================== Seed Permissions =====================
DO $$
BEGIN
    -- User Management Permissions
    INSERT INTO permissions (code, name, description, category) VALUES
        ('users.view', 'View Users', 'View user list and details', 'User Management'),
        ('users.create', 'Create Users', 'Create new user accounts', 'User Management'),
        ('users.edit', 'Edit Users', 'Edit user information and roles', 'User Management'),
        ('users.delete', 'Delete Users', 'Deactivate or delete users', 'User Management'),
        ('users.invite', 'Invite Users', 'Send user invitations', 'User Management')
    ON CONFLICT (code) DO NOTHING;

    -- Role Management Permissions
    INSERT INTO permissions (code, name, description, category) VALUES
        ('roles.view', 'View Roles', 'View role definitions', 'Role Management'),
        ('roles.create', 'Create Roles', 'Create custom roles', 'Role Management'),
        ('roles.edit', 'Edit Roles', 'Edit role permissions', 'Role Management'),
        ('roles.delete', 'Delete Roles', 'Delete custom roles', 'Role Management')
    ON CONFLICT (code) DO NOTHING;

    -- Loan Product Permissions
    INSERT INTO permissions (code, name, description, category) VALUES
        ('products.view', 'View Products', 'View loan products', 'Product Management'),
        ('products.create', 'Create Products', 'Create new loan products', 'Product Management'),
        ('products.edit', 'Edit Products', 'Edit loan product details', 'Product Management'),
        ('products.delete', 'Delete Products', 'Delete loan products', 'Product Management')
    ON CONFLICT (code) DO NOTHING;

    -- Application Permissions
    INSERT INTO permissions (code, name, description, category) VALUES
        ('applications.view', 'View Applications', 'View loan applications', 'Application Management'),
        ('applications.create', 'Create Applications', 'Create new applications', 'Application Management'),
        ('applications.edit', 'Edit Applications', 'Edit application details', 'Application Management'),
        ('applications.delete', 'Delete Applications', 'Delete applications', 'Application Management'),
        ('applications.approve', 'Approve Applications', 'Approve loan applications', 'Application Management'),
        ('applications.reject', 'Reject Applications', 'Reject loan applications', 'Application Management')
    ON CONFLICT (code) DO NOTHING;

    -- Template Permissions
    INSERT INTO permissions (code, name, description, category) VALUES
        ('templates.view', 'View Templates', 'View application templates', 'Template Management'),
        ('templates.create', 'Create Templates', 'Create new templates', 'Template Management'),
        ('templates.edit', 'Edit Templates', 'Edit template configuration', 'Template Management'),
        ('templates.delete', 'Delete Templates', 'Delete templates', 'Template Management')
    ON CONFLICT (code) DO NOTHING;

    -- Queue Permissions
    INSERT INTO permissions (code, name, description, category) VALUES
        ('queues.view', 'View Queues', 'View work queues', 'Queue Management'),
        ('queues.create', 'Create Queues', 'Create new queues', 'Queue Management'),
        ('queues.edit', 'Edit Queues', 'Edit queue settings', 'Queue Management'),
        ('queues.delete', 'Delete Queues', 'Delete queues', 'Queue Management'),
        ('queues.assign', 'Assign to Queues', 'Assign users to queues', 'Queue Management')
    ON CONFLICT (code) DO NOTHING;

    -- Task Permissions
    INSERT INTO permissions (code, name, description, category) VALUES
        ('tasks.view', 'View Tasks', 'View tasks', 'Task Management'),
        ('tasks.create', 'Create Tasks', 'Create new tasks', 'Task Management'),
        ('tasks.edit', 'Edit Tasks', 'Edit task details', 'Task Management'),
        ('tasks.delete', 'Delete Tasks', 'Delete tasks', 'Task Management'),
        ('tasks.assign', 'Assign Tasks', 'Assign tasks to users', 'Task Management')
    ON CONFLICT (code) DO NOTHING;

    -- Organization Permissions
    INSERT INTO permissions (code, name, description, category) VALUES
        ('org.view', 'View Organization', 'View organization settings', 'Organization'),
        ('org.edit', 'Edit Organization', 'Edit organization settings', 'Organization'),
        ('org.branding', 'Manage Branding', 'Customize organization branding', 'Organization'),
        ('org.features', 'Manage Features', 'Configure feature flags', 'Organization')
    ON CONFLICT (code) DO NOTHING;

    -- Reporting Permissions
    INSERT INTO permissions (code, name, description, category) VALUES
        ('reports.view', 'View Reports', 'View reports and analytics', 'Reporting'),
        ('reports.export', 'Export Reports', 'Export report data', 'Reporting'),
        ('reports.create', 'Create Reports', 'Create custom reports', 'Reporting')
    ON CONFLICT (code) DO NOTHING;

    -- System Permissions
    INSERT INTO permissions (code, name, description, category) VALUES
        ('system.audit', 'View Audit Logs', 'View system audit logs', 'System'),
        ('system.settings', 'Manage System', 'Configure system settings', 'System')
    ON CONFLICT (code) DO NOTHING;
END $$;

-- ===================== Additional Tables for Underwriter Portal =====================

-- Application notes for internal communication
CREATE TABLE IF NOT EXISTS application_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_notes_app_id ON application_notes(application_id);
CREATE INDEX IF NOT EXISTS idx_application_notes_created ON application_notes(created_at DESC);

-- Add assigned_underwriter_id to applications if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'applications' AND column_name = 'assigned_underwriter_id'
    ) THEN
        ALTER TABLE applications ADD COLUMN assigned_underwriter_id UUID REFERENCES users(id) ON DELETE SET NULL;
        CREATE INDEX idx_applications_assigned_underwriter ON applications(assigned_underwriter_id);
    END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE application_notes IS 'Internal notes and comments on applications for underwriter collaboration';
COMMENT ON COLUMN application_notes.is_internal IS 'True for internal notes, false for customer-visible comments';
