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
          commission_percent: number | null
          created_at: string
          created_by: string
          currency: string
          evidence: Json
          external_id: string | null
          id: string
          name: string
          organization_id: string
          price_cents: number | null
          revenue_domain: Database["public"]["Enums"]["smkon_revenue_domain"]
          score: number | null
          score_reasons: Json
          source: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          affiliate_url?: string | null
          commission_percent?: number | null
          created_at?: string
          created_by?: string
          currency?: string
          evidence?: Json
          external_id?: string | null
          id?: string
          name: string
          organization_id: string
          price_cents?: number | null
          revenue_domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          score?: number | null
          score_reasons?: Json
          source: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          affiliate_url?: string | null
          commission_percent?: number | null
          created_at?: string
          created_by?: string
          currency?: string
          evidence?: Json
          external_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          price_cents?: number | null
          revenue_domain?: Database["public"]["Enums"]["smkon_revenue_domain"]
          score?: number | null
          score_reasons?: Json
          source?: string
          status?: string
          type?: string
          updated_at?: string
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
    }
    Functions: {
      accept_invitation: {
        Args: { p_token_hash: string }
        Returns: {
          member_role: string
          workspace_id: string
        }[]
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
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
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

