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
      activity_logs: {
        Row: {
          buyer_consults: number
          cma_deliveries: number
          company_id: string
          conversations: number
          created_at: string
          db_buyer_leads: number
          db_seller_leads: number
          door_knocks: number
          id: string
          listing_appts: number
          log_date: string
          marked_all_zeros: boolean
          offers_submitted: number
          open_houses: number
          showings: number
          updated_at: string
          user_id: string
          zillow_appts_met: number
          zillow_appts_set: number
        }
        Insert: {
          buyer_consults?: number
          cma_deliveries?: number
          company_id: string
          conversations?: number
          created_at?: string
          db_buyer_leads?: number
          db_seller_leads?: number
          door_knocks?: number
          id?: string
          listing_appts?: number
          log_date: string
          marked_all_zeros?: boolean
          offers_submitted?: number
          open_houses?: number
          showings?: number
          updated_at?: string
          user_id: string
          zillow_appts_met?: number
          zillow_appts_set?: number
        }
        Update: {
          buyer_consults?: number
          cma_deliveries?: number
          company_id?: string
          conversations?: number
          created_at?: string
          db_buyer_leads?: number
          db_seller_leads?: number
          door_knocks?: number
          id?: string
          listing_appts?: number
          log_date?: string
          marked_all_zeros?: boolean
          offers_submitted?: number
          open_houses?: number
          showings?: number
          updated_at?: string
          user_id?: string
          zillow_appts_met?: number
          zillow_appts_set?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          payload: Json
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          payload?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          payload?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_log_entries: {
        Row: {
          agent_user_id: string
          body: string
          coach_user_id: string | null
          created_at: string
          id: string
          is_test: boolean
          occurred_at: string
          updated_at: string
        }
        Insert: {
          agent_user_id: string
          body: string
          coach_user_id?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          occurred_at: string
          updated_at?: string
        }
        Update: {
          agent_user_id?: string
          body?: string
          coach_user_id?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          occurred_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_log_entries_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_log_entries_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_log_entries_coach_user_id_fkey"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_log_entries_coach_user_id_fkey"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          brokerage_license_number: string | null
          brokerage_name: string | null
          brokerage_state: string | null
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          plan: Database["public"]["Enums"]["company_plan"]
          seats_total: number
          signed_up_source: string | null
          slug: string
          status: Database["public"]["Enums"]["company_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          brokerage_license_number?: string | null
          brokerage_name?: string | null
          brokerage_state?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan?: Database["public"]["Enums"]["company_plan"]
          seats_total?: number
          signed_up_source?: string | null
          slug: string
          status?: Database["public"]["Enums"]["company_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          brokerage_license_number?: string | null
          brokerage_name?: string | null
          brokerage_state?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["company_plan"]
          seats_total?: number
          signed_up_source?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["company_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deal_activity: {
        Row: {
          created_at: string
          deal_id: string
          event_type: Database["public"]["Enums"]["deal_activity_event"]
          id: string
          payload: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          event_type: Database["public"]["Enums"]["deal_activity_event"]
          id?: string
          payload?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          event_type?: Database["public"]["Enums"]["deal_activity_event"]
          id?: string
          payload?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activity_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activity_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_ai_extractions: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          deal_file_id: string
          extracted_fields: Json | null
          id: string
          model_name: string | null
          raw_response: Json | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          deal_file_id: string
          extracted_fields?: Json | null
          id?: string
          model_name?: string | null
          raw_response?: Json | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          deal_file_id?: string
          extracted_fields?: Json | null
          id?: string
          model_name?: string | null
          raw_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_ai_extractions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ai_extractions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ai_extractions_deal_file_id_fkey"
            columns: ["deal_file_id"]
            isOneToOne: false
            referencedRelation: "deal_files"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_files: {
        Row: {
          content_type: string | null
          deal_id: string
          file_size_bytes: number | null
          id: string
          original_filename: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          deal_id: string
          file_size_bytes?: number | null
          id?: string
          original_filename: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          deal_id?: string
          file_size_bytes?: number | null
          id?: string
          original_filename?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          id: string
          is_terminal_lost: boolean
          is_terminal_won: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_terminal_lost?: boolean
          is_terminal_won?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_terminal_lost?: boolean
          is_terminal_won?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_types: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          appraisal_contingency_days: number | null
          buy_side_broker: string | null
          buyer_agent_id: string | null
          client_email: string | null
          client_first_name: string | null
          client_last_name: string | null
          client_phone: string | null
          close_date: string | null
          co_listing_agent_id: string | null
          commission_pct: number | null
          company_id: string
          created_at: string
          created_by: string | null
          deal_type_id: string | null
          deleted_at: string | null
          gci_cents: number | null
          id: string
          inspection_contingency_days: number | null
          listing_agent_id: string | null
          listing_broker: string | null
          loan_contingency_days: number | null
          property_address: string | null
          property_city: string | null
          property_state: string | null
          property_zip: string | null
          public_share_link_enabled: boolean
          representing: Database["public"]["Enums"]["deal_representing"] | null
          rpa_signed_date: string | null
          sales_price_cents: number | null
          stage_id: string | null
          updated_at: string
        }
        Insert: {
          appraisal_contingency_days?: number | null
          buy_side_broker?: string | null
          buyer_agent_id?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          close_date?: string | null
          co_listing_agent_id?: string | null
          commission_pct?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deal_type_id?: string | null
          deleted_at?: string | null
          gci_cents?: number | null
          id?: string
          inspection_contingency_days?: number | null
          listing_agent_id?: string | null
          listing_broker?: string | null
          loan_contingency_days?: number | null
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_zip?: string | null
          public_share_link_enabled?: boolean
          representing?: Database["public"]["Enums"]["deal_representing"] | null
          rpa_signed_date?: string | null
          sales_price_cents?: number | null
          stage_id?: string | null
          updated_at?: string
        }
        Update: {
          appraisal_contingency_days?: number | null
          buy_side_broker?: string | null
          buyer_agent_id?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          close_date?: string | null
          co_listing_agent_id?: string | null
          commission_pct?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deal_type_id?: string | null
          deleted_at?: string | null
          gci_cents?: number | null
          id?: string
          inspection_contingency_days?: number | null
          listing_agent_id?: string | null
          listing_broker?: string | null
          loan_contingency_days?: number | null
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_zip?: string | null
          public_share_link_enabled?: boolean
          representing?: Database["public"]["Enums"]["deal_representing"] | null
          rpa_signed_date?: string | null
          sales_price_cents?: number | null
          stage_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_buyer_agent_id_fkey"
            columns: ["buyer_agent_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_buyer_agent_id_fkey"
            columns: ["buyer_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_co_listing_agent_id_fkey"
            columns: ["co_listing_agent_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_co_listing_agent_id_fkey"
            columns: ["co_listing_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_deal_type_id_fkey"
            columns: ["deal_type_id"]
            isOneToOne: false
            referencedRelation: "deal_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_agent_id_fkey"
            columns: ["listing_agent_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_agent_id_fkey"
            columns: ["listing_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled_company_ids: string[]
          enabled_globally: boolean
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled_company_ids?: string[]
          enabled_globally?: boolean
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled_company_ids?: string[]
          enabled_globally?: boolean
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          company_id: string
          created_at: string
          goal_type: Database["public"]["Enums"]["goal_type"]
          id: string
          period: Database["public"]["Enums"]["goal_period"]
          period_start: string
          target_value: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          goal_type: Database["public"]["Enums"]["goal_type"]
          id?: string
          period: Database["public"]["Enums"]["goal_period"]
          period_start: string
          target_value: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          goal_type?: Database["public"]["Enums"]["goal_type"]
          id?: string
          period?: Database["public"]["Enums"]["goal_period"]
          period_start?: string
          target_value?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_thread_participants: {
        Row: {
          joined_at: string
          last_read_at: string | null
          notifications_enabled: boolean
          thread_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          last_read_at?: string | null
          notifications_enabled?: boolean
          thread_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          last_read_at?: string | null
          notifications_enabled?: boolean
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_thread_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_thread_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          type: Database["public"]["Enums"]["message_thread_type"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          type: Database["public"]["Enums"]["message_thread_type"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          type?: Database["public"]["Enums"]["message_thread_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          reply_to_message_id: string | null
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          attachments?: Json
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_message_id?: string | null
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          attachments?: Json
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_message_id?: string | null
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      request_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          is_internal: boolean
          request_id: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          request_id: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          request_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "active_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      request_files: {
        Row: {
          content_type: string | null
          file_size_bytes: number | null
          id: string
          original_filename: string
          request_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          file_size_bytes?: number | null
          id?: string
          original_filename: string
          request_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          file_size_bytes?: number | null
          id?: string
          original_filename?: string
          request_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_files_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "active_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_files_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      request_types: {
        Row: {
          company_id: string | null
          created_at: string
          default_assignee_role: Database["public"]["Enums"]["user_role"] | null
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          default_assignee_role?:
            | Database["public"]["Enums"]["user_role"]
            | null
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          default_assignee_role?:
            | Database["public"]["Enums"]["user_role"]
            | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          assigned_to_role: Database["public"]["Enums"]["user_role"] | null
          assigned_to_user_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["request_priority"]
          related_deal_id: string | null
          request_type_id: string
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_role?: Database["public"]["Enums"]["user_role"] | null
          assigned_to_user_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["request_priority"]
          related_deal_id?: string | null
          request_type_id: string
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_role?: Database["public"]["Enums"]["user_role"] | null
          assigned_to_user_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["request_priority"]
          related_deal_id?: string | null
          request_type_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_related_deal_id_fkey"
            columns: ["related_deal_id"]
            isOneToOne: false
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_related_deal_id_fkey"
            columns: ["related_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "request_types"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          company_id: string | null
          created_at: string
          event_type: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          stripe_event_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          stripe_event_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          stripe_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          content: Json
          created_at: string
          deleted_at: string | null
          description: string | null
          estimated_minutes: number | null
          id: string
          position: number
          recommended_timeline_days: number | null
          section_id: string
          status: Database["public"]["Enums"]["publish_status"]
          title: string
          updated_at: string
          visible_to_roles: Database["public"]["Enums"]["user_role"][]
        }
        Insert: {
          content?: Json
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          position?: number
          recommended_timeline_days?: number | null
          section_id: string
          status?: Database["public"]["Enums"]["publish_status"]
          title: string
          updated_at?: string
          visible_to_roles?: Database["public"]["Enums"]["user_role"][]
        }
        Update: {
          content?: Json
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          position?: number
          recommended_timeline_days?: number | null
          section_id?: string
          status?: Database["public"]["Enums"]["publish_status"]
          title?: string
          updated_at?: string
          visible_to_roles?: Database["public"]["Enums"]["user_role"][]
        }
        Relationships: [
          {
            foreignKeyName: "training_modules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "active_training_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_modules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "training_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      training_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_viewed_at: string | null
          module_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["progress_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          module_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          module_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "active_training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sections: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          position: number
          status: Database["public"]["Enums"]["publish_status"]
          title: string
          updated_at: string
          visible_to_roles: Database["public"]["Enums"]["user_role"][]
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          position?: number
          status?: Database["public"]["Enums"]["publish_status"]
          title: string
          updated_at?: string
          visible_to_roles?: Database["public"]["Enums"]["user_role"][]
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          position?: number
          status?: Database["public"]["Enums"]["publish_status"]
          title?: string
          updated_at?: string
          visible_to_roles?: Database["public"]["Enums"]["user_role"][]
        }
        Relationships: [
          {
            foreignKeyName: "training_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          assigned_module_ids: string[]
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          token: string
          welcome_message: string | null
        }
        Insert: {
          accepted_at?: string | null
          assigned_module_ids?: string[]
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["user_role"]
          token: string
          welcome_message?: string | null
        }
        Update: {
          accepted_at?: string | null
          assigned_module_ids?: string[]
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          invited_at: string | null
          last_active_at: string | null
          license_number: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          invited_at?: string | null
          last_active_at?: string | null
          license_number?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          invited_at?: string | null
          last_active_at?: string | null
          license_number?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_companies: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          plan: Database["public"]["Enums"]["company_plan"] | null
          seats_total: number | null
          signed_up_source: string | null
          slug: string | null
          status: Database["public"]["Enums"]["company_status"] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          plan?: Database["public"]["Enums"]["company_plan"] | null
          seats_total?: number | null
          signed_up_source?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["company_status"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          plan?: Database["public"]["Enums"]["company_plan"] | null
          seats_total?: number | null
          signed_up_source?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["company_status"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      active_deals: {
        Row: {
          appraisal_contingency_days: number | null
          buy_side_broker: string | null
          buyer_agent_id: string | null
          client_email: string | null
          client_first_name: string | null
          client_last_name: string | null
          client_phone: string | null
          close_date: string | null
          co_listing_agent_id: string | null
          commission_pct: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          deal_type_id: string | null
          deleted_at: string | null
          gci_cents: number | null
          id: string | null
          inspection_contingency_days: number | null
          listing_agent_id: string | null
          listing_broker: string | null
          loan_contingency_days: number | null
          property_address: string | null
          property_city: string | null
          property_state: string | null
          property_zip: string | null
          public_share_link_enabled: boolean | null
          representing: Database["public"]["Enums"]["deal_representing"] | null
          rpa_signed_date: string | null
          sales_price_cents: number | null
          stage_id: string | null
          updated_at: string | null
        }
        Insert: {
          appraisal_contingency_days?: number | null
          buy_side_broker?: string | null
          buyer_agent_id?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          close_date?: string | null
          co_listing_agent_id?: string | null
          commission_pct?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_type_id?: string | null
          deleted_at?: string | null
          gci_cents?: number | null
          id?: string | null
          inspection_contingency_days?: number | null
          listing_agent_id?: string | null
          listing_broker?: string | null
          loan_contingency_days?: number | null
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_zip?: string | null
          public_share_link_enabled?: boolean | null
          representing?: Database["public"]["Enums"]["deal_representing"] | null
          rpa_signed_date?: string | null
          sales_price_cents?: number | null
          stage_id?: string | null
          updated_at?: string | null
        }
        Update: {
          appraisal_contingency_days?: number | null
          buy_side_broker?: string | null
          buyer_agent_id?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          close_date?: string | null
          co_listing_agent_id?: string | null
          commission_pct?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_type_id?: string | null
          deleted_at?: string | null
          gci_cents?: number | null
          id?: string | null
          inspection_contingency_days?: number | null
          listing_agent_id?: string | null
          listing_broker?: string | null
          loan_contingency_days?: number | null
          property_address?: string | null
          property_city?: string | null
          property_state?: string | null
          property_zip?: string | null
          public_share_link_enabled?: boolean | null
          representing?: Database["public"]["Enums"]["deal_representing"] | null
          rpa_signed_date?: string | null
          sales_price_cents?: number | null
          stage_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_buyer_agent_id_fkey"
            columns: ["buyer_agent_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_buyer_agent_id_fkey"
            columns: ["buyer_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_co_listing_agent_id_fkey"
            columns: ["co_listing_agent_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_co_listing_agent_id_fkey"
            columns: ["co_listing_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_deal_type_id_fkey"
            columns: ["deal_type_id"]
            isOneToOne: false
            referencedRelation: "deal_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_agent_id_fkey"
            columns: ["listing_agent_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_agent_id_fkey"
            columns: ["listing_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      active_requests: {
        Row: {
          assigned_to_role: Database["public"]["Enums"]["user_role"] | null
          assigned_to_user_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string | null
          priority: Database["public"]["Enums"]["request_priority"] | null
          related_deal_id: string | null
          request_type_id: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to_role?: Database["public"]["Enums"]["user_role"] | null
          assigned_to_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string | null
          priority?: Database["public"]["Enums"]["request_priority"] | null
          related_deal_id?: string | null
          request_type_id?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to_role?: Database["public"]["Enums"]["user_role"] | null
          assigned_to_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string | null
          priority?: Database["public"]["Enums"]["request_priority"] | null
          related_deal_id?: string | null
          request_type_id?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_related_deal_id_fkey"
            columns: ["related_deal_id"]
            isOneToOne: false
            referencedRelation: "active_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_related_deal_id_fkey"
            columns: ["related_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "request_types"
            referencedColumns: ["id"]
          },
        ]
      }
      active_training_modules: {
        Row: {
          content: Json | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          estimated_minutes: number | null
          id: string | null
          position: number | null
          recommended_timeline_days: number | null
          section_id: string | null
          status: Database["public"]["Enums"]["publish_status"] | null
          title: string | null
          updated_at: string | null
          visible_to_roles: Database["public"]["Enums"]["user_role"][] | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string | null
          position?: number | null
          recommended_timeline_days?: number | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["publish_status"] | null
          title?: string | null
          updated_at?: string | null
          visible_to_roles?: Database["public"]["Enums"]["user_role"][] | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string | null
          position?: number | null
          recommended_timeline_days?: number | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["publish_status"] | null
          title?: string | null
          updated_at?: string | null
          visible_to_roles?: Database["public"]["Enums"]["user_role"][] | null
        }
        Relationships: [
          {
            foreignKeyName: "training_modules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "active_training_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_modules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "training_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      active_training_sections: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string | null
          position: number | null
          status: Database["public"]["Enums"]["publish_status"] | null
          title: string | null
          updated_at: string | null
          visible_to_roles: Database["public"]["Enums"]["user_role"][] | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          position?: number | null
          status?: Database["public"]["Enums"]["publish_status"] | null
          title?: string | null
          updated_at?: string | null
          visible_to_roles?: Database["public"]["Enums"]["user_role"][] | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          position?: number | null
          status?: Database["public"]["Enums"]["publish_status"] | null
          title?: string | null
          updated_at?: string | null
          visible_to_roles?: Database["public"]["Enums"]["user_role"][] | null
        }
        Relationships: [
          {
            foreignKeyName: "training_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      active_users: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          invited_at: string | null
          last_active_at: string | null
          license_number: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: Database["public"]["Enums"]["user_status"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          invited_at?: string | null
          last_active_at?: string | null
          license_number?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          invited_at?: string | null
          last_active_at?: string | null
          license_number?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_user_company_id: { Args: never; Returns: string }
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      can_manage_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      is_team_lead_of: {
        Args: { target_company_id: string; uid: string }
        Returns: boolean
      }
      is_thread_participant: { Args: { tid: string }; Returns: boolean }
    }
    Enums: {
      company_plan: "launch" | "pro" | "brokerage"
      company_status: "trialing" | "active" | "past_due" | "canceled" | "paused"
      deal_activity_event:
        | "created"
        | "stage_changed"
        | "field_updated"
        | "file_uploaded"
        | "ai_extracted"
        | "comment_added"
      deal_representing: "buyer" | "seller" | "dual"
      goal_period: "monthly" | "quarterly" | "annual"
      goal_type:
        | "gci_cents"
        | "closed_volume_cents"
        | "closed_deals_count"
        | "appointments_count"
        | "conversations_count"
      message_thread_type: "direct" | "group" | "channel"
      progress_status: "not_started" | "in_progress" | "completed"
      publish_status: "draft" | "published" | "archived"
      request_priority: "low" | "normal" | "high" | "urgent"
      request_status:
        | "pending"
        | "in_progress"
        | "ready_for_review"
        | "completed"
        | "rejected"
      user_role:
        | "super_admin"
        | "team_lead"
        | "agent"
        | "admin_tc"
        | "marketing"
      user_status: "invited" | "active" | "archived"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      company_plan: ["launch", "pro", "brokerage"],
      company_status: ["trialing", "active", "past_due", "canceled", "paused"],
      deal_activity_event: [
        "created",
        "stage_changed",
        "field_updated",
        "file_uploaded",
        "ai_extracted",
        "comment_added",
      ],
      deal_representing: ["buyer", "seller", "dual"],
      goal_period: ["monthly", "quarterly", "annual"],
      goal_type: [
        "gci_cents",
        "closed_volume_cents",
        "closed_deals_count",
        "appointments_count",
        "conversations_count",
      ],
      message_thread_type: ["direct", "group", "channel"],
      progress_status: ["not_started", "in_progress", "completed"],
      publish_status: ["draft", "published", "archived"],
      request_priority: ["low", "normal", "high", "urgent"],
      request_status: [
        "pending",
        "in_progress",
        "ready_for_review",
        "completed",
        "rejected",
      ],
      user_role: ["super_admin", "team_lead", "agent", "admin_tc", "marketing"],
      user_status: ["invited", "active", "archived"],
    },
  },
} as const
