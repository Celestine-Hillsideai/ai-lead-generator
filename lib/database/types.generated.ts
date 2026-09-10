/**
 * Hand-authored placeholder matching supabase/migrations/*.sql, until the
 * project is linked to a real Supabase instance and this can be regenerated
 * with the real CLI output:
 *
 *   supabase gen types typescript --linked > lib/database/types.generated.ts
 *
 * Do not hand-edit once that's possible -- regenerate instead so this never
 * drifts from the actual schema.
 *
 * `Relationships: []` on every table and `Views`/`Functions: {}` on the
 * schema are required to satisfy @supabase/postgrest-js's GenericSchema/
 * GenericTable constraints -- omitting them silently collapses every
 * Row/Insert/Update type to `never` rather than producing a visible error.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: { id: string; email: string; created_at: string };
        Insert: { id: string; email: string; created_at?: string };
        Update: { id?: string; email?: string; created_at?: string };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          industry: string | null;
          geography: string | null;
          company_size: string | null;
          target_roles: string[];
          offer_description: string | null;
          value_proposition: string | null;
          cta: string | null;
          research_instructions: string | null;
          status: "DRAFT" | "READY" | "PROCESSING" | "PAUSED" | "COMPLETED" | "FAILED";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["campaigns"]["Row"]> & {
          user_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Row"]>;
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          campaign_id: string;
          name: string;
          website: string;
          normalized_domain: string;
          industry: string | null;
          description: string | null;
          location: string | null;
          employee_size: string | null;
          research_status:
            | "IMPORTED"
            | "RESEARCHING"
            | "RESEARCHED"
            | "CONTACT_SEARCHING"
            | "CONTACT_FOUND"
            | "QUALIFYING"
            | "QUALIFIED"
            | "EMAIL_GENERATING"
            | "EMAIL_READY"
            | "NEEDS_REVIEW"
            | "APPROVED"
            | "FAILED";
          qualification_score: number | null;
          qualification_tier: "HIGH" | "MEDIUM" | "LOW" | "UNQUALIFIED" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["companies"]["Row"]> & {
          campaign_id: string;
          name: string;
          website: string;
          normalized_domain: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Row"]>;
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          company_id: string;
          first_name: string | null;
          last_name: string | null;
          full_name: string | null;
          title: string | null;
          email: string | null;
          email_status: "verified" | "public" | "unverified" | "invalid" | "unknown" | null;
          source_url: string | null;
          confidence: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contacts"]["Row"]> & { company_id: string };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Row"]>;
        Relationships: [];
      };
      research_sources: {
        Row: {
          id: string;
          company_id: string;
          url: string;
          title: string | null;
          source_type: string | null;
          retrieved_at: string;
          content_hash: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["research_sources"]["Row"]> & {
          company_id: string;
          url: string;
        };
        Update: Partial<Database["public"]["Tables"]["research_sources"]["Row"]>;
        Relationships: [];
      };
      research_findings: {
        Row: {
          id: string;
          company_id: string;
          source_id: string | null;
          category: string | null;
          claim: string;
          evidence: string;
          confidence: number | null;
          fact_type: "FACT" | "INFERENCE" | "UNKNOWN";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["research_findings"]["Row"]> & {
          company_id: string;
          claim: string;
          evidence: string;
          fact_type: "FACT" | "INFERENCE" | "UNKNOWN";
        };
        Update: Partial<Database["public"]["Tables"]["research_findings"]["Row"]>;
        Relationships: [];
      };
      qualifications: {
        Row: {
          id: string;
          company_id: string;
          score: number;
          tier: "HIGH" | "MEDIUM" | "LOW" | "UNQUALIFIED";
          industry_score: number | null;
          size_score: number | null;
          geography_score: number | null;
          problem_score: number | null;
          decision_maker_score: number | null;
          buying_signal_score: number | null;
          reasons: Json;
          risk_flags: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["qualifications"]["Row"]> & {
          company_id: string;
          score: number;
          tier: "HIGH" | "MEDIUM" | "LOW" | "UNQUALIFIED";
        };
        Update: Partial<Database["public"]["Tables"]["qualifications"]["Row"]>;
        Relationships: [];
      };
      email_drafts: {
        Row: {
          id: string;
          campaign_id: string;
          company_id: string;
          contact_id: string | null;
          subject: string;
          body: string;
          personalization_hook: string | null;
          evidence_ids: string[];
          confidence: number | null;
          status: "DRAFT" | "READY" | "APPROVED" | "REJECTED" | "SENDING" | "SENT" | "FAILED";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["email_drafts"]["Row"]> & {
          campaign_id: string;
          company_id: string;
          subject: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_drafts"]["Row"]>;
        Relationships: [];
      };
      agent_runs: {
        Row: {
          id: string;
          campaign_id: string;
          company_id: string | null;
          agent_type: "research" | "decision_maker" | "qualification" | "personalization" | "email";
          status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
          input: Json | null;
          output: Json | null;
          error: string | null;
          retry_count: number;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["agent_runs"]["Row"]> & {
          campaign_id: string;
          agent_type: "research" | "decision_maker" | "qualification" | "personalization" | "email";
        };
        Update: Partial<Database["public"]["Tables"]["agent_runs"]["Row"]>;
        Relationships: [];
      };
      suppressions: {
        Row: {
          id: string;
          user_id: string | null;
          campaign_id: string | null;
          email: string;
          reason: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["suppressions"]["Row"]> & { email: string };
        Update: Partial<Database["public"]["Tables"]["suppressions"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
