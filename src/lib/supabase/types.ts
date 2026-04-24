// Domain types mirroring the SQL schema. Hand-maintained until we wire up
// `supabase gen types typescript` in a later phase.

export type UserRole = "customer" | "agency_member" | "consultant" | "admin";
export type TenantType = "agency" | "solo_consultant";
export type TenantStatus = "pending_approval" | "active" | "suspended" | "rejected";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";
export type ProjectStatus =
  | "draft"
  | "open"
  | "matched"
  | "in_progress"
  | "completed"
  | "cancelled";
export type BidStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "withdrawn";
export type ContractStatus =
  | "draft"
  | "sent"
  | "signed"
  | "active"
  | "completed"
  | "cancelled";
export type MessageChannel = "project" | "bid" | "contract";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  type: TenantType;
  status: TenantStatus;
  org_number: string | null;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  billing_email: string | null;
  stripe_customer_id: string | null;
  platform_fee_enabled: boolean;
  platform_fee_percent: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  active: boolean;
  max_agencies_per_lead: number;
  created_at: string;
}

export interface Project {
  id: string;
  customer_id: string;
  title: string;
  description: string;
  budget_min_nok: number | null;
  budget_max_nok: number | null;
  deadline: string | null;
  status: ProjectStatus;
  location: string | null;
  remote_ok: boolean;
  source: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  closed_at: string | null;
}

export interface Bid {
  id: string;
  project_id: string;
  tenant_id: string;
  amount_nok: number;
  currency: string;
  delivery_weeks: number | null;
  description: string;
  includes: string[] | null;
  status: BidStatus;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  responded_at: string | null;
}

export interface PipelineStage {
  id: string;
  tenant_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface PipelineCard {
  id: string;
  tenant_id: string;
  project_id: string;
  stage_id: string;
  assigned_to: string | null;
  notes: string | null;
  sort_order: number;
}

export interface ConsultantProfile {
  id: string;
  tenant_id: string;
  user_id: string | null;
  slug: string;
  full_name: string;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
  hourly_rate_nok: number | null;
  years_experience: number | null;
  available_from: string | null;
  available_hours_per_week: number | null;
  visible_in_marketplace: boolean;
  linkedin_url: string | null;
  portfolio_url: string | null;
}
