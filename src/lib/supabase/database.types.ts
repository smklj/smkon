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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_model_usage: {
        Row: {
          cost_usd: number
          created_at: string
          id: number
          input_tokens: number
          model: string
          organization_id: string
          output_tokens: number
          phase: string
          run_id: string
        }
        Insert: {
          cost_usd: number
          created_at?: string
          id?: number
          input_tokens: number
          model: string
          organization_id: string
          output_tokens: number
          phase: string
          run_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: number
          input_tokens?: number
          model?: string
          organization_id?: string
          output_tokens?: number
          phase?: string
          run_id?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent: string
          cancel_reason: string | null
          cancelled_by: string | null
          claimed_at: string | null
          created_at: string
          created_by: string
          error_code: string | null
          finished_at: string | null
          goal: string
          id: string
          max_steps: number
          organization_id: string
          outcome: Json | null
          started_at: string | null
          status: string
          step_count: number
        }
        Insert: {
          agent: string
          cancel_reason?: string | null
          cancelled_by?: string | null
          claimed_at?: string | null
          created_at?: string
          created_by: string
          error_code?: string | null
          finished_at?: string | null
          goal: string
          id?: string
          max_steps: number
          organization_id: string
          outcome?: Json | null
          started_at?: string | null
          status?: string
          step_count?: number
        }
        Update: {
          agent?: string
          cancel_reason?: string | null
          cancelled_by?: string | null
          claimed_at?: string | null
          created_at?: string
          created_by?: string
          error_code?: string | null
          finished_at?: string | null
          goal?: string
          id?: string
          max_steps?: number
          organization_id?: string
          outcome?: Json | null
          started_at?: string | null
          status?: string
          step_count?: number
        }
        Relationships: []
      }
      agent_settings: {
        Row: {
          kill_changed_at: string | null
          kill_changed_by: string | null
          kill_reason: string | null
          kill_switch: boolean
          max_runs_per_day: number
          max_steps_per_run: number
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          kill_changed_at?: string | null
          kill_changed_by?: string | null
          kill_reason?: string | null
          kill_switch?: boolean
          max_runs_per_day?: number
          max_steps_per_run?: number
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          kill_changed_at?: string | null
          kill_changed_by?: string | null
          kill_reason?: string | null
          kill_switch?: boolean
          max_runs_per_day?: number
          max_steps_per_run?: number
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agent_steps: {
        Row: {
          created_at: string
          detail: string | null
          id: number
          input: Json
          organization_id: string
          output: Json
          phase: string
          run_id: string
          seq: number
          status: string
          tool: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: number
          input?: Json
          organization_id: string
          output?: Json
          phase: string
          run_id: string
          seq: number
          status: string
          tool?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: number
          input?: Json
          organization_id?: string
          output?: Json
          phase?: string
          run_id?: string
          seq?: number
          status?: string
          tool?: string | null
        }
        Relationships: []
      }
      agent_tool_grants: {
        Row: {
          granted_at: string
          granted_by: string
          organization_id: string
          tool: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          organization_id: string
          tool: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          organization_id?: string
          tool?: string
        }
        Relationships: []
      }
      ad_campaign_daily_metrics: {
        Row: {
          campaign_external_id: string
          clicks: number
          connection_id: string
          conversions: number
          created_at: string
          currency: string
          domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_event_id: string | null
          id: string
          impressions: number
          metric_date: string
          organization_id: string
          spend: number
        }
        Insert: {
          campaign_external_id: string
          clicks?: number
          connection_id: string
          conversions?: number
          created_at?: string
          currency: string
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_event_id?: string | null
          id?: string
          impressions?: number
          metric_date: string
          organization_id: string
          spend?: number
        }
        Update: {
          campaign_external_id?: string
          clicks?: number
          connection_id?: string
          conversions?: number
          created_at?: string
          currency?: string
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_event_id?: string | null
          id?: string
          impressions?: number
          metric_date?: string
          organization_id?: string
          spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaign_daily_metrics_connection_id_organization_id_do_fkey"
            columns: ["connection_id", "organization_id", "domain"]
            isOneToOne: false
            referencedRelation: "source_connections"
            referencedColumns: ["id", "organization_id", "domain"]
          },
          {
            foreignKeyName: "ad_campaign_daily_metrics_external_event_id_organization_i_fkey"
            columns: ["external_event_id", "organization_id", "domain"]
            isOneToOne: false
            referencedRelation: "external_events"
            referencedColumns: ["id", "organization_id", "domain"]
          },
          {
            foreignKeyName: "ad_campaign_daily_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_clicks: {
        Row: {
          click_reference: string
          clicked_at: string
          connection_id: string
          created_at: string
          destination_host: string
          domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          id: string
          organization_id: string
          tracking_id: string
        }
        Insert: {
          click_reference: string
          clicked_at: string
          connection_id: string
          created_at?: string
          destination_host: string
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          id?: string
          organization_id: string
          tracking_id: string
        }
        Update: {
          click_reference?: string
          clicked_at?: string
          connection_id?: string
          created_at?: string
          destination_host?: string
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          id?: string
          organization_id?: string
          tracking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_connection_id_organization_id_domain_fkey"
            columns: ["connection_id", "organization_id", "domain"]
            isOneToOne: false
            referencedRelation: "source_connections"
            referencedColumns: ["id", "organization_id", "domain"]
          },
          {
            foreignKeyName: "affiliate_clicks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commission_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          commission_amount: number | null
          conversion_id: string
          currency: string
          from_status: string | null
          id: number
          organization_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          commission_amount?: number | null
          conversion_id: string
          currency: string
          from_status?: string | null
          id?: never
          organization_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          commission_amount?: number | null
          conversion_id?: string
          currency?: string
          from_status?: string | null
          id?: never
          organization_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commission_status_history_conversion_id_fkey"
            columns: ["conversion_id"]
            isOneToOne: false
            referencedRelation: "affiliate_conversions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversions: {
        Row: {
          commission_amount: number | null
          connection_id: string
          created_at: string
          currency: string
          domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_conversion_id: string
          external_event_id: string | null
          id: string
          occurred_at: string
          order_amount: number | null
          organization_id: string
          provider: string
          status: Database["public"]["Enums"]["smkon_commission_status"]
          tracking_id: string | null
          updated_at: string
        }
        Insert: {
          commission_amount?: number | null
          connection_id: string
          created_at?: string
          currency: string
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_conversion_id: string
          external_event_id?: string | null
          id?: string
          occurred_at: string
          order_amount?: number | null
          organization_id: string
          provider: string
          status?: Database["public"]["Enums"]["smkon_commission_status"]
          tracking_id?: string | null
          updated_at?: string
        }
        Update: {
          commission_amount?: number | null
          connection_id?: string
          created_at?: string
          currency?: string
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_conversion_id?: string
          external_event_id?: string | null
          id?: string
          occurred_at?: string
          order_amount?: number | null
          organization_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["smkon_commission_status"]
          tracking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_connection_id_organization_id_domain_fkey"
            columns: ["connection_id", "organization_id", "domain"]
            isOneToOne: false
            referencedRelation: "source_connections"
            referencedColumns: ["id", "organization_id", "domain"]
          },
          {
            foreignKeyName: "affiliate_conversions_external_event_id_fkey"
            columns: ["external_event_id"]
            isOneToOne: false
            referencedRelation: "external_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_external_event_id_organization_id_do_fkey"
            columns: ["external_event_id", "organization_id", "domain"]
            isOneToOne: false
            referencedRelation: "external_events"
            referencedColumns: ["id", "organization_id", "domain"]
          },
          {
            foreignKeyName: "affiliate_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          id: number
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          organization_id: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          id?: never
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          id?: never
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      consent_events: {
        Row: {
          action: string
          channel: string
          contact_id: string
          created_at: string
          evidence_ref: string | null
          evidence_type: string
          id: string
          occurred_at: string
          organization_id: string
          purpose: string
          recorded_by: string
        }
        Insert: {
          action: string
          channel: string
          contact_id: string
          created_at?: string
          evidence_ref?: string | null
          evidence_type: string
          id?: string
          occurred_at: string
          organization_id: string
          purpose: string
          recorded_by: string
        }
        Update: {
          action?: string
          channel?: string
          contact_id?: string
          created_at?: string
          evidence_ref?: string | null
          evidence_type?: string
          id?: string
          occurred_at?: string
          organization_id?: string
          purpose?: string
          recorded_by?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          anonymized_at: string | null
          anonymized_by: string | null
          created_at: string
          created_by: string
          display_name: string | null
          email: string | null
          id: string
          last_activity_at: string
          legal_basis: string
          organization_id: string
          phone: string | null
          purpose: string
          source: string
          source_detail: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anonymized_at?: string | null
          anonymized_by?: string | null
          created_at?: string
          created_by: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_activity_at?: string
          legal_basis: string
          organization_id: string
          phone?: string | null
          purpose: string
          source: string
          source_detail?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anonymized_at?: string | null
          anonymized_by?: string | null
          created_at?: string
          created_by?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_activity_at?: string
          legal_basis?: string
          organization_id?: string
          phone?: string | null
          purpose?: string
          source?: string
          source_detail?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      content_approvals: {
        Row: {
          content_hash: string
          content_item_id: string
          decided_at: string
          decided_by: string
          decision: string
          id: string
          note: string | null
          organization_id: string
          version: number
        }
        Insert: {
          content_hash: string
          content_item_id: string
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          note?: string | null
          organization_id: string
          version: number
        }
        Update: {
          content_hash?: string
          content_item_id?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          note?: string | null
          organization_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_approvals_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          agent_run_id: string | null
          approved_version: number | null
          asset_url: string
          caption: string
          channels: string[]
          content_hash: string
          created_at: string
          created_by: string
          cta: string
          hashtags: string
          id: string
          media_asset_id: string | null
          organization_id: string
          product: string
          rights_confirmed: boolean
          script: string
          source_url: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          agent_run_id?: string | null
          approved_version?: number | null
          asset_url?: string
          caption?: string
          channels?: string[]
          content_hash?: string
          created_at?: string
          created_by: string
          cta?: string
          hashtags?: string
          id?: string
          media_asset_id?: string | null
          organization_id: string
          product?: string
          rights_confirmed?: boolean
          script?: string
          source_url?: string
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          agent_run_id?: string | null
          approved_version?: number | null
          asset_url?: string
          caption?: string
          channels?: string[]
          content_hash?: string
          created_at?: string
          created_by?: string
          cta?: string
          hashtags?: string
          id?: string
          media_asset_id?: string | null
          organization_id?: string
          product?: string
          rights_confirmed?: boolean
          script?: string
          source_url?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_items_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_versions: {
        Row: {
          content_hash: string
          content_item_id: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          content_hash: string
          content_item_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          snapshot: Json
          version: number
        }
        Update: {
          content_hash?: string
          content_item_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string
          details: string | null
          due_at: string
          id: string
          kind: string
          organization_id: string
          received_at: string
          received_via: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by: string
          details?: string | null
          due_at: string
          id?: string
          kind: string
          organization_id: string
          received_at: string
          received_via: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string
          details?: string | null
          due_at?: string
          id?: string
          kind?: string
          organization_id?: string
          received_at?: string
          received_via?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      external_action_requests: {
        Row: {
          action: string
          approved_hash: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          error_code: string | null
          executed_at: string | null
          external_ref: string | null
          id: string
          organization_id: string
          payload: Json
          payload_hash: string
          requested_at: string
          requested_by: string
          social_account_id: string
          status: string
        }
        Insert: {
          action: string
          approved_hash?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          error_code?: string | null
          executed_at?: string | null
          external_ref?: string | null
          id?: string
          organization_id: string
          payload: Json
          payload_hash: string
          requested_at?: string
          requested_by: string
          social_account_id: string
          status?: string
        }
        Update: {
          action?: string
          approved_hash?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          error_code?: string | null
          executed_at?: string | null
          external_ref?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          payload_hash?: string
          requested_at?: string
          requested_by?: string
          social_account_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_action_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_action_requests_social_account_id_organization_id_fkey"
            columns: ["social_account_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      external_events: {
        Row: {
          connection_id: string
          created_at: string
          domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          event_type: string
          external_id: string
          id: string
          normalization_version: number
          occurred_at: string | null
          source_updated_at: string | null
          organization_id: string
          payload_hash: string
          provider: string
          received_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          event_type: string
          external_id: string
          id?: string
          normalization_version?: number
          occurred_at?: string | null
          source_updated_at?: string | null
          organization_id: string
          payload_hash: string
          provider: string
          received_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          event_type?: string
          external_id?: string
          id?: string
          normalization_version?: number
          occurred_at?: string | null
          source_updated_at?: string | null
          organization_id?: string
          payload_hash?: string
          provider?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_events_connection_id_organization_id_domain_fkey"
            columns: ["connection_id", "organization_id", "domain"]
            isOneToOne: false
            referencedRelation: "source_connections"
            referencedColumns: ["id", "organization_id", "domain"]
          },
          {
            foreignKeyName: "external_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger_entries: {
        Row: {
          amount: number
          created_at: string
          currency: string
          domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          effective_at: string
          entry_type: string
          id: string
          organization_id: string
          source_id: string
          source_table: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          effective_at: string
          entry_type: string
          id?: string
          organization_id: string
          source_id: string
          source_table: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          effective_at?: string
          entry_type?: string
          id?: string
          organization_id?: string
          source_id?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          id: string
          kind: string
          mime_type: string
          organization_id: string
          original_name: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          kind: string
          mime_type: string
          organization_id: string
          original_name: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string
          organization_id?: string
          original_name?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      media_licenses: {
        Row: {
          allows_commercial_use: boolean
          allows_modification: boolean
          created_at: string
          id: string
          license_type: string
          licensor: string
          media_asset_id: string
          notes: string | null
          organization_id: string
          proof_url: string | null
          recorded_by: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          territory: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          allows_commercial_use: boolean
          allows_modification: boolean
          created_at?: string
          id?: string
          license_type: string
          licensor: string
          media_asset_id: string
          notes?: string | null
          organization_id: string
          proof_url?: string | null
          recorded_by?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          territory?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          allows_commercial_use?: boolean
          allows_modification?: boolean
          created_at?: string
          id?: string
          license_type?: string
          licensor?: string
          media_asset_id?: string
          notes?: string | null
          organization_id?: string
          proof_url?: string | null
          recorded_by?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          territory?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_evidence: {
        Row: {
          captured_by: string
          claim: string
          created_at: string
          id: string
          kind: string
          observed_at: string
          organization_id: string
          product_id: string
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_url: string
          value: number | null
        }
        Insert: {
          captured_by?: string
          claim: string
          created_at?: string
          id?: string
          kind: string
          observed_at?: string
          organization_id: string
          product_id: string
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url: string
          value?: number | null
        }
        Update: {
          captured_by?: string
          claim?: string
          created_at?: string
          id?: string
          kind?: string
          observed_at?: string
          organization_id?: string
          product_id?: string
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_evidence_product_id_organization_id_fkey"
            columns: ["product_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_url: string | null
          category: string | null
          commission_percent: number | null
          compare_at_price_cents: number | null
          created_at: string
          created_by: string
          currency: string
          description: string | null
          digital_asset_path: string | null
          digital_benefits: Json | null
          digital_delivery_type: string | null
          digital_external_url: string | null
          digital_instructions: string | null
          evidence: Json
          external_id: string | null
          fulfillment_mode: string | null
          height_cm: number | null
          id: string
          image_urls: Json | null
          is_bestseller: boolean | null
          is_featured: boolean | null
          is_new_arrival: boolean | null
          is_published_in_store: boolean | null
          length_cm: number | null
          name: string
          organization_id: string
          price_cents: number | null
          revenue_domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          score: number | null
          score_rank: number
          score_reasons: Json
          short_description: string | null
          sku: string | null
          slug: string | null
          source: string
          status: string
          stock_quantity: number | null
          subcategory: string | null
          track_inventory: boolean | null
          type: string
          updated_at: string
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          affiliate_url?: string | null
          category?: string | null
          commission_percent?: number | null
          compare_at_price_cents?: number | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          digital_asset_path?: string | null
          digital_benefits?: Json | null
          digital_delivery_type?: string | null
          digital_external_url?: string | null
          digital_instructions?: string | null
          evidence?: Json
          external_id?: string | null
          fulfillment_mode?: string | null
          height_cm?: number | null
          id?: string
          image_urls?: Json | null
          is_bestseller?: boolean | null
          is_featured?: boolean | null
          is_new_arrival?: boolean | null
          is_published_in_store?: boolean | null
          length_cm?: number | null
          name: string
          organization_id: string
          price_cents?: number | null
          revenue_domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          score?: number | null
          score_rank?: never
          score_reasons?: Json
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          source: string
          status?: string
          stock_quantity?: number | null
          subcategory?: string | null
          track_inventory?: boolean | null
          type?: string
          updated_at?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          affiliate_url?: string | null
          category?: string | null
          commission_percent?: number | null
          compare_at_price_cents?: number | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          digital_asset_path?: string | null
          digital_benefits?: Json | null
          digital_delivery_type?: string | null
          digital_external_url?: string | null
          digital_instructions?: string | null
          evidence?: Json
          external_id?: string | null
          fulfillment_mode?: string | null
          height_cm?: number | null
          id?: string
          image_urls?: Json | null
          is_bestseller?: boolean | null
          is_featured?: boolean | null
          is_new_arrival?: boolean | null
          is_published_in_store?: boolean | null
          length_cm?: number | null
          name?: string
          organization_id?: string
          price_cents?: number | null
          revenue_domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          score?: number | null
          score_rank?: never
          score_reasons?: Json
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          source?: string
          status?: string
          stock_quantity?: number | null
          subcategory?: string | null
          track_inventory?: boolean | null
          type?: string
          updated_at?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_job_events: {
        Row: {
          actor_id: string | null
          detail: Json
          event: string
          id: number
          job_id: string
          occurred_at: string
          organization_id: string
        }
        Insert: {
          actor_id?: string | null
          detail?: Json
          event: string
          id?: number
          job_id: string
          occurred_at?: string
          organization_id: string
        }
        Update: {
          actor_id?: string | null
          detail?: Json
          event?: string
          id?: number
          job_id?: string
          occurred_at?: string
          organization_id?: string
        }
        Relationships: []
      }
      publication_jobs: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string
          checks: Json
          content_hash: string
          content_item_id: string
          content_version: number
          created_at: string
          created_by: string
          id: string
          last_run_at: string | null
          mode: string
          organization_id: string
          scheduled_for: string
          status: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel: string
          checks?: Json
          content_hash: string
          content_item_id: string
          content_version: number
          created_at?: string
          created_by: string
          id?: string
          last_run_at?: string | null
          mode?: string
          organization_id: string
          scheduled_for: string
          status?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel?: string
          checks?: Json
          content_hash?: string
          content_item_id?: string
          content_version?: number
          created_at?: string
          created_by?: string
          id?: string
          last_run_at?: string | null
          mode?: string
          organization_id?: string
          scheduled_for?: string
          status?: string
        }
        Relationships: []
      }
      sales_order_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          created_at: string
          currency: string
          external_adjustment_id: string | null
          id: string
          occurred_at: string
          organization_id: string
          sales_order_id: string
        }
        Insert: {
          adjustment_type: string
          amount: number
          created_at?: string
          currency: string
          external_adjustment_id?: string | null
          id?: string
          occurred_at: string
          organization_id: string
          sales_order_id: string
        }
        Update: {
          adjustment_type?: string
          amount?: number
          created_at?: string
          currency?: string
          external_adjustment_id?: string | null
          id?: string
          occurred_at?: string
          organization_id?: string
          sales_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_adjustments_sales_order_id_organization_id_fkey"
            columns: ["sales_order_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          connection_id: string
          created_at: string
          currency: string
          discount_amount: number
          domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_event_id: string | null
          external_order_id: string
          fee_amount: number
          gross_amount: number
          id: string
          occurred_at: string
          order_status: string
          organization_id: string
          provider: string
          refund_amount: number
          settled_at: string | null
          shipping_amount: number
        }
        Insert: {
          connection_id: string
          created_at?: string
          currency: string
          discount_amount?: number
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_event_id?: string | null
          external_order_id: string
          fee_amount?: number
          gross_amount: number
          id?: string
          occurred_at: string
          order_status: string
          organization_id: string
          provider: string
          refund_amount?: number
          settled_at?: string | null
          shipping_amount?: number
        }
        Update: {
          connection_id?: string
          created_at?: string
          currency?: string
          discount_amount?: number
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_event_id?: string | null
          external_order_id?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          occurred_at?: string
          order_status?: string
          organization_id?: string
          provider?: string
          refund_amount?: number
          settled_at?: string | null
          shipping_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_connection_id_organization_id_domain_fkey"
            columns: ["connection_id", "organization_id", "domain"]
            isOneToOne: false
            referencedRelation: "source_connections"
            referencedColumns: ["id", "organization_id", "domain"]
          },
          {
            foreignKeyName: "sales_orders_external_event_id_fkey"
            columns: ["external_event_id"]
            isOneToOne: false
            referencedRelation: "external_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_external_event_id_organization_id_domain_fkey"
            columns: ["external_event_id", "organization_id", "domain"]
            isOneToOne: false
            referencedRelation: "external_events"
            referencedColumns: ["id", "organization_id", "domain"]
          },
          {
            foreignKeyName: "sales_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          account_type: string
          capabilities: string[]
          created_at: string
          display_name: string | null
          external_account_id: string
          handle: string | null
          id: string
          last_error_code: string | null
          last_synced_at: string | null
          network: string
          organization_id: string
          status: Database["public"]["Enums"]["smkon_connection_status"]
          updated_at: string
          via: string
        }
        Insert: {
          account_type: string
          capabilities?: string[]
          created_at?: string
          display_name?: string | null
          external_account_id: string
          handle?: string | null
          id?: string
          last_error_code?: string | null
          last_synced_at?: string | null
          network: string
          organization_id: string
          status?: Database["public"]["Enums"]["smkon_connection_status"]
          updated_at?: string
          via: string
        }
        Update: {
          account_type?: string
          capabilities?: string[]
          created_at?: string
          display_name?: string | null
          external_account_id?: string
          handle?: string | null
          id?: string
          last_error_code?: string | null
          last_synced_at?: string | null
          network?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["smkon_connection_status"]
          updated_at?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      source_connections: {
        Row: {
          created_at: string
          display_name: string | null
          domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_account_id: string | null
          granted_scopes: string[]
          id: string
          last_error_code: string | null
          last_synced_at: string | null
          organization_id: string
          provider: string
          status: Database["public"]["Enums"]["smkon_connection_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_account_id?: string | null
          granted_scopes?: string[]
          id?: string
          last_error_code?: string | null
          last_synced_at?: string | null
          organization_id: string
          provider: string
          status?: Database["public"]["Enums"]["smkon_connection_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          external_account_id?: string | null
          granted_scopes?: string[]
          id?: string
          last_error_code?: string | null
          last_synced_at?: string | null
          organization_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["smkon_connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_active_workspace: {
        Row: {
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_workspace_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      store_settings: {
        Row: {
          accent_color: string
          announcement_bar: Json
          categories_nav: Json
          created_at: string
          featured_categories: Json
          free_shipping_min_cents: number | null
          hero_banners: Json
          id: string
          is_store_active: boolean
          logo_url: string | null
          organization_id: string
          primary_color: string
          shipping_origin_cep: string
          social_links: Json
          store_name: string
          store_tagline: string | null
          support_email: string | null
          support_whatsapp: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          announcement_bar?: Json
          categories_nav?: Json
          created_at?: string
          featured_categories?: Json
          free_shipping_min_cents?: number | null
          hero_banners?: Json
          id?: string
          is_store_active?: boolean
          logo_url?: string | null
          organization_id: string
          primary_color?: string
          shipping_origin_cep?: string
          social_links?: Json
          store_name?: string
          store_tagline?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          announcement_bar?: Json
          categories_nav?: Json
          created_at?: string
          featured_categories?: Json
          free_shipping_min_cents?: number | null
          hero_banners?: Json
          id?: string
          is_store_active?: boolean
          logo_url?: string | null
          organization_id?: string
          primary_color?: string
          shipping_origin_cep?: string
          social_links?: Json
          store_name?: string
          store_tagline?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      store_coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_discount_amount_cents: number | null
          max_uses: number | null
          min_order_amount_cents: number | null
          organization_id: string
          updated_at: string
          used_count: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_discount_amount_cents?: number | null
          max_uses?: number | null
          min_order_amount_cents?: number | null
          organization_id: string
          updated_at?: string
          used_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_discount_amount_cents?: number | null
          max_uses?: number | null
          min_order_amount_cents?: number | null
          organization_id?: string
          updated_at?: string
          used_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_coupons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          coupon_code: string | null
          created_at: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_notes: string | null
          customer_phone: string
          discount_amount_cents: number
          id: string
          items_subtotal_cents: number
          metadata: Json
          order_code: string
          organization_id: string
          paid_at: string | null
          payment_method: string
          payment_status: string
          sales_order_id: string | null
          shipping_address: Json | null
          shipping_amount_cents: number
          shipping_carrier_name: string | null
          shipping_estimated_days: number | null
          shipping_service_name: string | null
          status: string
          total_amount_cents: number
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_notes?: string | null
          customer_phone: string
          discount_amount_cents?: number
          id?: string
          items_subtotal_cents?: number
          metadata?: Json
          order_code: string
          organization_id: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          sales_order_id?: string | null
          shipping_address?: Json | null
          shipping_amount_cents?: number
          shipping_carrier_name?: string | null
          shipping_estimated_days?: number | null
          shipping_service_name?: string | null
          status?: string
          total_amount_cents?: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          customer_document?: string
          customer_email?: string
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string
          discount_amount_cents?: number
          id?: string
          items_subtotal_cents?: number
          metadata?: Json
          order_code?: string
          organization_id?: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          sales_order_id?: string | null
          shipping_address?: Json | null
          shipping_amount_cents?: number
          shipping_carrier_name?: string | null
          shipping_estimated_days?: number | null
          shipping_service_name?: string | null
          status?: string
          total_amount_cents?: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_items: {
        Row: {
          created_at: string
          fulfillment_mode: string
          id: string
          image_url: string | null
          order_id: string
          product_id: string
          product_name: string
          product_slug: string
          quantity: number
          sku: string | null
          subtotal_cents: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          fulfillment_mode?: string
          id?: string
          image_url?: string | null
          order_id: string
          product_id: string
          product_name: string
          product_slug: string
          quantity: number
          sku?: string | null
          subtotal_cents: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          fulfillment_mode?: string
          id?: string
          image_url?: string | null
          order_id?: string
          product_id?: string
          product_name?: string
          product_slug?: string
          quantity?: number
          sku?: string | null
          subtotal_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_shipment_events: {
        Row: {
          created_at: string
          description: string
          id: string
          location: string | null
          occurred_at: string
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          location?: string | null
          occurred_at?: string
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          location?: string | null
          occurred_at?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_shipment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_digital_deliveries: {
        Row: {
          access_token: string
          asset_path: string | null
          created_at: string
          delivery_type: string
          download_count: number
          expires_at: string
          external_url: string | null
          id: string
          instructions: string | null
          license_key: string | null
          max_downloads: number
          order_id: string
          product_id: string
          product_name: string
          updated_at: string
        }
        Insert: {
          access_token: string
          asset_path?: string | null
          created_at?: string
          delivery_type?: string
          download_count?: number
          expires_at: string
          external_url?: string | null
          id?: string
          instructions?: string | null
          license_key?: string | null
          max_downloads?: number
          order_id: string
          product_id: string
          product_name: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          asset_path?: string | null
          created_at?: string
          delivery_type?: string
          download_count?: number
          expires_at?: string
          external_url?: string | null
          id?: string
          instructions?: string | null
          license_key?: string | null
          max_downloads?: number
          order_id?: string
          product_id?: string
          product_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_digital_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          order_id: string
          payload: Json
          payload_hash: string
          provider: string
          provider_payment_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          payload?: Json
          payload_hash: string
          provider: string
          provider_payment_id: string
          status: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          payload?: Json
          payload_hash?: string
          provider?: string
          provider_payment_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      affiliate_commission_summary: {
        Row: {
          approved_amount: number | null
          cancelled_amount: number | null
          conversions: number | null
          currency: string | null
          forecast_amount: number | null
          organization_id: string | null
          paid_amount: number | null
          reversed_amount: number | null
          settled_amount: number | null
        }
        Relationships: []
      }
      contact_consent_state: {
        Row: {
          channel: string | null
          contact_id: string | null
          event_id: string | null
          granted: boolean | null
          occurred_at: string | null
          organization_id: string | null
          purpose: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      agent_cancel_run: {
        Args: { p_reason: string; p_run_id: string }
        Returns: undefined
      }
      agent_claim_next_run: {
        Args: never
        Returns: {
          agent: string
          claimed_at: string
          created_by: string
          goal: string
          granted_tools: string[]
          max_steps: number
          organization_id: string
          run_id: string
          step_count: number
        }[]
      }
      agent_draft_content: {
        Args: { p_draft: Json; p_run_id: string }
        Returns: {
          content_hash: string
          content_id: string
          content_status: string
          content_version: number
        }[]
      }
      agent_model_spend_since: {
        Args: { p_since: string }
        Returns: number
      }
      agent_reap_stale_runs: {
        Args: { p_lease_seconds?: number }
        Returns: number
      }
      agent_record_model_usage: {
        Args: {
          p_cost_usd: number
          p_input_tokens: number
          p_model: string
          p_output_tokens: number
          p_phase: string
          p_run_id: string
        }
        Returns: undefined
      }
      agent_set_kill_switch: {
        Args: { p_on: boolean; p_organization_id: string; p_reason?: string }
        Returns: number
      }
      agent_set_tool: {
        Args: { p_enabled: boolean; p_organization_id: string; p_tool: string }
        Returns: undefined
      }
      agent_start_run: {
        Args: { p_agent: string; p_goal: string; p_max_steps?: number; p_organization_id: string }
        Returns: string
      }
      agent_tool_catalog: {
        Args: never
        Returns: { description: string; kind: string; tool: string }[]
      }
      agent_update_limits: {
        Args: { p_max_runs_per_day: number; p_max_steps_per_run: number; p_organization_id: string }
        Returns: undefined
      }
      accept_invitation: {
        Args: { p_token_hash: string }
        Returns: {
          member_role: string
          workspace_id: string
        }[]
      }
      request_external_action: {
        Args: { p_action: string; p_payload: Json; p_social_account_id: string }
        Returns: { payload_hash: string; request_id: string }[]
      }
      decide_external_action: {
        Args: { p_decision: string; p_expected_hash: string; p_note?: string; p_request_id: string }
        Returns: string
      }
      cancel_external_action: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      external_action_hash: {
        Args: { p_action: string; p_payload: Json }
        Returns: string
      }
      approve_content: {
        Args: { p_content_id: string; p_expected_hash: string; p_note?: string }
        Returns: {
          approved_hash: string
          approved_version: number
          content_id: string
        }[]
      }
      content_canonical_hash: {
        Args: { item: Database["public"]["Tables"]["content_items"]["Row"] }
        Returns: string
      }
      archive_media_asset: {
        Args: { p_media_id: string }
        Returns: undefined
      }
      cancel_publication: {
        Args: { p_job_id: string; p_reason: string }
        Returns: undefined
      }
      create_invitation: {
        Args: {
          p_email: string
          p_organization_id: string
          p_role: string
          p_token_hash: string
        }
        Returns: {
          created: boolean
          invitation_expires_at: string
          invitation_id: string
        }[]
      }
      anonymize_contact: {
        Args: { p_contact_id: string; p_reason: string }
        Returns: string
      }
      create_contact: {
        Args: {
          p_consent_channel?: string
          p_consent_occurred_at?: string
          p_display_name: string | null
          p_email: string | null
          p_evidence_ref?: string
          p_evidence_type?: string
          p_legal_basis: string
          p_organization_id: string
          p_phone: string | null
          p_purpose: string
          p_source: string
          p_source_detail: string | null
        }
        Returns: string
      }
      export_contact_data: {
        Args: { p_contact_id: string }
        Returns: Json
      }
      record_consent: {
        Args: {
          p_action: string
          p_channel: string
          p_contact_id: string
          p_evidence_ref?: string
          p_evidence_type: string
          p_occurred_at?: string
          p_purpose: string
        }
        Returns: string
      }
      register_data_subject_request: {
        Args: { p_contact_id: string; p_details?: string; p_kind: string; p_received_at?: string; p_received_via: string }
        Returns: string
      }
      resolve_data_subject_request: {
        Args: { p_note?: string; p_request_id: string; p_status: string }
        Returns: undefined
      }
      revoke_all_consents: {
        Args: { p_contact_id: string; p_evidence_ref?: string; p_evidence_type: string }
        Returns: number
      }
      update_contact: {
        Args: {
          p_contact_id: string
          p_display_name: string | null
          p_email: string | null
          p_legal_basis: string
          p_phone: string | null
          p_purpose: string
        }
        Returns: undefined
      }
      ensure_workspace: {
        Args: never
        Returns: {
          member_role: string
          workspace_id: string
        }[]
      }
      rate_limit_consume: {
        Args: { p_scope: string; p_subject?: string }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      review_product_evidence: {
        Args: { p_decision: string; p_evidence_id: string; p_note?: string }
        Returns: {
          evidence_id: string
          product_score: number | null
        }[]
      }
      run_publication_dry_run: {
        Args: { p_job_id: string }
        Returns: {
          checks: Json
          job_status: string
        }[]
      }
      schedule_publication: {
        Args: { p_channel: string; p_content_id: string; p_scheduled_for: string }
        Returns: string
      }
      register_media_asset: {
        Args: { p_original_name: string; p_storage_path: string }
        Returns: string
      }
      revoke_media_license: {
        Args: { p_license_id: string; p_reason: string }
        Returns: undefined
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      change_member_role: {
        Args: { p_organization_id: string; p_role: string; p_user_id: string }
        Returns: {
          changed: boolean
          member_role: string
          user_id: string
        }[]
      }
      list_workspace_members: {
        Args: { p_organization_id: string }
        Returns: {
          email: string | null
          joined_at: string
          member_role: string
          user_id: string
        }[]
      }
      remove_member: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: undefined
      }
      set_active_workspace: {
        Args: { p_organization_id: string }
        Returns: {
          member_role: string
          workspace_id: string
        }[]
      }
      workspace_overview: {
        Args: { p_organization_id: string }
        Returns: Json
      }
    }
    Enums: {
      smkon_commission_status:
        | "pending"
        | "approved"
        | "settled"
        | "cancelled"
        | "reversed"
        | "paid"
      smkon_connection_status:
        | "pending"
        | "connected"
        | "reauthorization_required"
        | "disabled"
        | "error"
      smkon_revenue_domain: "paid_media" | "owned_sales" | "affiliate"
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
    Enums: {
      smkon_commission_status: [
        "pending",
        "approved",
        "settled",
        "cancelled",
        "reversed",
        "paid",
      ],
      smkon_connection_status: [
        "pending",
        "connected",
        "reauthorization_required",
        "disabled",
        "error",
      ],
      smkon_revenue_domain: ["paid_media", "owned_sales", "affiliate"],
    },
  },
} as const

