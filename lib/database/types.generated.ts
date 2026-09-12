export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent_type: string
          campaign_id: string
          company_id: string | null
          completed_at: string | null
          error: string | null
          id: string
          input: Json | null
          output: Json | null
          retry_count: number
          started_at: string | null
          status: string
        }
        Insert: {
          agent_type: string
          campaign_id: string
          company_id?: string | null
          completed_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          agent_type?: string
          campaign_id?: string
          company_id?: string | null
          completed_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          company_size: string | null
          created_at: string
          cta: string | null
          description: string | null
          geography: string | null
          id: string
          industry: string | null
          name: string
          offer_description: string | null
          research_instructions: string | null
          status: string
          target_roles: string[]
          updated_at: string
          user_id: string
          value_proposition: string | null
        }
        Insert: {
          company_size?: string | null
          created_at?: string
          cta?: string | null
          description?: string | null
          geography?: string | null
          id?: string
          industry?: string | null
          name: string
          offer_description?: string | null
          research_instructions?: string | null
          status?: string
          target_roles?: string[]
          updated_at?: string
          user_id: string
          value_proposition?: string | null
        }
        Update: {
          company_size?: string | null
          created_at?: string
          cta?: string | null
          description?: string | null
          geography?: string | null
          id?: string
          industry?: string | null
          name?: string
          offer_description?: string | null
          research_instructions?: string | null
          status?: string
          target_roles?: string[]
          updated_at?: string
          user_id?: string
          value_proposition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          campaign_id: string
          created_at: string
          description: string | null
          employee_size: string | null
          id: string
          industry: string | null
          location: string | null
          name: string
          normalized_domain: string
          qualification_score: number | null
          qualification_tier: string | null
          research_status: string
          source_provider: string | null
          source_type: string
          sourcing_run_id: string | null
          updated_at: string
          website: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string | null
          employee_size?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name: string
          normalized_domain: string
          qualification_score?: number | null
          qualification_tier?: string | null
          research_status?: string
          source_provider?: string | null
          source_type?: string
          sourcing_run_id?: string | null
          updated_at?: string
          website: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string | null
          employee_size?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name?: string
          normalized_domain?: string
          qualification_score?: number | null
          qualification_tier?: string | null
          research_status?: string
          source_provider?: string | null
          source_type?: string
          sourcing_run_id?: string | null
          updated_at?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_sourcing_run_id_fkey"
            columns: ["sourcing_run_id"]
            isOneToOne: false
            referencedRelation: "sourcing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          confidence: number | null
          created_at: string
          email: string | null
          email_status: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          source_url: string | null
          title: string | null
        }
        Insert: {
          company_id: string
          confidence?: number | null
          created_at?: string
          email?: string | null
          email_status?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          source_url?: string | null
          title?: string | null
        }
        Update: {
          company_id?: string
          confidence?: number | null
          created_at?: string
          email?: string | null
          email_status?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          source_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_draft_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          email_draft_id: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          email_draft_id: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          email_draft_id?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_draft_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_draft_events_email_draft_id_fkey"
            columns: ["email_draft_id"]
            isOneToOne: false
            referencedRelation: "email_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          body: string
          campaign_id: string
          company_id: string
          confidence: number | null
          contact_id: string | null
          created_at: string
          evidence_ids: string[]
          id: string
          personalization_hook: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          campaign_id: string
          company_id: string
          confidence?: number | null
          contact_id?: string | null
          created_at?: string
          evidence_ids?: string[]
          id?: string
          personalization_hook?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          campaign_id?: string
          company_id?: string
          confidence?: number | null
          contact_id?: string | null
          created_at?: string
          evidence_ids?: string[]
          id?: string
          personalization_hook?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      qualifications: {
        Row: {
          buying_signal_score: number | null
          company_id: string
          created_at: string
          decision_maker_score: number | null
          geography_score: number | null
          id: string
          industry_score: number | null
          problem_score: number | null
          reasons: Json
          risk_flags: Json
          score: number
          size_score: number | null
          tier: string
        }
        Insert: {
          buying_signal_score?: number | null
          company_id: string
          created_at?: string
          decision_maker_score?: number | null
          geography_score?: number | null
          id?: string
          industry_score?: number | null
          problem_score?: number | null
          reasons?: Json
          risk_flags?: Json
          score: number
          size_score?: number | null
          tier: string
        }
        Update: {
          buying_signal_score?: number | null
          company_id?: string
          created_at?: string
          decision_maker_score?: number | null
          geography_score?: number | null
          id?: string
          industry_score?: number | null
          problem_score?: number | null
          reasons?: Json
          risk_flags?: Json
          score?: number
          size_score?: number | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      research_findings: {
        Row: {
          category: string | null
          claim: string
          company_id: string
          confidence: number | null
          created_at: string
          evidence: string
          fact_type: string
          id: string
          source_id: string | null
        }
        Insert: {
          category?: string | null
          claim: string
          company_id: string
          confidence?: number | null
          created_at?: string
          evidence: string
          fact_type: string
          id?: string
          source_id?: string | null
        }
        Update: {
          category?: string | null
          claim?: string
          company_id?: string
          confidence?: number | null
          created_at?: string
          evidence?: string
          fact_type?: string
          id?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_findings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_findings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "research_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      research_sources: {
        Row: {
          company_id: string
          content_hash: string | null
          id: string
          retrieved_at: string
          source_type: string | null
          title: string | null
          url: string
        }
        Insert: {
          company_id: string
          content_hash?: string | null
          id?: string
          retrieved_at?: string
          source_type?: string | null
          title?: string | null
          url: string
        }
        Update: {
          company_id?: string
          content_hash?: string | null
          id?: string
          retrieved_at?: string
          source_type?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_runs: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string
          discovered_count: number
          error: string | null
          id: string
          inserted_count: number
          provider: string
          requested_by: string
          skipped_count: number
          status: string
          target_count: number
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          discovered_count?: number
          error?: string | null
          id?: string
          inserted_count?: number
          provider: string
          requested_by: string
          skipped_count?: number
          status?: string
          target_count: number
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          discovered_count?: number
          error?: string | null
          id?: string
          inserted_count?: number
          provider?: string
          requested_by?: string
          skipped_count?: number
          status?: string
          target_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sourcing_runs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressions: {
        Row: {
          campaign_id: string | null
          created_at: string
          email: string
          id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          email: string
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          email?: string
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppressions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          ai_model: string | null
          ai_provider: string
          created_at: string
          email_provider: string
          max_companies_per_campaign: number
          max_companies_per_sourcing_run: number
          max_pages_per_company: number
          qualification_weights: Json
          sender_email: string | null
          sender_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string
          created_at?: string
          email_provider?: string
          max_companies_per_campaign?: number
          max_companies_per_sourcing_run?: number
          max_pages_per_company?: number
          qualification_weights?: Json
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string
          created_at?: string
          email_provider?: string
          max_companies_per_campaign?: number
          max_companies_per_sourcing_run?: number
          max_pages_per_company?: number
          qualification_weights?: Json
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
