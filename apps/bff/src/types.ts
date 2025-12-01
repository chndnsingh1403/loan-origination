// Type definitions for the loan origination system
export interface User {
  id: string;
  organization_id: string;
  email: string;
  password_hash?: string; // Don't expose in API responses
  first_name: string;
  last_name: string;
  role: 'admin' | 'tenant_admin' | 'broker' | 'underwriter' | 'processor';
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  branding: Record<string, any>;
  feature_flags: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Lead {
  id: string;
  organization_id: string;
  assigned_broker_id?: string;
  loan_product_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  requested_amount?: number;
  purpose?: string;
  source: string;
  source_details: Record<string, any>;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  qualification_score?: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  converted_at?: Date;
  last_contacted?: Date;
}

export interface Application {
  id: string;
  organization_id: string;
  lead_id?: string;
  loan_product_id: string;
  template_id: string;
  assigned_broker_id?: string;
  assigned_underwriter_id?: string;
  application_number: string;
  requested_amount: number;
  requested_term_months: number;
  purpose?: string;
  applicant_data: Record<string, any>;
  status: 'draft' | 'submitted' | 'under_review' | 'additional_info_required' | 'underwriting' | 'approved' | 'declined' | 'withdrawn' | 'funded';
  stage: 'application' | 'verification' | 'underwriting' | 'approval' | 'funding' | 'closed';
  approved_amount?: number;
  approved_rate?: number;
  approved_term_months?: number;
  conditions?: string;
  submitted_at?: Date;
  decision_date?: Date;
  funding_date?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface LoanProduct {
  id: string;
  organization_id: string;
  name: string;
  type: string;
  description?: string;
  min_amount?: number;
  max_amount?: number;
  min_term_months?: number;
  max_term_months?: number;
  interest_rate_range?: Record<string, any>;
  eligibility_criteria: Record<string, any>;
  required_documents: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ApplicationTemplate {
  id: string;
  organization_id: string;
  loan_product_id: string;
  name: string;
  version: number;
  form_schema: Record<string, any>;
  validation_rules: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LoanOffer {
  id: string;
  application_id: string;
  created_by_user_id?: string;
  offer_type: 'standard' | 'counter_offer' | 'pre_approval';
  loan_amount: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  total_interest: number;
  apr: number;
  conditions?: string;
  fees: Record<string, any>;
  expires_at: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  responded_at?: Date;
  created_at: Date;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  uploaded_by_user_id?: string;
  document_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  is_verified: boolean;
  verified_by_user_id?: string;
  verified_at?: Date;
  verification_notes?: string;
  created_at: Date;
}

// API Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
  organization: Organization;
  sessionId?: string;
}

// Sign-up interfaces for production-ready user registration
export interface SignUpRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationId?: string;        // Optional for multi-tenant signup
  invitationToken?: string;       // For invitation-based registration
  role?: string;                  // Optional role, defaults to 'broker'
  termsAccepted: boolean;         // Terms of service acceptance
  marketingOptIn?: boolean;       // Marketing communication consent
  referralSource?: string;        // How they heard about the service
}

export interface SignUpResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
  organization: Organization;
  sessionId: string;
  requiresVerification: boolean;  // Whether email verification is needed
  verificationSent?: boolean;     // Whether verification email was sent
  nextSteps?: string[];          // Array of next steps for the user
}

// Email verification interfaces
export interface EmailVerificationRequest {
  token: string;
}

export interface EmailVerificationResponse {
  verified: boolean;
  message: string;
  user?: Omit<User, 'password_hash'>;
}

// Organization invitation interfaces
export interface OrganizationInviteRequest {
  email: string;
  role: string;
  organizationId: string;
  invitedBy: string;              // User ID who sent the invitation
  message?: string;               // Optional personal message
}

export interface OrganizationInviteResponse {
  invitationId: string;
  email: string;
  expiresAt: Date;
  invitationUrl: string;
}

// Password validation interface
export interface PasswordValidationResult {
  isValid: boolean;
  score: number;                  // Strength score 0-4
  feedback: string[];            // Array of feedback messages
  requirements: {
    minLength: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    notCommon: boolean;
  };
}

export interface CreateLeadRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  requested_amount?: number;
  purpose?: string;
  source: string;
  loan_product_id?: string;
}

export interface CreateApplicationRequest {
  lead_id?: string;
  loan_product_id: string;
  template_id: string;
  requested_amount: number;
  requested_term_months: number;
  purpose?: string;
  applicant_data: Record<string, any>;
}

export interface UpdateApplicationStatusRequest {
  status: Application['status'];
  stage?: Application['stage'];
  comment?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}