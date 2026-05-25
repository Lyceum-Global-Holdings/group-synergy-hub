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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounting_periods: {
        Row: {
          closed_by: string | null
          closed_date: string | null
          company_id: string | null
          created_at: string | null
          end_date: string
          fiscal_year: number
          id: string
          period_name: string
          period_number: number
          start_date: string
          status: Database["public"]["Enums"]["period_status"] | null
          updated_at: string | null
        }
        Insert: {
          closed_by?: string | null
          closed_date?: string | null
          company_id?: string | null
          created_at?: string | null
          end_date: string
          fiscal_year: number
          id?: string
          period_name: string
          period_number: number
          start_date: string
          status?: Database["public"]["Enums"]["period_status"] | null
          updated_at?: string | null
        }
        Update: {
          closed_by?: string | null
          closed_date?: string | null
          company_id?: string | null
          created_at?: string | null
          end_date?: string
          fiscal_year?: number
          id?: string
          period_name?: string
          period_number?: number
          start_date?: string
          status?: Database["public"]["Enums"]["period_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      approval_routing_rules: {
        Row: {
          company_id: string | null
          condition_field: string | null
          condition_operator: string | null
          condition_value: string | null
          created_at: string | null
          id: string
          required_stages: number[] | null
          rule_name: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          condition_field?: string | null
          condition_operator?: string | null
          condition_value?: string | null
          created_at?: string | null
          id?: string
          required_stages?: number[] | null
          rule_name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          condition_field?: string | null
          condition_operator?: string | null
          condition_value?: string | null
          created_at?: string | null
          id?: string
          required_stages?: number[] | null
          rule_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_routing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_stages: {
        Row: {
          approval_type: string | null
          company_id: string | null
          created_at: string | null
          escalation_days: number | null
          id: string
          required: boolean | null
          required_role: string | null
          stage_description: string | null
          stage_name: string
          stage_order: number
          updated_at: string | null
        }
        Insert: {
          approval_type?: string | null
          company_id?: string | null
          created_at?: string | null
          escalation_days?: number | null
          id?: string
          required?: boolean | null
          required_role?: string | null
          stage_description?: string | null
          stage_name: string
          stage_order: number
          updated_at?: string | null
        }
        Update: {
          approval_type?: string | null
          company_id?: string | null
          created_at?: string | null
          escalation_days?: number | null
          id?: string
          required?: boolean | null
          required_role?: string | null
          stage_description?: string | null
          stage_name?: string
          stage_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      approver_assignments: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          is_backup: boolean | null
          notification_enabled: boolean | null
          role_required: string | null
          stage_order: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_backup?: boolean | null
          notification_enabled?: boolean | null
          role_required?: string | null
          stage_order: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_backup?: boolean | null
          notification_enabled?: boolean | null
          role_required?: string | null
          stage_order?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approver_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_categories: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_disposals: {
        Row: {
          asset_id: string
          buyer_name: string | null
          company_id: string | null
          created_at: string | null
          disposal_date: string
          disposal_method: string
          disposed_by: string | null
          gain_loss: number | null
          id: string
          journal_entry_id: string | null
          net_book_value_at_disposal: number
          notes: string | null
          proceeds: number
          status: string
          updated_at: string | null
        }
        Insert: {
          asset_id: string
          buyer_name?: string | null
          company_id?: string | null
          created_at?: string | null
          disposal_date?: string
          disposal_method?: string
          disposed_by?: string | null
          gain_loss?: number | null
          id?: string
          journal_entry_id?: string | null
          net_book_value_at_disposal?: number
          notes?: string | null
          proceeds?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          asset_id?: string
          buyer_name?: string | null
          company_id?: string | null
          created_at?: string | null
          disposal_date?: string
          disposal_method?: string
          disposed_by?: string | null
          gain_loss?: number | null
          id?: string
          journal_entry_id?: string | null
          net_book_value_at_disposal?: number
          notes?: string | null
          proceeds?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_disposals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "warehouse_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_disposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_disposals_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_master: {
        Row: {
          accumulated_depreciation: number | null
          asset_name: string
          brand: string | null
          category_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          current_value: number | null
          depreciation_method: string | null
          depreciation_rate: number | null
          description: string | null
          id: string
          image_url: string | null
          purchase_date: string | null
          purchase_price: number | null
          salvage_value: number | null
          status: string | null
          subcategory_id: string | null
          updated_at: string
          useful_life_years: number | null
        }
        Insert: {
          accumulated_depreciation?: number | null
          asset_name: string
          brand?: string | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          depreciation_method?: string | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          salvage_value?: number | null
          status?: string | null
          subcategory_id?: string | null
          updated_at?: string
          useful_life_years?: number | null
        }
        Update: {
          accumulated_depreciation?: number | null
          asset_name?: string
          brand?: string | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          depreciation_method?: string | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          salvage_value?: number | null
          status?: string | null
          subcategory_id?: string | null
          updated_at?: string
          useful_life_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_master_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_master_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_master_purchase_history: {
        Row: {
          asset_master_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          purchase_date: string
          purchase_price: number
          quantity_purchased: number | null
          vendor: string | null
        }
        Insert: {
          asset_master_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_date: string
          purchase_price: number
          quantity_purchased?: number | null
          vendor?: string | null
        }
        Update: {
          asset_master_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_date?: string
          purchase_price?: number
          quantity_purchased?: number | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_master_purchase_history_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_master"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_request_approvals: {
        Row: {
          action: Database["public"]["Enums"]["asset_approval_action"]
          approval_level: Database["public"]["Enums"]["asset_approval_level"]
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["asset_approval_action"]
          approval_level: Database["public"]["Enums"]["asset_approval_level"]
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["asset_approval_action"]
          approval_level?: Database["public"]["Enums"]["asset_approval_level"]
          approver_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_request_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "asset_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_request_deliveries: {
        Row: {
          created_at: string
          delivered_by: string | null
          delivery_date: string
          delivery_location: string | null
          delivery_notes: string | null
          id: string
          request_id: string
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_by?: string | null
          delivery_date?: string
          delivery_location?: string | null
          delivery_notes?: string | null
          id?: string
          request_id: string
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_by?: string | null
          delivery_date?: string
          delivery_location?: string | null
          delivery_notes?: string | null
          id?: string
          request_id?: string
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_request_deliveries_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "asset_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_request_delivery_items: {
        Row: {
          created_at: string
          delivery_id: string
          delivery_notes: string | null
          id: string
          quantity_delivered: number
          quantity_received: number | null
          receipt_notes: string | null
          received_at: string | null
          received_by: string | null
          request_item_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          delivery_notes?: string | null
          id?: string
          quantity_delivered?: number
          quantity_received?: number | null
          receipt_notes?: string | null
          received_at?: string | null
          received_by?: string | null
          request_item_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          delivery_notes?: string | null
          id?: string
          quantity_delivered?: number
          quantity_received?: number | null
          receipt_notes?: string | null
          received_at?: string | null
          received_by?: string | null
          request_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_request_delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "asset_request_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_request_delivery_items_request_item_id_fkey"
            columns: ["request_item_id"]
            isOneToOne: false
            referencedRelation: "asset_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_request_items: {
        Row: {
          asset_master_id: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          fulfillment_method:
            | Database["public"]["Enums"]["asset_fulfillment_method"]
            | null
          id: string
          item_description: string | null
          item_name: string
          justification: string | null
          line_number: number | null
          notes: string | null
          preferred_vendor: string | null
          quantity_approved: number | null
          quantity_fulfilled: number | null
          quantity_requested: number
          request_id: string
          request_type: Database["public"]["Enums"]["asset_request_item_type"]
          specifications: string | null
          status:
            | Database["public"]["Enums"]["asset_request_item_status"]
            | null
          subcategory_id: string | null
          total_price_estimate: number | null
          unit_price_estimate: number | null
          updated_at: string
          warehouse_asset_id: string | null
        }
        Insert: {
          asset_master_id?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          fulfillment_method?:
            | Database["public"]["Enums"]["asset_fulfillment_method"]
            | null
          id?: string
          item_description?: string | null
          item_name: string
          justification?: string | null
          line_number?: number | null
          notes?: string | null
          preferred_vendor?: string | null
          quantity_approved?: number | null
          quantity_fulfilled?: number | null
          quantity_requested: number
          request_id: string
          request_type: Database["public"]["Enums"]["asset_request_item_type"]
          specifications?: string | null
          status?:
            | Database["public"]["Enums"]["asset_request_item_status"]
            | null
          subcategory_id?: string | null
          total_price_estimate?: number | null
          unit_price_estimate?: number | null
          updated_at?: string
          warehouse_asset_id?: string | null
        }
        Update: {
          asset_master_id?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          fulfillment_method?:
            | Database["public"]["Enums"]["asset_fulfillment_method"]
            | null
          id?: string
          item_description?: string | null
          item_name?: string
          justification?: string | null
          line_number?: number | null
          notes?: string | null
          preferred_vendor?: string | null
          quantity_approved?: number | null
          quantity_fulfilled?: number | null
          quantity_requested?: number
          request_id?: string
          request_type?: Database["public"]["Enums"]["asset_request_item_type"]
          specifications?: string | null
          status?:
            | Database["public"]["Enums"]["asset_request_item_status"]
            | null
          subcategory_id?: string | null
          total_price_estimate?: number | null
          unit_price_estimate?: number | null
          updated_at?: string
          warehouse_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_request_items_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_request_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "asset_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_request_items_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_request_items_warehouse_asset_id_fkey"
            columns: ["warehouse_asset_id"]
            isOneToOne: false
            referencedRelation: "warehouse_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_request_returns: {
        Row: {
          company_id: string | null
          created_at: string
          delivery_id: string
          id: string
          items: Json
          request_id: string
          return_date: string
          return_notes: string | null
          return_reason: string
          returned_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          delivery_id: string
          id?: string
          items?: Json
          request_id: string
          return_date?: string
          return_notes?: string | null
          return_reason: string
          returned_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          delivery_id?: string
          id?: string
          items?: Json
          request_id?: string
          return_date?: string
          return_notes?: string | null
          return_reason?: string
          returned_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_request_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_request_returns_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "asset_request_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_request_returns_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "asset_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_request_workflow_history: {
        Row: {
          comments: string | null
          created_at: string
          id: string
          metadata: Json | null
          performed_at: string
          performed_by: string | null
          request_id: string
          workflow_stage: Database["public"]["Enums"]["workflow_stage"]
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_at?: string
          performed_by?: string | null
          request_id: string
          workflow_stage: Database["public"]["Enums"]["workflow_stage"]
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_at?: string
          performed_by?: string | null
          request_id?: string
          workflow_stage?: Database["public"]["Enums"]["workflow_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "asset_request_workflow_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "asset_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_requests: {
        Row: {
          company_id: string | null
          contact_number: string | null
          created_at: string
          created_by: string | null
          department: string | null
          department_id: string | null
          fulfilled_by: string | null
          fulfilled_date: string | null
          hod_approval_date: string | null
          hod_approved_by: string | null
          hod_comments: string | null
          id: string
          justification: string | null
          notes: string | null
          priority: Database["public"]["Enums"]["asset_request_priority"]
          procurement_approval_date: string | null
          procurement_approved_by: string | null
          procurement_comments: string | null
          purchase_notes: string | null
          purchased_by: string | null
          purchased_date: string | null
          purpose: string
          rejection_reason: string | null
          request_date: string
          request_number: string
          requested_by: string | null
          requester_name: string
          required_date: string
          status: Database["public"]["Enums"]["asset_request_status"]
          total_estimated_cost: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          department_id?: string | null
          fulfilled_by?: string | null
          fulfilled_date?: string | null
          hod_approval_date?: string | null
          hod_approved_by?: string | null
          hod_comments?: string | null
          id?: string
          justification?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["asset_request_priority"]
          procurement_approval_date?: string | null
          procurement_approved_by?: string | null
          procurement_comments?: string | null
          purchase_notes?: string | null
          purchased_by?: string | null
          purchased_date?: string | null
          purpose: string
          rejection_reason?: string | null
          request_date?: string
          request_number: string
          requested_by?: string | null
          requester_name: string
          required_date: string
          status?: Database["public"]["Enums"]["asset_request_status"]
          total_estimated_cost?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          department_id?: string | null
          fulfilled_by?: string | null
          fulfilled_date?: string | null
          hod_approval_date?: string | null
          hod_approved_by?: string | null
          hod_comments?: string | null
          id?: string
          justification?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["asset_request_priority"]
          procurement_approval_date?: string | null
          procurement_approved_by?: string | null
          procurement_comments?: string | null
          purchase_notes?: string | null
          purchased_by?: string | null
          purchased_date?: string | null
          purpose?: string
          rejection_reason?: string | null
          request_date?: string
          request_number?: string
          requested_by?: string | null
          requester_name?: string
          required_date?: string
          status?: Database["public"]["Enums"]["asset_request_status"]
          total_estimated_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_revaluations: {
        Row: {
          adjustment_amount: number | null
          asset_id: string
          company_id: string | null
          created_at: string | null
          id: string
          journal_entry_id: string | null
          new_value: number
          old_value: number
          reason: string | null
          revaluation_date: string
          revalued_by: string | null
          updated_at: string | null
        }
        Insert: {
          adjustment_amount?: number | null
          asset_id: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          journal_entry_id?: string | null
          new_value?: number
          old_value?: number
          reason?: string | null
          revaluation_date?: string
          revalued_by?: string | null
          updated_at?: string | null
        }
        Update: {
          adjustment_amount?: number | null
          asset_id?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          journal_entry_id?: string | null
          new_value?: number
          old_value?: number
          reason?: string | null
          revaluation_date?: string
          revalued_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_revaluations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "warehouse_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_revaluations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_revaluations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_transactions: {
        Row: {
          amount: number
          asset_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          journal_entry_id: string | null
          reference_number: string | null
          transaction_date: string
          transaction_type: string | null
          warehouse_asset_id: string | null
        }
        Insert: {
          amount: number
          asset_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          reference_number?: string | null
          transaction_date: string
          transaction_type?: string | null
          warehouse_asset_id?: string | null
        }
        Update: {
          amount?: number
          asset_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          reference_number?: string | null
          transaction_date?: string
          transaction_type?: string | null
          warehouse_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transactions_warehouse_asset_id_fkey"
            columns: ["warehouse_asset_id"]
            isOneToOne: false
            referencedRelation: "warehouse_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_transfers: {
        Row: {
          asset_id: string
          created_at: string
          from_department_id: string | null
          from_location_id: string | null
          from_sublocation_id: string | null
          id: string
          notes: string | null
          to_department_id: string | null
          to_location_id: string | null
          to_sublocation_id: string | null
          transfer_date: string
          transfer_reason: string | null
          transferred_by: string | null
          updated_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          from_department_id?: string | null
          from_location_id?: string | null
          from_sublocation_id?: string | null
          id?: string
          notes?: string | null
          to_department_id?: string | null
          to_location_id?: string | null
          to_sublocation_id?: string | null
          transfer_date?: string
          transfer_reason?: string | null
          transferred_by?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          from_department_id?: string | null
          from_location_id?: string | null
          from_sublocation_id?: string | null
          id?: string
          notes?: string | null
          to_department_id?: string | null
          to_location_id?: string | null
          to_sublocation_id?: string | null
          transfer_date?: string
          transfer_reason?: string | null
          transferred_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_transfers_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "warehouse_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transfers_from_department_id_fkey"
            columns: ["from_department_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transfers_from_sublocation_id_fkey"
            columns: ["from_sublocation_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transfers_to_department_id_fkey"
            columns: ["to_department_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transfers_to_sublocation_id_fkey"
            columns: ["to_sublocation_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      bad_debt_provisions: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          journal_entry_id: string | null
          notes: string | null
          provision_date: string
          reason: string | null
          recovery_amount: number
          status: string
          updated_at: string | null
          write_off_date: string | null
        }
        Insert: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          provision_date?: string
          reason?: string | null
          recovery_amount?: number
          status?: string
          updated_at?: string | null
          write_off_date?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          provision_date?: string
          reason?: string | null
          recovery_amount?: number
          status?: string
          updated_at?: string | null
          write_off_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bad_debt_provisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bad_debt_provisions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bad_debt_provisions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bad_debt_provisions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bad_debt_provisions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          branch_name: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          current_balance: number | null
          gl_account_id: string | null
          iban: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          opening_balance: number | null
          swift_code: string | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          branch_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          current_balance?: number | null
          gl_account_id?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          opening_balance?: number | null
          swift_code?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          branch_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          current_balance?: number | null
          gl_account_id?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          opening_balance?: number | null
          swift_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliation_sessions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bank_account_id: string
          closing_book_balance: number
          company_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          difference: number | null
          id: string
          notes: string | null
          opening_book_balance: number
          outstanding_checks: number | null
          outstanding_checks_amount: number | null
          outstanding_deposits: number | null
          outstanding_deposits_amount: number | null
          period_end: string
          period_start: string
          reconciled_balance: number | null
          statement_balance: number
          statement_import_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id: string
          closing_book_balance: number
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          difference?: number | null
          id?: string
          notes?: string | null
          opening_book_balance: number
          outstanding_checks?: number | null
          outstanding_checks_amount?: number | null
          outstanding_deposits?: number | null
          outstanding_deposits_amount?: number | null
          period_end: string
          period_start: string
          reconciled_balance?: number | null
          statement_balance: number
          statement_import_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string
          closing_book_balance?: number
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          difference?: number | null
          id?: string
          notes?: string | null
          opening_book_balance?: number
          outstanding_checks?: number | null
          outstanding_checks_amount?: number | null
          outstanding_deposits?: number | null
          outstanding_deposits_amount?: number | null
          period_end?: string
          period_start?: string
          reconciled_balance?: number | null
          statement_balance?: number
          statement_import_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliation_sessions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_sessions_statement_import_id_fkey"
            columns: ["statement_import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          adjusted_book_balance: number | null
          bank_account_id: string | null
          book_balance: number
          company_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          difference: number | null
          id: string
          notes: string | null
          reconciliation_date: string
          statement_balance: number
          statement_id: string | null
          status: string | null
        }
        Insert: {
          adjusted_book_balance?: number | null
          bank_account_id?: string | null
          book_balance: number
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          difference?: number | null
          id?: string
          notes?: string | null
          reconciliation_date: string
          statement_balance: number
          statement_id?: string | null
          status?: string | null
        }
        Update: {
          adjusted_book_balance?: number | null
          bank_account_id?: string | null
          book_balance?: number
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          difference?: number | null
          id?: string
          notes?: string | null
          reconciliation_date?: string
          statement_balance?: number
          statement_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_imports: {
        Row: {
          bank_account_id: string
          closing_balance: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          file_format: string | null
          file_name: string
          id: string
          import_date: string | null
          matched_count: number | null
          notes: string | null
          opening_balance: number | null
          period_end: string | null
          period_start: string | null
          statement_date: string | null
          status: string | null
          total_credits: number | null
          total_debits: number | null
          transaction_count: number | null
          unmatched_count: number | null
        }
        Insert: {
          bank_account_id: string
          closing_balance?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_format?: string | null
          file_name: string
          id?: string
          import_date?: string | null
          matched_count?: number | null
          notes?: string | null
          opening_balance?: number | null
          period_end?: string | null
          period_start?: string | null
          statement_date?: string | null
          status?: string | null
          total_credits?: number | null
          total_debits?: number | null
          transaction_count?: number | null
          unmatched_count?: number | null
        }
        Update: {
          bank_account_id?: string
          closing_balance?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_format?: string | null
          file_name?: string
          id?: string
          import_date?: string | null
          matched_count?: number | null
          notes?: string | null
          opening_balance?: number | null
          period_end?: string | null
          period_start?: string | null
          statement_date?: string | null
          status?: string | null
          total_credits?: number | null
          total_debits?: number | null
          transaction_count?: number | null
          unmatched_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_imports_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          check_number: string | null
          create_transaction: boolean | null
          created_at: string | null
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          gl_account_id: string | null
          id: string
          import_id: string
          line_number: number
          match_confidence: number | null
          match_reason: string | null
          match_status: string | null
          matched_at: string | null
          matched_by: string | null
          matched_transaction_id: string | null
          payee_name: string | null
          reference: string | null
          running_balance: number | null
          transaction_date: string
          transaction_type: string | null
          value_date: string | null
        }
        Insert: {
          check_number?: string | null
          create_transaction?: boolean | null
          created_at?: string | null
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          gl_account_id?: string | null
          id?: string
          import_id: string
          line_number: number
          match_confidence?: number | null
          match_reason?: string | null
          match_status?: string | null
          matched_at?: string | null
          matched_by?: string | null
          matched_transaction_id?: string | null
          payee_name?: string | null
          reference?: string | null
          running_balance?: number | null
          transaction_date: string
          transaction_type?: string | null
          value_date?: string | null
        }
        Update: {
          check_number?: string | null
          create_transaction?: boolean | null
          created_at?: string | null
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          gl_account_id?: string | null
          id?: string
          import_id?: string
          line_number?: number
          match_confidence?: number | null
          match_reason?: string | null
          match_status?: string | null
          matched_at?: string | null
          matched_by?: string | null
          matched_transaction_id?: string | null
          payee_name?: string | null
          reference?: string | null
          running_balance?: number | null
          transaction_date?: string
          transaction_type?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string | null
          closing_balance: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          file_url: string | null
          id: string
          opening_balance: number | null
          period_end: string | null
          period_start: string | null
          statement_date: string
          statement_number: string | null
          status: string | null
          total_credits: number | null
          total_debits: number | null
        }
        Insert: {
          bank_account_id?: string | null
          closing_balance?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          file_url?: string | null
          id?: string
          opening_balance?: number | null
          period_end?: string | null
          period_start?: string | null
          statement_date: string
          statement_number?: string | null
          status?: string | null
          total_credits?: number | null
          total_debits?: number | null
        }
        Update: {
          bank_account_id?: string | null
          closing_balance?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          file_url?: string | null
          id?: string
          opening_balance?: number | null
          period_end?: string | null
          period_start?: string | null
          statement_date?: string
          statement_number?: string | null
          status?: string | null
          total_credits?: number | null
          total_debits?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          bank_account_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          id: string
          is_reconciled: boolean | null
          journal_entry_id: string | null
          reconciled_date: string | null
          reconciliation_id: string | null
          reference_number: string | null
          running_balance: number | null
          source_id: string | null
          source_type: string | null
          transaction_date: string
          transaction_type: string | null
          value_date: string | null
        }
        Insert: {
          bank_account_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          is_reconciled?: boolean | null
          journal_entry_id?: string | null
          reconciled_date?: string | null
          reconciliation_id?: string | null
          reference_number?: string | null
          running_balance?: number | null
          source_id?: string | null
          source_type?: string | null
          transaction_date: string
          transaction_type?: string | null
          value_date?: string | null
        }
        Update: {
          bank_account_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          is_reconciled?: boolean | null
          journal_entry_id?: string | null
          reconciled_date?: string | null
          reconciliation_id?: string | null
          reference_number?: string | null
          running_balance?: number | null
          source_id?: string | null
          source_type?: string | null
          transaction_date?: string
          transaction_type?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_issue_details: {
        Row: {
          batch_id: string
          created_at: string | null
          id: string
          issue_item_id: string
          quantity_from_batch: number
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          id?: string
          issue_item_id: string
          quantity_from_batch: number
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          id?: string
          issue_item_id?: string
          quantity_from_batch?: number
        }
        Relationships: [
          {
            foreignKeyName: "batch_issue_details_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "item_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_issue_details_issue_item_id_fkey"
            columns: ["issue_item_id"]
            isOneToOne: false
            referencedRelation: "material_issue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_stock_allocations: {
        Row: {
          allocated_quantity: number
          batch_id: string
          bin_id: string
          company_id: string | null
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          allocated_quantity?: number
          batch_id: string
          bin_id: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          allocated_quantity?: number
          batch_id?: string
          bin_id?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_stock_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "item_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_stock_allocations_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_stock_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_of_materials: {
        Row: {
          bom_number: string
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_legacy_bom: boolean | null
          po_id: string | null
          product_master_id: string | null
          product_name: string
          size: string | null
          size_specific: boolean | null
          status: string
          style_no: string | null
          target_sizes: Json | null
          updated_at: string
          version: string | null
          warehouse_item_id: string | null
        }
        Insert: {
          bom_number: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_legacy_bom?: boolean | null
          po_id?: string | null
          product_master_id?: string | null
          product_name: string
          size?: string | null
          size_specific?: boolean | null
          status?: string
          style_no?: string | null
          target_sizes?: Json | null
          updated_at?: string
          version?: string | null
          warehouse_item_id?: string | null
        }
        Update: {
          bom_number?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_legacy_bom?: boolean | null
          po_id?: string | null
          product_master_id?: string | null
          product_name?: string
          size?: string | null
          size_specific?: boolean | null
          status?: string
          style_no?: string | null
          target_sizes?: Json | null
          updated_at?: string
          version?: string | null
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_product_master_id_fkey"
            columns: ["product_master_id"]
            isOneToOne: false
            referencedRelation: "product_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      bin_types: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      blacklist_reviews: {
        Row: {
          blacklist_id: string
          created_at: string | null
          decision: string
          id: string
          next_review_date: string | null
          recommendation: string | null
          review_date: string
          reviewed_by: string | null
          supporting_evidence: Json | null
        }
        Insert: {
          blacklist_id: string
          created_at?: string | null
          decision: string
          id?: string
          next_review_date?: string | null
          recommendation?: string | null
          review_date?: string
          reviewed_by?: string | null
          supporting_evidence?: Json | null
        }
        Update: {
          blacklist_id?: string
          created_at?: string | null
          decision?: string
          id?: string
          next_review_date?: string | null
          recommendation?: string | null
          review_date?: string
          reviewed_by?: string | null
          supporting_evidence?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_reviews_blacklist_id_fkey"
            columns: ["blacklist_id"]
            isOneToOne: false
            referencedRelation: "supplier_blacklist"
            referencedColumns: ["id"]
          },
        ]
      }
      blanket_po_amendments: {
        Row: {
          amendment_date: string
          amendment_number: string
          amendment_type: Database["public"]["Enums"]["amendment_type"]
          approved_by: string | null
          approved_date: string | null
          bpo_id: string
          created_at: string
          created_by: string | null
          id: string
          new_value: Json | null
          notes: string | null
          previous_value: Json | null
          reason: string
        }
        Insert: {
          amendment_date?: string
          amendment_number: string
          amendment_type: Database["public"]["Enums"]["amendment_type"]
          approved_by?: string | null
          approved_date?: string | null
          bpo_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_value?: Json | null
          notes?: string | null
          previous_value?: Json | null
          reason: string
        }
        Update: {
          amendment_date?: string
          amendment_number?: string
          amendment_type?: Database["public"]["Enums"]["amendment_type"]
          approved_by?: string | null
          approved_date?: string | null
          bpo_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_value?: Json | null
          notes?: string | null
          previous_value?: Json | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "blanket_po_amendments_bpo_id_fkey"
            columns: ["bpo_id"]
            isOneToOne: false
            referencedRelation: "blanket_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      blanket_po_items: {
        Row: {
          bpo_id: string
          category: string | null
          created_at: string
          description: string | null
          discount_percentage: number | null
          discount_terms: string | null
          id: string
          item_code: string | null
          item_name: string
          lead_time_days: number | null
          max_order_quantity: number | null
          min_order_quantity: number | null
          notes: string | null
          price_validity_end: string | null
          price_validity_start: string | null
          quantity_released: number | null
          remaining_quantity: number | null
          specifications: string | null
          total_quantity_limit: number | null
          unit_of_measure: string
          unit_price: number
          updated_at: string
          warehouse_item_id: string | null
        }
        Insert: {
          bpo_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          discount_terms?: string | null
          id?: string
          item_code?: string | null
          item_name: string
          lead_time_days?: number | null
          max_order_quantity?: number | null
          min_order_quantity?: number | null
          notes?: string | null
          price_validity_end?: string | null
          price_validity_start?: string | null
          quantity_released?: number | null
          remaining_quantity?: number | null
          specifications?: string | null
          total_quantity_limit?: number | null
          unit_of_measure?: string
          unit_price: number
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Update: {
          bpo_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          discount_terms?: string | null
          id?: string
          item_code?: string | null
          item_name?: string
          lead_time_days?: number | null
          max_order_quantity?: number | null
          min_order_quantity?: number | null
          notes?: string | null
          price_validity_end?: string | null
          price_validity_start?: string | null
          quantity_released?: number | null
          remaining_quantity?: number | null
          specifications?: string | null
          total_quantity_limit?: number | null
          unit_of_measure?: string
          unit_price?: number
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blanket_po_items_bpo_id_fkey"
            columns: ["bpo_id"]
            isOneToOne: false
            referencedRelation: "blanket_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blanket_po_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blanket_po_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blanket_po_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      blanket_po_release_items: {
        Row: {
          bpo_item_id: string
          created_at: string
          delivery_date: string | null
          delivery_location_id: string | null
          id: string
          notes: string | null
          quantity_approved: number | null
          quantity_received: number | null
          quantity_requested: number
          release_id: string
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          bpo_item_id: string
          created_at?: string
          delivery_date?: string | null
          delivery_location_id?: string | null
          id?: string
          notes?: string | null
          quantity_approved?: number | null
          quantity_received?: number | null
          quantity_requested: number
          release_id: string
          total_price: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          bpo_item_id?: string
          created_at?: string
          delivery_date?: string | null
          delivery_location_id?: string | null
          id?: string
          notes?: string | null
          quantity_approved?: number | null
          quantity_received?: number | null
          quantity_requested?: number
          release_id?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blanket_po_release_items_bpo_item_id_fkey"
            columns: ["bpo_item_id"]
            isOneToOne: false
            referencedRelation: "blanket_po_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blanket_po_release_items_delivery_location_id_fkey"
            columns: ["delivery_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blanket_po_release_items_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "blanket_po_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      blanket_po_releases: {
        Row: {
          actual_delivery_date: string | null
          approved_by: string | null
          approved_date: string | null
          bpo_id: string
          created_at: string
          delivery_location: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          release_date: string
          release_number: string
          release_status: Database["public"]["Enums"]["bpo_release_status"]
          requested_by: string | null
          total_amount: number | null
          updated_at: string
          urgency_level: Database["public"]["Enums"]["urgency_level"] | null
        }
        Insert: {
          actual_delivery_date?: string | null
          approved_by?: string | null
          approved_date?: string | null
          bpo_id: string
          created_at?: string
          delivery_location?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          release_date?: string
          release_number: string
          release_status?: Database["public"]["Enums"]["bpo_release_status"]
          requested_by?: string | null
          total_amount?: number | null
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Update: {
          actual_delivery_date?: string | null
          approved_by?: string | null
          approved_date?: string | null
          bpo_id?: string
          created_at?: string
          delivery_location?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          release_date?: string
          release_number?: string
          release_status?: Database["public"]["Enums"]["bpo_release_status"]
          requested_by?: string | null
          total_amount?: number | null
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "blanket_po_releases_bpo_id_fkey"
            columns: ["bpo_id"]
            isOneToOne: false
            referencedRelation: "blanket_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      blanket_po_spending_analytics: {
        Row: {
          analysis_period: string
          average_lead_time: number | null
          bpo_id: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          savings_achieved: number | null
          total_quantity: number | null
          total_releases: number | null
          total_spent: number | null
          utilization_percentage: number | null
        }
        Insert: {
          analysis_period: string
          average_lead_time?: number | null
          bpo_id: string
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          savings_achieved?: number | null
          total_quantity?: number | null
          total_releases?: number | null
          total_spent?: number | null
          utilization_percentage?: number | null
        }
        Update: {
          analysis_period?: string
          average_lead_time?: number | null
          bpo_id?: string
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          savings_achieved?: number | null
          total_quantity?: number | null
          total_releases?: number | null
          total_spent?: number | null
          utilization_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blanket_po_spending_analytics_bpo_id_fkey"
            columns: ["bpo_id"]
            isOneToOne: false
            referencedRelation: "blanket_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      blanket_purchase_orders: {
        Row: {
          approval_workflow_required: boolean | null
          approved_by: string | null
          approved_date: string | null
          auto_renew: boolean | null
          bpo_number: string
          company_id: string | null
          contract_end_date: string
          contract_start_date: string
          contract_status: Database["public"]["Enums"]["blanket_contract_status"]
          contract_terms: string | null
          contract_type: Database["public"]["Enums"]["blanket_contract_type"]
          created_at: string
          created_by: string | null
          currency: string | null
          delivery_terms: string | null
          early_termination_terms: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          penalty_clauses: Json | null
          remaining_value: number
          renewal_terms: string | null
          supplier_id: string
          total_contract_value: number
          updated_at: string
        }
        Insert: {
          approval_workflow_required?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          auto_renew?: boolean | null
          bpo_number: string
          company_id?: string | null
          contract_end_date: string
          contract_start_date: string
          contract_status?: Database["public"]["Enums"]["blanket_contract_status"]
          contract_terms?: string | null
          contract_type?: Database["public"]["Enums"]["blanket_contract_type"]
          created_at?: string
          created_by?: string | null
          currency?: string | null
          delivery_terms?: string | null
          early_termination_terms?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          penalty_clauses?: Json | null
          remaining_value?: number
          renewal_terms?: string | null
          supplier_id: string
          total_contract_value?: number
          updated_at?: string
        }
        Update: {
          approval_workflow_required?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          auto_renew?: boolean | null
          bpo_number?: string
          company_id?: string | null
          contract_end_date?: string
          contract_start_date?: string
          contract_status?: Database["public"]["Enums"]["blanket_contract_status"]
          contract_terms?: string | null
          contract_type?: Database["public"]["Enums"]["blanket_contract_type"]
          created_at?: string
          created_by?: string | null
          currency?: string | null
          delivery_terms?: string | null
          early_termination_terms?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          penalty_clauses?: Json | null
          remaining_value?: number
          renewal_terms?: string | null
          supplier_id?: string
          total_contract_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blanket_purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blanket_purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_approvals: {
        Row: {
          approval_level: number
          approval_status: string
          approved_at: string | null
          approver_id: string
          bom_id: string
          comments: string | null
          created_at: string
          id: string
        }
        Insert: {
          approval_level?: number
          approval_status?: string
          approved_at?: string | null
          approver_id: string
          bom_id: string
          comments?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          approval_level?: number
          approval_status?: string
          approved_at?: string | null
          approver_id?: string
          bom_id?: string
          comments?: string | null
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_approvals_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_approvals_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "modern_boms"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_finished_goods: {
        Row: {
          bom_id: string
          created_at: string
          created_by: string | null
          finished_good_id: string
          id: string
        }
        Insert: {
          bom_id: string
          created_at?: string
          created_by?: string | null
          finished_good_id: string
          id?: string
        }
        Update: {
          bom_id?: string
          created_at?: string
          created_by?: string | null
          finished_good_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_finished_goods_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_finished_goods_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "modern_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_finished_goods_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_item_substitutions: {
        Row: {
          availability_status: string | null
          bom_item_id: string
          cost_difference: number | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          priority: number | null
          substitute_item_id: string
          updated_at: string
        }
        Insert: {
          availability_status?: string | null
          bom_item_id: string
          cost_difference?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          priority?: number | null
          substitute_item_id: string
          updated_at?: string
        }
        Update: {
          availability_status?: string | null
          bom_item_id?: string
          cost_difference?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          priority?: number | null
          substitute_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_item_substitutions_bom_item_id_fkey"
            columns: ["bom_item_id"]
            isOneToOne: false
            referencedRelation: "bom_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_item_substitutions_substitute_item_id_fkey"
            columns: ["substitute_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_item_substitutions_substitute_item_id_fkey"
            columns: ["substitute_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_item_substitutions_substitute_item_id_fkey"
            columns: ["substitute_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          bom_id: string
          category: string | null
          consumption: number | null
          created_at: string
          description: string | null
          id: string
          item_code: string | null
          item_name: string
          manufacturer_part_number: string | null
          notes: string | null
          po_item_id: string | null
          quantity: number
          supplier_part_number: string | null
          total_cost: number | null
          unit_cost: number | null
          unit_of_measure: string
          updated_at: string
          warehouse_item_id: string | null
        }
        Insert: {
          bom_id: string
          category?: string | null
          consumption?: number | null
          created_at?: string
          description?: string | null
          id?: string
          item_code?: string | null
          item_name: string
          manufacturer_part_number?: string | null
          notes?: string | null
          po_item_id?: string | null
          quantity: number
          supplier_part_number?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Update: {
          bom_id?: string
          category?: string | null
          consumption?: number | null
          created_at?: string
          description?: string | null
          id?: string
          item_code?: string | null
          item_name?: string
          manufacturer_part_number?: string | null
          notes?: string | null
          po_item_id?: string | null
          quantity?: number
          supplier_part_number?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "modern_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "po_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_size_multipliers: {
        Row: {
          bom_id: string
          created_at: string | null
          id: string
          multiplier: number | null
          notes: string | null
          size: string
          updated_at: string | null
        }
        Insert: {
          bom_id: string
          created_at?: string | null
          id?: string
          multiplier?: number | null
          notes?: string | null
          size: string
          updated_at?: string | null
        }
        Update: {
          bom_id?: string
          created_at?: string | null
          id?: string
          multiplier?: number | null
          notes?: string | null
          size?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_size_multipliers_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_size_multipliers_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "modern_boms"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_templates: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean | null
          template_data: Json
          template_name: string
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          template_data?: Json
          template_name: string
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          template_data?: Json
          template_name?: string
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_versions: {
        Row: {
          bom_id: string
          changes_summary: Json | null
          created_at: string
          created_by: string | null
          id: string
          previous_version_id: string | null
          version_data: Json
          version_notes: string | null
          version_number: string
        }
        Insert: {
          bom_id: string
          changes_summary?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          previous_version_id?: string | null
          version_data?: Json
          version_notes?: string | null
          version_number: string
        }
        Update: {
          bom_id?: string
          changes_summary?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          previous_version_id?: string | null
          version_data?: Json
          version_notes?: string | null
          version_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_versions_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_versions_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "modern_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_versions_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "bom_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          account_id: string | null
          annual_amount: number | null
          budget_id: string | null
          cost_center_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          period_1: number | null
          period_10: number | null
          period_11: number | null
          period_12: number | null
          period_2: number | null
          period_3: number | null
          period_4: number | null
          period_5: number | null
          period_6: number | null
          period_7: number | null
          period_8: number | null
          period_9: number | null
          profit_center_id: string | null
        }
        Insert: {
          account_id?: string | null
          annual_amount?: number | null
          budget_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          period_1?: number | null
          period_10?: number | null
          period_11?: number | null
          period_12?: number | null
          period_2?: number | null
          period_3?: number | null
          period_4?: number | null
          period_5?: number | null
          period_6?: number | null
          period_7?: number | null
          period_8?: number | null
          period_9?: number | null
          profit_center_id?: string | null
        }
        Update: {
          account_id?: string | null
          annual_amount?: number | null
          budget_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          period_1?: number | null
          period_10?: number | null
          period_11?: number | null
          period_12?: number | null
          period_2?: number | null
          period_3?: number | null
          period_4?: number | null
          period_5?: number | null
          period_6?: number | null
          period_7?: number | null
          period_8?: number | null
          period_9?: number | null
          profit_center_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_transactions: {
        Row: {
          amount: number
          budget_item_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          reference_number: string | null
          transaction_date: string
          transaction_type: string
          vendor: string | null
        }
        Insert: {
          amount: number
          budget_item_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reference_number?: string | null
          transaction_date: string
          transaction_type: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          budget_item_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reference_number?: string | null
          transaction_date?: string
          transaction_type?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_transactions_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "project_budget_items"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          budget_name: string
          budget_type: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          fiscal_year: number
          id: string
          is_active: boolean | null
          notes: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          budget_name: string
          budget_type?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          fiscal_year: number
          id?: string
          is_active?: boolean | null
          notes?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          budget_name?: string
          budget_type?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          fiscal_year?: number
          id?: string
          is_active?: boolean | null
          notes?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_flow_mappings: {
        Row: {
          account_id: string | null
          activity_type: string
          cash_flow_category: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_addition: boolean | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          activity_type: string
          cash_flow_category: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_addition?: boolean | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          activity_type?: string
          cash_flow_category?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_addition?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_category: Database["public"]["Enums"]["account_category"]
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          company_id: string | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          current_balance: number | null
          id: string
          is_active: boolean | null
          is_control_account: boolean | null
          is_header: boolean | null
          is_sensitive: boolean | null
          level: number
          normal_balance: Database["public"]["Enums"]["normal_balance"]
          notes: string | null
          opening_balance: number | null
          opening_balance_date: string | null
          parent_account_id: string | null
          sensitivity_reason: string | null
          updated_at: string | null
        }
        Insert: {
          account_category: Database["public"]["Enums"]["account_category"]
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          company_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          is_control_account?: boolean | null
          is_header?: boolean | null
          is_sensitive?: boolean | null
          level?: number
          normal_balance: Database["public"]["Enums"]["normal_balance"]
          notes?: string | null
          opening_balance?: number | null
          opening_balance_date?: string | null
          parent_account_id?: string | null
          sensitivity_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          account_category?: Database["public"]["Enums"]["account_category"]
          account_code?: string
          account_name?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          company_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          is_control_account?: boolean | null
          is_header?: boolean | null
          is_sensitive?: boolean | null
          level?: number
          normal_balance?: Database["public"]["Enums"]["normal_balance"]
          notes?: string | null
          opening_balance?: number | null
          opening_balance_date?: string | null
          parent_account_id?: string | null
          sensitivity_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      cheques: {
        Row: {
          amount: number
          bank_account_id: string | null
          cheque_date: string
          cheque_number: string
          cheque_type: string
          clearing_date: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          description: string | null
          id: string
          is_post_dated: boolean
          journal_entry_id: string | null
          payee_payer: string
          status: string
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          cheque_date?: string
          cheque_number: string
          cheque_type?: string
          clearing_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          is_post_dated?: boolean
          journal_entry_id?: string | null
          payee_payer: string
          status?: string
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          cheque_date?: string
          cheque_number?: string
          cheque_type?: string
          clearing_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          is_post_dated?: boolean
          journal_entry_id?: string | null
          payee_payer?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cheques_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          code: string
          country_mandate_overrides: Json
          created_at: string
          created_by: string | null
          hod_user_id: string | null
          id: string
          logo_url: string | null
          main_warehouse_location_id: string | null
          manager_user_id: string | null
          modules: Json | null
          name: string
          peppol_environment: Database["public"]["Enums"]["peppol_environment"]
          peppol_live_enabled_at: string | null
          peppol_live_enabled_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          country_mandate_overrides?: Json
          created_at?: string
          created_by?: string | null
          hod_user_id?: string | null
          id?: string
          logo_url?: string | null
          main_warehouse_location_id?: string | null
          manager_user_id?: string | null
          modules?: Json | null
          name: string
          peppol_environment?: Database["public"]["Enums"]["peppol_environment"]
          peppol_live_enabled_at?: string | null
          peppol_live_enabled_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          country_mandate_overrides?: Json
          created_at?: string
          created_by?: string | null
          hod_user_id?: string | null
          id?: string
          logo_url?: string | null
          main_warehouse_location_id?: string | null
          manager_user_id?: string | null
          modules?: Json | null
          name?: string
          peppol_environment?: Database["public"]["Enums"]["peppol_environment"]
          peppol_live_enabled_at?: string | null
          peppol_live_enabled_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_main_warehouse_location_id_fkey"
            columns: ["main_warehouse_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_approvers: {
        Row: {
          approval_level: Database["public"]["Enums"]["approval_level_type"]
          can_approve_up_to_amount: number | null
          company_id: string
          created_at: string | null
          created_by: string | null
          department: string | null
          id: string
          is_primary: boolean | null
          modules: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approval_level: Database["public"]["Enums"]["approval_level_type"]
          can_approve_up_to_amount?: number | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          id?: string
          is_primary?: boolean | null
          modules?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approval_level?: Database["public"]["Enums"]["approval_level_type"]
          can_approve_up_to_amount?: number | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          id?: string
          is_primary?: boolean | null
          modules?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_approvers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_excluded_categories: {
        Row: {
          category_id: string
          company_id: string
          excluded_at: string | null
          excluded_by: string | null
          id: string
        }
        Insert: {
          category_id: string
          company_id: string
          excluded_at?: string | null
          excluded_by?: string | null
          id?: string
        }
        Update: {
          category_id?: string
          company_id?: string
          excluded_at?: string | null
          excluded_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_excluded_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_excluded_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_suppliers: {
        Row: {
          allocated_at: string | null
          allocated_by: string | null
          allocation_type: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string | null
          credit_limit: number | null
          id: string
          is_preferred: boolean | null
          notes: string | null
          payment_terms: string | null
          status: string
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          allocated_at?: string | null
          allocated_by?: string | null
          allocation_type?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string | null
          credit_limit?: number | null
          id?: string
          is_preferred?: boolean | null
          notes?: string | null
          payment_terms?: string | null
          status?: string
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          allocated_at?: string | null
          allocated_by?: string | null
          allocation_type?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string | null
          credit_limit?: number | null
          id?: string
          is_preferred?: boolean | null
          notes?: string | null
          payment_terms?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_suppliers_allocated_by_fkey"
            columns: ["allocated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_suppliers_allocated_by_fkey"
            columns: ["allocated_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_suppliers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_suppliers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_documents: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          document_number: string
          document_type: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_latest: boolean | null
          project_id: string
          revision_notes: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
          version: string | null
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          document_number: string
          document_type: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_latest?: boolean | null
          project_id: string
          revision_notes?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
          version?: string | null
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          document_number?: string
          document_type?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_latest?: boolean | null
          project_id?: string
          revision_notes?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_inventory_master: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          item_code: string | null
          item_name: string
          location_id: string | null
          notes: string | null
          quantity: number
          section: string | null
          serial_number: string | null
          status: string
          unit: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          item_code?: string | null
          item_name: string
          location_id?: string | null
          notes?: string | null
          quantity?: number
          section?: string | null
          serial_number?: string | null
          status?: string
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          item_code?: string | null
          item_name?: string
          location_id?: string | null
          notes?: string | null
          quantity?: number
          section?: string | null
          serial_number?: string | null
          status?: string
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_inventory_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_inventory_master_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_inventory_stock: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          item_master_id: string
          location_id: string
          quantity: number
          reserved_quantity: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          item_master_id: string
          location_id: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          item_master_id?: string
          location_id?: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_inventory_stock_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_inventory_stock_item_master_id_fkey"
            columns: ["item_master_id"]
            isOneToOne: false
            referencedRelation: "construction_item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_inventory_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_inventory_transactions: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          item_master_id: string | null
          location_id: string | null
          notes: string | null
          performed_by: string | null
          quantity_change: number | null
          repair_id: string | null
          serial_number_id: string | null
          transaction_date: string
          transaction_type: string
          transfer_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          item_master_id?: string | null
          location_id?: string | null
          notes?: string | null
          performed_by?: string | null
          quantity_change?: number | null
          repair_id?: string | null
          serial_number_id?: string | null
          transaction_date?: string
          transaction_type: string
          transfer_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          item_master_id?: string | null
          location_id?: string | null
          notes?: string | null
          performed_by?: string | null
          quantity_change?: number | null
          repair_id?: string | null
          serial_number_id?: string | null
          transaction_date?: string
          transaction_type?: string
          transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_inventory_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_inventory_transactions_item_master_id_fkey"
            columns: ["item_master_id"]
            isOneToOne: false
            referencedRelation: "construction_item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_inventory_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_inventory_transactions_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "construction_repair_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_inventory_transactions_serial_number_id_fkey"
            columns: ["serial_number_id"]
            isOneToOne: false
            referencedRelation: "construction_serial_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_inventory_transactions_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "construction_inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_inventory_transfers: {
        Row: {
          company_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          from_location_id: string
          id: string
          initiated_by: string | null
          notes: string | null
          status: string
          to_location_id: string
          transfer_date: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          from_location_id: string
          id?: string
          initiated_by?: string | null
          notes?: string | null
          status?: string
          to_location_id: string
          transfer_date?: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          from_location_id?: string
          id?: string
          initiated_by?: string | null
          notes?: string | null
          status?: string
          to_location_id?: string
          transfer_date?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_inventory_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_inventory_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_inventory_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_item_master: {
        Row: {
          brand: string | null
          category: string
          color: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_serial_tracked: boolean
          item_code: string
          item_name: string
          model: string | null
          purchase_date: string | null
          section: string
          status: string
          sub_category: string | null
          unit_cost: number | null
          unit_of_measurement: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category: string
          color?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_serial_tracked?: boolean
          item_code: string
          item_name: string
          model?: string | null
          purchase_date?: string | null
          section: string
          status?: string
          sub_category?: string | null
          unit_cost?: number | null
          unit_of_measurement?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string
          color?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_serial_tracked?: boolean
          item_code?: string
          item_name?: string
          model?: string | null
          purchase_date?: string | null
          section?: string
          status?: string
          sub_category?: string | null
          unit_cost?: number | null
          unit_of_measurement?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_item_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_labour_categories: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_labour_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_labour_companies: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_labour_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_labour_master: {
        Row: {
          category: string | null
          company_id: string | null
          contact_number: string | null
          created_at: string
          created_by: string | null
          daily_rate: number | null
          email: string | null
          employee_id: string | null
          epf_no: string | null
          hourly_rate: number | null
          id: string
          labour_company: string | null
          location_id: string | null
          name: string
          notes: string | null
          project_id: string | null
          skill_level: string | null
          status: string
          trade: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          daily_rate?: number | null
          email?: string | null
          employee_id?: string | null
          epf_no?: string | null
          hourly_rate?: number | null
          id?: string
          labour_company?: string | null
          location_id?: string | null
          name: string
          notes?: string | null
          project_id?: string | null
          skill_level?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          daily_rate?: number | null
          email?: string | null
          employee_id?: string | null
          epf_no?: string | null
          hourly_rate?: number | null
          id?: string
          labour_company?: string | null
          location_id?: string | null
          name?: string
          notes?: string | null
          project_id?: string | null
          skill_level?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_labour_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_labour_master_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_labour_master_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_project_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_project_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_project_companies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_projects: {
        Row: {
          actual_cost: number | null
          actual_end_date: string | null
          address: string | null
          city: string | null
          client_contact: string | null
          client_name: string | null
          company_id: string | null
          completion_percentage: number | null
          contract_number: string | null
          contract_value: number | null
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_budget: number | null
          id: string
          latitude: number | null
          location_id: string | null
          longitude: number | null
          notes: string | null
          project_code: string
          project_manager_id: string | null
          project_name: string
          project_type: string | null
          start_date: string | null
          state: string | null
          status: string
          target_end_date: string | null
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          actual_end_date?: string | null
          address?: string | null
          city?: string | null
          client_contact?: string | null
          client_name?: string | null
          company_id?: string | null
          completion_percentage?: number | null
          contract_number?: string | null
          contract_value?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_budget?: number | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          notes?: string | null
          project_code: string
          project_manager_id?: string | null
          project_name: string
          project_type?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          target_end_date?: string | null
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          actual_end_date?: string | null
          address?: string | null
          city?: string | null
          client_contact?: string | null
          client_name?: string | null
          company_id?: string | null
          completion_percentage?: number | null
          contract_number?: string | null
          contract_value?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_budget?: number | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          notes?: string | null
          project_code?: string
          project_manager_id?: string | null
          project_name?: string
          project_type?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          target_end_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_projects_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_repair_records: {
        Row: {
          actual_return_date: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          expected_return_date: string | null
          id: string
          issue_description: string | null
          item_master_id: string
          quantity: number | null
          repair_cost: number | null
          repair_date: string
          repair_notes: string | null
          serial_number_id: string | null
          service_provider: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_return_date?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_return_date?: string | null
          id?: string
          issue_description?: string | null
          item_master_id: string
          quantity?: number | null
          repair_cost?: number | null
          repair_date?: string
          repair_notes?: string | null
          serial_number_id?: string | null
          service_provider?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_return_date?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_return_date?: string | null
          id?: string
          issue_description?: string | null
          item_master_id?: string
          quantity?: number | null
          repair_cost?: number | null
          repair_date?: string
          repair_notes?: string | null
          serial_number_id?: string | null
          service_provider?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_repair_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_repair_records_item_master_id_fkey"
            columns: ["item_master_id"]
            isOneToOne: false
            referencedRelation: "construction_item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_repair_records_serial_number_id_fkey"
            columns: ["serial_number_id"]
            isOneToOne: false
            referencedRelation: "construction_serial_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_resources: {
        Row: {
          assigned_site_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          notes: string | null
          project_id: string
          quantity_allocated: number | null
          quantity_used: number | null
          resource_name: string
          resource_type: string
          start_date: string | null
          status: string | null
          total_cost: number | null
          unit: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_site_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          quantity_allocated?: number | null
          quantity_used?: number | null
          resource_name: string
          resource_type: string
          start_date?: string | null
          status?: string | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_site_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          quantity_allocated?: number | null
          quantity_used?: number | null
          resource_name?: string
          resource_type?: string
          start_date?: string | null
          status?: string | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_resources_assigned_site_id_fkey"
            columns: ["assigned_site_id"]
            isOneToOne: false
            referencedRelation: "project_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_resources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_serial_numbers: {
        Row: {
          asset_value: number | null
          availability: string
          company_id: string | null
          condition: string
          created_at: string
          created_by: string | null
          current_location_id: string | null
          id: string
          item_master_id: string
          notes: string | null
          purchase_date: string | null
          serial_number: string
          updated_at: string
          warranty_expiry: string | null
        }
        Insert: {
          asset_value?: number | null
          availability?: string
          company_id?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          current_location_id?: string | null
          id?: string
          item_master_id: string
          notes?: string | null
          purchase_date?: string | null
          serial_number: string
          updated_at?: string
          warranty_expiry?: string | null
        }
        Update: {
          asset_value?: number | null
          availability?: string
          company_id?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          current_location_id?: string | null
          id?: string
          item_master_id?: string
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string
          updated_at?: string
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_serial_numbers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_serial_numbers_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_serial_numbers_item_master_id_fkey"
            columns: ["item_master_id"]
            isOneToOne: false
            referencedRelation: "construction_item_master"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_subcontractor_master: {
        Row: {
          address: string | null
          company_id: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          insurance_expiry: string | null
          license_number: string | null
          name: string
          notes: string | null
          phone: string | null
          status: string
          trade: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          insurance_expiry?: string | null
          license_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          insurance_expiry?: string | null
          license_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_subcontractor_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_transfer_items: {
        Row: {
          id: string
          item_master_id: string
          quantity: number | null
          serial_number_id: string | null
          transfer_id: string
        }
        Insert: {
          id?: string
          item_master_id: string
          quantity?: number | null
          serial_number_id?: string | null
          transfer_id: string
        }
        Update: {
          id?: string
          item_master_id?: string
          quantity?: number | null
          serial_number_id?: string | null
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_transfer_items_item_master_id_fkey"
            columns: ["item_master_id"]
            isOneToOne: false
            referencedRelation: "construction_item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_transfer_items_serial_number_id_fkey"
            columns: ["serial_number_id"]
            isOneToOne: false
            referencedRelation: "construction_serial_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "construction_inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_work_orders: {
        Row: {
          actual_cost: number | null
          actual_end_date: string | null
          actual_hours: number | null
          actual_start_date: string | null
          assigned_to: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          estimated_cost: number | null
          estimated_hours: number | null
          id: string
          notes: string | null
          planned_end_date: string | null
          planned_start_date: string | null
          priority: string | null
          project_id: string
          site_id: string | null
          status: string | null
          title: string
          updated_at: string | null
          work_order_number: string
          work_type: string | null
        }
        Insert: {
          actual_cost?: number | null
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_start_date?: string | null
          assigned_to?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          estimated_cost?: number | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string | null
          project_id: string
          site_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          work_order_number: string
          work_type?: string | null
        }
        Update: {
          actual_cost?: number | null
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_start_date?: string | null
          assigned_to?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          estimated_cost?: number | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string | null
          project_id?: string
          site_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          work_order_number?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_work_orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "project_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_amendments: {
        Row: {
          amendment_date: string
          amendment_number: string
          amendment_type: Database["public"]["Enums"]["contract_amendment_type"]
          approved_by: string | null
          approved_date: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          document_id: string | null
          effective_date: string | null
          financial_impact: number | null
          id: string
          new_value: Json | null
          notes: string | null
          previous_value: Json | null
          reason: string
        }
        Insert: {
          amendment_date?: string
          amendment_number: string
          amendment_type: Database["public"]["Enums"]["contract_amendment_type"]
          approved_by?: string | null
          approved_date?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          effective_date?: string | null
          financial_impact?: number | null
          id?: string
          new_value?: Json | null
          notes?: string | null
          previous_value?: Json | null
          reason: string
        }
        Update: {
          amendment_date?: string
          amendment_number?: string
          amendment_type?: Database["public"]["Enums"]["contract_amendment_type"]
          approved_by?: string | null
          approved_date?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          effective_date?: string | null
          financial_impact?: number | null
          id?: string
          new_value?: Json | null
          notes?: string | null
          previous_value?: Json | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_amendments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_amendments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: string
          description: string | null
          document_date: string | null
          document_name: string
          document_type: Database["public"]["Enums"]["contract_document_type"]
          esign_platform: string | null
          esign_reference_id: string | null
          file_path: string
          file_size: number | null
          file_url: string | null
          id: string
          is_latest_version: boolean | null
          is_signed: boolean | null
          mime_type: string | null
          notes: string | null
          signature_status:
            | Database["public"]["Enums"]["signature_status"]
            | null
          uploaded_at: string
          uploaded_by: string | null
          version_number: string | null
        }
        Insert: {
          contract_id: string
          description?: string | null
          document_date?: string | null
          document_name: string
          document_type: Database["public"]["Enums"]["contract_document_type"]
          esign_platform?: string | null
          esign_reference_id?: string | null
          file_path: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_latest_version?: boolean | null
          is_signed?: boolean | null
          mime_type?: string | null
          notes?: string | null
          signature_status?:
            | Database["public"]["Enums"]["signature_status"]
            | null
          uploaded_at?: string
          uploaded_by?: string | null
          version_number?: string | null
        }
        Update: {
          contract_id?: string
          description?: string | null
          document_date?: string | null
          document_name?: string
          document_type?: Database["public"]["Enums"]["contract_document_type"]
          esign_platform?: string | null
          esign_reference_id?: string | null
          file_path?: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_latest_version?: boolean | null
          is_signed?: boolean | null
          mime_type?: string | null
          notes?: string | null
          signature_status?:
            | Database["public"]["Enums"]["signature_status"]
            | null
          uploaded_at?: string
          uploaded_by?: string | null
          version_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_obligations: {
        Row: {
          assigned_to: string | null
          completed: boolean | null
          completed_by: string | null
          completed_date: string | null
          contract_id: string
          created_at: string
          currency: string | null
          description: string | null
          due_date: string | null
          evidence_notes: string | null
          evidence_required: boolean | null
          id: string
          next_occurrence_date: string | null
          notification_days_before: number | null
          obligation_type: Database["public"]["Enums"]["obligation_type"]
          penalty_for_delay: number | null
          priority: Database["public"]["Enums"]["contract_priority"] | null
          recurrence: string | null
          responsible_party: string | null
          status: Database["public"]["Enums"]["obligation_status"] | null
          title: string
          updated_at: string
          value_amount: number | null
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean | null
          completed_by?: string | null
          completed_date?: string | null
          contract_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          evidence_notes?: string | null
          evidence_required?: boolean | null
          id?: string
          next_occurrence_date?: string | null
          notification_days_before?: number | null
          obligation_type: Database["public"]["Enums"]["obligation_type"]
          penalty_for_delay?: number | null
          priority?: Database["public"]["Enums"]["contract_priority"] | null
          recurrence?: string | null
          responsible_party?: string | null
          status?: Database["public"]["Enums"]["obligation_status"] | null
          title: string
          updated_at?: string
          value_amount?: number | null
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean | null
          completed_by?: string | null
          completed_date?: string | null
          contract_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          evidence_notes?: string | null
          evidence_required?: boolean | null
          id?: string
          next_occurrence_date?: string | null
          notification_days_before?: number | null
          obligation_type?: Database["public"]["Enums"]["obligation_type"]
          penalty_for_delay?: number | null
          priority?: Database["public"]["Enums"]["contract_priority"] | null
          recurrence?: string | null
          responsible_party?: string | null
          status?: Database["public"]["Enums"]["obligation_status"] | null
          title?: string
          updated_at?: string
          value_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_obligations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_parties: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          party_contact_person: string | null
          party_email: string | null
          party_name: string
          party_phone: string | null
          party_reference_id: string | null
          party_reference_type: string | null
          party_role: string | null
          party_type: Database["public"]["Enums"]["contract_party_type"]
          signature_method:
            | Database["public"]["Enums"]["signature_method"]
            | null
          signed: boolean | null
          signed_date: string | null
          signing_authority: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          party_contact_person?: string | null
          party_email?: string | null
          party_name: string
          party_phone?: string | null
          party_reference_id?: string | null
          party_reference_type?: string | null
          party_role?: string | null
          party_type: Database["public"]["Enums"]["contract_party_type"]
          signature_method?:
            | Database["public"]["Enums"]["signature_method"]
            | null
          signed?: boolean | null
          signed_date?: string | null
          signing_authority?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          party_contact_person?: string | null
          party_email?: string | null
          party_name?: string
          party_phone?: string | null
          party_reference_id?: string | null
          party_reference_type?: string | null
          party_role?: string | null
          party_type?: Database["public"]["Enums"]["contract_party_type"]
          signature_method?:
            | Database["public"]["Enums"]["signature_method"]
            | null
          signed?: boolean | null
          signed_date?: string | null
          signing_authority?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_parties_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          approval_workflow_required: boolean | null
          approved_by: string | null
          approved_date: string | null
          auto_renew: boolean | null
          billing_frequency:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          company_id: string | null
          compliance_requirements: Json | null
          confidentiality_level:
            | Database["public"]["Enums"]["confidentiality_level"]
            | null
          contract_category: string | null
          contract_date: string
          contract_number: string
          contract_sub_type: string | null
          contract_terms: string | null
          contract_title: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          contract_value: number | null
          cost_center_id: string | null
          counterparty_contact: string | null
          counterparty_email: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          department_id: string | null
          dispute_resolution: string | null
          effective_date: string
          expiry_date: string | null
          governing_law: string | null
          id: string
          insurance_details: string | null
          insurance_required: boolean | null
          max_renewal_count: number | null
          notes: string | null
          notice_period_days: number | null
          owner_id: string | null
          payment_terms: string | null
          penalty_clauses: Json | null
          primary_party_id: string | null
          primary_party_type: string | null
          priority: Database["public"]["Enums"]["contract_priority"]
          renewal_count: number | null
          renewal_notice_days: number | null
          renewal_terms: string | null
          renewal_type: Database["public"]["Enums"]["renewal_type"] | null
          risk_level: Database["public"]["Enums"]["contract_risk_level"] | null
          signed_by_them: string | null
          signed_by_us: string | null
          signed_date: string | null
          special_conditions: string | null
          status: Database["public"]["Enums"]["contract_status"]
          tags: Json | null
          termination_terms: string | null
          updated_at: string
        }
        Insert: {
          approval_workflow_required?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          auto_renew?: boolean | null
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          company_id?: string | null
          compliance_requirements?: Json | null
          confidentiality_level?:
            | Database["public"]["Enums"]["confidentiality_level"]
            | null
          contract_category?: string | null
          contract_date?: string
          contract_number: string
          contract_sub_type?: string | null
          contract_terms?: string | null
          contract_title: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          contract_value?: number | null
          cost_center_id?: string | null
          counterparty_contact?: string | null
          counterparty_email?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          department_id?: string | null
          dispute_resolution?: string | null
          effective_date: string
          expiry_date?: string | null
          governing_law?: string | null
          id?: string
          insurance_details?: string | null
          insurance_required?: boolean | null
          max_renewal_count?: number | null
          notes?: string | null
          notice_period_days?: number | null
          owner_id?: string | null
          payment_terms?: string | null
          penalty_clauses?: Json | null
          primary_party_id?: string | null
          primary_party_type?: string | null
          priority?: Database["public"]["Enums"]["contract_priority"]
          renewal_count?: number | null
          renewal_notice_days?: number | null
          renewal_terms?: string | null
          renewal_type?: Database["public"]["Enums"]["renewal_type"] | null
          risk_level?: Database["public"]["Enums"]["contract_risk_level"] | null
          signed_by_them?: string | null
          signed_by_us?: string | null
          signed_date?: string | null
          special_conditions?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tags?: Json | null
          termination_terms?: string | null
          updated_at?: string
        }
        Update: {
          approval_workflow_required?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          auto_renew?: boolean | null
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency"]
            | null
          company_id?: string | null
          compliance_requirements?: Json | null
          confidentiality_level?:
            | Database["public"]["Enums"]["confidentiality_level"]
            | null
          contract_category?: string | null
          contract_date?: string
          contract_number?: string
          contract_sub_type?: string | null
          contract_terms?: string | null
          contract_title?: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          contract_value?: number | null
          cost_center_id?: string | null
          counterparty_contact?: string | null
          counterparty_email?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          department_id?: string | null
          dispute_resolution?: string | null
          effective_date?: string
          expiry_date?: string | null
          governing_law?: string | null
          id?: string
          insurance_details?: string | null
          insurance_required?: boolean | null
          max_renewal_count?: number | null
          notes?: string | null
          notice_period_days?: number | null
          owner_id?: string | null
          payment_terms?: string | null
          penalty_clauses?: Json | null
          primary_party_id?: string | null
          primary_party_type?: string | null
          priority?: Database["public"]["Enums"]["contract_priority"]
          renewal_count?: number | null
          renewal_notice_days?: number | null
          renewal_terms?: string | null
          renewal_type?: Database["public"]["Enums"]["renewal_type"] | null
          risk_level?: Database["public"]["Enums"]["contract_risk_level"] | null
          signed_by_them?: string | null
          signed_by_us?: string | null
          signed_date?: string | null
          special_conditions?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tags?: Json | null
          termination_terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_layers: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          item_id: string
          item_type: string
          layer_status: string | null
          quantity_received: number
          quantity_remaining: number
          receipt_date: string
          total_cost: number
          transaction_id: string | null
          unit_cost: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          item_id: string
          item_type: string
          layer_status?: string | null
          quantity_received: number
          quantity_remaining: number
          receipt_date?: string
          total_cost: number
          transaction_id?: string | null
          unit_cost: number
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          item_id?: string
          item_type?: string
          layer_status?: string | null
          quantity_received?: number
          quantity_remaining?: number
          receipt_date?: string
          total_cost?: number
          transaction_id?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_layers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          amount_applied: number
          company_id: string | null
          created_at: string | null
          created_by: string | null
          credit_date: string
          credit_note_number: string
          customer_id: string | null
          description: string | null
          id: string
          reason: string | null
          reference_invoice_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          amount_applied?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_date?: string
          credit_note_number: string
          customer_id?: string | null
          description?: string | null
          id?: string
          reason?: string | null
          reference_invoice_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          amount_applied?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_date?: string
          credit_note_number?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          reason?: string | null
          reference_invoice_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_reference_invoice_id_fkey"
            columns: ["reference_invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string | null
          decimal_places: number | null
          id: string
          is_active: boolean | null
          is_base_currency: boolean | null
          name: string
          symbol: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          decimal_places?: number | null
          id?: string
          is_active?: boolean | null
          is_base_currency?: boolean | null
          name: string
          symbol?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          decimal_places?: number | null
          id?: string
          is_active?: boolean | null
          is_base_currency?: boolean | null
          name?: string
          symbol?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_advances: {
        Row: {
          advance_date: string
          advance_number: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          description: string | null
          id: string
          journal_entry_id: string | null
          original_amount: number
          payment_method: string | null
          reference_number: string | null
          remaining_amount: number
          status: string
          updated_at: string | null
        }
        Insert: {
          advance_date?: string
          advance_number: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          original_amount?: number
          payment_method?: string | null
          reference_number?: string | null
          remaining_amount?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          advance_date?: string
          advance_number?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          original_amount?: number
          payment_method?: string | null
          reference_number?: string | null
          remaining_amount?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_advances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_advances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_advances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_advances_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoice_lines: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          gl_account_id: string | null
          id: string
          invoice_id: string | null
          line_number: number
          quantity: number | null
          tax_amount: number | null
          tax_code_id: string | null
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          gl_account_id?: string | null
          id?: string
          invoice_id?: string | null
          line_number: number
          quantity?: number | null
          tax_amount?: number | null
          tax_code_id?: string | null
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          gl_account_id?: string | null
          id?: string
          invoice_id?: string | null
          line_number?: number
          quantity?: number | null
          tax_amount?: number | null
          tax_code_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoice_lines_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoice_lines_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoice_lines_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          amount_received: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string | null
          due_date: string
          gl_account_id: string | null
          gross_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          net_amount: number
          notes: string | null
          payment_terms: string | null
          posted_by: string | null
          posted_date: string | null
          sales_order_id: string | null
          sap_document_number: string | null
          sap_last_sync_at: string | null
          sap_sync_status: string | null
          status: string | null
          tax_amount: number | null
          updated_at: string | null
        }
        Insert: {
          amount_received?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          due_date: string
          gl_account_id?: string | null
          gross_amount?: number
          id?: string
          invoice_date: string
          invoice_number: string
          net_amount?: number
          notes?: string | null
          payment_terms?: string | null
          posted_by?: string | null
          posted_date?: string | null
          sales_order_id?: string | null
          sap_document_number?: string | null
          sap_last_sync_at?: string | null
          sap_sync_status?: string | null
          status?: string | null
          tax_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          amount_received?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          due_date?: string
          gl_account_id?: string | null
          gross_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          net_amount?: number
          notes?: string | null
          payment_terms?: string | null
          posted_by?: string | null
          posted_date?: string | null
          sales_order_id?: string | null
          sap_document_number?: string | null
          sap_last_sync_at?: string | null
          sap_sync_status?: string | null
          status?: string | null
          tax_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_po_approvals: {
        Row: {
          action: string
          approver_id: string
          comments: string | null
          cpo_id: string
          created_at: string
          id: string
        }
        Insert: {
          action: string
          approver_id: string
          comments?: string | null
          cpo_id: string
          created_at?: string
          id?: string
        }
        Update: {
          action?: string
          approver_id?: string
          comments?: string | null
          cpo_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_po_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_po_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_po_approvals_cpo_id_fkey"
            columns: ["cpo_id"]
            isOneToOne: false
            referencedRelation: "customer_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_po_items: {
        Row: {
          color: string | null
          cpo_id: string
          created_at: string
          delivery_date: string | null
          description: string | null
          finished_good_id: string | null
          id: string
          item_name: string
          product_master_id: string | null
          quantity_ordered: number
          size: string | null
          status: string
          style_no: string | null
          total_price: number | null
          unit_of_measure: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          cpo_id: string
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          finished_good_id?: string | null
          id?: string
          item_name: string
          product_master_id?: string | null
          quantity_ordered?: number
          size?: string | null
          status?: string
          style_no?: string | null
          total_price?: number | null
          unit_of_measure?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          cpo_id?: string
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          finished_good_id?: string | null
          id?: string
          item_name?: string
          product_master_id?: string | null
          quantity_ordered?: number
          size?: string | null
          status?: string
          style_no?: string | null
          total_price?: number | null
          unit_of_measure?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_po_items_cpo_id_fkey"
            columns: ["cpo_id"]
            isOneToOne: false
            referencedRelation: "customer_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_po_items_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_po_items_product_master_id_fkey"
            columns: ["product_master_id"]
            isOneToOne: false
            referencedRelation: "product_master"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_po_workflow_tracking: {
        Row: {
          cpo_id: string
          created_at: string
          id: string
          material_demand_id: string | null
          notes: string | null
          po_id: string | null
          pr_id: string | null
          stage_completed_at: string | null
          stage_completed_by: string | null
          updated_at: string
          workflow_stage: string
        }
        Insert: {
          cpo_id: string
          created_at?: string
          id?: string
          material_demand_id?: string | null
          notes?: string | null
          po_id?: string | null
          pr_id?: string | null
          stage_completed_at?: string | null
          stage_completed_by?: string | null
          updated_at?: string
          workflow_stage?: string
        }
        Update: {
          cpo_id?: string
          created_at?: string
          id?: string
          material_demand_id?: string | null
          notes?: string | null
          po_id?: string | null
          pr_id?: string | null
          stage_completed_at?: string | null
          stage_completed_by?: string | null
          updated_at?: string
          workflow_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_po_workflow_tracking_cpo_id_fkey"
            columns: ["cpo_id"]
            isOneToOne: false
            referencedRelation: "customer_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_po_workflow_tracking_material_demand_id_fkey"
            columns: ["material_demand_id"]
            isOneToOne: false
            referencedRelation: "material_demand"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_purchase_orders: {
        Row: {
          approval_comments: string | null
          approved_by: string | null
          approved_date: string | null
          company_id: string | null
          cpo_number: string
          created_at: string
          created_by: string | null
          customer_id: string
          delivery_date: string | null
          id: string
          notes: string | null
          pending_approval: boolean | null
          po_date: string
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          approval_comments?: string | null
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          cpo_number: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          pending_approval?: boolean | null
          po_date?: string
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          approval_comments?: string | null
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          cpo_number?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          pending_approval?: boolean | null
          po_date?: string
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_purchase_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_purchase_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_receipts: {
        Row: {
          bank_account_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          payment_method: string | null
          receipt_date: string
          receipt_number: string
          reference_number: string | null
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          bank_account_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_method?: string | null
          receipt_date: string
          receipt_number: string
          reference_number?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          bank_account_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_method?: string | null
          receipt_date?: string
          receipt_number?: string
          reference_number?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company_id: string | null
          company_registration_document_url: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          customer_code: string
          customer_name: string
          customer_type: string
          email: string | null
          first_name: string | null
          id: string
          id_passport_number: string | null
          last_name: string | null
          phone: string | null
          registration_number: string | null
          sap_customer_code: string | null
          sap_sync_status: string | null
          status: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          company_registration_document_url?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_code: string
          customer_name: string
          customer_type?: string
          email?: string | null
          first_name?: string | null
          id?: string
          id_passport_number?: string | null
          last_name?: string | null
          phone?: string | null
          registration_number?: string | null
          sap_customer_code?: string | null
          sap_sync_status?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string | null
          company_registration_document_url?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string
          customer_name?: string
          customer_type?: string
          email?: string | null
          first_name?: string | null
          id?: string
          id_passport_number?: string | null
          last_name?: string | null
          phone?: string | null
          registration_number?: string | null
          sap_customer_code?: string | null
          sap_sync_status?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_count_adjustments: {
        Row: {
          adjustment_quantity: number
          adjustment_type: string
          adjustment_value: number | null
          approved_by: string | null
          approved_date: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          cycle_count_id: string
          cycle_count_item_id: string
          id: string
          reason: string
          stock_transaction_id: string | null
        }
        Insert: {
          adjustment_quantity: number
          adjustment_type: string
          adjustment_value?: number | null
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          cycle_count_id: string
          cycle_count_item_id: string
          id?: string
          reason: string
          stock_transaction_id?: string | null
        }
        Update: {
          adjustment_quantity?: number
          adjustment_type?: string
          adjustment_value?: number | null
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          cycle_count_id?: string
          cycle_count_item_id?: string
          id?: string
          reason?: string
          stock_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_count_adjustments_cycle_count_id_fkey"
            columns: ["cycle_count_id"]
            isOneToOne: false
            referencedRelation: "cycle_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_count_adjustments_cycle_count_item_id_fkey"
            columns: ["cycle_count_item_id"]
            isOneToOne: false
            referencedRelation: "cycle_count_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_count_items: {
        Row: {
          bin_id: string | null
          counted_at: string | null
          counted_by: string | null
          created_at: string | null
          cycle_count_id: string
          id: string
          investigation_notes: string | null
          physical_quantity: number | null
          physical_value: number | null
          recount_count: number | null
          recount_required: boolean | null
          status: string
          system_quantity: number
          system_value: number | null
          updated_at: string | null
          variance_percentage: number | null
          variance_quantity: number | null
          variance_reason: string | null
          variance_value: number | null
          warehouse_item_id: string
        }
        Insert: {
          bin_id?: string | null
          counted_at?: string | null
          counted_by?: string | null
          created_at?: string | null
          cycle_count_id: string
          id?: string
          investigation_notes?: string | null
          physical_quantity?: number | null
          physical_value?: number | null
          recount_count?: number | null
          recount_required?: boolean | null
          status?: string
          system_quantity: number
          system_value?: number | null
          updated_at?: string | null
          variance_percentage?: number | null
          variance_quantity?: number | null
          variance_reason?: string | null
          variance_value?: number | null
          warehouse_item_id: string
        }
        Update: {
          bin_id?: string | null
          counted_at?: string | null
          counted_by?: string | null
          created_at?: string | null
          cycle_count_id?: string
          id?: string
          investigation_notes?: string | null
          physical_quantity?: number | null
          physical_value?: number | null
          recount_count?: number | null
          recount_required?: boolean | null
          status?: string
          system_quantity?: number
          system_value?: number | null
          updated_at?: string | null
          variance_percentage?: number | null
          variance_quantity?: number | null
          variance_reason?: string | null
          variance_value?: number | null
          warehouse_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_count_items_cycle_count_id_fkey"
            columns: ["cycle_count_id"]
            isOneToOne: false
            referencedRelation: "cycle_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_count_schedules: {
        Row: {
          abc_classification: string | null
          category_ids: string[] | null
          company_id: string | null
          count_per_cycle: number | null
          created_at: string | null
          created_by: string | null
          frequency: string
          id: string
          item_ids: string[] | null
          last_count_date: string | null
          location_ids: string[] | null
          next_count_date: string | null
          priority: string
          schedule_name: string
          schedule_type: string
          status: string
          updated_at: string | null
        }
        Insert: {
          abc_classification?: string | null
          category_ids?: string[] | null
          company_id?: string | null
          count_per_cycle?: number | null
          created_at?: string | null
          created_by?: string | null
          frequency: string
          id?: string
          item_ids?: string[] | null
          last_count_date?: string | null
          location_ids?: string[] | null
          next_count_date?: string | null
          priority?: string
          schedule_name: string
          schedule_type: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          abc_classification?: string | null
          category_ids?: string[] | null
          company_id?: string | null
          count_per_cycle?: number | null
          created_at?: string | null
          created_by?: string | null
          frequency?: string
          id?: string
          item_ids?: string[] | null
          last_count_date?: string | null
          location_ids?: string[] | null
          next_count_date?: string | null
          priority?: string
          schedule_name?: string
          schedule_type?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cycle_counts: {
        Row: {
          approval_notes: string | null
          approved_by: string | null
          approved_date: string | null
          assigned_to: string | null
          company_id: string | null
          completed_at: string | null
          count_date: string
          count_number: string
          count_type: string
          created_at: string | null
          created_by: string | null
          id: string
          items_counted: number | null
          items_with_variance: number | null
          location_id: string | null
          notes: string | null
          schedule_id: string | null
          started_at: string | null
          status: string
          total_items_to_count: number | null
          total_variance_value: number | null
          updated_at: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_by?: string | null
          approved_date?: string | null
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          count_date?: string
          count_number: string
          count_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          items_counted?: number | null
          items_with_variance?: number | null
          location_id?: string | null
          notes?: string | null
          schedule_id?: string | null
          started_at?: string | null
          status?: string
          total_items_to_count?: number | null
          total_variance_value?: number | null
          updated_at?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_by?: string | null
          approved_date?: string | null
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          count_date?: string
          count_number?: string
          count_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          items_counted?: number | null
          items_with_variance?: number | null
          location_id?: string | null
          notes?: string | null
          schedule_id?: string | null
          started_at?: string | null
          status?: string
          total_items_to_count?: number | null
          total_variance_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_counts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "cycle_count_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_site_reports: {
        Row: {
          approved_by: string | null
          company_id: string | null
          created_at: string | null
          delays_issues: string | null
          equipment_on_site: string | null
          id: string
          labor_count: number | null
          location_id: string | null
          materials_received: string | null
          period_end_date: string | null
          period_start_date: string | null
          photos_url: string[] | null
          project_id: string
          report_date: string
          report_number: string
          report_type: Database["public"]["Enums"]["report_period_type"]
          safety_observations: string | null
          site_id: string | null
          skilled_labor_count: number | null
          status: string | null
          subcontractor_count: number | null
          submitted_by: string | null
          temperature_high: number | null
          temperature_low: number | null
          unskilled_labor_count: number | null
          updated_at: string | null
          visitor_count: number | null
          weather_conditions: string | null
          work_summary: string | null
        }
        Insert: {
          approved_by?: string | null
          company_id?: string | null
          created_at?: string | null
          delays_issues?: string | null
          equipment_on_site?: string | null
          id?: string
          labor_count?: number | null
          location_id?: string | null
          materials_received?: string | null
          period_end_date?: string | null
          period_start_date?: string | null
          photos_url?: string[] | null
          project_id: string
          report_date: string
          report_number: string
          report_type?: Database["public"]["Enums"]["report_period_type"]
          safety_observations?: string | null
          site_id?: string | null
          skilled_labor_count?: number | null
          status?: string | null
          subcontractor_count?: number | null
          submitted_by?: string | null
          temperature_high?: number | null
          temperature_low?: number | null
          unskilled_labor_count?: number | null
          updated_at?: string | null
          visitor_count?: number | null
          weather_conditions?: string | null
          work_summary?: string | null
        }
        Update: {
          approved_by?: string | null
          company_id?: string | null
          created_at?: string | null
          delays_issues?: string | null
          equipment_on_site?: string | null
          id?: string
          labor_count?: number | null
          location_id?: string | null
          materials_received?: string | null
          period_end_date?: string | null
          period_start_date?: string | null
          photos_url?: string[] | null
          project_id?: string
          report_date?: string
          report_number?: string
          report_type?: Database["public"]["Enums"]["report_period_type"]
          safety_observations?: string | null
          site_id?: string | null
          skilled_labor_count?: number | null
          status?: string | null
          subcontractor_count?: number | null
          submitted_by?: string | null
          temperature_high?: number | null
          temperature_low?: number | null
          unskilled_labor_count?: number | null
          updated_at?: string | null
          visitor_count?: number | null
          weather_conditions?: string | null
          work_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_site_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_site_reports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_site_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_site_reports_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "project_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_permissions: {
        Row: {
          created_at: string | null
          dashboard_id: string
          id: string
          permission_level:
            | Database["public"]["Enums"]["permission_level"]
            | null
          role_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          dashboard_id: string
          id?: string
          permission_level?:
            | Database["public"]["Enums"]["permission_level"]
            | null
          role_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          dashboard_id?: string
          id?: string
          permission_level?:
            | Database["public"]["Enums"]["permission_level"]
            | null
          role_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_permissions_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          config: Json | null
          created_at: string | null
          dashboard_id: string
          filter_config: Json | null
          height: number | null
          id: string
          kpi_id: string | null
          position_x: number | null
          position_y: number | null
          title: string
          updated_at: string | null
          widget_type: Database["public"]["Enums"]["widget_type"]
          width: number | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          dashboard_id: string
          filter_config?: Json | null
          height?: number | null
          id?: string
          kpi_id?: string | null
          position_x?: number | null
          position_y?: number | null
          title: string
          updated_at?: string | null
          widget_type: Database["public"]["Enums"]["widget_type"]
          width?: number | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          dashboard_id?: string
          filter_config?: Json | null
          height?: number | null
          id?: string
          kpi_id?: string | null
          position_x?: number | null
          position_y?: number | null
          title?: string
          updated_at?: string | null
          widget_type?: Database["public"]["Enums"]["widget_type"]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_widgets_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          layout_config: Json | null
          name: string
          updated_at: string | null
          visibility: Database["public"]["Enums"]["dashboard_visibility"] | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          layout_config?: Json | null
          name: string
          updated_at?: string | null
          visibility?:
            | Database["public"]["Enums"]["dashboard_visibility"]
            | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          layout_config?: Json | null
          name?: string
          updated_at?: string | null
          visibility?:
            | Database["public"]["Enums"]["dashboard_visibility"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      debit_notes: {
        Row: {
          amount: number
          amount_applied: number
          company_id: string | null
          created_at: string | null
          created_by: string | null
          debit_date: string
          debit_note_number: string
          description: string | null
          id: string
          reason: string | null
          reference_invoice_id: string | null
          status: string
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          amount_applied?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          debit_date?: string
          debit_note_number: string
          description?: string | null
          id?: string
          reason?: string | null
          reference_invoice_id?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          amount_applied?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          debit_date?: string
          debit_note_number?: string
          description?: string | null
          id?: string
          reason?: string | null
          reference_invoice_id?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debit_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_reference_invoice_id_fkey"
            columns: ["reference_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_order_items: {
        Row: {
          batch_number: string | null
          created_at: string
          do_id: string
          finished_good_id: string
          id: string
          item_condition: string | null
          notes: string | null
          package_number: string | null
          packing_list_item_id: string | null
          quality_checked: boolean | null
          quantity_delivered: number | null
          quantity_ordered: number
          quantity_to_deliver: number
          sales_order_item_id: string | null
          serial_numbers: Json | null
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          do_id: string
          finished_good_id: string
          id?: string
          item_condition?: string | null
          notes?: string | null
          package_number?: string | null
          packing_list_item_id?: string | null
          quality_checked?: boolean | null
          quantity_delivered?: number | null
          quantity_ordered: number
          quantity_to_deliver: number
          sales_order_item_id?: string | null
          serial_numbers?: Json | null
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          do_id?: string
          finished_good_id?: string
          id?: string
          item_condition?: string | null
          notes?: string | null
          package_number?: string | null
          packing_list_item_id?: string | null
          quality_checked?: boolean | null
          quantity_delivered?: number | null
          quantity_ordered?: number
          quantity_to_deliver?: number
          sales_order_item_id?: string | null
          serial_numbers?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_order_items_do_id_fkey"
            columns: ["do_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_items_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_items_packing_list_item_id_fkey"
            columns: ["packing_list_item_id"]
            isOneToOne: false
            referencedRelation: "packing_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_items_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          approval_notes: string | null
          approved_by: string | null
          approved_date: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          delivery_address: string
          delivery_contact: string | null
          delivery_date: string
          delivery_instructions: string | null
          delivery_phone: string | null
          delivery_time_slot: string | null
          do_number: string
          driver_name: string | null
          driver_phone: string | null
          finished_goods_issue_id: string | null
          id: string
          internal_notes: string | null
          packing_list_id: string | null
          priority: string | null
          sales_order_id: string
          special_instructions: string | null
          status: string
          total_packages: number | null
          total_volume: number | null
          total_weight: number | null
          updated_at: string
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivery_address: string
          delivery_contact?: string | null
          delivery_date: string
          delivery_instructions?: string | null
          delivery_phone?: string | null
          delivery_time_slot?: string | null
          do_number: string
          driver_name?: string | null
          driver_phone?: string | null
          finished_goods_issue_id?: string | null
          id?: string
          internal_notes?: string | null
          packing_list_id?: string | null
          priority?: string | null
          sales_order_id: string
          special_instructions?: string | null
          status?: string
          total_packages?: number | null
          total_volume?: number | null
          total_weight?: number | null
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivery_address?: string
          delivery_contact?: string | null
          delivery_date?: string
          delivery_instructions?: string | null
          delivery_phone?: string | null
          delivery_time_slot?: string | null
          do_number?: string
          driver_name?: string | null
          driver_phone?: string | null
          finished_goods_issue_id?: string | null
          id?: string
          internal_notes?: string | null
          packing_list_id?: string | null
          priority?: string | null
          sales_order_id?: string
          special_instructions?: string | null
          status?: string
          total_packages?: number | null
          total_volume?: number | null
          total_weight?: number | null
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_finished_goods_issue_id_fkey"
            columns: ["finished_goods_issue_id"]
            isOneToOne: false
            referencedRelation: "finished_goods_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_packing_list_id_fkey"
            columns: ["packing_list_id"]
            isOneToOne: false
            referencedRelation: "packing_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      depreciation_schedule: {
        Row: {
          accumulated_depreciation: number
          asset_id: string | null
          book_value: number
          company_id: string | null
          created_at: string | null
          depreciation_amount: number
          fiscal_year: number | null
          id: string
          is_posted: boolean | null
          journal_entry_id: string | null
          period_id: string | null
          period_number: number | null
          posted_date: string | null
          warehouse_asset_id: string | null
        }
        Insert: {
          accumulated_depreciation: number
          asset_id?: string | null
          book_value: number
          company_id?: string | null
          created_at?: string | null
          depreciation_amount: number
          fiscal_year?: number | null
          id?: string
          is_posted?: boolean | null
          journal_entry_id?: string | null
          period_id?: string | null
          period_number?: number | null
          posted_date?: string | null
          warehouse_asset_id?: string | null
        }
        Update: {
          accumulated_depreciation?: number
          asset_id?: string | null
          book_value?: number
          company_id?: string | null
          created_at?: string | null
          depreciation_amount?: number
          fiscal_year?: number | null
          id?: string
          is_posted?: boolean | null
          journal_entry_id?: string | null
          period_id?: string | null
          period_number?: number | null
          posted_date?: string | null
          warehouse_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_schedule_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedule_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedule_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedule_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedule_warehouse_asset_id_fkey"
            columns: ["warehouse_asset_id"]
            isOneToOne: false
            referencedRelation: "warehouse_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_records: {
        Row: {
          actual_delivery_date: string | null
          company_id: string | null
          courier_name: string | null
          created_at: string
          created_by: string | null
          delivery_address: string
          delivery_contact: string | null
          delivery_notes: string | null
          delivery_order_id: string | null
          delivery_phone: string | null
          dispatch_date: string
          dispatch_number: string
          estimated_delivery_date: string | null
          id: string
          packing_list_id: string
          proof_of_delivery_url: string | null
          sales_order_id: string
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          company_id?: string | null
          courier_name?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address: string
          delivery_contact?: string | null
          delivery_notes?: string | null
          delivery_order_id?: string | null
          delivery_phone?: string | null
          dispatch_date?: string
          dispatch_number: string
          estimated_delivery_date?: string | null
          id?: string
          packing_list_id: string
          proof_of_delivery_url?: string | null
          sales_order_id: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          company_id?: string | null
          courier_name?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string
          delivery_contact?: string | null
          delivery_notes?: string | null
          delivery_order_id?: string | null
          delivery_phone?: string | null
          dispatch_date?: string
          dispatch_number?: string
          estimated_delivery_date?: string | null
          id?: string
          packing_list_id?: string
          proof_of_delivery_url?: string | null
          sales_order_id?: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_records_delivery_order_id_fkey"
            columns: ["delivery_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_records_packing_list_id_fkey"
            columns: ["packing_list_id"]
            isOneToOne: false
            referencedRelation: "packing_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_records_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_history: {
        Row: {
          amount_overdue: number
          company_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          days_overdue: number
          dunning_date: string
          dunning_level_id: string | null
          email_sent: boolean | null
          fee_charged: number | null
          id: string
          invoice_id: string
          letter_sent: boolean | null
          response_date: string | null
          response_notes: string | null
          status: string | null
        }
        Insert: {
          amount_overdue: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          days_overdue: number
          dunning_date?: string
          dunning_level_id?: string | null
          email_sent?: boolean | null
          fee_charged?: number | null
          id?: string
          invoice_id: string
          letter_sent?: boolean | null
          response_date?: string | null
          response_notes?: string | null
          status?: string | null
        }
        Update: {
          amount_overdue?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          days_overdue?: number
          dunning_date?: string
          dunning_level_id?: string | null
          email_sent?: boolean | null
          fee_charged?: number | null
          id?: string
          invoice_id?: string
          letter_sent?: boolean | null
          response_date?: string | null
          response_notes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dunning_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_history_dunning_level_id_fkey"
            columns: ["dunning_level_id"]
            isOneToOne: false
            referencedRelation: "dunning_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_levels: {
        Row: {
          company_id: string | null
          created_at: string | null
          days_overdue: number
          email_template: string | null
          fee_amount: number | null
          fee_percent: number | null
          id: string
          is_active: boolean | null
          letter_template: string | null
          level_name: string
          level_number: number
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          days_overdue: number
          email_template?: string | null
          fee_amount?: number | null
          fee_percent?: number | null
          id?: string
          is_active?: boolean | null
          letter_template?: string | null
          level_name: string
          level_number: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          days_overdue?: number
          email_template?: string | null
          fee_amount?: number | null
          fee_percent?: number | null
          id?: string
          is_active?: boolean | null
          letter_template?: string | null
          level_name?: string
          level_number?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dunning_levels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_attachment_keys: {
        Row: {
          algorithm: string
          attachment_id: string
          auth_tag: string
          company_id: string
          created_at: string
          id: string
          iv: string
          key_id: string
          wrapped_dek: string
        }
        Insert: {
          algorithm?: string
          attachment_id: string
          auth_tag: string
          company_id: string
          created_at?: string
          id?: string
          iv: string
          key_id: string
          wrapped_dek: string
        }
        Update: {
          algorithm?: string
          attachment_id?: string
          auth_tag?: string
          company_id?: string
          created_at?: string
          id?: string
          iv?: string
          key_id?: string
          wrapped_dek?: string
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_attachment_keys_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "einvoice_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_attachments: {
        Row: {
          byte_size: number | null
          created_at: string
          einvoice_id: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          uploaded_by: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          einvoice_id: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          uploaded_by: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          einvoice_id?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_attachments_einvoice_id_fkey"
            columns: ["einvoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_country_artifacts: {
        Row: {
          clearance_status: string | null
          clearance_uuid: string | null
          cleared_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          einvoice_id: string
          government_response: Json
          id: string
          mandate: Database["public"]["Enums"]["einvoice_country_mandate"]
          qr_code: string | null
        }
        Insert: {
          clearance_status?: string | null
          clearance_uuid?: string | null
          cleared_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          einvoice_id: string
          government_response?: Json
          id?: string
          mandate: Database["public"]["Enums"]["einvoice_country_mandate"]
          qr_code?: string | null
        }
        Update: {
          clearance_status?: string | null
          clearance_uuid?: string | null
          cleared_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          einvoice_id?: string
          government_response?: Json
          id?: string
          mandate?: Database["public"]["Enums"]["einvoice_country_mandate"]
          qr_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_country_artifacts_einvoice_id_fkey"
            columns: ["einvoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          einvoice_id: string
          event_type: Database["public"]["Enums"]["einvoice_event_type"]
          id: string
          ip: string | null
          payload: Json
          prev_hash: string | null
          row_hash: string
          user_agent: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          einvoice_id: string
          event_type: Database["public"]["Enums"]["einvoice_event_type"]
          id?: string
          ip?: string | null
          payload?: Json
          prev_hash?: string | null
          row_hash?: string
          user_agent?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          einvoice_id?: string
          event_type?: Database["public"]["Enums"]["einvoice_event_type"]
          id?: string
          ip?: string | null
          payload?: Json
          prev_hash?: string | null
          row_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_events_einvoice_id_fkey"
            columns: ["einvoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_lines: {
        Row: {
          created_at: string
          description: string
          einvoice_id: string
          id: string
          item_code: string | null
          line_extension: number
          line_no: number
          po_line_id: string | null
          quantity: number
          tax_amount: number
          tax_category: string
          tax_rate: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          einvoice_id: string
          id?: string
          item_code?: string | null
          line_extension: number
          line_no: number
          po_line_id?: string | null
          quantity: number
          tax_amount?: number
          tax_category?: string
          tax_rate?: number
          unit?: string
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          einvoice_id?: string
          id?: string
          item_code?: string | null
          line_extension?: number
          line_no?: number
          po_line_id?: string | null
          quantity?: number
          tax_amount?: number
          tax_category?: string
          tax_rate?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_lines_einvoice_id_fkey"
            columns: ["einvoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_match_results: {
        Row: {
          discrepancies: Json
          einvoice_id: string
          evaluated_at: string
          evaluated_by: string | null
          grn_id: string | null
          id: string
          po_id: string | null
          price_match: boolean
          qty_match: boolean
          score: number
          total_match: boolean
        }
        Insert: {
          discrepancies?: Json
          einvoice_id: string
          evaluated_at?: string
          evaluated_by?: string | null
          grn_id?: string | null
          id?: string
          po_id?: string | null
          price_match?: boolean
          qty_match?: boolean
          score?: number
          total_match?: boolean
        }
        Update: {
          discrepancies?: Json
          einvoice_id?: string
          evaluated_at?: string
          evaluated_by?: string | null
          grn_id?: string | null
          id?: string
          po_id?: string | null
          price_match?: boolean
          qty_match?: boolean
          score?: number
          total_match?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_match_results_einvoice_id_fkey"
            columns: ["einvoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_transmissions: {
        Row: {
          attempt_count: number
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["einvoice_direction"]
          einvoice_id: string
          error_message: string | null
          id: string
          last_status: string
          last_status_at: string
          provider: string
          provider_message_id: string | null
          raw_response: Json
          submitted_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["einvoice_direction"]
          einvoice_id: string
          error_message?: string | null
          id?: string
          last_status?: string
          last_status_at?: string
          provider?: string
          provider_message_id?: string | null
          raw_response?: Json
          submitted_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["einvoice_direction"]
          einvoice_id?: string
          error_message?: string | null
          id?: string
          last_status?: string
          last_status_at?: string
          provider?: string
          provider_message_id?: string | null
          raw_response?: Json
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_transmissions_einvoice_id_fkey"
            columns: ["einvoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoices: {
        Row: {
          archive_until: string | null
          company_id: string
          compliance_profile: Database["public"]["Enums"]["einvoice_compliance_profile"]
          corrected_einvoice_id: string | null
          created_at: string
          created_by: string
          currency: string
          customer_company_id: string | null
          direction: Database["public"]["Enums"]["einvoice_direction"]
          document_type: Database["public"]["Enums"]["einvoice_document_type"]
          due_date: string | null
          grand_total: number
          grn_id: string | null
          id: string
          invoice_number: string
          issue_date: string
          legal_hold: boolean
          match_status: Database["public"]["Enums"]["einvoice_match_status"]
          notes: string | null
          pdf_path: string | null
          peppol_customization: string
          peppol_message_id: string | null
          peppol_profile: string
          po_id: string | null
          status: Database["public"]["Enums"]["einvoice_status"]
          subtotal: number
          supplier_id: string | null
          tax_total: number
          ubl_xml_path: string | null
          updated_at: string
          validation_report: Json | null
        }
        Insert: {
          archive_until?: string | null
          company_id: string
          compliance_profile?: Database["public"]["Enums"]["einvoice_compliance_profile"]
          corrected_einvoice_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          customer_company_id?: string | null
          direction: Database["public"]["Enums"]["einvoice_direction"]
          document_type?: Database["public"]["Enums"]["einvoice_document_type"]
          due_date?: string | null
          grand_total?: number
          grn_id?: string | null
          id?: string
          invoice_number: string
          issue_date: string
          legal_hold?: boolean
          match_status?: Database["public"]["Enums"]["einvoice_match_status"]
          notes?: string | null
          pdf_path?: string | null
          peppol_customization?: string
          peppol_message_id?: string | null
          peppol_profile?: string
          po_id?: string | null
          status?: Database["public"]["Enums"]["einvoice_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          ubl_xml_path?: string | null
          updated_at?: string
          validation_report?: Json | null
        }
        Update: {
          archive_until?: string | null
          company_id?: string
          compliance_profile?: Database["public"]["Enums"]["einvoice_compliance_profile"]
          corrected_einvoice_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          customer_company_id?: string | null
          direction?: Database["public"]["Enums"]["einvoice_direction"]
          document_type?: Database["public"]["Enums"]["einvoice_document_type"]
          due_date?: string | null
          grand_total?: number
          grn_id?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          legal_hold?: boolean
          match_status?: Database["public"]["Enums"]["einvoice_match_status"]
          notes?: string | null
          pdf_path?: string | null
          peppol_customization?: string
          peppol_message_id?: string | null
          peppol_profile?: string
          po_id?: string | null
          status?: Database["public"]["Enums"]["einvoice_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          ubl_xml_path?: string | null
          updated_at?: string
          validation_report?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_corrected_einvoice_id_fkey"
            columns: ["corrected_einvoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_customer_company_id_fkey"
            columns: ["customer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_rules: {
        Row: {
          action_type: string
          company_id: string | null
          comparison_operator: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          rule_name: string
          rule_type: string
          threshold_value: number
          updated_at: string
        }
        Insert: {
          action_type: string
          company_id?: string | null
          comparison_operator: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          rule_name: string
          rule_type: string
          threshold_value: number
          updated_at?: string
        }
        Update: {
          action_type?: string
          company_id?: string | null
          comparison_operator?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          rule_name?: string
          rule_type?: string
          threshold_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          exchange_rate: number
          from_currency: string
          id: string
          rate_date: string
          rate_type: string | null
          source: string | null
          to_currency: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          exchange_rate: number
          from_currency: string
          id?: string
          rate_date: string
          rate_type?: string | null
          source?: string | null
          to_currency: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          exchange_rate?: number
          from_currency?: string
          id?: string
          rate_date?: string
          rate_type?: string | null
          source?: string | null
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_rates_from_currency_fkey"
            columns: ["from_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "exchange_rates_to_currency_fkey"
            columns: ["to_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      expense_categories: {
        Row: {
          category_code: string | null
          category_name: string
          company_id: string | null
          created_at: string | null
          gl_account_id: string | null
          id: string
          is_active: boolean
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          category_code?: string | null
          category_name: string
          company_id?: string | null
          created_at?: string | null
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category_code?: string | null
          category_name?: string
          company_id?: string | null
          created_at?: string | null
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods: {
        Row: {
          available_sizes: Json | null
          available_stock: number | null
          bin_id: string | null
          bom_id: string | null
          category: string | null
          color: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          current_stock: number
          description: string | null
          id: string
          is_variant: boolean | null
          lead_time_days: number | null
          location_id: string | null
          maximum_stock: number | null
          minimum_stock: number | null
          product_code: string
          product_master_id: string | null
          product_name: string
          quality_status: string | null
          reorder_point: number | null
          reserved_stock: number
          selling_price: number | null
          size: string | null
          size_specific_stock: Json | null
          standard_cost: number | null
          status: string | null
          style_no: string | null
          sublocation_id: string | null
          unit_of_measure: string
          updated_at: string | null
          variant: string | null
          variant_code: string | null
          warehouse_item_id: string | null
        }
        Insert: {
          available_sizes?: Json | null
          available_stock?: number | null
          bin_id?: string | null
          bom_id?: string | null
          category?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_stock?: number
          description?: string | null
          id?: string
          is_variant?: boolean | null
          lead_time_days?: number | null
          location_id?: string | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          product_code: string
          product_master_id?: string | null
          product_name: string
          quality_status?: string | null
          reorder_point?: number | null
          reserved_stock?: number
          selling_price?: number | null
          size?: string | null
          size_specific_stock?: Json | null
          standard_cost?: number | null
          status?: string | null
          style_no?: string | null
          sublocation_id?: string | null
          unit_of_measure?: string
          updated_at?: string | null
          variant?: string | null
          variant_code?: string | null
          warehouse_item_id?: string | null
        }
        Update: {
          available_sizes?: Json | null
          available_stock?: number | null
          bin_id?: string | null
          bom_id?: string | null
          category?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_stock?: number
          description?: string | null
          id?: string
          is_variant?: boolean | null
          lead_time_days?: number | null
          location_id?: string | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          product_code?: string
          product_master_id?: string | null
          product_name?: string
          quality_status?: string | null
          reorder_point?: number | null
          reserved_stock?: number
          selling_price?: number | null
          size?: string | null
          size_specific_stock?: Json | null
          standard_cost?: number | null
          status?: string | null
          style_no?: string | null
          sublocation_id?: string | null
          unit_of_measure?: string
          updated_at?: string | null
          variant?: string | null
          variant_code?: string | null
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_product_master_id_fkey"
            columns: ["product_master_id"]
            isOneToOne: false
            referencedRelation: "product_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_finished_goods_warehouse_item"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_finished_goods_warehouse_item"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_finished_goods_warehouse_item"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_batch_approvals: {
        Row: {
          action: string
          approver_id: string
          batch_id: string
          comments: string | null
          created_at: string
          id: string
        }
        Insert: {
          action: string
          approver_id: string
          batch_id: string
          comments?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          action?: string
          approver_id?: string
          batch_id?: string
          comments?: string | null
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_batch_approvals_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "finished_goods_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_batches: {
        Row: {
          approval_comments: string | null
          approval_status: string | null
          approved_by: string | null
          approved_date: string | null
          batch_number: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          expiry_date: string | null
          finished_good_id: string
          id: string
          notes: string | null
          production_cost: number | null
          production_date: string
          quality_check_by: string | null
          quality_check_date: string | null
          quality_check_status: string | null
          quantity: number
          rejection_reason: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approval_comments?: string | null
          approval_status?: string | null
          approved_by?: string | null
          approved_date?: string | null
          batch_number: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expiry_date?: string | null
          finished_good_id: string
          id?: string
          notes?: string | null
          production_cost?: number | null
          production_date: string
          quality_check_by?: string | null
          quality_check_date?: string | null
          quality_check_status?: string | null
          quantity: number
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_comments?: string | null
          approval_status?: string | null
          approved_by?: string | null
          approved_date?: string | null
          batch_number?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expiry_date?: string | null
          finished_good_id?: string
          id?: string
          notes?: string | null
          production_cost?: number | null
          production_date?: string
          quality_check_by?: string | null
          quality_check_date?: string | null
          quality_check_status?: string | null
          quantity?: number
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_batches_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_issue_items: {
        Row: {
          batch_number: string | null
          created_at: string | null
          finished_good_id: string
          from_bin_id: string | null
          from_location_id: string | null
          id: string
          issue_id: string
          notes: string | null
          quantity_issued: number | null
          quantity_to_issue: number
          sales_order_item_id: string | null
          serial_numbers: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          finished_good_id: string
          from_bin_id?: string | null
          from_location_id?: string | null
          id?: string
          issue_id: string
          notes?: string | null
          quantity_issued?: number | null
          quantity_to_issue: number
          sales_order_item_id?: string | null
          serial_numbers?: Json | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          finished_good_id?: string
          from_bin_id?: string | null
          from_location_id?: string | null
          id?: string
          issue_id?: string
          notes?: string | null
          quantity_issued?: number | null
          quantity_to_issue?: number
          sales_order_item_id?: string | null
          serial_numbers?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_issue_items_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_issue_items_from_bin_id_fkey"
            columns: ["from_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_issue_items_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_issue_items_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "finished_goods_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_issue_items_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_issues: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          issue_date: string
          issue_number: string
          issued_by: string | null
          issued_items: number | null
          notes: string | null
          sales_order_id: string | null
          status: string
          total_items: number | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          issue_date?: string
          issue_number: string
          issued_by?: string | null
          issued_items?: number | null
          notes?: string | null
          sales_order_id?: string | null
          status?: string
          total_items?: number | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          issue_date?: string
          issue_number?: string
          issued_by?: string | null
          issued_items?: number | null
          notes?: string | null
          sales_order_id?: string | null
          status?: string
          total_items?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_issues_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_movements: {
        Row: {
          batch_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          finished_good_id: string
          from_location_id: string | null
          id: string
          movement_type: string
          notes: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
          to_location_id: string | null
          total_value: number | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          batch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          finished_good_id: string
          from_location_id?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          to_location_id?: string | null
          total_value?: number | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          batch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          finished_good_id?: string
          from_location_id?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change?: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          to_location_id?: string | null
          total_value?: number | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "finished_goods_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_movements_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_reservations: {
        Row: {
          batch_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          finished_good_id: string
          id: string
          notes: string | null
          reference_id: string
          reference_number: string | null
          reference_type: string
          required_date: string | null
          reserved_date: string
          reserved_quantity: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          batch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          finished_good_id: string
          id?: string
          notes?: string | null
          reference_id: string
          reference_number?: string | null
          reference_type: string
          required_date?: string | null
          reserved_date?: string
          reserved_quantity: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          finished_good_id?: string
          id?: string
          notes?: string | null
          reference_id?: string
          reference_number?: string | null
          reference_type?: string
          required_date?: string | null
          reserved_date?: string
          reserved_quantity?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_reservations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "finished_goods_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_reservations_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_years: {
        Row: {
          company_id: string | null
          created_at: string | null
          end_date: string
          fiscal_year: number
          id: string
          is_current: boolean | null
          start_date: string
          status: Database["public"]["Enums"]["period_status"] | null
          updated_at: string | null
          year_name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          end_date: string
          fiscal_year: number
          id?: string
          is_current?: boolean | null
          start_date: string
          status?: Database["public"]["Enums"]["period_status"] | null
          updated_at?: string | null
          year_name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          end_date?: string
          fiscal_year?: number
          id?: string
          is_current?: boolean | null
          start_date?: string
          status?: Database["public"]["Enums"]["period_status"] | null
          updated_at?: string | null
          year_name?: string
        }
        Relationships: []
      }
      floor_drawing_rooms: {
        Row: {
          area_sqft: number | null
          area_sqm: number | null
          center_x: number | null
          center_y: number | null
          color: string | null
          coordinates: Json | null
          created_at: string | null
          floor_drawing_id: string
          height_percent: number | null
          id: string
          room_name: string
          room_type: string | null
          updated_at: string | null
          width_percent: number | null
        }
        Insert: {
          area_sqft?: number | null
          area_sqm?: number | null
          center_x?: number | null
          center_y?: number | null
          color?: string | null
          coordinates?: Json | null
          created_at?: string | null
          floor_drawing_id: string
          height_percent?: number | null
          id?: string
          room_name: string
          room_type?: string | null
          updated_at?: string | null
          width_percent?: number | null
        }
        Update: {
          area_sqft?: number | null
          area_sqm?: number | null
          center_x?: number | null
          center_y?: number | null
          color?: string | null
          coordinates?: Json | null
          created_at?: string | null
          floor_drawing_id?: string
          height_percent?: number | null
          id?: string
          room_name?: string
          room_type?: string | null
          updated_at?: string | null
          width_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "floor_drawing_rooms_floor_drawing_id_fkey"
            columns: ["floor_drawing_id"]
            isOneToOne: false
            referencedRelation: "project_floor_drawings"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_room_material_transactions: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          new_quantity: number
          new_warehouse_stock: number | null
          notes: string | null
          performed_by: string | null
          previous_quantity: number
          previous_warehouse_stock: number | null
          quantity: number
          room_id: string
          room_material_id: string
          total_value: number | null
          transaction_type: string
          unit_cost: number | null
          warehouse_item_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          new_quantity: number
          new_warehouse_stock?: number | null
          notes?: string | null
          performed_by?: string | null
          previous_quantity?: number
          previous_warehouse_stock?: number | null
          quantity: number
          room_id: string
          room_material_id: string
          total_value?: number | null
          transaction_type: string
          unit_cost?: number | null
          warehouse_item_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          new_quantity?: number
          new_warehouse_stock?: number | null
          notes?: string | null
          performed_by?: string | null
          previous_quantity?: number
          previous_warehouse_stock?: number | null
          quantity?: number
          room_id?: string
          room_material_id?: string
          total_value?: number | null
          transaction_type?: string
          unit_cost?: number | null
          warehouse_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_room_material_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_room_material_transactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "floor_drawing_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_room_material_transactions_room_material_id_fkey"
            columns: ["room_material_id"]
            isOneToOne: false
            referencedRelation: "floor_room_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_room_material_transactions_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_room_material_transactions_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_room_material_transactions_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_room_materials: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          quantity_allocated: number | null
          quantity_required: number
          quantity_used: number | null
          room_id: string
          status: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string | null
          warehouse_item_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity_allocated?: number | null
          quantity_required?: number
          quantity_used?: number | null
          room_id: string
          status?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          warehouse_item_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity_allocated?: number | null
          quantity_required?: number
          quantity_used?: number | null
          room_id?: string
          status?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          warehouse_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_room_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_room_materials_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "floor_drawing_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_room_materials_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_room_materials_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_room_materials_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_room_stages: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          assigned_to: string | null
          company_id: string | null
          completion_percentage: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          notes: string | null
          planned_end_date: string | null
          planned_start_date: string | null
          room_id: string
          stage_name: string
          stage_order: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          assigned_to?: string | null
          company_id?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          room_id: string
          stage_name: string
          stage_order: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          assigned_to?: string | null
          company_id?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          room_id?: string
          stage_name?: string
          stage_order?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "floor_room_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_room_stages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "floor_drawing_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_transfers: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          exchange_rate: number | null
          from_account_id: string | null
          from_currency: string | null
          id: string
          journal_entry_id: string | null
          reference_number: string | null
          status: string
          to_account_id: string | null
          to_currency: string | null
          transfer_date: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          exchange_rate?: number | null
          from_account_id?: string | null
          from_currency?: string | null
          id?: string
          journal_entry_id?: string | null
          reference_number?: string | null
          status?: string
          to_account_id?: string | null
          to_currency?: string | null
          transfer_date?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          exchange_rate?: number | null
          from_account_id?: string | null
          from_currency?: string | null
          id?: string
          journal_entry_id?: string | null
          reference_number?: string | null
          status?: string
          to_account_id?: string | null
          to_currency?: string | null
          transfer_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fund_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transfers_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_settings: {
        Row: {
          allow_posting_to_closed_periods: boolean | null
          approval_threshold_amount: number | null
          base_currency: string
          company_id: string
          created_at: string
          currency_symbol: string
          date_format: string | null
          decimal_places: number
          id: string
          je_number_format: string | null
          require_je_approval: boolean | null
          updated_at: string
        }
        Insert: {
          allow_posting_to_closed_periods?: boolean | null
          approval_threshold_amount?: number | null
          base_currency?: string
          company_id: string
          created_at?: string
          currency_symbol?: string
          date_format?: string | null
          decimal_places?: number
          id?: string
          je_number_format?: string | null
          require_je_approval?: boolean | null
          updated_at?: string
        }
        Update: {
          allow_posting_to_closed_periods?: boolean | null
          approval_threshold_amount?: number | null
          base_currency?: string
          company_id?: string
          created_at?: string
          currency_symbol?: string
          date_format?: string | null
          decimal_places?: number
          id?: string
          je_number_format?: string | null
          require_je_approval?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_notes: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          branch: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          grn_date: string
          grn_number: string
          id: string
          invoice_date: string | null
          invoice_document_url: string | null
          invoice_number: string | null
          mr_number: string | null
          po_id: string | null
          po_number: string | null
          pr_number: string | null
          received_by: string | null
          remarks: string | null
          status: string
          supplier_address: string | null
          supplier_id: string | null
          supplier_name: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          branch?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          grn_date?: string
          grn_number: string
          id?: string
          invoice_date?: string | null
          invoice_document_url?: string | null
          invoice_number?: string | null
          mr_number?: string | null
          po_id?: string | null
          po_number?: string | null
          pr_number?: string | null
          received_by?: string | null
          remarks?: string | null
          status?: string
          supplier_address?: string | null
          supplier_id?: string | null
          supplier_name: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          branch?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          grn_date?: string
          grn_number?: string
          id?: string
          invoice_date?: string | null
          invoice_document_url?: string | null
          invoice_number?: string | null
          mr_number?: string | null
          po_id?: string | null
          po_number?: string | null
          pr_number?: string | null
          received_by?: string | null
          remarks?: string | null
          status?: string
          supplier_address?: string | null
          supplier_id?: string | null
          supplier_name?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_notes_approved_by_profile_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_approved_by_profile_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_created_by_profile_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_created_by_profile_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_received_by_profile_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_received_by_profile_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_items: {
        Row: {
          batch_number: string | null
          conversion_note: string | null
          created_at: string
          description: string | null
          expiry_date: string | null
          grn_id: string
          id: string
          item_code: string | null
          item_name: string
          manufacturing_date: string | null
          po_item_id: string | null
          quality_status: string | null
          quantity_ordered: number | null
          quantity_received: number
          remarks: string | null
          secondary_quantity_received: number | null
          secondary_uom: string | null
          total_cost: number | null
          unit_of_measure: string
          unit_price: number | null
          updated_at: string
          warehouse_item_id: string | null
        }
        Insert: {
          batch_number?: string | null
          conversion_note?: string | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          grn_id: string
          id?: string
          item_code?: string | null
          item_name: string
          manufacturing_date?: string | null
          po_item_id?: string | null
          quality_status?: string | null
          quantity_ordered?: number | null
          quantity_received: number
          remarks?: string | null
          secondary_quantity_received?: number | null
          secondary_uom?: string | null
          total_cost?: number | null
          unit_of_measure?: string
          unit_price?: number | null
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Update: {
          batch_number?: string | null
          conversion_note?: string | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          grn_id?: string
          id?: string
          item_code?: string | null
          item_name?: string
          manufacturing_date?: string | null
          po_item_id?: string | null
          quality_status?: string | null
          quantity_ordered?: number | null
          quantity_received?: number
          remarks?: string | null
          secondary_quantity_received?: number | null
          secondary_uom?: string | null
          total_cost?: number | null
          unit_of_measure?: string
          unit_price?: number | null
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_snapshots: {
        Row: {
          assets_value: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          finished_goods_value: number | null
          id: string
          item_count: number | null
          raw_materials_value: number | null
          snapshot_data: Json | null
          snapshot_date: string
          snapshot_type: string
          total_inventory_value: number | null
        }
        Insert: {
          assets_value?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          finished_goods_value?: number | null
          id?: string
          item_count?: number | null
          raw_materials_value?: number | null
          snapshot_data?: Json | null
          snapshot_date: string
          snapshot_type: string
          total_inventory_value?: number | null
        }
        Update: {
          assets_value?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          finished_goods_value?: number | null
          id?: string
          item_count?: number | null
          raw_materials_value?: number | null
          snapshot_data?: Json | null
          snapshot_date?: string
          snapshot_type?: string
          total_inventory_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_valuation_methods: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          effective_from: string
          id: string
          is_default: boolean | null
          item_id: string | null
          item_type: string
          updated_at: string | null
          valuation_method: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          id?: string
          is_default?: boolean | null
          item_id?: string | null
          item_type: string
          updated_at?: string | null
          valuation_method: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          id?: string
          is_default?: boolean | null
          item_id?: string | null
          item_type?: string
          updated_at?: string | null
          valuation_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_valuation_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_valuation_reports: {
        Row: {
          company_id: string | null
          filters: Json | null
          generated_at: string | null
          generated_by: string | null
          id: string
          is_pinned: boolean | null
          report_data: Json | null
          report_name: string
          report_type: string
        }
        Insert: {
          company_id?: string | null
          filters?: Json | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          is_pinned?: boolean | null
          report_data?: Json | null
          report_name: string
          report_type: string
        }
        Update: {
          company_id?: string | null
          filters?: Json | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          is_pinned?: boolean | null
          report_data?: Json | null
          report_name?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_valuation_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment_schedule: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string | null
          discount_amount: number | null
          discount_date: string | null
          discount_taken: number | null
          due_date: string
          id: string
          installment_number: number | null
          invoice_id: string
          invoice_type: string
          notes: string | null
          paid_amount: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_date?: string | null
          discount_taken?: number | null
          due_date: string
          id?: string
          installment_number?: number | null
          invoice_id: string
          invoice_type: string
          notes?: string | null
          paid_amount?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_date?: string | null
          discount_taken?: number | null
          due_date?: string
          id?: string
          installment_number?: number | null
          invoice_id?: string
          invoice_type?: string
          notes?: string | null
          paid_amount?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_schedule_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      item_batches: {
        Row: {
          batch_number: string
          company_id: string | null
          created_at: string | null
          expiry_date: string | null
          grn_item_id: string | null
          id: string
          manufacturing_date: string | null
          notes: string | null
          quantity_received: number
          quantity_remaining: number
          status: string | null
          unit_cost: number | null
          updated_at: string | null
          warehouse_item_id: string
        }
        Insert: {
          batch_number: string
          company_id?: string | null
          created_at?: string | null
          expiry_date?: string | null
          grn_item_id?: string | null
          id?: string
          manufacturing_date?: string | null
          notes?: string | null
          quantity_received?: number
          quantity_remaining?: number
          status?: string | null
          unit_cost?: number | null
          updated_at?: string | null
          warehouse_item_id: string
        }
        Update: {
          batch_number?: string
          company_id?: string | null
          created_at?: string | null
          expiry_date?: string | null
          grn_item_id?: string | null
          id?: string
          manufacturing_date?: string | null
          notes?: string | null
          quantity_received?: number
          quantity_remaining?: number
          status?: string | null
          unit_cost?: number | null
          updated_at?: string | null
          warehouse_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_grn_item_id_fkey"
            columns: ["grn_item_id"]
            isOneToOne: false
            referencedRelation: "grn_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      item_units: {
        Row: {
          abbreviation: string
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          abbreviation: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          approval_required: boolean | null
          approved_by: string | null
          approved_date: string | null
          attachments: Json | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          fiscal_year: number | null
          id: string
          is_balanced: boolean | null
          is_recurring: boolean | null
          journal_date: string
          journal_number: string
          journal_type: Database["public"]["Enums"]["journal_type"] | null
          period_id: string | null
          period_month: number | null
          posted_by: string | null
          posted_date: string | null
          recurrence_pattern: Json | null
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
          reversal_je_id: string | null
          reversed_by: string | null
          reversed_date: string | null
          status: Database["public"]["Enums"]["journal_status"] | null
          tags: string[] | null
          total_credit: number | null
          total_debit: number | null
          updated_at: string | null
        }
        Insert: {
          approval_required?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          attachments?: Json | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          fiscal_year?: number | null
          id?: string
          is_balanced?: boolean | null
          is_recurring?: boolean | null
          journal_date: string
          journal_number: string
          journal_type?: Database["public"]["Enums"]["journal_type"] | null
          period_id?: string | null
          period_month?: number | null
          posted_by?: string | null
          posted_date?: string | null
          recurrence_pattern?: Json | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          reversal_je_id?: string | null
          reversed_by?: string | null
          reversed_date?: string | null
          status?: Database["public"]["Enums"]["journal_status"] | null
          tags?: string[] | null
          total_credit?: number | null
          total_debit?: number | null
          updated_at?: string | null
        }
        Update: {
          approval_required?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          attachments?: Json | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          fiscal_year?: number | null
          id?: string
          is_balanced?: boolean | null
          is_recurring?: boolean | null
          journal_date?: string
          journal_number?: string
          journal_type?: Database["public"]["Enums"]["journal_type"] | null
          period_id?: string | null
          period_month?: number | null
          posted_by?: string | null
          posted_date?: string | null
          recurrence_pattern?: Json | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          reversal_je_id?: string | null
          reversed_by?: string | null
          reversed_date?: string | null
          status?: Database["public"]["Enums"]["journal_status"] | null
          tags?: string[] | null
          total_credit?: number | null
          total_debit?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_je_id_fkey"
            columns: ["reversal_je_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          base_currency_amount: number | null
          cost_center_id: string | null
          created_at: string | null
          credit_amount: number | null
          currency: string | null
          customer_id: string | null
          debit_amount: number | null
          department_id: string | null
          description: string | null
          dimension_1: string | null
          dimension_2: string | null
          dimension_3: string | null
          exchange_rate: number | null
          id: string
          item_id: string | null
          journal_entry_id: string
          line_number: number
          project_id: string | null
          supplier_id: string | null
          tax_amount: number | null
          tax_code_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          base_currency_amount?: number | null
          cost_center_id?: string | null
          created_at?: string | null
          credit_amount?: number | null
          currency?: string | null
          customer_id?: string | null
          debit_amount?: number | null
          department_id?: string | null
          description?: string | null
          dimension_1?: string | null
          dimension_2?: string | null
          dimension_3?: string | null
          exchange_rate?: number | null
          id?: string
          item_id?: string | null
          journal_entry_id: string
          line_number: number
          project_id?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          tax_code_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          base_currency_amount?: number | null
          cost_center_id?: string | null
          created_at?: string | null
          credit_amount?: number | null
          currency?: string | null
          customer_id?: string | null
          debit_amount?: number | null
          department_id?: string | null
          description?: string | null
          dimension_1?: string | null
          dimension_2?: string | null
          dimension_3?: string | null
          exchange_rate?: number | null
          id?: string
          item_id?: string | null
          journal_entry_id?: string
          line_number?: number
          project_id?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          tax_code_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          calculation_type:
            | Database["public"]["Enums"]["calculation_type"]
            | null
          category: Database["public"]["Enums"]["kpi_category"] | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          data_source: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          refresh_interval: number | null
          sql_query: string | null
          target_value: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          calculation_type?:
            | Database["public"]["Enums"]["calculation_type"]
            | null
          category?: Database["public"]["Enums"]["kpi_category"] | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_source?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          refresh_interval?: number | null
          sql_query?: string | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          calculation_type?:
            | Database["public"]["Enums"]["calculation_type"]
            | null
          category?: Database["public"]["Enums"]["kpi_category"] | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_source?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          refresh_interval?: number | null
          sql_query?: string | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_history: {
        Row: {
          calculated_at: string | null
          id: string
          kpi_id: string
          metadata: Json | null
          value: number
        }
        Insert: {
          calculated_at?: string | null
          id?: string
          kpi_id: string
          metadata?: Json | null
          value: number
        }
        Update: {
          calculated_at?: string | null
          id?: string
          kpi_id?: string
          metadata?: Json | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_history_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_query_whitelist: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          query_hash: string
          query_text: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          query_hash: string
          query_text: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          query_hash?: string
          query_text?: string
        }
        Relationships: []
      }
      material_demand: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          current_stock: number
          demand_date: string
          demand_source: string
          gross_requirement: number
          id: string
          item_code: string
          item_name: string
          lead_time_days: number | null
          net_requirement: number
          notes: string | null
          on_order_quantity: number
          reference_id: string | null
          reorder_level: number | null
          safety_stock: number | null
          status: string
          suggested_order_quantity: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stock?: number
          demand_date: string
          demand_source: string
          gross_requirement?: number
          id?: string
          item_code: string
          item_name: string
          lead_time_days?: number | null
          net_requirement?: number
          notes?: string | null
          on_order_quantity?: number
          reference_id?: string | null
          reorder_level?: number | null
          safety_stock?: number | null
          status?: string
          suggested_order_quantity?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stock?: number
          demand_date?: string
          demand_source?: string
          gross_requirement?: number
          id?: string
          item_code?: string
          item_name?: string
          lead_time_days?: number | null
          net_requirement?: number
          notes?: string | null
          on_order_quantity?: number
          reference_id?: string | null
          reorder_level?: number | null
          safety_stock?: number | null
          status?: string
          suggested_order_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      material_demand_items: {
        Row: {
          bom_id: string | null
          bom_item_id: string | null
          created_at: string
          demand_id: string
          id: string
          notes: string | null
          po_id: string | null
          po_item_id: string | null
          priority: string
          quantity_required: number
          required_date: string
          total_cost: number | null
          unit_cost: number | null
          unit_of_measure: string
          updated_at: string
          warehouse_item_id: string | null
        }
        Insert: {
          bom_id?: string | null
          bom_item_id?: string | null
          created_at?: string
          demand_id: string
          id?: string
          notes?: string | null
          po_id?: string | null
          po_item_id?: string | null
          priority?: string
          quantity_required?: number
          required_date: string
          total_cost?: number | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Update: {
          bom_id?: string | null
          bom_item_id?: string | null
          created_at?: string
          demand_id?: string
          id?: string
          notes?: string | null
          po_id?: string | null
          po_item_id?: string | null
          priority?: string
          quantity_required?: number
          required_date?: string
          total_cost?: number | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_demand_items_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "material_demand"
            referencedColumns: ["id"]
          },
        ]
      }
      material_issue_items: {
        Row: {
          batch_allocation_mode: string | null
          created_at: string
          description: string | null
          from_reservation: boolean | null
          id: string
          issued_at: string | null
          item_code: string | null
          item_id: string
          line_number: number | null
          min_id: string
          notes: string | null
          purpose: string | null
          quantity_issued: number
          quantity_received: number | null
          quantity_required: number | null
          received_at: string | null
          recipient_signature: string | null
          reservation_id: string | null
          secondary_quantity_issued: number | null
          secondary_uom: string | null
          srn_number: string | null
          total_cost: number | null
          unit_cost: number | null
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          batch_allocation_mode?: string | null
          created_at?: string
          description?: string | null
          from_reservation?: boolean | null
          id?: string
          issued_at?: string | null
          item_code?: string | null
          item_id: string
          line_number?: number | null
          min_id: string
          notes?: string | null
          purpose?: string | null
          quantity_issued: number
          quantity_received?: number | null
          quantity_required?: number | null
          received_at?: string | null
          recipient_signature?: string | null
          reservation_id?: string | null
          secondary_quantity_issued?: number | null
          secondary_uom?: string | null
          srn_number?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          batch_allocation_mode?: string | null
          created_at?: string
          description?: string | null
          from_reservation?: boolean | null
          id?: string
          issued_at?: string | null
          item_code?: string | null
          item_id?: string
          line_number?: number | null
          min_id?: string
          notes?: string | null
          purpose?: string | null
          quantity_issued?: number
          quantity_received?: number | null
          quantity_required?: number | null
          received_at?: string | null
          recipient_signature?: string | null
          reservation_id?: string | null
          secondary_quantity_issued?: number | null
          secondary_uom?: string | null
          srn_number?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_issue_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_issue_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_issue_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_issue_items_min_id_fkey"
            columns: ["min_id"]
            isOneToOne: false
            referencedRelation: "material_issue_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_issue_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "warehouse_item_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      material_issue_notes: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          company_id: string | null
          contact_number: string | null
          cpo_id: string | null
          cpo_number: string | null
          created_at: string
          created_by: string | null
          department: string | null
          dispatch_note: string | null
          epf_number: string | null
          form_reference: string | null
          hod_approval_date: string | null
          hod_approved_by: string | null
          id: string
          issue_date: string
          issued_by: string | null
          issued_by_name: string | null
          issued_to: string
          items_required_date: string | null
          job_number: string | null
          location_id: string | null
          management_approval_date: string | null
          management_approved_by: string | null
          min_number: string
          mr_received_by: string | null
          mr_received_date: string | null
          notes: string | null
          order_completed: boolean | null
          po_number: string | null
          pr_number: string | null
          purpose: string | null
          received_by: string | null
          received_by_name: string | null
          received_date: string | null
          request_id: string | null
          requested_by: string | null
          srn_document_url: string | null
          srn_number: string | null
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          contact_number?: string | null
          cpo_id?: string | null
          cpo_number?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          dispatch_note?: string | null
          epf_number?: string | null
          form_reference?: string | null
          hod_approval_date?: string | null
          hod_approved_by?: string | null
          id?: string
          issue_date?: string
          issued_by?: string | null
          issued_by_name?: string | null
          issued_to: string
          items_required_date?: string | null
          job_number?: string | null
          location_id?: string | null
          management_approval_date?: string | null
          management_approved_by?: string | null
          min_number: string
          mr_received_by?: string | null
          mr_received_date?: string | null
          notes?: string | null
          order_completed?: boolean | null
          po_number?: string | null
          pr_number?: string | null
          purpose?: string | null
          received_by?: string | null
          received_by_name?: string | null
          received_date?: string | null
          request_id?: string | null
          requested_by?: string | null
          srn_document_url?: string | null
          srn_number?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          contact_number?: string | null
          cpo_id?: string | null
          cpo_number?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          dispatch_note?: string | null
          epf_number?: string | null
          form_reference?: string | null
          hod_approval_date?: string | null
          hod_approved_by?: string | null
          id?: string
          issue_date?: string
          issued_by?: string | null
          issued_by_name?: string | null
          issued_to?: string
          items_required_date?: string | null
          job_number?: string | null
          location_id?: string | null
          management_approval_date?: string | null
          management_approved_by?: string | null
          min_number?: string
          mr_received_by?: string | null
          mr_received_date?: string | null
          notes?: string | null
          order_completed?: boolean | null
          po_number?: string | null
          pr_number?: string | null
          purpose?: string | null
          received_by?: string | null
          received_by_name?: string | null
          received_date?: string | null
          request_id?: string | null
          requested_by?: string | null
          srn_document_url?: string | null
          srn_number?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_issue_notes_cpo_id_fkey"
            columns: ["cpo_id"]
            isOneToOne: false
            referencedRelation: "customer_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_issue_notes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_issue_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_request_items: {
        Row: {
          adjustment_reason: string | null
          created_at: string
          description: string | null
          id: string
          issued_at: string | null
          item_code: string | null
          item_id: string
          line_number: number | null
          notes: string | null
          purpose: string | null
          quantity_approved: number | null
          quantity_issued: number | null
          quantity_received: number | null
          quantity_requested: number
          received_at: string | null
          received_by: string | null
          request_id: string
          srn_number: string | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          adjustment_reason?: string | null
          created_at?: string
          description?: string | null
          id?: string
          issued_at?: string | null
          item_code?: string | null
          item_id: string
          line_number?: number | null
          notes?: string | null
          purpose?: string | null
          quantity_approved?: number | null
          quantity_issued?: number | null
          quantity_received?: number | null
          quantity_requested: number
          received_at?: string | null
          received_by?: string | null
          request_id: string
          srn_number?: string | null
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          adjustment_reason?: string | null
          created_at?: string
          description?: string | null
          id?: string
          issued_at?: string | null
          item_code?: string | null
          item_id?: string
          line_number?: number | null
          notes?: string | null
          purpose?: string | null
          quantity_approved?: number | null
          quantity_issued?: number | null
          quantity_received?: number | null
          quantity_requested?: number
          received_at?: string | null
          received_by?: string | null
          request_id?: string
          srn_number?: string | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_request_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          company_id: string | null
          contact_number: string | null
          cpo_id: string | null
          cpo_number: string | null
          created_at: string
          created_by: string | null
          department: string | null
          epf_number: string | null
          hod_approval_date: string | null
          hod_approved_by: string | null
          hod_comments: string | null
          id: string
          items_required_date: string
          job_number: string | null
          location_id: string | null
          management_approval_date: string | null
          management_approved_by: string | null
          management_comments: string | null
          min_id: string | null
          notes: string | null
          priority: Database["public"]["Enums"]["material_request_priority"]
          purpose: string
          rejection_reason: string | null
          request_date: string
          request_number: string
          requested_by: string
          srn_number: string | null
          status: Database["public"]["Enums"]["material_request_status"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_number?: string | null
          cpo_id?: string | null
          cpo_number?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          epf_number?: string | null
          hod_approval_date?: string | null
          hod_approved_by?: string | null
          hod_comments?: string | null
          id?: string
          items_required_date: string
          job_number?: string | null
          location_id?: string | null
          management_approval_date?: string | null
          management_approved_by?: string | null
          management_comments?: string | null
          min_id?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["material_request_priority"]
          purpose: string
          rejection_reason?: string | null
          request_date?: string
          request_number: string
          requested_by: string
          srn_number?: string | null
          status?: Database["public"]["Enums"]["material_request_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_number?: string | null
          cpo_id?: string | null
          cpo_number?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          epf_number?: string | null
          hod_approval_date?: string | null
          hod_approved_by?: string | null
          hod_comments?: string | null
          id?: string
          items_required_date?: string
          job_number?: string | null
          location_id?: string | null
          management_approval_date?: string | null
          management_approved_by?: string | null
          management_comments?: string | null
          min_id?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["material_request_priority"]
          purpose?: string
          rejection_reason?: string | null
          request_date?: string
          request_number?: string
          requested_by?: string
          srn_number?: string | null
          status?: Database["public"]["Enums"]["material_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_cpo_id_fkey"
            columns: ["cpo_id"]
            isOneToOne: false
            referencedRelation: "customer_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_min_id_fkey"
            columns: ["min_id"]
            isOneToOne: false
            referencedRelation: "material_issue_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      material_return_items: {
        Row: {
          condition: string | null
          created_at: string
          id: string
          item_id: string
          mrn_id: string
          notes: string | null
          quantity_returned: number
          secondary_quantity_returned: number | null
          secondary_uom: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          id?: string
          item_id: string
          mrn_id: string
          notes?: string | null
          quantity_returned: number
          secondary_quantity_returned?: number | null
          secondary_uom?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          id?: string
          item_id?: string
          mrn_id?: string
          notes?: string | null
          quantity_returned?: number
          secondary_quantity_returned?: number | null
          secondary_uom?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_return_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_return_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_return_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_return_items_mrn_id_fkey"
            columns: ["mrn_id"]
            isOneToOne: false
            referencedRelation: "material_return_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      material_return_notes: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          mrn_number: string
          notes: string | null
          reason: string
          reference_id: string | null
          reference_type: string | null
          return_date: string
          return_type: string
          returned_by: string
          srn_number: string | null
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mrn_number: string
          notes?: string | null
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          return_date?: string
          return_type?: string
          returned_by: string
          srn_number?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mrn_number?: string
          notes?: string | null
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          return_date?: string
          return_type?: string
          returned_by?: string
          srn_number?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      packing_list_items: {
        Row: {
          created_at: string | null
          finished_good_id: string
          id: string
          notes: string | null
          package_number: string | null
          packing_list_id: string
          pick_list_item_id: string | null
          quantity_packed: number
          sales_order_item_id: string | null
          serial_numbers: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          finished_good_id: string
          id?: string
          notes?: string | null
          package_number?: string | null
          packing_list_id: string
          pick_list_item_id?: string | null
          quantity_packed: number
          sales_order_item_id?: string | null
          serial_numbers?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          finished_good_id?: string
          id?: string
          notes?: string | null
          package_number?: string | null
          packing_list_id?: string
          pick_list_item_id?: string | null
          quantity_packed?: number
          sales_order_item_id?: string | null
          serial_numbers?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packing_list_items_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_list_items_packing_list_id_fkey"
            columns: ["packing_list_id"]
            isOneToOne: false
            referencedRelation: "packing_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_list_items_pick_list_item_id_fkey"
            columns: ["pick_list_item_id"]
            isOneToOne: false
            referencedRelation: "pick_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_list_items_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_lists: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          package_dimensions: string | null
          package_type: string | null
          package_weight: number | null
          packer_id: string | null
          packing_list_number: string
          pick_list_id: string
          quality_checked_at: string | null
          quality_checked_by: string | null
          sales_order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          package_dimensions?: string | null
          package_type?: string | null
          package_weight?: number | null
          packer_id?: string | null
          packing_list_number: string
          pick_list_id: string
          quality_checked_at?: string | null
          quality_checked_by?: string | null
          sales_order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          package_dimensions?: string | null
          package_type?: string | null
          package_weight?: number | null
          packer_id?: string | null
          packing_list_number?: string
          pick_list_id?: string
          quality_checked_at?: string | null
          quality_checked_by?: string | null
          sales_order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_lists_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_lists_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_allocated: number
          created_at: string | null
          discount_taken: number | null
          id: string
          invoice_id: string | null
          payment_id: string | null
        }
        Insert: {
          amount_allocated: number
          created_at?: string | null
          discount_taken?: number | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
        }
        Update: {
          amount_allocated?: number
          created_at?: string | null
          discount_taken?: number | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "supplier_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_batches: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          bank_account_id: string | null
          batch_date: string
          batch_number: string
          batch_type: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          payment_count: number
          status: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          bank_account_id?: string | null
          batch_date?: string
          batch_number: string
          batch_type?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          payment_count?: number
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          bank_account_id?: string | null
          batch_date?: string
          batch_number?: string
          batch_type?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          payment_count?: number
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_batches_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_run_items: {
        Row: {
          check_number: string | null
          created_at: string | null
          discount_amount: number | null
          failure_reason: string | null
          id: string
          invoice_amount: number
          invoice_id: string
          invoice_type: string | null
          payment_amount: number
          payment_run_id: string
          reference_number: string | null
          status: string | null
          supplier_id: string | null
        }
        Insert: {
          check_number?: string | null
          created_at?: string | null
          discount_amount?: number | null
          failure_reason?: string | null
          id?: string
          invoice_amount: number
          invoice_id: string
          invoice_type?: string | null
          payment_amount: number
          payment_run_id: string
          reference_number?: string | null
          status?: string | null
          supplier_id?: string | null
        }
        Update: {
          check_number?: string | null
          created_at?: string | null
          discount_amount?: number | null
          failure_reason?: string | null
          id?: string
          invoice_amount?: number
          invoice_id?: string
          invoice_type?: string | null
          payment_amount?: number
          payment_run_id?: string
          reference_number?: string | null
          status?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_run_items_payment_run_id_fkey"
            columns: ["payment_run_id"]
            isOneToOne: false
            referencedRelation: "payment_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_run_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_runs: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          bank_account_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payment_count: number | null
          payment_date: string
          payment_method: string | null
          processed_by: string | null
          processed_date: string | null
          run_number: string
          status: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          bank_account_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_count?: number | null
          payment_date: string
          payment_method?: string | null
          processed_by?: string | null
          processed_date?: string | null
          run_number: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          bank_account_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_count?: number | null
          payment_date?: string
          payment_method?: string | null
          processed_by?: string | null
          processed_date?: string | null
          run_number?: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_runs_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_terms: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          credit_days: number
          description: string | null
          discount_days: number | null
          discount_percent: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_days?: number
          description?: string | null
          discount_days?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_days?: number
          description?: string | null
          discount_days?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_terms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      peppol_participants: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          owner_id: string
          owner_type: string
          participant_id: string
          scheme_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          owner_id: string
          owner_type: string
          participant_id: string
          scheme_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          owner_id?: string
          owner_type?: string
          participant_id?: string
          scheme_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          company_id: string | null
          context: Json | null
          id: string
          metric_kind: string
          metric_value: number
          recorded_at: string
          route: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          context?: Json | null
          id?: string
          metric_kind: string
          metric_value: number
          recorded_at?: string
          route: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          context?: Json | null
          id?: string
          metric_kind?: string
          metric_value?: number
          recorded_at?: string
          route?: string
          user_id?: string | null
        }
        Relationships: []
      }
      period_close_tasks: {
        Row: {
          company_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          description: string | null
          id: string
          is_required: boolean | null
          notes: string | null
          period_id: string | null
          status: string | null
          task_category: string | null
          task_name: string
          task_order: number
          task_type: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          notes?: string | null
          period_id?: string | null
          status?: string | null
          task_category?: string | null
          task_name: string
          task_order: number
          task_type: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          notes?: string | null
          period_id?: string | null
          status?: string | null
          task_category?: string | null
          task_name?: string
          task_order?: number
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_close_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_close_tasks_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      petty_cash_funds: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          current_balance: number
          custodian_id: string | null
          custodian_name: string | null
          float_amount: number
          fund_code: string | null
          fund_name: string
          gl_account_id: string | null
          id: string
          last_replenished_at: string | null
          location: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_balance?: number
          custodian_id?: string | null
          custodian_name?: string | null
          float_amount?: number
          fund_code?: string | null
          fund_name: string
          gl_account_id?: string | null
          id?: string
          last_replenished_at?: string | null
          location?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_balance?: number
          custodian_id?: string | null
          custodian_name?: string | null
          float_amount?: number
          fund_code?: string | null
          fund_name?: string
          gl_account_id?: string | null
          id?: string
          last_replenished_at?: string | null
          location?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_funds_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_funds_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_funds_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      petty_cash_vouchers: {
        Row: {
          amount: number
          approved_by: string | null
          approved_date: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expense_category_id: string | null
          fund_id: string | null
          id: string
          journal_entry_id: string | null
          payee_name: string
          receipt_attached: boolean
          status: string
          updated_at: string | null
          voucher_date: string
          voucher_number: string
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_category_id?: string | null
          fund_id?: string | null
          id?: string
          journal_entry_id?: string | null
          payee_name: string
          receipt_attached?: boolean
          status?: string
          updated_at?: string | null
          voucher_date?: string
          voucher_number: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_category_id?: string | null
          fund_id?: string | null
          id?: string
          journal_entry_id?: string | null
          payee_name?: string
          receipt_attached?: boolean
          status?: string
          updated_at?: string | null
          voucher_date?: string
          voucher_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_vouchers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_vouchers_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_vouchers_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_vouchers_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_list_items: {
        Row: {
          bin_id: string | null
          created_at: string
          finished_good_id: string
          id: string
          location_id: string | null
          notes: string | null
          pick_list_id: string
          pick_sequence: number
          picked_at: string | null
          picked_by: string | null
          quantity_picked: number
          quantity_to_pick: number
          sales_order_item_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bin_id?: string | null
          created_at?: string
          finished_good_id: string
          id?: string
          location_id?: string | null
          notes?: string | null
          pick_list_id: string
          pick_sequence?: number
          picked_at?: string | null
          picked_by?: string | null
          quantity_picked?: number
          quantity_to_pick: number
          sales_order_item_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bin_id?: string | null
          created_at?: string
          finished_good_id?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          pick_list_id?: string
          pick_sequence?: number
          picked_at?: string | null
          picked_by?: string | null
          quantity_picked?: number
          quantity_to_pick?: number
          sales_order_item_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_list_items_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_lists: {
        Row: {
          actual_pick_time: number | null
          company_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          estimated_pick_time: number | null
          id: string
          notes: string | null
          pick_list_number: string
          pick_zone: string | null
          picked_items: number
          picker_id: string | null
          priority: string
          sales_order_id: string
          started_at: string | null
          status: string
          total_items: number
          updated_at: string
        }
        Insert: {
          actual_pick_time?: number | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          estimated_pick_time?: number | null
          id?: string
          notes?: string | null
          pick_list_number: string
          pick_zone?: string | null
          picked_items?: number
          picker_id?: string | null
          priority?: string
          sales_order_id: string
          started_at?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Update: {
          actual_pick_time?: number | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          estimated_pick_time?: number | null
          id?: string
          notes?: string | null
          pick_list_number?: string
          pick_zone?: string | null
          picked_items?: number
          picker_id?: string | null
          priority?: string
          sales_order_id?: string
          started_at?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pick_lists_picker"
            columns: ["picker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pick_lists_picker"
            columns: ["picker_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_amendments: {
        Row: {
          amendment_date: string
          amendment_number: string
          amendment_type: Database["public"]["Enums"]["po_amendment_type"]
          approved_by: string | null
          approved_date: string | null
          created_at: string
          created_by: string | null
          id: string
          new_value: Json | null
          notes: string | null
          po_id: string
          previous_value: Json | null
          reason: string
        }
        Insert: {
          amendment_date?: string
          amendment_number: string
          amendment_type: Database["public"]["Enums"]["po_amendment_type"]
          approved_by?: string | null
          approved_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_value?: Json | null
          notes?: string | null
          po_id: string
          previous_value?: Json | null
          reason: string
        }
        Update: {
          amendment_date?: string
          amendment_number?: string
          amendment_type?: Database["public"]["Enums"]["po_amendment_type"]
          approved_by?: string | null
          approved_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_value?: Json | null
          notes?: string | null
          po_id?: string
          previous_value?: Json | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_amendments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_approval_tokens: {
        Row: {
          approval_level: string
          approver_email: string | null
          approver_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          po_id: string
          token: string
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          approval_level: string
          approver_email?: string | null
          approver_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          po_id: string
          token: string
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          approval_level?: string
          approver_email?: string | null
          approver_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          po_id?: string
          token?: string
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_approval_tokens_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_approvals: {
        Row: {
          action: Database["public"]["Enums"]["po_status"]
          approval_level: string | null
          approval_method: string | null
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          po_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["po_status"]
          approval_level?: string | null
          approval_method?: string | null
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          po_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["po_status"]
          approval_level?: string | null
          approval_method?: string | null
          approver_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          po_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_approvals_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_items: {
        Row: {
          created_at: string
          delivery_date: string | null
          description: string | null
          id: string
          item_code: string | null
          item_name: string
          notes: string | null
          po_id: string
          pr_item_id: string | null
          quantity_ordered: number
          quantity_pending: number | null
          quantity_received: number | null
          specifications: string | null
          total_price: number
          unit_of_measure: string
          unit_price: number
          updated_at: string
          warehouse_item_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          id?: string
          item_code?: string | null
          item_name: string
          notes?: string | null
          po_id: string
          pr_item_id?: string | null
          quantity_ordered: number
          quantity_pending?: number | null
          quantity_received?: number | null
          specifications?: string | null
          total_price: number
          unit_of_measure?: string
          unit_price: number
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          id?: string
          item_code?: string | null
          item_name?: string
          notes?: string | null
          po_id?: string
          pr_item_id?: string | null
          quantity_ordered?: number
          quantity_pending?: number | null
          quantity_received?: number | null
          specifications?: string | null
          total_price?: number
          unit_of_measure?: string
          unit_price?: number
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_items_pr_item_id_fkey"
            columns: ["pr_item_id"]
            isOneToOne: false
            referencedRelation: "pr_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      po_receipt_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          po_item_id: string
          quality_status: string | null
          quantity_received: number
          receipt_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          po_item_id: string
          quality_status?: string | null
          quantity_received: number
          receipt_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          po_item_id?: string
          quality_status?: string | null
          quantity_received?: number
          receipt_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_receipt_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "po_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "po_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      po_receipts: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          po_id: string
          receipt_number: string
          received_by: string
          received_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          po_id: string
          receipt_number: string
          received_by: string
          received_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          po_id?: string
          receipt_number?: string
          received_by?: string
          received_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pr_approvals: {
        Row: {
          action: Database["public"]["Enums"]["pr_status"]
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          pr_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["pr_status"]
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          pr_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["pr_status"]
          approver_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          pr_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pr_approvals_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      pr_items: {
        Row: {
          created_at: string
          description: string | null
          estimated_total_price: number
          estimated_unit_price: number
          finished_good_id: string | null
          id: string
          item_code: string | null
          item_name: string
          notes: string | null
          pr_id: string
          quantity: number
          specifications: string | null
          unit_of_measure: string
          updated_at: string
          warehouse_item_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_total_price: number
          estimated_unit_price: number
          finished_good_id?: string | null
          id?: string
          item_code?: string | null
          item_name: string
          notes?: string | null
          pr_id: string
          quantity: number
          specifications?: string | null
          unit_of_measure?: string
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_total_price?: number
          estimated_unit_price?: number
          finished_good_id?: string | null
          id?: string
          item_code?: string | null
          item_name?: string
          notes?: string | null
          pr_id?: string
          quantity?: number
          specifications?: string | null
          unit_of_measure?: string
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pr_items_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pr_items_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pr_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pr_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pr_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      product_colors: {
        Row: {
          color_code: string | null
          color_name: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          hex_value: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          color_code?: string | null
          color_name: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          hex_value?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          color_code?: string | null
          color_name?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          hex_value?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_colors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_master: {
        Row: {
          available_colors: Json | null
          available_sizes: Json | null
          base_price: number | null
          category_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          product_code: string
          product_name: string
          status: string | null
          style_no: string | null
          subcategory_id: string | null
          unit_of_measure: string | null
          updated_at: string | null
        }
        Insert: {
          available_colors?: Json | null
          available_sizes?: Json | null
          base_price?: number | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          product_code: string
          product_name: string
          status?: string | null
          style_no?: string | null
          subcategory_id?: string | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Update: {
          available_colors?: Json | null
          available_sizes?: Json | null
          base_price?: number | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          product_code?: string
          product_name?: string
          status?: string | null
          style_no?: string | null
          subcategory_id?: string | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_master_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_master_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      production_daily_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          input_qty: number
          notes: string | null
          output_qty: number
          stage_id: string
          wastage_qty: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          input_qty?: number
          notes?: string | null
          output_qty?: number
          stage_id: string
          wastage_qty?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          input_qty?: number
          notes?: string | null
          output_qty?: number
          stage_id?: string
          wastage_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_daily_entries_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "production_order_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_stages: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          input_qty: number | null
          notes: string | null
          order_id: string
          output_qty: number | null
          sequence_order: number
          stage_name: string
          stage_template_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          wastage_qty: number | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          input_qty?: number | null
          notes?: string | null
          order_id: string
          output_qty?: number | null
          sequence_order: number
          stage_name: string
          stage_template_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          wastage_qty?: number | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          input_qty?: number | null
          notes?: string | null
          order_id?: string
          output_qty?: number | null
          sequence_order?: number
          stage_name?: string
          stage_template_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          wastage_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_order_stages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_stages_stage_template_id_fkey"
            columns: ["stage_template_id"]
            isOneToOne: false
            referencedRelation: "production_stage_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          bom_id: string | null
          company_id: string | null
          completed_date: string | null
          cpo_id: string | null
          cpo_item_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          order_number: string
          product_name: string
          sector_id: string
          start_date: string | null
          status: string
          style_no: string | null
          target_qty: number
          updated_at: string
        }
        Insert: {
          bom_id?: string | null
          company_id?: string | null
          completed_date?: string | null
          cpo_id?: string | null
          cpo_item_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_number: string
          product_name: string
          sector_id: string
          start_date?: string | null
          status?: string
          style_no?: string | null
          target_qty?: number
          updated_at?: string
        }
        Update: {
          bom_id?: string | null
          company_id?: string | null
          completed_date?: string | null
          cpo_id?: string | null
          cpo_item_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          product_name?: string
          sector_id?: string
          start_date?: string | null
          status?: string
          style_no?: string | null
          target_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "modern_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_cpo_id_fkey"
            columns: ["cpo_id"]
            isOneToOne: false
            referencedRelation: "customer_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_cpo_item_id_fkey"
            columns: ["cpo_item_id"]
            isOneToOne: false
            referencedRelation: "customer_po_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "production_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      production_sectors: {
        Row: {
          code: string
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_sectors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stage_costs: {
        Row: {
          bom_item_id: string | null
          created_at: string
          id: string
          item_name: string
          notes: string | null
          quantity_used: number | null
          source: string
          stage_id: string
          total_cost: number | null
          unit_cost: number | null
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          bom_item_id?: string | null
          created_at?: string
          id?: string
          item_name: string
          notes?: string | null
          quantity_used?: number | null
          source?: string
          stage_id: string
          total_cost?: number | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          bom_item_id?: string | null
          created_at?: string
          id?: string
          item_name?: string
          notes?: string | null
          quantity_used?: number | null
          source?: string
          stage_id?: string
          total_cost?: number | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_stage_costs_bom_item_id_fkey"
            columns: ["bom_item_id"]
            isOneToOne: false
            referencedRelation: "bom_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stage_costs_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "production_order_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stage_templates: {
        Row: {
          bom_categories: Json | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          sector_id: string
          sequence_order: number
          stage_name: string
          updated_at: string
        }
        Insert: {
          bom_categories?: Json | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sector_id: string
          sequence_order: number
          stage_name: string
          updated_at?: string
        }
        Update: {
          bom_categories?: Json | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sector_id?: string
          sequence_order?: number
          stage_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_stage_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stage_templates_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "production_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
          view_all_locations: boolean
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
          view_all_locations?: boolean
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
          view_all_locations?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_centers: {
        Row: {
          code: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profit_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budget_items: {
        Row: {
          actual_amount: number | null
          budget_code: string
          category: string
          committed_amount: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          notes: string | null
          planned_amount: number
          project_id: string
          quantity: number | null
          unit: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          actual_amount?: number | null
          budget_code: string
          category: string
          committed_amount?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          notes?: string | null
          planned_amount: number
          project_id: string
          quantity?: number | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_amount?: number | null
          budget_code?: string
          category?: string
          committed_amount?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          notes?: string | null
          planned_amount?: number
          project_id?: string
          quantity?: number | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_budget_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budget_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_floor_drawings: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          drawing_name: string
          floor_number: number | null
          id: string
          image_url: string
          project_id: string
          scale_factor: number | null
          total_area_sqm: number | null
          updated_at: string | null
          wall_height: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drawing_name: string
          floor_number?: number | null
          id?: string
          image_url: string
          project_id: string
          scale_factor?: number | null
          total_area_sqm?: number | null
          updated_at?: string | null
          wall_height?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drawing_name?: string
          floor_number?: number | null
          id?: string
          image_url?: string
          project_id?: string
          scale_factor?: number | null
          total_area_sqm?: number | null
          updated_at?: string | null
          wall_height?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_floor_drawings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_floor_drawings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          actual_cost: number | null
          actual_end_date: string | null
          actual_start_date: string | null
          budget_allocated: number | null
          completion_percentage: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          notes: string | null
          phase_name: string
          phase_number: number
          planned_end_date: string | null
          planned_start_date: string | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          actual_end_date?: string | null
          actual_start_date?: string | null
          budget_allocated?: number | null
          completion_percentage?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          phase_name: string
          phase_number: number
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          actual_end_date?: string | null
          actual_start_date?: string | null
          budget_allocated?: number | null
          completion_percentage?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          phase_name?: string
          phase_number?: number
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sites: {
        Row: {
          address: string | null
          area_sqft: number | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          project_id: string
          site_code: string
          site_manager_id: string | null
          site_name: string
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          area_sqft?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          project_id: string
          site_code: string
          site_manager_id?: string | null
          site_name: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          area_sqft?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          project_id?: string
          site_code?: string
          site_manager_id?: string | null
          site_name?: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_members: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          project_id: string
          role: string
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          project_id: string
          role: string
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          project_id?: string
          role?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_warehouse_allocations: {
        Row: {
          allocated_date: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_primary: boolean | null
          notes: string | null
          project_id: string
          updated_at: string | null
          warehouse_location_id: string
        }
        Insert: {
          allocated_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          project_id: string
          updated_at?: string | null
          warehouse_location_id: string
        }
        Update: {
          allocated_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          project_id?: string
          updated_at?: string | null
          warehouse_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_warehouse_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_warehouse_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_warehouse_allocations_warehouse_location_id_fkey"
            columns: ["warehouse_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          approval_level: number | null
          approved_by: string | null
          approved_date: string | null
          buyer_id: string | null
          company_id: string | null
          created_at: string
          created_by: string
          currency: string | null
          delivery_terms: string | null
          department_head_approved_by: string | null
          department_head_approved_date: string | null
          department_head_comments: string | null
          discount_amount: number | null
          expected_delivery_date: string | null
          final_amount: number | null
          id: string
          merchandiser_approved_by: string | null
          merchandiser_approved_date: string | null
          merchandiser_comments: string | null
          notes: string | null
          payment_terms: string | null
          po_date: string
          po_number: string
          pr_id: string | null
          sap_document_number: string | null
          sap_last_sync_at: string | null
          sap_sync_status: string | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          approval_level?: number | null
          approved_by?: string | null
          approved_date?: string | null
          buyer_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          delivery_terms?: string | null
          department_head_approved_by?: string | null
          department_head_approved_date?: string | null
          department_head_comments?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          final_amount?: number | null
          id?: string
          merchandiser_approved_by?: string | null
          merchandiser_approved_date?: string | null
          merchandiser_comments?: string | null
          notes?: string | null
          payment_terms?: string | null
          po_date?: string
          po_number: string
          pr_id?: string | null
          sap_document_number?: string | null
          sap_last_sync_at?: string | null
          sap_sync_status?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          approval_level?: number | null
          approved_by?: string | null
          approved_date?: string | null
          buyer_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          delivery_terms?: string | null
          department_head_approved_by?: string | null
          department_head_approved_date?: string | null
          department_head_comments?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          final_amount?: number | null
          id?: string
          merchandiser_approved_by?: string | null
          merchandiser_approved_date?: string | null
          merchandiser_comments?: string | null
          notes?: string | null
          payment_terms?: string | null
          po_date?: string
          po_number?: string
          pr_id?: string | null
          sap_document_number?: string | null
          sap_last_sync_at?: string | null
          sap_sync_status?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisitions: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          bom_id: string | null
          company_id: string | null
          created_at: string
          department: string | null
          description: string | null
          id: string
          justification: string | null
          pr_number: string
          priority: Database["public"]["Enums"]["pr_priority"]
          rejection_reason: string | null
          requested_by: string
          requested_date: string
          required_date: string
          status: Database["public"]["Enums"]["pr_status"]
          title: string
          total_estimated_amount: number | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          bom_id?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          justification?: string | null
          pr_number: string
          priority?: Database["public"]["Enums"]["pr_priority"]
          rejection_reason?: string | null
          requested_by: string
          requested_date?: string
          required_date: string
          status?: Database["public"]["Enums"]["pr_status"]
          title: string
          total_estimated_amount?: number | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          bom_id?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          justification?: string | null
          pr_number?: string
          priority?: Database["public"]["Enums"]["pr_priority"]
          rejection_reason?: string | null
          requested_by?: string
          requested_date?: string
          required_date?: string
          status?: Database["public"]["Enums"]["pr_status"]
          title?: string
          total_estimated_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisitions_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisitions_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "modern_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      putaway_items: {
        Row: {
          created_at: string
          from_location_id: string | null
          id: string
          item_code: string | null
          item_name: string
          notes: string | null
          putaway_id: string
          putaway_sequence: number | null
          quantity: number
          status: string
          to_bin_id: string | null
          unit_of_measure: string | null
          updated_at: string
          warehouse_item_id: string
        }
        Insert: {
          created_at?: string
          from_location_id?: string | null
          id?: string
          item_code?: string | null
          item_name: string
          notes?: string | null
          putaway_id: string
          putaway_sequence?: number | null
          quantity: number
          status?: string
          to_bin_id?: string | null
          unit_of_measure?: string | null
          updated_at?: string
          warehouse_item_id: string
        }
        Update: {
          created_at?: string
          from_location_id?: string | null
          id?: string
          item_code?: string | null
          item_name?: string
          notes?: string | null
          putaway_id?: string
          putaway_sequence?: number | null
          quantity?: number
          status?: string
          to_bin_id?: string | null
          unit_of_measure?: string | null
          updated_at?: string
          warehouse_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "putaway_items_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_items_putaway_id_fkey"
            columns: ["putaway_id"]
            isOneToOne: false
            referencedRelation: "putaway_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_items_to_bin_id_fkey"
            columns: ["to_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      putaway_records: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          completed_by: string | null
          completed_date: string | null
          created_at: string
          created_by: string | null
          grn_id: string | null
          grn_number: string | null
          id: string
          notes: string | null
          putaway_date: string
          putaway_number: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          grn_id?: string | null
          grn_number?: string | null
          id?: string
          notes?: string | null
          putaway_date?: string
          putaway_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          grn_id?: string | null
          grn_number?: string | null
          id?: string
          notes?: string | null
          putaway_date?: string
          putaway_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "putaway_records_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_inspection_items: {
        Row: {
          checklist_item: string
          created_at: string | null
          expected_value: string | null
          id: string
          inspection_id: string
          item_order: number | null
          measured_value: string | null
          notes: string | null
          requirement: string | null
          result: string | null
        }
        Insert: {
          checklist_item: string
          created_at?: string | null
          expected_value?: string | null
          id?: string
          inspection_id: string
          item_order?: number | null
          measured_value?: string | null
          notes?: string | null
          requirement?: string | null
          result?: string | null
        }
        Update: {
          checklist_item?: string
          created_at?: string | null
          expected_value?: string | null
          id?: string
          inspection_id?: string
          item_order?: number | null
          measured_value?: string | null
          notes?: string | null
          requirement?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "quality_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_inspections: {
        Row: {
          company_id: string | null
          corrective_actions: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          findings: string | null
          follow_up_date: string | null
          id: string
          inspection_date: string
          inspection_number: string
          inspection_type: string
          inspector_id: string | null
          overall_result: string | null
          photos_url: string[] | null
          project_id: string
          site_id: string | null
          status: string | null
          title: string
          updated_at: string | null
          work_order_id: string | null
        }
        Insert: {
          company_id?: string | null
          corrective_actions?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          findings?: string | null
          follow_up_date?: string | null
          id?: string
          inspection_date: string
          inspection_number: string
          inspection_type: string
          inspector_id?: string | null
          overall_result?: string | null
          photos_url?: string[] | null
          project_id: string
          site_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          work_order_id?: string | null
        }
        Update: {
          company_id?: string | null
          corrective_actions?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          findings?: string | null
          follow_up_date?: string | null
          id?: string
          inspection_date?: string
          inspection_number?: string
          inspection_type?: string
          inspector_id?: string | null
          overall_result?: string | null
          photos_url?: string[] | null
          project_id?: string
          site_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_inspections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "project_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspections_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "construction_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_comparisons: {
        Row: {
          comparison_data: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          request_id: string
        }
        Insert: {
          comparison_data?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          request_id: string
        }
        Update: {
          comparison_data?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_comparisons_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "rfq_rfp_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_evaluations: {
        Row: {
          comments: string | null
          commercial_score: number | null
          compliance_score: number | null
          created_at: string | null
          criteria_scores: Json | null
          evaluation_date: string | null
          evaluator_id: string
          id: string
          overall_score: number | null
          quote_id: string
          recommendation:
            | Database["public"]["Enums"]["evaluation_recommendation"]
            | null
          strengths: string | null
          technical_score: number | null
          weaknesses: string | null
        }
        Insert: {
          comments?: string | null
          commercial_score?: number | null
          compliance_score?: number | null
          created_at?: string | null
          criteria_scores?: Json | null
          evaluation_date?: string | null
          evaluator_id: string
          id?: string
          overall_score?: number | null
          quote_id: string
          recommendation?:
            | Database["public"]["Enums"]["evaluation_recommendation"]
            | null
          strengths?: string | null
          technical_score?: number | null
          weaknesses?: string | null
        }
        Update: {
          comments?: string | null
          commercial_score?: number | null
          compliance_score?: number | null
          created_at?: string | null
          criteria_scores?: Json | null
          evaluation_date?: string | null
          evaluator_id?: string
          id?: string
          overall_score?: number | null
          quote_id?: string
          recommendation?:
            | Database["public"]["Enums"]["evaluation_recommendation"]
            | null
          strengths?: string | null
          technical_score?: number | null
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_evaluations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_allocations: {
        Row: {
          amount_allocated: number
          created_at: string | null
          discount_given: number | null
          id: string
          invoice_id: string | null
          receipt_id: string | null
        }
        Insert: {
          amount_allocated: number
          created_at?: string | null
          discount_given?: number | null
          id?: string
          invoice_id?: string | null
          receipt_id?: string | null
        }
        Update: {
          amount_allocated?: number
          created_at?: string | null
          discount_given?: number | null
          id?: string
          invoice_id?: string | null
          receipt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "customer_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_items: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          is_reconciled: boolean | null
          item_type: string
          notes: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_id: string
          reference: string | null
          statement_line_id: string | null
          transaction_date: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_reconciled?: boolean | null
          item_type: string
          notes?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_id: string
          reference?: string | null
          statement_line_id?: string | null
          transaction_date: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_reconciled?: boolean | null
          item_type?: string
          notes?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_id?: string
          reference?: string | null
          statement_line_id?: string | null
          transaction_date?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_items_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "bank_reconciliation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_items_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_journal_templates: {
        Row: {
          auto_post: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          day_of_period: number | null
          description: string | null
          end_date: string | null
          frequency: string
          id: string
          last_generated_date: string | null
          next_generation_date: string | null
          start_date: string
          status: string | null
          template_lines: Json | null
          template_name: string
          updated_at: string | null
        }
        Insert: {
          auto_post?: boolean | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          day_of_period?: number | null
          description?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          last_generated_date?: string | null
          next_generation_date?: string | null
          start_date: string
          status?: string | null
          template_lines?: Json | null
          template_name: string
          updated_at?: string | null
        }
        Update: {
          auto_post?: boolean | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          day_of_period?: number | null
          description?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          last_generated_date?: string | null
          next_generation_date?: string | null
          start_date?: string
          status?: string | null
          template_lines?: Json | null
          template_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      report_audit_log: {
        Row: {
          company_id: string | null
          format: string
          generated_at: string
          generated_by: string
          id: string
          module_key: string
          params: Json
          report_code: string
          report_title: string
          row_count: number
          user_agent: string | null
        }
        Insert: {
          company_id?: string | null
          format: string
          generated_at?: string
          generated_by?: string
          id?: string
          module_key: string
          params?: Json
          report_code: string
          report_title: string
          row_count?: number
          user_agent?: string | null
        }
        Update: {
          company_id?: string | null
          format?: string
          generated_at?: string
          generated_by?: string
          id?: string
          module_key?: string
          params?: Json
          report_code?: string
          report_title?: string
          row_count?: number
          user_agent?: string | null
        }
        Relationships: []
      }
      rfq_rfp_invited_suppliers: {
        Row: {
          created_at: string | null
          declined_reason: string | null
          id: string
          invitation_date: string | null
          invitation_notes: string | null
          invitation_status: Database["public"]["Enums"]["invitation_status"]
          request_id: string
          supplier_id: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          declined_reason?: string | null
          id?: string
          invitation_date?: string | null
          invitation_notes?: string | null
          invitation_status?: Database["public"]["Enums"]["invitation_status"]
          request_id: string
          supplier_id: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          declined_reason?: string | null
          id?: string
          invitation_date?: string | null
          invitation_notes?: string | null
          invitation_status?: Database["public"]["Enums"]["invitation_status"]
          request_id?: string
          supplier_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_rfp_invited_suppliers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "rfq_rfp_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_rfp_invited_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_rfp_items: {
        Row: {
          created_at: string | null
          delivery_date: string | null
          description: string | null
          estimated_total_price: number | null
          estimated_unit_price: number | null
          id: string
          item_code: string | null
          item_name: string
          line_number: number
          notes: string | null
          quantity: number
          request_id: string
          specifications: string | null
          unit_of_measure: string
          updated_at: string | null
          warehouse_item_id: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_date?: string | null
          description?: string | null
          estimated_total_price?: number | null
          estimated_unit_price?: number | null
          id?: string
          item_code?: string | null
          item_name: string
          line_number: number
          notes?: string | null
          quantity: number
          request_id: string
          specifications?: string | null
          unit_of_measure?: string
          updated_at?: string | null
          warehouse_item_id?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_date?: string | null
          description?: string | null
          estimated_total_price?: number | null
          estimated_unit_price?: number | null
          id?: string
          item_code?: string | null
          item_name?: string
          line_number?: number
          notes?: string | null
          quantity?: number
          request_id?: string
          specifications?: string | null
          unit_of_measure?: string
          updated_at?: string | null
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_rfp_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "rfq_rfp_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_rfp_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_rfp_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_rfp_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_rfp_requests: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          awarded_date: string | null
          awarded_supplier_id: string | null
          bom_id: string | null
          budget_estimate: number | null
          category: string | null
          company_id: string | null
          compliance_requirements: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          delivery_requirements: string | null
          description: string | null
          evaluation_criteria: Json | null
          evaluation_deadline: string | null
          id: string
          issue_date: string
          payment_terms: string | null
          pr_id: string | null
          priority: Database["public"]["Enums"]["rfq_rfp_priority"]
          publish_type: Database["public"]["Enums"]["rfq_rfp_publish_type"]
          request_number: string
          request_type: Database["public"]["Enums"]["rfq_rfp_type"]
          status: Database["public"]["Enums"]["rfq_rfp_status"]
          submission_deadline: string
          technical_specifications: string | null
          terms_and_conditions: string | null
          title: string
          updated_at: string | null
          warranty_requirements: string | null
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          awarded_date?: string | null
          awarded_supplier_id?: string | null
          bom_id?: string | null
          budget_estimate?: number | null
          category?: string | null
          company_id?: string | null
          compliance_requirements?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          delivery_requirements?: string | null
          description?: string | null
          evaluation_criteria?: Json | null
          evaluation_deadline?: string | null
          id?: string
          issue_date?: string
          payment_terms?: string | null
          pr_id?: string | null
          priority?: Database["public"]["Enums"]["rfq_rfp_priority"]
          publish_type?: Database["public"]["Enums"]["rfq_rfp_publish_type"]
          request_number: string
          request_type: Database["public"]["Enums"]["rfq_rfp_type"]
          status?: Database["public"]["Enums"]["rfq_rfp_status"]
          submission_deadline: string
          technical_specifications?: string | null
          terms_and_conditions?: string | null
          title: string
          updated_at?: string | null
          warranty_requirements?: string | null
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          awarded_date?: string | null
          awarded_supplier_id?: string | null
          bom_id?: string | null
          budget_estimate?: number | null
          category?: string | null
          company_id?: string | null
          compliance_requirements?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          delivery_requirements?: string | null
          description?: string | null
          evaluation_criteria?: Json | null
          evaluation_deadline?: string | null
          id?: string
          issue_date?: string
          payment_terms?: string | null
          pr_id?: string | null
          priority?: Database["public"]["Enums"]["rfq_rfp_priority"]
          publish_type?: Database["public"]["Enums"]["rfq_rfp_publish_type"]
          request_number?: string
          request_type?: Database["public"]["Enums"]["rfq_rfp_type"]
          status?: Database["public"]["Enums"]["rfq_rfp_status"]
          submission_deadline?: string
          technical_specifications?: string | null
          terms_and_conditions?: string | null
          title?: string
          updated_at?: string | null
          warranty_requirements?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_rfp_requests_awarded_supplier_id_fkey"
            columns: ["awarded_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_rfp_requests_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_rfp_requests_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "modern_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_rfp_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_rfp_requests_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_alert_rules: {
        Row: {
          alert_frequency_days: number | null
          alert_on_creation: boolean | null
          alert_on_escalation: boolean | null
          alert_recipients: Json | null
          company_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          min_severity: Database["public"]["Enums"]["risk_severity"]
          risk_category: Database["public"]["Enums"]["risk_category"] | null
          rule_name: string
          updated_at: string | null
        }
        Insert: {
          alert_frequency_days?: number | null
          alert_on_creation?: boolean | null
          alert_on_escalation?: boolean | null
          alert_recipients?: Json | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_severity: Database["public"]["Enums"]["risk_severity"]
          risk_category?: Database["public"]["Enums"]["risk_category"] | null
          rule_name: string
          updated_at?: string | null
        }
        Update: {
          alert_frequency_days?: number | null
          alert_on_creation?: boolean | null
          alert_on_escalation?: boolean | null
          alert_recipients?: Json | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_severity?: Database["public"]["Enums"]["risk_severity"]
          risk_category?: Database["public"]["Enums"]["risk_category"] | null
          rule_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_alert_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_flag_history: {
        Row: {
          action_date: string | null
          action_type: Database["public"]["Enums"]["action_type"]
          created_at: string | null
          id: string
          metadata: Json | null
          new_status: Database["public"]["Enums"]["risk_flag_status"] | null
          notes: string | null
          performed_by: string | null
          previous_status:
            | Database["public"]["Enums"]["risk_flag_status"]
            | null
          risk_flag_id: string
        }
        Insert: {
          action_date?: string | null
          action_type: Database["public"]["Enums"]["action_type"]
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["risk_flag_status"] | null
          notes?: string | null
          performed_by?: string | null
          previous_status?:
            | Database["public"]["Enums"]["risk_flag_status"]
            | null
          risk_flag_id: string
        }
        Update: {
          action_date?: string | null
          action_type?: Database["public"]["Enums"]["action_type"]
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["risk_flag_status"] | null
          notes?: string | null
          performed_by?: string | null
          previous_status?:
            | Database["public"]["Enums"]["risk_flag_status"]
            | null
          risk_flag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_flag_history_risk_flag_id_fkey"
            columns: ["risk_flag_id"]
            isOneToOne: false
            referencedRelation: "supplier_risk_flags"
            referencedColumns: ["id"]
          },
        ]
      }
      role_modules: {
        Row: {
          created_at: string | null
          id: string
          module_key: string
          operations: string[] | null
          role_id: string
          submodules: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_key: string
          operations?: string[] | null
          role_id: string
          submodules?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          module_key?: string
          operations?: string[] | null
          role_id?: string
          submodules?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_modules_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          app_role: Database["public"]["Enums"]["app_role"]
          created_at: string | null
          department: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          app_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string | null
          department?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          app_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string | null
          department?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      safety_incidents: {
        Row: {
          company_id: string | null
          corrective_actions: string | null
          created_at: string | null
          description: string | null
          id: string
          immediate_actions: string | null
          incident_date: string
          incident_number: string
          incident_time: string | null
          incident_type: string
          injured_party: string | null
          injury_description: string | null
          investigated_by: string | null
          location: string | null
          photos_url: string[] | null
          preventive_actions: string | null
          project_id: string
          reported_by: string | null
          root_cause: string | null
          severity: string | null
          site_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          corrective_actions?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          immediate_actions?: string | null
          incident_date: string
          incident_number: string
          incident_time?: string | null
          incident_type: string
          injured_party?: string | null
          injury_description?: string | null
          investigated_by?: string | null
          location?: string | null
          photos_url?: string[] | null
          preventive_actions?: string | null
          project_id: string
          reported_by?: string | null
          root_cause?: string | null
          severity?: string | null
          site_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          corrective_actions?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          immediate_actions?: string | null
          incident_date?: string
          incident_number?: string
          incident_time?: string | null
          incident_type?: string
          injured_party?: string | null
          injury_description?: string | null
          investigated_by?: string | null
          location?: string | null
          photos_url?: string[] | null
          preventive_actions?: string | null
          project_id?: string
          reported_by?: string | null
          root_cause?: string | null
          severity?: string | null
          site_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_incidents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_incidents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "project_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_inspections: {
        Row: {
          company_id: string | null
          corrective_actions: string | null
          created_at: string | null
          created_by: string | null
          findings: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          hazards_identified: string | null
          id: string
          inspection_date: string
          inspection_number: string
          inspection_type: string
          inspector_id: string | null
          overall_score: number | null
          photos_url: string[] | null
          project_id: string
          site_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          corrective_actions?: string | null
          created_at?: string | null
          created_by?: string | null
          findings?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          hazards_identified?: string | null
          id?: string
          inspection_date: string
          inspection_number: string
          inspection_type: string
          inspector_id?: string | null
          overall_score?: number | null
          photos_url?: string[] | null
          project_id: string
          site_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          corrective_actions?: string | null
          created_at?: string | null
          created_by?: string | null
          findings?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          hazards_identified?: string | null
          id?: string
          inspection_date?: string
          inspection_number?: string
          inspection_type?: string
          inspector_id?: string | null
          overall_score?: number | null
          photos_url?: string[] | null
          project_id?: string
          site_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_inspections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "construction_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_inspections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "project_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          company_id: string | null
          cpo_item_id: string | null
          created_at: string | null
          description: string | null
          finished_good_id: string | null
          id: string
          item_name: string
          notes: string | null
          quantity_dispatched: number
          quantity_issued: number
          quantity_ordered: number
          quantity_packed: number
          quantity_picked: number
          sales_order_id: string
          status: string
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          cpo_item_id?: string | null
          created_at?: string | null
          description?: string | null
          finished_good_id?: string | null
          id?: string
          item_name: string
          notes?: string | null
          quantity_dispatched?: number
          quantity_issued?: number
          quantity_ordered?: number
          quantity_packed?: number
          quantity_picked?: number
          sales_order_id: string
          status?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          cpo_item_id?: string | null
          created_at?: string | null
          description?: string | null
          finished_good_id?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          quantity_dispatched?: number
          quantity_issued?: number
          quantity_ordered?: number
          quantity_packed?: number
          quantity_picked?: number
          sales_order_id?: string
          status?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_cpo_item_id_fkey"
            columns: ["cpo_item_id"]
            isOneToOne: false
            referencedRelation: "customer_po_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          company_id: string | null
          cpo_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          delivery_address: string | null
          id: string
          order_date: string
          order_number: string
          packed_items: number
          picked_items: number
          priority: string
          required_date: string | null
          special_instructions: string | null
          status: string
          total_items: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          cpo_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivery_address?: string | null
          id?: string
          order_date?: string
          order_number: string
          packed_items?: number
          picked_items?: number
          priority?: string
          required_date?: string | null
          special_instructions?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          cpo_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivery_address?: string | null
          id?: string
          order_date?: string
          order_number?: string
          packed_items?: number
          picked_items?: number
          priority?: string
          required_date?: string | null
          special_instructions?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_cpo_id_fkey"
            columns: ["cpo_id"]
            isOneToOne: false
            referencedRelation: "customer_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      sap_configurations: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_enabled: boolean | null
          last_sync_at: string | null
          sap_system_type: string | null
          sync_frequency: string | null
          sync_settings: Json | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          last_sync_at?: string | null
          sap_system_type?: string | null
          sync_frequency?: string | null
          sync_settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          last_sync_at?: string | null
          sap_system_type?: string | null
          sync_frequency?: string | null
          sync_settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sap_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sap_entity_mappings: {
        Row: {
          company_id: string | null
          created_at: string | null
          entity_type: string
          id: string
          last_synced_at: string | null
          local_id: string
          sap_code: string
          sap_type: string | null
          sync_direction: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          entity_type: string
          id?: string
          last_synced_at?: string | null
          local_id: string
          sap_code: string
          sap_type?: string | null
          sync_direction?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          entity_type?: string
          id?: string
          last_synced_at?: string | null
          local_id?: string
          sap_code?: string
          sap_type?: string | null
          sync_direction?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sap_entity_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sap_sync_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          direction: string
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          sap_code: string | null
          status: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direction: string
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          sap_code?: string | null
          status?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          sap_code?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sap_sync_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          after_value: Json | null
          before_value: Json | null
          changed_at: string
          changed_by: string | null
          id: string
        }
        Insert: {
          action: string
          after_value?: Json | null
          before_value?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: string
        }
        Update: {
          action?: string
          after_value?: Json | null
          before_value?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          allowed_mfa_factors: string[]
          created_at: string
          id: string
          mfa_grace_period_days: number
          mfa_policy: Database["public"]["Enums"]["mfa_policy"]
          mfa_remember_device_hours: number
          turnstile_enabled: boolean
          turnstile_surfaces: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_mfa_factors?: string[]
          created_at?: string
          id?: string
          mfa_grace_period_days?: number
          mfa_policy?: Database["public"]["Enums"]["mfa_policy"]
          mfa_remember_device_hours?: number
          turnstile_enabled?: boolean
          turnstile_surfaces?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_mfa_factors?: string[]
          created_at?: string
          id?: string
          mfa_grace_period_days?: number
          mfa_policy?: Database["public"]["Enums"]["mfa_policy"]
          mfa_remember_device_hours?: number
          turnstile_enabled?: boolean
          turnstile_surfaces?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      senior_finance_users: {
        Row: {
          company_id: string | null
          created_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          is_active: boolean | null
          reason: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "senior_finance_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      site_report_activities: {
        Row: {
          activity_type: string
          completion_percentage: number | null
          created_at: string | null
          description: string | null
          id: string
          labor_hours: number | null
          location: string | null
          notes: string | null
          report_id: string
        }
        Insert: {
          activity_type: string
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          labor_hours?: number | null
          location?: string | null
          notes?: string | null
          report_id: string
        }
        Update: {
          activity_type?: string
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          labor_hours?: number | null
          location?: string | null
          notes?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_report_activities_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "daily_site_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      site_report_labour_attendance: {
        Row: {
          attendance_date: string
          attendance_status: string
          category: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          in_time: string | null
          labour_id: string
          location_id: string | null
          notes: string | null
          out_time: string | null
          site_report_id: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          attendance_status?: string
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          in_time?: string | null
          labour_id: string
          location_id?: string | null
          notes?: string | null
          out_time?: string | null
          site_report_id: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          attendance_status?: string
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          in_time?: string | null
          labour_id?: string
          location_id?: string | null
          notes?: string | null
          out_time?: string | null
          site_report_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_report_labour_attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_report_labour_attendance_labour_id_fkey"
            columns: ["labour_id"]
            isOneToOne: false
            referencedRelation: "construction_labour_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_report_labour_attendance_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_report_labour_attendance_site_report_id_fkey"
            columns: ["site_report_id"]
            isOneToOne: false
            referencedRelation: "daily_site_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_access: {
        Row: {
          access_granted_at: string
          access_granted_by: string | null
          access_level: string
          access_revoked_at: string | null
          account_id: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_granted_at?: string
          access_granted_by?: string | null
          access_level?: string
          access_revoked_at?: string | null
          account_id: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_granted_at?: string
          access_granted_by?: string | null
          access_level?: string
          access_revoked_at?: string | null
          account_id?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_media_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_accounts: {
        Row: {
          account_handle: string | null
          account_name: string
          account_type: string
          account_url: string | null
          added_by: string | null
          company_id: string
          created_at: string
          description: string | null
          follower_count: number | null
          id: string
          platform: Database["public"]["Enums"]["social_media_platform"]
          profile_image_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_handle?: string | null
          account_name: string
          account_type?: string
          account_url?: string | null
          added_by?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          follower_count?: number | null
          id?: string
          platform?: Database["public"]["Enums"]["social_media_platform"]
          profile_image_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_handle?: string | null
          account_name?: string
          account_type?: string
          account_url?: string | null
          added_by?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          follower_count?: number | null
          id?: string
          platform?: Database["public"]["Enums"]["social_media_platform"]
          profile_image_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_activity_log: {
        Row: {
          account_id: string | null
          action: string
          company_id: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string | null
        }
        Insert: {
          account_id?: string | null
          action: string
          company_id: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
        }
        Update: {
          account_id?: string | null
          action?: string
          company_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_activity_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_media_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_ndas: {
        Row: {
          access_id: string
          company_id: string
          created_at: string
          id: string
          nda_document_url: string | null
          nda_expiry_date: string | null
          nda_signed: boolean
          nda_signed_at: string | null
          nda_version: string | null
          notes: string | null
          updated_at: string
          user_id: string
          witnessed_by: string | null
        }
        Insert: {
          access_id: string
          company_id: string
          created_at?: string
          id?: string
          nda_document_url?: string | null
          nda_expiry_date?: string | null
          nda_signed?: boolean
          nda_signed_at?: string | null
          nda_version?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          witnessed_by?: string | null
        }
        Update: {
          access_id?: string
          company_id?: string
          created_at?: string
          id?: string
          nda_document_url?: string | null
          nda_expiry_date?: string | null
          nda_signed?: boolean
          nda_signed_at?: string | null
          nda_version?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          witnessed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_ndas_access_id_fkey"
            columns: ["access_id"]
            isOneToOne: false
            referencedRelation: "social_media_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_ndas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      srn_counters: {
        Row: {
          company_id: string
          last_seq: number
          updated_at: string
          year: number
        }
        Insert: {
          company_id: string
          last_seq?: number
          updated_at?: string
          year: number
        }
        Update: {
          company_id?: string
          last_seq?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      staff_advances: {
        Row: {
          advance_date: string
          advance_number: string
          approved_amount: number | null
          approved_by: string | null
          approved_date: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          disbursed_amount: number
          disbursed_date: string | null
          employee_id: string | null
          employee_name: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          outstanding_amount: number
          payment_method: string | null
          purpose: string | null
          requested_amount: number
          settled_amount: number
          settlement_due_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          advance_date?: string
          advance_number: string
          approved_amount?: number | null
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          disbursed_amount?: number
          disbursed_date?: string | null
          employee_id?: string | null
          employee_name: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          outstanding_amount?: number
          payment_method?: string | null
          purpose?: string | null
          requested_amount?: number
          settled_amount?: number
          settlement_due_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          advance_date?: string
          advance_number?: string
          approved_amount?: number | null
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          disbursed_amount?: number
          disbursed_date?: string | null
          employee_id?: string | null
          employee_name?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          outstanding_amount?: number
          payment_method?: string | null
          purpose?: string | null
          requested_amount?: number
          settled_amount?: number
          settlement_due_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_advances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_advances_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_batches: {
        Row: {
          adjustment_date: string
          adjustment_type: string
          approval_threshold_exceeded: boolean | null
          approved_by: string | null
          approved_date: string | null
          attachments: Json | null
          batch_number: string
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          notes: string | null
          reason_category: string
          rejection_reason: string | null
          requires_approval: boolean | null
          status: string
          submitted_by: string | null
          submitted_date: string | null
          total_items: number | null
          total_value_impact: number | null
          updated_at: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_type?: string
          approval_threshold_exceeded?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          attachments?: Json | null
          batch_number: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          reason_category?: string
          rejection_reason?: string | null
          requires_approval?: boolean | null
          status?: string
          submitted_by?: string | null
          submitted_date?: string | null
          total_items?: number | null
          total_value_impact?: number | null
          updated_at?: string
        }
        Update: {
          adjustment_date?: string
          adjustment_type?: string
          approval_threshold_exceeded?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          attachments?: Json | null
          batch_number?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          reason_category?: string
          rejection_reason?: string | null
          requires_approval?: boolean | null
          status?: string
          submitted_by?: string | null
          submitted_date?: string | null
          total_items?: number | null
          total_value_impact?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_ledger_backfill_audit: {
        Row: {
          bin_id: string | null
          created_at: string
          drift: number | null
          expected_latest_after: number | null
          id: string
          item_id: string | null
          location_id: string | null
          observed_latest_after: number | null
          rows_touched: number | null
          scope: string
        }
        Insert: {
          bin_id?: string | null
          created_at?: string
          drift?: number | null
          expected_latest_after?: number | null
          id?: string
          item_id?: string | null
          location_id?: string | null
          observed_latest_after?: number | null
          rows_touched?: number | null
          scope: string
        }
        Update: {
          bin_id?: string | null
          created_at?: string
          drift?: number | null
          expected_latest_after?: number | null
          id?: string
          item_id?: string | null
          location_id?: string | null
          observed_latest_after?: number | null
          rows_touched?: number | null
          scope?: string
        }
        Relationships: []
      }
      stock_transactions: {
        Row: {
          adjustment_reason: string | null
          approved_by: string | null
          approved_date: string | null
          batch_id: string | null
          bin_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          issued_to_location_id: string | null
          item_id: string
          location_id: string | null
          notes: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_id: string | null
          reference_type: Database["public"]["Enums"]["stock_reference_type"]
          secondary_quantity_after: number | null
          secondary_quantity_before: number | null
          secondary_quantity_change: number | null
          secondary_uom: string | null
          total_value: number | null
          transaction_type: Database["public"]["Enums"]["stock_transaction_type"]
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          adjustment_reason?: string | null
          approved_by?: string | null
          approved_date?: string | null
          batch_id?: string | null
          bin_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          issued_to_location_id?: string | null
          item_id: string
          location_id?: string | null
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change: number
          reference_id?: string | null
          reference_type: Database["public"]["Enums"]["stock_reference_type"]
          secondary_quantity_after?: number | null
          secondary_quantity_before?: number | null
          secondary_quantity_change?: number | null
          secondary_uom?: string | null
          total_value?: number | null
          transaction_type: Database["public"]["Enums"]["stock_transaction_type"]
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          adjustment_reason?: string | null
          approved_by?: string | null
          approved_date?: string | null
          batch_id?: string | null
          bin_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          issued_to_location_id?: string | null
          item_id?: string
          location_id?: string | null
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change?: number
          reference_id?: string | null
          reference_type?: Database["public"]["Enums"]["stock_reference_type"]
          secondary_quantity_after?: number | null
          secondary_quantity_before?: number | null
          secondary_quantity_change?: number | null
          secondary_uom?: string | null
          total_value?: number | null
          transaction_type?: Database["public"]["Enums"]["stock_transaction_type"]
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_stock_transactions_warehouse_items"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stock_transactions_warehouse_items"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stock_transactions_warehouse_items"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_issued_to_location_id_fkey"
            columns: ["issued_to_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string
          from_bin_id: string | null
          id: string
          item_code: string | null
          item_name: string
          notes: string | null
          quantity_requested: number
          quantity_transferred: number | null
          status: string
          to_bin_id: string | null
          transfer_id: string
          unit_of_measure: string | null
          updated_at: string
          warehouse_item_id: string
        }
        Insert: {
          created_at?: string
          from_bin_id?: string | null
          id?: string
          item_code?: string | null
          item_name: string
          notes?: string | null
          quantity_requested: number
          quantity_transferred?: number | null
          status?: string
          to_bin_id?: string | null
          transfer_id: string
          unit_of_measure?: string | null
          updated_at?: string
          warehouse_item_id: string
        }
        Update: {
          created_at?: string
          from_bin_id?: string | null
          id?: string
          item_code?: string | null
          item_name?: string
          notes?: string | null
          quantity_requested?: number
          quantity_transferred?: number | null
          status?: string
          to_bin_id?: string | null
          transfer_id?: string
          unit_of_measure?: string | null
          updated_at?: string
          warehouse_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_from_bin_id_fkey"
            columns: ["from_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_to_bin_id_fkey"
            columns: ["to_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_requests: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          company_id: string | null
          completed_by: string | null
          completed_date: string | null
          created_at: string
          created_by: string | null
          expected_completion_date: string | null
          from_department_id: string | null
          from_location_id: string | null
          from_sublocation_id: string | null
          id: string
          notes: string | null
          priority: string
          reason: string | null
          requested_by: string | null
          requested_date: string | null
          status: string
          to_department_id: string | null
          to_location_id: string | null
          to_sublocation_id: string | null
          transfer_date: string
          transfer_number: string
          transfer_type: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          expected_completion_date?: string | null
          from_department_id?: string | null
          from_location_id?: string | null
          from_sublocation_id?: string | null
          id?: string
          notes?: string | null
          priority?: string
          reason?: string | null
          requested_by?: string | null
          requested_date?: string | null
          status?: string
          to_department_id?: string | null
          to_location_id?: string | null
          to_sublocation_id?: string | null
          transfer_date?: string
          transfer_number: string
          transfer_type?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          expected_completion_date?: string | null
          from_department_id?: string | null
          from_location_id?: string | null
          from_sublocation_id?: string | null
          id?: string
          notes?: string | null
          priority?: string
          reason?: string | null
          requested_by?: string | null
          requested_date?: string | null
          status?: string
          to_department_id?: string | null
          to_location_id?: string | null
          to_sublocation_id?: string | null
          transfer_date?: string
          transfer_number?: string
          transfer_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_requests_from_department_id_fkey"
            columns: ["from_department_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_requests_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_requests_from_sublocation_id_fkey"
            columns: ["from_sublocation_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_requests_to_department_id_fkey"
            columns: ["to_department_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_requests_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_requests_to_sublocation_id_fkey"
            columns: ["to_sublocation_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_action_items: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          priority: string
          recommendation_id: string | null
          status: string
          supplier_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          recommendation_id?: string | null
          status?: string
          supplier_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          recommendation_id?: string | null
          status?: string
          supplier_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_action_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_action_items_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "supplier_recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_action_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_analytics_cache: {
        Row: {
          avg_performance_rate: number
          avg_punctuality_score: number
          avg_quality_score: number
          calculation_date: string
          company_id: string | null
          consistency_score: number
          created_at: string
          id: string
          improvement_rate: number
          performance_grade: string
          reliability_index: number
          supplier_id: string
          total_deliveries: number
          total_evaluations: number
          trend_direction: string
          updated_at: string
        }
        Insert: {
          avg_performance_rate?: number
          avg_punctuality_score?: number
          avg_quality_score?: number
          calculation_date?: string
          company_id?: string | null
          consistency_score?: number
          created_at?: string
          id?: string
          improvement_rate?: number
          performance_grade?: string
          reliability_index?: number
          supplier_id: string
          total_deliveries?: number
          total_evaluations?: number
          trend_direction?: string
          updated_at?: string
        }
        Update: {
          avg_performance_rate?: number
          avg_punctuality_score?: number
          avg_quality_score?: number
          calculation_date?: string
          company_id?: string | null
          consistency_score?: number
          created_at?: string
          id?: string
          improvement_rate?: number
          performance_grade?: string
          reliability_index?: number
          supplier_id?: string
          total_deliveries?: number
          total_evaluations?: number
          trend_direction?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_analytics_cache_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_analytics_cache_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_approval_workflow: {
        Row: {
          approval_action: string | null
          approval_comments: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          documents_verified: boolean | null
          escalated_to: string | null
          id: string
          notes: string | null
          notified_at: string | null
          registration_request_id: string
          stage: string
          stage_order: number | null
          status: string
          time_spent_hours: number | null
        }
        Insert: {
          approval_action?: string | null
          approval_comments?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          documents_verified?: boolean | null
          escalated_to?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          registration_request_id: string
          stage: string
          stage_order?: number | null
          status?: string
          time_spent_hours?: number | null
        }
        Update: {
          approval_action?: string | null
          approval_comments?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          documents_verified?: boolean | null
          escalated_to?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          registration_request_id?: string
          stage?: string
          stage_order?: number | null
          status?: string
          time_spent_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_approval_workflow_registration_request_id_fkey"
            columns: ["registration_request_id"]
            isOneToOne: false
            referencedRelation: "supplier_registration_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_blacklist: {
        Row: {
          blacklist_reason: string
          blacklisted_by: string | null
          blacklisted_date: string
          cleared_by: string | null
          cleared_date: string | null
          clearing_reason: string | null
          company_id: string | null
          created_at: string | null
          id: string
          next_review_date: string | null
          permanent: boolean | null
          related_risk_flags: Json | null
          restrictions: Json | null
          review_frequency_days: number | null
          review_required: boolean | null
          status: Database["public"]["Enums"]["blacklist_status"]
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          blacklist_reason: string
          blacklisted_by?: string | null
          blacklisted_date?: string
          cleared_by?: string | null
          cleared_date?: string | null
          clearing_reason?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          next_review_date?: string | null
          permanent?: boolean | null
          related_risk_flags?: Json | null
          restrictions?: Json | null
          review_frequency_days?: number | null
          review_required?: boolean | null
          status?: Database["public"]["Enums"]["blacklist_status"]
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          blacklist_reason?: string
          blacklisted_by?: string | null
          blacklisted_date?: string
          cleared_by?: string | null
          cleared_date?: string | null
          clearing_reason?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          next_review_date?: string | null
          permanent?: boolean | null
          related_risk_flags?: Json | null
          restrictions?: Json | null
          review_frequency_days?: number | null
          review_required?: boolean | null
          status?: Database["public"]["Enums"]["blacklist_status"]
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_blacklist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_blacklist_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: true
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean | null
          mobile: string | null
          name: string
          phone: string | null
          supplier_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name: string
          phone?: string | null
          supplier_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name?: string
          phone?: string | null
          supplier_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          registration_request_id: string | null
          supplier_id: string | null
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          registration_request_id?: string | null
          supplier_id?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          registration_request_id?: string | null
          supplier_id?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_registration_request_id_fkey"
            columns: ["registration_request_id"]
            isOneToOne: false
            referencedRelation: "supplier_registration_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_evaluation_entries: {
        Row: {
          created_at: string
          evaluation_id: string
          failed_but_accepted: boolean | null
          failed_returned: boolean | null
          five_days_late: boolean | null
          id: string
          notes: string | null
          over_14_days_late: boolean | null
          passed_after_rework: boolean | null
          passed_first_time: boolean | null
          po_delivery_date: string
          po_number: string | null
          punctuality_score: number
          quality_score: number
          receipt_date: string
          total_score: number
          updated_at: string
          warehouse_item_id: string | null
          within_14_days: boolean | null
          within_due_date: boolean | null
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          failed_but_accepted?: boolean | null
          failed_returned?: boolean | null
          five_days_late?: boolean | null
          id?: string
          notes?: string | null
          over_14_days_late?: boolean | null
          passed_after_rework?: boolean | null
          passed_first_time?: boolean | null
          po_delivery_date: string
          po_number?: string | null
          punctuality_score?: number
          quality_score?: number
          receipt_date: string
          total_score?: number
          updated_at?: string
          warehouse_item_id?: string | null
          within_14_days?: boolean | null
          within_due_date?: boolean | null
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          failed_but_accepted?: boolean | null
          failed_returned?: boolean | null
          five_days_late?: boolean | null
          id?: string
          notes?: string | null
          over_14_days_late?: boolean | null
          passed_after_rework?: boolean | null
          passed_first_time?: boolean | null
          po_delivery_date?: string
          po_number?: string | null
          punctuality_score?: number
          quality_score?: number
          receipt_date?: string
          total_score?: number
          updated_at?: string
          warehouse_item_id?: string | null
          within_14_days?: boolean | null
          within_due_date?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_evaluation_entries_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "supplier_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_evaluation_entries_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_evaluation_entries_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_evaluation_entries_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_evaluations: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          evaluated_by: string | null
          evaluation_number: string
          evaluation_period_end: string
          evaluation_period_start: string
          id: string
          performance_rate: number
          product_name: string
          status: string
          supplier_id: string
          supplier_item_id: string | null
          total_deliveries: number
          total_points_achieved: number
          total_possible_points: number
          updated_at: string
          warehouse_item_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          evaluated_by?: string | null
          evaluation_number: string
          evaluation_period_end: string
          evaluation_period_start: string
          id?: string
          performance_rate?: number
          product_name: string
          status?: string
          supplier_id: string
          supplier_item_id?: string | null
          total_deliveries?: number
          total_points_achieved?: number
          total_possible_points?: number
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          evaluated_by?: string | null
          evaluation_number?: string
          evaluation_period_end?: string
          evaluation_period_start?: string
          id?: string
          performance_rate?: number
          product_name?: string
          status?: string
          supplier_id?: string
          supplier_item_id?: string | null
          total_deliveries?: number
          total_points_achieved?: number
          total_possible_points?: number
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_evaluations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_evaluations_supplier_item_id_fkey"
            columns: ["supplier_item_id"]
            isOneToOne: false
            referencedRelation: "supplier_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_evaluations_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_evaluations_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_evaluations_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          portal_role: string
          revoked_at: string | null
          supplier_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          portal_role: string
          revoked_at?: string | null
          supplier_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          portal_role?: string
          revoked_at?: string | null
          supplier_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invitations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoice_lines: {
        Row: {
          amount: number
          cost_center_id: string | null
          created_at: string | null
          description: string | null
          gl_account_id: string | null
          id: string
          invoice_id: string | null
          line_number: number
          quantity: number | null
          tax_amount: number | null
          tax_code_id: string | null
          unit_price: number
        }
        Insert: {
          amount?: number
          cost_center_id?: string | null
          created_at?: string | null
          description?: string | null
          gl_account_id?: string | null
          id?: string
          invoice_id?: string | null
          line_number: number
          quantity?: number | null
          tax_amount?: number | null
          tax_code_id?: string | null
          unit_price?: number
        }
        Update: {
          amount?: number
          cost_center_id?: string | null
          created_at?: string | null
          description?: string | null
          gl_account_id?: string | null
          id?: string
          invoice_id?: string | null
          line_number?: number
          quantity?: number | null
          tax_amount?: number | null
          tax_code_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_lines_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_lines_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_lines_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          amount_paid: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          due_date: string
          exchange_rate: number | null
          gl_account_id: string | null
          grn_id: string | null
          gross_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          net_amount: number
          notes: string | null
          payment_terms: string | null
          po_id: string | null
          posted_by: string | null
          posted_date: string | null
          sap_document_number: string | null
          sap_last_sync_at: string | null
          sap_sync_status: string | null
          status: string | null
          supplier_id: string | null
          tax_amount: number | null
          three_way_match_status: string | null
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_date: string
          exchange_rate?: number | null
          gl_account_id?: string | null
          grn_id?: string | null
          gross_amount?: number
          id?: string
          invoice_date: string
          invoice_number: string
          net_amount?: number
          notes?: string | null
          payment_terms?: string | null
          po_id?: string | null
          posted_by?: string | null
          posted_date?: string | null
          sap_document_number?: string | null
          sap_last_sync_at?: string | null
          sap_sync_status?: string | null
          status?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          three_way_match_status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_date?: string
          exchange_rate?: number | null
          gl_account_id?: string | null
          grn_id?: string | null
          gross_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          net_amount?: number
          notes?: string | null
          payment_terms?: string | null
          po_id?: string | null
          posted_by?: string | null
          posted_date?: string | null
          sap_document_number?: string | null
          sap_last_sync_at?: string | null
          sap_sync_status?: string | null
          status?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          three_way_match_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_items: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_preferred_supplier: boolean | null
          lead_time_days: number | null
          minimum_order_quantity: number | null
          notes: string | null
          status: string | null
          supplier_id: string
          supplier_item_code: string | null
          supplier_unit_price: number | null
          updated_at: string
          warehouse_item_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_preferred_supplier?: boolean | null
          lead_time_days?: number | null
          minimum_order_quantity?: number | null
          notes?: string | null
          status?: string | null
          supplier_id: string
          supplier_item_code?: string | null
          supplier_unit_price?: number | null
          updated_at?: string
          warehouse_item_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_preferred_supplier?: boolean | null
          lead_time_days?: number | null
          minimum_order_quantity?: number | null
          notes?: string | null
          status?: string | null
          supplier_id?: string
          supplier_item_code?: string | null
          supplier_unit_price?: number | null
          updated_at?: string
          warehouse_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          bank_account_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string | null
          payment_number: string
          reference_number: string | null
          status: string | null
          supplier_id: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          bank_account_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_date: string
          payment_method?: string | null
          payment_number: string
          reference_number?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          bank_account_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_number?: string
          reference_number?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_portal_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: number
          ip: unknown
          metadata: Json
          prev_hash: string | null
          row_hash: string | null
          supplier_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: number
          ip?: unknown
          metadata?: Json
          prev_hash?: string | null
          row_hash?: string | null
          supplier_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: number
          ip?: unknown
          metadata?: Json
          prev_hash?: string | null
          row_hash?: string | null
          supplier_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      supplier_portal_settings: {
        Row: {
          company_id: string
          created_at: string
          is_active: boolean
          public_base_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          is_active?: boolean
          public_base_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          is_active?: boolean
          public_base_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_portal_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_profiles_extended: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_swift: string | null
          default_currency: string | null
          default_payment_terms_days: number | null
          legal_name: string | null
          peppol_enabled: boolean
          supplier_id: string
          tax_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_swift?: string | null
          default_currency?: string | null
          default_payment_terms_days?: number | null
          legal_name?: string | null
          peppol_enabled?: boolean
          supplier_id: string
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_swift?: string | null
          default_currency?: string | null
          default_payment_terms_days?: number | null
          legal_name?: string | null
          peppol_enabled?: boolean
          supplier_id?: string
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_profiles_extended_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: true
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quote_items: {
        Row: {
          alternative_description: string | null
          alternative_offered: boolean | null
          created_at: string | null
          delivery_days: number | null
          id: string
          line_number: number
          notes: string | null
          quote_id: string
          rfq_item_id: string
          total_price: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          alternative_description?: string | null
          alternative_offered?: boolean | null
          created_at?: string | null
          delivery_days?: number | null
          id?: string
          line_number: number
          notes?: string | null
          quote_id: string
          rfq_item_id: string
          total_price: number
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          alternative_description?: string | null
          alternative_offered?: boolean | null
          created_at?: string | null
          delivery_days?: number | null
          id?: string
          line_number?: number
          notes?: string | null
          quote_id?: string
          rfq_item_id?: string
          total_price?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_items_rfq_item_id_fkey"
            columns: ["rfq_item_id"]
            isOneToOne: false
            referencedRelation: "rfq_rfp_items"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotes: {
        Row: {
          attachments: Json | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          delivery_commitment: string | null
          evaluated_at: string | null
          evaluated_by: string | null
          evaluation_notes: string | null
          evaluation_score: number | null
          id: string
          notes: string | null
          payment_terms: string | null
          quote_number: string
          rejection_reason: string | null
          request_id: string
          status: Database["public"]["Enums"]["quote_status"]
          submission_date: string | null
          supplier_id: string
          total_quoted_amount: number | null
          updated_at: string | null
          validity_period: number | null
          warranty_offered: string | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          delivery_commitment?: string | null
          evaluated_at?: string | null
          evaluated_by?: string | null
          evaluation_notes?: string | null
          evaluation_score?: number | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          quote_number: string
          rejection_reason?: string | null
          request_id: string
          status?: Database["public"]["Enums"]["quote_status"]
          submission_date?: string | null
          supplier_id: string
          total_quoted_amount?: number | null
          updated_at?: string | null
          validity_period?: number | null
          warranty_offered?: string | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          delivery_commitment?: string | null
          evaluated_at?: string | null
          evaluated_by?: string | null
          evaluation_notes?: string | null
          evaluation_score?: number | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          quote_number?: string
          rejection_reason?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          submission_date?: string | null
          supplier_id?: string
          total_quoted_amount?: number | null
          updated_at?: string | null
          validity_period?: number | null
          warranty_offered?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "rfq_rfp_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_recommendations: {
        Row: {
          action_taken: boolean | null
          action_taken_at: string | null
          action_taken_by: string | null
          company_id: string | null
          created_at: string
          description: string
          expires_at: string | null
          id: string
          potential_savings: number | null
          priority: string
          recommendation_type: string
          risk_level: string | null
          supplier_id: string
          title: string
        }
        Insert: {
          action_taken?: boolean | null
          action_taken_at?: string | null
          action_taken_by?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          expires_at?: string | null
          id?: string
          potential_savings?: number | null
          priority?: string
          recommendation_type: string
          risk_level?: string | null
          supplier_id: string
          title: string
        }
        Update: {
          action_taken?: boolean | null
          action_taken_at?: string | null
          action_taken_by?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          potential_savings?: number | null
          priority?: string
          recommendation_type?: string
          risk_level?: string | null
          supplier_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_recommendations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_recommendations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_registration_form_config: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_published: boolean
          schema: Json
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_published?: boolean
          schema?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_published?: boolean
          schema?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_registration_form_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_registration_requests: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          documents: Json | null
          id: string
          rejection_reason: string | null
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          supplier_data: Json
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          documents?: Json | null
          id?: string
          rejection_reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          supplier_data: Json
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          documents?: Json | null
          id?: string
          rejection_reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          supplier_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_registration_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_risk_flags: {
        Row: {
          auto_alert_enabled: boolean | null
          company_id: string | null
          created_at: string | null
          description: string | null
          evidence_urls: Json | null
          financial_impact: number | null
          flagged_by: string | null
          flagged_date: string
          id: string
          next_review_date: string | null
          resolution_notes: string | null
          resolved_by: string | null
          resolved_date: string | null
          review_date: string | null
          risk_category: Database["public"]["Enums"]["risk_category"]
          risk_severity: Database["public"]["Enums"]["risk_severity"]
          status: Database["public"]["Enums"]["risk_flag_status"]
          supplier_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          auto_alert_enabled?: boolean | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          evidence_urls?: Json | null
          financial_impact?: number | null
          flagged_by?: string | null
          flagged_date?: string
          id?: string
          next_review_date?: string | null
          resolution_notes?: string | null
          resolved_by?: string | null
          resolved_date?: string | null
          review_date?: string | null
          risk_category: Database["public"]["Enums"]["risk_category"]
          risk_severity: Database["public"]["Enums"]["risk_severity"]
          status?: Database["public"]["Enums"]["risk_flag_status"]
          supplier_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          auto_alert_enabled?: boolean | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          evidence_urls?: Json | null
          financial_impact?: number | null
          flagged_by?: string | null
          flagged_date?: string
          id?: string
          next_review_date?: string | null
          resolution_notes?: string | null
          resolved_by?: string | null
          resolved_date?: string | null
          review_date?: string | null
          risk_category?: Database["public"]["Enums"]["risk_category"]
          risk_severity?: Database["public"]["Enums"]["risk_severity"]
          status?: Database["public"]["Enums"]["risk_flag_status"]
          supplier_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_risk_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_risk_flags_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_users: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          portal_role: string
          supplier_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          portal_role: string
          supplier_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          portal_role?: string
          supplier_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_users_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          category: string | null
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          currency: string | null
          email: string | null
          id: string
          legal_name: string | null
          material_type: string | null
          measurement_type: string | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          rating: number | null
          registration_number: string | null
          sap_sync_status: string | null
          sap_vendor_code: string | null
          state: string | null
          status: string
          supplier_code: string
          supplier_type: string
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          category?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          material_type?: string | null
          measurement_type?: string | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          registration_number?: string | null
          sap_sync_status?: string | null
          sap_vendor_code?: string | null
          state?: string | null
          status?: string
          supplier_code: string
          supplier_type?: string
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          category?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          material_type?: string | null
          measurement_type?: string | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          registration_number?: string | null
          sap_sync_status?: string | null
          sap_vendor_code?: string | null
          state?: string | null
          status?: string
          supplier_code?: string
          supplier_type?: string
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_error_logs: {
        Row: {
          company_id: string | null
          created_at: string
          error_code: number | null
          error_message: string
          function_name: string
          id: string
          request_context: Json | null
          resolution: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error_code?: number | null
          error_message: string
          function_name: string
          id?: string
          request_context?: Json | null
          resolution?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error_code?: number | null
          error_message?: string
          function_name?: string
          id?: string
          request_context?: Json | null
          resolution?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_error_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_codes: {
        Row: {
          company_id: string | null
          created_at: string | null
          gl_account_id: string | null
          id: string
          is_active: boolean | null
          tax_code: string
          tax_name: string
          tax_rate: number
          tax_type: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          gl_account_id?: string | null
          id?: string
          is_active?: boolean | null
          tax_code: string
          tax_name: string
          tax_rate: number
          tax_type: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          gl_account_id?: string | null
          id?: string
          is_active?: boolean | null
          tax_code?: string
          tax_name?: string
          tax_rate?: number
          tax_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_codes_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_codes_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_return_lines: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          invoice_count: number | null
          line_number: number
          return_id: string
          tax_amount: number | null
          taxable_amount: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_count?: number | null
          line_number: number
          return_id: string
          tax_amount?: number | null
          taxable_amount?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_count?: number | null
          line_number?: number
          return_id?: string
          tax_amount?: number | null
          taxable_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_return_lines_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "tax_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_returns: {
        Row: {
          adjustments: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          filing_date: string | null
          id: string
          input_tax: number | null
          net_tax_payable: number | null
          notes: string | null
          output_tax: number | null
          payment_date: string | null
          period_end: string
          period_start: string
          reference_number: string | null
          return_period: string
          status: string | null
          tax_type: string
          total_due: number | null
          updated_at: string | null
        }
        Insert: {
          adjustments?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          filing_date?: string | null
          id?: string
          input_tax?: number | null
          net_tax_payable?: number | null
          notes?: string | null
          output_tax?: number | null
          payment_date?: string | null
          period_end: string
          period_start: string
          reference_number?: string | null
          return_period: string
          status?: string | null
          tax_type: string
          total_due?: number | null
          updated_at?: string | null
        }
        Update: {
          adjustments?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          filing_date?: string | null
          id?: string
          input_tax?: number | null
          net_tax_payable?: number | null
          notes?: string | null
          output_tax?: number | null
          payment_date?: string | null
          period_end?: string
          period_start?: string
          reference_number?: string | null
          return_period?: string
          status?: string | null
          tax_type?: string
          total_due?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_template_details: {
        Row: {
          account_id: string | null
          calculation_order: number | null
          created_at: string | null
          id: string
          is_compound: boolean | null
          is_included_in_price: boolean | null
          tax_component_name: string
          tax_rate: number
          template_id: string
        }
        Insert: {
          account_id?: string | null
          calculation_order?: number | null
          created_at?: string | null
          id?: string
          is_compound?: boolean | null
          is_included_in_price?: boolean | null
          tax_component_name: string
          tax_rate: number
          template_id: string
        }
        Update: {
          account_id?: string | null
          calculation_order?: number | null
          created_at?: string | null
          id?: string
          is_compound?: boolean | null
          is_included_in_price?: boolean | null
          tax_component_name?: string
          tax_rate?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_template_details_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_template_details_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_template_details_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tax_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_templates: {
        Row: {
          applies_to: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          tax_type: string
          updated_at: string | null
        }
        Insert: {
          applies_to?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          tax_type: string
          updated_at?: string | null
        }
        Update: {
          applies_to?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          tax_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_job_runs: {
        Row: {
          company_id: string
          error_text: string | null
          finished_at: string | null
          id: string
          job_id: string
          payload_preview: string | null
          recipient_count: number
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          company_id: string
          error_text?: string | null
          finished_at?: string | null
          id?: string
          job_id: string
          payload_preview?: string | null
          recipient_count?: number
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Update: {
          company_id?: string
          error_text?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string
          payload_preview?: string | null
          recipient_count?: number
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_job_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "telegram_scheduled_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_scheduled_jobs: {
        Row: {
          chat_ids: string[]
          company_id: string
          created_at: string
          created_by: string | null
          day_of_month: number | null
          filters: Json
          frequency: string
          id: string
          is_enabled: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          report_type: string
          send_time: string
          timezone: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          chat_ids?: string[]
          company_id: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          filters?: Json
          frequency: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          report_type: string
          send_time?: string
          timezone?: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          chat_ids?: string[]
          company_id?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          filters?: Json
          frequency?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          report_type?: string
          send_time?: string
          timezone?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_scheduled_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_settings: {
        Row: {
          bot_token: string | null
          chat_id: string | null
          company_id: string
          created_at: string | null
          id: string
          is_enabled: boolean | null
          last_scheduled_send: string | null
          notify_on_report_create: boolean | null
          scheduled_send_enabled: boolean | null
          scheduled_send_time: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          bot_token?: string | null
          chat_id?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          last_scheduled_send?: string | null
          notify_on_report_create?: boolean | null
          scheduled_send_enabled?: boolean | null
          scheduled_send_time?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          bot_token?: string | null
          chat_id?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          last_scheduled_send?: string | null
          notify_on_report_create?: boolean | null
          scheduled_send_enabled?: boolean | null
          scheduled_send_time?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_adjustments: {
        Row: {
          adjustment_type: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reason: string | null
          tool_id: string
        }
        Insert: {
          adjustment_type: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reason?: string | null
          tool_id: string
        }
        Update: {
          adjustment_type?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change?: number
          reason?: string | null
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_adjustments_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "warehouse_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_bin_allocations: {
        Row: {
          allocated_quantity: number
          available_quantity: number | null
          bin_id: string
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          reserved_quantity: number
          tool_id: string
          updated_at: string
        }
        Insert: {
          allocated_quantity?: number
          available_quantity?: number | null
          bin_id: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reserved_quantity?: number
          tool_id: string
          updated_at?: string
        }
        Update: {
          allocated_quantity?: number
          available_quantity?: number | null
          bin_id?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reserved_quantity?: number
          tool_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_bin_allocations_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_bin_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_bin_allocations_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "warehouse_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_issues: {
        Row: {
          approved_by: string | null
          bin_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          expected_return_date: string | null
          expected_return_time: string | null
          id: string
          issue_date: string
          issue_number: string
          issued_to: string | null
          issued_to_name: string
          notes: string | null
          purpose: string | null
          quantity_issued: number
          quantity_returned: number
          status: string
          tool_code_snapshot: string | null
          tool_id: string | null
          tool_name_snapshot: string | null
          updated_at: string | null
          warehouse_item_id: string | null
        }
        Insert: {
          approved_by?: string | null
          bin_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          expected_return_date?: string | null
          expected_return_time?: string | null
          id?: string
          issue_date?: string
          issue_number: string
          issued_to?: string | null
          issued_to_name: string
          notes?: string | null
          purpose?: string | null
          quantity_issued?: number
          quantity_returned?: number
          status?: string
          tool_code_snapshot?: string | null
          tool_id?: string | null
          tool_name_snapshot?: string | null
          updated_at?: string | null
          warehouse_item_id?: string | null
        }
        Update: {
          approved_by?: string | null
          bin_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          expected_return_date?: string | null
          expected_return_time?: string | null
          id?: string
          issue_date?: string
          issue_number?: string
          issued_to?: string | null
          issued_to_name?: string
          notes?: string | null
          purpose?: string | null
          quantity_issued?: number
          quantity_returned?: number
          status?: string
          tool_code_snapshot?: string | null
          tool_id?: string | null
          tool_name_snapshot?: string | null
          updated_at?: string | null
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_issues_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_issues_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "warehouse_tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_issues_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_issues_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_issues_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_returns: {
        Row: {
          company_id: string | null
          condition: string
          condition_notes: string | null
          created_at: string | null
          created_by: string | null
          id: string
          issue_id: string
          notes: string | null
          quantity_returned: number
          received_by: string | null
          return_date: string
          return_number: string
          returned_by_name: string | null
          status: string
          updated_at: string | null
          warehouse_item_id: string | null
        }
        Insert: {
          company_id?: string | null
          condition?: string
          condition_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          issue_id: string
          notes?: string | null
          quantity_returned: number
          received_by?: string | null
          return_date?: string
          return_number: string
          returned_by_name?: string | null
          status?: string
          updated_at?: string | null
          warehouse_item_id?: string | null
        }
        Update: {
          company_id?: string | null
          condition?: string
          condition_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          issue_id?: string
          notes?: string | null
          quantity_returned?: number
          received_by?: string | null
          return_date?: string
          return_number?: string
          returned_by_name?: string | null
          status?: string
          updated_at?: string | null
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_returns_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "tool_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_returns_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_returns_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_returns_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      training_manuals: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number | null
          document_url: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_published: boolean | null
          legacy_file_path: string | null
          mime_type: string | null
          page_count: number | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          document_url?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_published?: boolean | null
          legacy_file_path?: string | null
          mime_type?: string | null
          page_count?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          document_url?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_published?: boolean | null
          legacy_file_path?: string | null
          mime_type?: string | null
          page_count?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: string | null
        }
        Relationships: []
      }
      transaction_rules: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description_template: string | null
          gl_account_id: string | null
          id: string
          is_active: boolean
          match_field: string
          match_pattern: string
          priority: number
          rule_name: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description_template?: string | null
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          match_field?: string
          match_pattern: string
          priority?: number
          rule_name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description_template?: string | null
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          match_field?: string
          match_pattern?: string
          priority?: number
          rule_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_rules_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_rules_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_to_gl_mapping: {
        Row: {
          company_id: string | null
          created_at: string | null
          credit_account_id: string | null
          debit_account_id: string | null
          description: string | null
          id: string
          is_default: boolean | null
          transaction_type: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          credit_account_id?: string | null
          debit_account_id?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          transaction_type: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          credit_account_id?: string | null
          debit_account_id?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_to_gl_mapping_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_to_gl_mapping_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_to_gl_mapping_debit_account_id_fkey"
            columns: ["debit_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_to_gl_mapping_debit_account_id_fkey"
            columns: ["debit_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_access: {
        Row: {
          access_type: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          access_type?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          access_type?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_location_assignments: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_primary: boolean | null
          location_id: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_primary?: boolean | null
          location_id: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_primary?: boolean | null
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_location_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_location_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_location_permissions: {
        Row: {
          created_at: string
          id: string
          location_id: string
          permission_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          permission_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          permission_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_location_permissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mfa_recovery_codes: {
        Row: {
          code_hash: string
          consumed_at: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_modules: {
        Row: {
          access_type: string
          created_at: string | null
          id: string
          module_key: string
          operations: string[] | null
          submodules: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          created_at?: string | null
          id?: string
          module_key: string
          operations?: string[] | null
          submodules?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          created_at?: string | null
          id?: string
          module_key?: string
          operations?: string[] | null
          submodules?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_pinned_submodules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          module_key: string
          position: number
          submodule_key: string
          submodule_title: string
          submodule_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          module_key: string
          position?: number
          submodule_key: string
          submodule_title: string
          submodule_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          module_key?: string
          position?: number
          submodule_key?: string
          submodule_title?: string
          submodule_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pinned_submodules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_advances: {
        Row: {
          advance_date: string
          advance_number: string
          amount: number
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          journal_entry_id: string | null
          payment_method: string | null
          reference_number: string | null
          remaining_amount: number
          status: string
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          advance_date?: string
          advance_number: string
          amount?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          payment_method?: string | null
          reference_number?: string | null
          remaining_amount?: number
          status?: string
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          advance_date?: string
          advance_number?: string
          amount?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          payment_method?: string | null
          reference_number?: string | null
          remaining_amount?: number
          status?: string
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_advances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_advances_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_advances_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_assets: {
        Row: {
          accumulated_depreciation: number | null
          asset_id: string | null
          asset_master_id: string | null
          asset_tag: string | null
          brand: string | null
          category: string
          category_id: string | null
          company_id: string | null
          condition: string
          created_at: string
          created_by: string | null
          current_value: number | null
          department_id: string | null
          depreciation_method: string | null
          depreciation_rate: number | null
          description: string | null
          id: string
          last_depreciation_date: string | null
          location_id: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          salvage_value: number | null
          serial_number: string | null
          source_request_id: string | null
          source_request_number: string | null
          status: string
          subcategory_id: string | null
          sublocation_id: string | null
          updated_at: string
          useful_life_years: number | null
        }
        Insert: {
          accumulated_depreciation?: number | null
          asset_id?: string | null
          asset_master_id?: string | null
          asset_tag?: string | null
          brand?: string | null
          category: string
          category_id?: string | null
          company_id?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          department_id?: string | null
          depreciation_method?: string | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          last_depreciation_date?: string | null
          location_id?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          salvage_value?: number | null
          serial_number?: string | null
          source_request_id?: string | null
          source_request_number?: string | null
          status?: string
          subcategory_id?: string | null
          sublocation_id?: string | null
          updated_at?: string
          useful_life_years?: number | null
        }
        Update: {
          accumulated_depreciation?: number | null
          asset_id?: string | null
          asset_master_id?: string | null
          asset_tag?: string | null
          brand?: string | null
          category?: string
          category_id?: string | null
          company_id?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          department_id?: string | null
          depreciation_method?: string | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          last_depreciation_date?: string | null
          location_id?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          salvage_value?: number | null
          serial_number?: string | null
          source_request_id?: string | null
          source_request_number?: string | null
          status?: string
          subcategory_id?: string | null
          sublocation_id?: string | null
          updated_at?: string
          useful_life_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_assets_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_assets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_assets_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "asset_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_assets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_assets_sublocation_id_fkey"
            columns: ["sublocation_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_bin_allocations: {
        Row: {
          allocated_quantity: number
          available_quantity: number | null
          bin_id: string
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          notes: string | null
          reserved_quantity: number
          secondary_quantity: number | null
          stock_owner: string | null
          updated_at: string
          warehouse_item_id: string
        }
        Insert: {
          allocated_quantity?: number
          available_quantity?: number | null
          bin_id: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          reserved_quantity?: number
          secondary_quantity?: number | null
          stock_owner?: string | null
          updated_at?: string
          warehouse_item_id: string
        }
        Update: {
          allocated_quantity?: number
          available_quantity?: number | null
          bin_id?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          reserved_quantity?: number
          secondary_quantity?: number | null
          stock_owner?: string | null
          updated_at?: string
          warehouse_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_bin_allocations_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_bin_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_bin_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "warehouse_bin_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "warehouse_bin_allocations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_bin_allocations_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_bin_allocations_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_bin_allocations_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_bin_relocations: {
        Row: {
          bin_id: string
          company_id: string
          created_at: string
          from_location_id: string | null
          id: string
          item_count: number
          mode: string
          performed_by: string | null
          reason: string | null
          to_location_id: string
          total_quantity: number
        }
        Insert: {
          bin_id: string
          company_id: string
          created_at?: string
          from_location_id?: string | null
          id?: string
          item_count?: number
          mode: string
          performed_by?: string | null
          reason?: string | null
          to_location_id: string
          total_quantity?: number
        }
        Update: {
          bin_id?: string
          company_id?: string
          created_at?: string
          from_location_id?: string | null
          id?: string
          item_count?: number
          mode?: string
          performed_by?: string | null
          reason?: string | null
          to_location_id?: string
          total_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_bin_relocations_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_bins: {
        Row: {
          bin_code: string
          bin_type_id: string | null
          capacity: number | null
          company_id: string | null
          created_at: string
          created_by: string | null
          current_quantity: number | null
          description: string | null
          id: string
          is_global_template: boolean
          is_shared: boolean
          location_id: string | null
          name: string
          notes: string | null
          parent_bin_id: string | null
          root_location_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bin_code: string
          bin_type_id?: string | null
          capacity?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_quantity?: number | null
          description?: string | null
          id?: string
          is_global_template?: boolean
          is_shared?: boolean
          location_id?: string | null
          name: string
          notes?: string | null
          parent_bin_id?: string | null
          root_location_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bin_code?: string
          bin_type_id?: string | null
          capacity?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_quantity?: number | null
          description?: string | null
          id?: string
          is_global_template?: boolean
          is_shared?: boolean
          location_id?: string | null
          name?: string
          notes?: string | null
          parent_bin_id?: string | null
          root_location_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_bins_bin_type_id_fkey"
            columns: ["bin_type_id"]
            isOneToOne: false
            referencedRelation: "bin_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_bins_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_bins_parent_bin_id_fkey"
            columns: ["parent_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_bins_root_location_id_fkey"
            columns: ["root_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_item_catalog: {
        Row: {
          barcode: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_batch_tracked: boolean
          is_serialized: boolean
          item_code: string
          item_type: string
          location_id: string | null
          manufacturer: string | null
          max_stock_level: number | null
          min_stock_level: number | null
          name: string
          notes: string | null
          reorder_level: number | null
          selling_price: number | null
          sku: string | null
          status: string
          supplier_id: string | null
          unit_cost: number | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_batch_tracked?: boolean
          is_serialized?: boolean
          item_code: string
          item_type?: string
          location_id?: string | null
          manufacturer?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          name: string
          notes?: string | null
          reorder_level?: number | null
          selling_price?: number | null
          sku?: string | null
          status?: string
          supplier_id?: string | null
          unit_cost?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_batch_tracked?: boolean
          is_serialized?: boolean
          item_code?: string
          item_type?: string
          location_id?: string | null
          manufacturer?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          name?: string
          notes?: string | null
          reorder_level?: number | null
          selling_price?: number | null
          sku?: string | null
          status?: string
          supplier_id?: string | null
          unit_cost?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_item_catalog_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_catalog_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_catalog_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_catalog_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "item_units"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_item_reservations: {
        Row: {
          bin_allocation_id: string | null
          bom_id: string | null
          bom_item_id: string | null
          company_id: string | null
          created_at: string
          expiry_date: string | null
          id: string
          notes: string | null
          quantity_issued: number | null
          quantity_remaining: number | null
          reference_id: string | null
          reference_number: string | null
          reference_type: string
          required_date: string | null
          reserved_by: string | null
          reserved_date: string
          reserved_quantity: number
          status: string
          updated_at: string
          warehouse_item_id: string
        }
        Insert: {
          bin_allocation_id?: string | null
          bom_id?: string | null
          bom_item_id?: string | null
          company_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          quantity_issued?: number | null
          quantity_remaining?: number | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type: string
          required_date?: string | null
          reserved_by?: string | null
          reserved_date?: string
          reserved_quantity: number
          status?: string
          updated_at?: string
          warehouse_item_id: string
        }
        Update: {
          bin_allocation_id?: string | null
          bom_id?: string | null
          bom_item_id?: string | null
          company_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          quantity_issued?: number | null
          quantity_remaining?: number | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string
          required_date?: string | null
          reserved_by?: string | null
          reserved_date?: string
          reserved_quantity?: number
          status?: string
          updated_at?: string
          warehouse_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_item_reservations_bin_allocation_id_fkey"
            columns: ["bin_allocation_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bin_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_reservations_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_reservations_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "modern_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_reservations_bom_item_id_fkey"
            columns: ["bom_item_id"]
            isOneToOne: false
            referencedRelation: "bom_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_reservations_reserved_by_fkey"
            columns: ["reserved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "warehouse_item_reservations_reserved_by_fkey"
            columns: ["reserved_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "warehouse_item_reservations_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_reservations_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_reservations_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_items: {
        Row: {
          available_quantity: number | null
          base_uom: string | null
          catalog_item_id: string
          company_id: string | null
          condition: string | null
          created_at: string
          created_by: string | null
          current_stock: number | null
          id: string
          is_loanable: boolean
          location_id: string | null
          max_stock_level: number | null
          min_stock_level: number | null
          notes: string | null
          reorder_level: number | null
          reserved_quantity: number | null
          secondary_uom: string | null
          selling_price: number | null
          status: string
          track_secondary_quantity: boolean
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          available_quantity?: number | null
          base_uom?: string | null
          catalog_item_id: string
          company_id?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          id?: string
          is_loanable?: boolean
          location_id?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          notes?: string | null
          reorder_level?: number | null
          reserved_quantity?: number | null
          secondary_uom?: string | null
          selling_price?: number | null
          status?: string
          track_secondary_quantity?: boolean
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          available_quantity?: number | null
          base_uom?: string | null
          catalog_item_id?: string
          company_id?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          id?: string
          is_loanable?: boolean
          location_id?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          notes?: string | null
          reorder_level?: number | null
          reserved_quantity?: number | null
          secondary_uom?: string | null
          selling_price?: number | null
          status?: string
          track_secondary_quantity?: boolean
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_item_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_location_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          location_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          location_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_location_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_location_companies_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locations: {
        Row: {
          capacity: number | null
          company_assignment_mode: string
          company_id: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          current_usage: number | null
          description: string | null
          id: string
          is_standalone_warehouse: boolean
          location_code: string | null
          name: string
          parent_id: string | null
          physical_address: string | null
          status: string | null
          type: string
          updated_at: string
          warehouse_category: string | null
        }
        Insert: {
          capacity?: number | null
          company_assignment_mode?: string
          company_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          current_usage?: number | null
          description?: string | null
          id?: string
          is_standalone_warehouse?: boolean
          location_code?: string | null
          name: string
          parent_id?: string | null
          physical_address?: string | null
          status?: string | null
          type: string
          updated_at?: string
          warehouse_category?: string | null
        }
        Update: {
          capacity?: number | null
          company_assignment_mode?: string
          company_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          current_usage?: number | null
          description?: string | null
          id?: string
          is_standalone_warehouse?: boolean
          location_code?: string | null
          name?: string
          parent_id?: string | null
          physical_address?: string | null
          status?: string | null
          type?: string
          updated_at?: string
          warehouse_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_partial_pieces: {
        Row: {
          batch_number: string | null
          bin_id: string | null
          company_id: string
          consumed_at: string | null
          consumed_by: string | null
          consumed_qty: number | null
          consumed_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          location_id: string
          notes: string | null
          original_piece_count: number
          parent_item_id: string
          parent_piece_id: string | null
          piece_code: string
          piece_count: number
          size_uom: string
          size_value: number
          source_ref: string | null
          status: Database["public"]["Enums"]["partial_piece_status"]
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          bin_id?: string | null
          company_id: string
          consumed_at?: string | null
          consumed_by?: string | null
          consumed_qty?: number | null
          consumed_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          location_id: string
          notes?: string | null
          original_piece_count?: number
          parent_item_id: string
          parent_piece_id?: string | null
          piece_code: string
          piece_count?: number
          size_uom: string
          size_value: number
          source_ref?: string | null
          status?: Database["public"]["Enums"]["partial_piece_status"]
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          bin_id?: string | null
          company_id?: string
          consumed_at?: string | null
          consumed_by?: string | null
          consumed_qty?: number | null
          consumed_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          location_id?: string
          notes?: string | null
          original_piece_count?: number
          parent_item_id?: string
          parent_piece_id?: string | null
          piece_code?: string
          piece_count?: number
          size_uom?: string
          size_value?: number
          source_ref?: string | null
          status?: Database["public"]["Enums"]["partial_piece_status"]
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_partial_pieces_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_partial_pieces_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_partial_pieces_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_partial_pieces_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_partial_pieces_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_partial_pieces_parent_piece_id_fkey"
            columns: ["parent_piece_id"]
            isOneToOne: false
            referencedRelation: "warehouse_partial_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_stock_audit_logs: {
        Row: {
          company_id: string
          desync_count: number
          desynced_items: Json
          id: string
          in_sync_count: number
          no_bins_count: number
          no_bins_items: Json
          recorded_at: string
          recorded_by: string
          total_items: number
        }
        Insert: {
          company_id: string
          desync_count: number
          desynced_items?: Json
          id?: string
          in_sync_count: number
          no_bins_count: number
          no_bins_items?: Json
          recorded_at?: string
          recorded_by: string
          total_items: number
        }
        Update: {
          company_id?: string
          desync_count?: number
          desynced_items?: Json
          id?: string
          in_sync_count?: number
          no_bins_count?: number
          no_bins_items?: Json
          recorded_at?: string
          recorded_by?: string
          total_items?: number
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_stock_movements: {
        Row: {
          bin_allocation_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
          total_value: number | null
          unit_cost: number | null
          updated_at: string | null
          warehouse_item_id: string
        }
        Insert: {
          bin_allocation_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          total_value?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          warehouse_item_id: string
        }
        Update: {
          bin_allocation_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change?: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          total_value?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          warehouse_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_movements_bin_allocation_id_fkey"
            columns: ["bin_allocation_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bin_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_movements_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_movements_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_movements_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_tools: {
        Row: {
          available_quantity: number
          catalog_item_id: string | null
          category_id: string | null
          company_id: string | null
          condition: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          issued_quantity: number
          location_id: string | null
          name: string
          notes: string | null
          tool_code: string
          total_quantity: number
          unit_cost: number | null
          unit_id: string | null
          updated_at: string | null
          warehouse_item_id: string | null
        }
        Insert: {
          available_quantity?: number
          catalog_item_id?: string | null
          category_id?: string | null
          company_id?: string | null
          condition?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          issued_quantity?: number
          location_id?: string | null
          name: string
          notes?: string | null
          tool_code: string
          total_quantity?: number
          unit_cost?: number | null
          unit_id?: string | null
          updated_at?: string | null
          warehouse_item_id?: string | null
        }
        Update: {
          available_quantity?: number
          catalog_item_id?: string | null
          category_id?: string | null
          company_id?: string | null
          condition?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          issued_quantity?: number
          location_id?: string | null
          name?: string
          notes?: string | null
          tool_code?: string
          total_quantity?: number
          unit_cost?: number | null
          unit_id?: string | null
          updated_at?: string | null
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_tools_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_item_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tools_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tools_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tools_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tools_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "item_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tools_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tools_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tools_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      wht_certificates: {
        Row: {
          certificate_date: string
          certificate_number: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          payment_id: string | null
          status: string
          supplier_id: string | null
          tax_period: string | null
          updated_at: string | null
          wht_amount: number
          wht_rate: number
        }
        Insert: {
          certificate_date?: string
          certificate_number: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          payment_id?: string | null
          status?: string
          supplier_id?: string | null
          tax_period?: string | null
          updated_at?: string | null
          wht_amount?: number
          wht_rate?: number
        }
        Update: {
          certificate_date?: string
          certificate_number?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          payment_id?: string | null
          status?: string
          supplier_id?: string | null
          tax_period?: string | null
          updated_at?: string | null
          wht_amount?: number
          wht_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "wht_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wht_certificates_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "supplier_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wht_certificates_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      construction_labour_directory: {
        Row: {
          category: string | null
          company_id: string | null
          contact_number: string | null
          created_at: string | null
          created_by: string | null
          daily_rate: number | null
          email: string | null
          employee_id: string | null
          epf_no: string | null
          hourly_rate: number | null
          id: string | null
          labour_company: string | null
          location_id: string | null
          name: string | null
          notes: string | null
          project_id: string | null
          skill_level: string | null
          status: string | null
          trade: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      customers_directory: {
        Row: {
          address: string | null
          company_id: string | null
          company_registration_document_url: string | null
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          customer_code: string | null
          customer_name: string | null
          customer_type: string | null
          email: string | null
          first_name: string | null
          id: string | null
          id_passport_number: string | null
          last_name: string | null
          phone: string | null
          registration_number: string | null
          sap_customer_code: string | null
          sap_sync_status: string | null
          status: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: never
          company_id?: string | null
          company_registration_document_url?: never
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_code?: string | null
          customer_name?: string | null
          customer_type?: string | null
          email?: never
          first_name?: string | null
          id?: string | null
          id_passport_number?: never
          last_name?: string | null
          phone?: never
          registration_number?: never
          sap_customer_code?: string | null
          sap_sync_status?: string | null
          status?: string | null
          tax_id?: never
          updated_at?: string | null
        }
        Update: {
          address?: never
          company_id?: string | null
          company_registration_document_url?: never
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_code?: string | null
          customer_name?: string | null
          customer_type?: string | null
          email?: never
          first_name?: string | null
          id?: string | null
          id_passport_number?: never
          last_name?: string | null
          phone?: never
          registration_number?: never
          sap_customer_code?: string | null
          sap_sync_status?: string | null
          status?: string | null
          tax_id?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      modern_boms: {
        Row: {
          bom_number: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          is_legacy_bom: boolean | null
          po_id: string | null
          product_master_id: string | null
          product_name: string | null
          size: string | null
          size_specific: boolean | null
          status: string | null
          style_no: string | null
          target_sizes: Json | null
          updated_at: string | null
          version: string | null
          warehouse_item_id: string | null
        }
        Insert: {
          bom_number?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          is_legacy_bom?: boolean | null
          po_id?: string | null
          product_master_id?: string | null
          product_name?: string | null
          size?: string | null
          size_specific?: boolean | null
          status?: string | null
          style_no?: string | null
          target_sizes?: Json | null
          updated_at?: string | null
          version?: string | null
          warehouse_item_id?: string | null
        }
        Update: {
          bom_number?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          is_legacy_bom?: boolean | null
          po_id?: string | null
          product_master_id?: string | null
          product_name?: string | null
          size?: string | null
          size_specific?: boolean | null
          status?: string | null
          style_no?: string | null
          target_sizes?: Json | null
          updated_at?: string | null
          version?: string | null
          warehouse_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_product_master_id_fkey"
            columns: ["product_master_id"]
            isOneToOne: false
            referencedRelation: "product_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_directory: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          department: string | null
          email: string | null
          full_name: string | null
          id: string | null
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: never
          full_name?: string | null
          id?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: never
          full_name?: string | null
          id?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_active_accounts_with_balances: {
        Row: {
          account_category:
            | Database["public"]["Enums"]["account_category"]
            | null
          account_code: string | null
          account_name: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          company_id: string | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          current_balance: number | null
          id: string | null
          is_active: boolean | null
          is_control_account: boolean | null
          is_header: boolean | null
          level: number | null
          normal_balance: Database["public"]["Enums"]["normal_balance"] | null
          notes: string | null
          opening_balance: number | null
          opening_balance_date: string | null
          parent_account_id: string | null
          total_credits: number | null
          total_debits: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "v_active_accounts_with_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      v_adjustment_summary_by_item: {
        Row: {
          company_id: string | null
          id: string | null
          item_code: string | null
          name: string | null
          qty_decreases: number | null
          qty_increases: number | null
          total_adjustments: number | null
          value_decreases: number | null
          value_increases: number | null
        }
        Relationships: []
      }
      v_adjustment_trends: {
        Row: {
          adjustment_count: number | null
          company_id: string | null
          decreases_count: number | null
          increases_count: number | null
          items_affected: number | null
          month: string | null
          total_value_impact: number | null
        }
        Relationships: []
      }
      v_stock_transactions_balance_drift: {
        Row: {
          bin_id: string | null
          computed_after: number | null
          computed_before: number | null
          created_at: string | null
          id: string | null
          item_id: string | null
          quantity_change: number | null
          stored_after: number | null
          stored_before: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stock_transactions_warehouse_items"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stock_transactions_warehouse_items"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stock_transactions_warehouse_items"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_transactions_bin_mismatch: {
        Row: {
          bin_id: string | null
          bin_location_id: string | null
          created_at: string | null
          item_id: string | null
          transaction_id: string | null
          transaction_location_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stock_transactions_warehouse_items"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_adjustment_summary_by_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stock_transactions_warehouse_items"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stock_transactions_warehouse_items"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_bins_location_id_fkey"
            columns: ["bin_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_items_full: {
        Row: {
          available_quantity: number | null
          barcode: string | null
          base_uom: string | null
          brand: string | null
          catalog_item_id: string | null
          category_id: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          current_stock: number | null
          description: string | null
          id: string | null
          image_url: string | null
          is_batch_tracked: boolean | null
          is_serialized: boolean | null
          item_code: string | null
          location_id: string | null
          manufacturer: string | null
          max_stock_level: number | null
          min_stock_level: number | null
          name: string | null
          notes: string | null
          reorder_level: number | null
          reserved_quantity: number | null
          secondary_uom: string | null
          selling_price: number | null
          sku: string | null
          status: string | null
          supplier_id: string | null
          track_secondary_quantity: boolean | null
          unit_cost: number | null
          unit_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_item_catalog_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_catalog_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_item_catalog_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "item_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_item_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_shared_bin_allocation: {
        Args: {
          _bin_id: string
          _notes?: string
          _owner_company_id: string
          _quantity: number
          _warehouse_item_id: string
        }
        Returns: {
          allocated_quantity: number
          available_quantity: number | null
          bin_id: string
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          notes: string | null
          reserved_quantity: number
          secondary_quantity: number | null
          stock_owner: string | null
          updated_at: string
          warehouse_item_id: string
        }
        SetofOptions: {
          from: "*"
          to: "warehouse_bin_allocations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_bin_allocation_from_scan: {
        Args: {
          p_allocation_id: string
          p_delta: number
          p_notes?: string
          p_reason_code: string
        }
        Returns: Json
      }
      bootstrap_admin: {
        Args: { _role_name?: string; _user_id: string }
        Returns: undefined
      }
      bulk_change_stock_owner: {
        Args: {
          _from_owner: string
          _item_ids: string[]
          _location_ids?: string[]
          _to_owner: string
        }
        Returns: {
          merged_rows: number
          moved_rows: number
          total_quantity: number
        }[]
      }
      bulk_clone_bin_scope: {
        Args: {
          _bin_ids: string[]
          _company_ids: string[]
          _global?: boolean
          _location_ids: string[]
          _mode?: string
        }
        Returns: Json
      }
      bulk_import_inventory_with_stock: {
        Args: { p_rows: Json }
        Returns: Json
      }
      bulk_provision_inventory_from_catalog: {
        Args: { p_rows: Json }
        Returns: Json
      }
      calculate_aging_buckets: {
        Args: {
          p_as_of_date: string
          p_company_id: string
          p_invoice_type: string
        }
        Returns: {
          bucket_1_30: number
          bucket_31_60: number
          bucket_61_90: number
          bucket_over_90: number
          current_bucket: number
          entity_id: string
          entity_name: string
          total_outstanding: number
        }[]
      }
      calculate_bpo_item_remaining_quantity: {
        Args: { p_bpo_item_id: string }
        Returns: number
      }
      calculate_bpo_remaining_value: {
        Args: { p_bpo_id: string }
        Returns: number
      }
      calculate_bpo_utilization: { Args: { p_bpo_id: string }; Returns: number }
      calculate_depreciation: {
        Args: {
          p_calculation_date?: string
          p_depreciation_method: string
          p_depreciation_rate: number
          p_purchase_date: string
          p_purchase_price: number
          p_salvage_value: number
          p_useful_life_years: number
        }
        Returns: number
      }
      calculate_inventory_valuation: {
        Args: {
          p_category_ids?: string[]
          p_company_id: string
          p_item_types?: string[]
          p_location_ids?: string[]
          p_valuation_date?: string
        }
        Returns: {
          aging_bucket: string
          category: string
          days_in_stock: number
          item_code: string
          item_id: string
          item_name: string
          item_type: string
          last_movement_date: string
          location: string
          quantity_on_hand: number
          total_value: number
          unit_cost: number
          valuation_method: string
        }[]
      }
      calculate_kpi_value: { Args: { p_kpi_id: string }; Returns: number }
      calculate_supplier_analytics: {
        Args: { p_period_months?: number; p_supplier_id: string }
        Returns: {
          avg_performance_rate: number
          avg_punctuality_score: number
          avg_quality_score: number
          consistency_score: number
          improvement_rate: number
          performance_grade: string
          reliability_index: number
          total_deliveries: number
          total_evaluations: number
          trend_direction: string
        }[]
      }
      calculate_supplier_risk_score: {
        Args: { p_supplier_id: string }
        Returns: number
      }
      can_access_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      can_manage_site_report_attendance: {
        Args: { _site_report_id: string }
        Returns: boolean
      }
      check_duplicate_supplier: {
        Args: {
          p_email?: string
          p_phone?: string
          p_supplier_name: string
          p_tax_id?: string
        }
        Returns: {
          email: string
          id: string
          match_reason: string
          phone: string
          supplier_name: string
          tax_id: string
        }[]
      }
      check_inventory_purge_eligibility: {
        Args: { p_item_ids: string[] }
        Returns: {
          blocking_refs: string[]
          current_stock: number
          eligible: boolean
          id: string
          item_code: string
        }[]
      }
      compute_telegram_job_next_run: {
        Args: {
          p_day_of_month: number
          p_frequency: string
          p_from?: string
          p_send_time: string
          p_timezone: string
          p_weekday: number
        }
        Returns: string
      }
      consume_mfa_recovery_code: { Args: { p_code: string }; Returns: boolean }
      consume_partial_piece: {
        Args: {
          p_id: string
          p_notes?: string
          p_post_to_stock?: boolean
          p_quantity: number
          p_reason: string
          p_reference?: string
        }
        Returns: Json
      }
      consume_partial_piece_pieces: {
        Args: {
          p_id: string
          p_notes?: string
          p_pieces: number
          p_post_to_stock?: boolean
          p_reason: string
          p_reference?: string
          p_residual_size: number
        }
        Returns: Json
      }
      create_assets_from_request: {
        Args: { p_request_id: string }
        Returns: {
          asset_code: string
          asset_id: string
        }[]
      }
      create_partial_piece: { Args: { p_payload: Json }; Returns: string }
      create_partial_pieces_bulk: {
        Args: {
          p_bin_id: string
          p_company_id: string
          p_location_id: string
          p_parent_item_id: string
          p_rows: Json
          p_shared: Json
        }
        Returns: string[]
      }
      create_tool_with_initial_bin: {
        Args: { p_bin_id: string; p_quantity: number; p_tool_data: Json }
        Returns: string
      }
      create_user_with_roles: {
        Args: {
          _department?: string
          _email: string
          _full_name: string
          _password: string
          _role_ids?: string[]
        }
        Returns: Json
      }
      current_supplier_ids: { Args: never; Returns: string[] }
      delete_partial_piece: { Args: { p_id: string }; Returns: undefined }
      ensure_partial_piece_parent_item: {
        Args: { p_catalog_item_id: string; p_company_id: string }
        Returns: string
      }
      escalate_pending_approvals: { Args: never; Returns: undefined }
      find_catalog_item_by_code: {
        Args: { p_code: string; p_target_company_id?: string }
        Returns: {
          already_imported: boolean
          catalog_id: string
          category_id: string
          category_name: string
          found: boolean
          item_code: string
          name: string
          status: string
          tool_id: string
          tool_name: string
        }[]
      }
      generate_adjustment_batch_number: { Args: never; Returns: string }
      generate_asset_id: {
        Args: {
          _brand?: string
          _category_id: string
          _subcategory_id?: string
        }
        Returns: string
      }
      generate_asset_request_number: { Args: never; Returns: string }
      generate_batch_number: {
        Args: { _company_id: string; _warehouse_item_id: string }
        Returns: string
      }
      generate_bom_number: { Args: never; Returns: string }
      generate_bpo_number: { Args: never; Returns: string }
      generate_construction_document_number: { Args: never; Returns: string }
      generate_contract_number: { Args: never; Returns: string }
      generate_cpo_number: { Args: never; Returns: string }
      generate_customer_code: { Args: never; Returns: string }
      generate_cycle_count_number: { Args: never; Returns: string }
      generate_daily_report_number: { Args: never; Returns: string }
      generate_do_number: { Args: never; Returns: string }
      generate_evaluation_number: { Args: never; Returns: string }
      generate_grn_number: { Args: never; Returns: string }
      generate_issue_number: { Args: never; Returns: string }
      generate_journal_entry_number: { Args: never; Returns: string }
      generate_mfa_recovery_codes: { Args: never; Returns: string[] }
      generate_min_number: { Args: never; Returns: string }
      generate_mr_number: { Args: never; Returns: string }
      generate_mrn_number: { Args: never; Returns: string }
      generate_next_supplier_code: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_pick_list_number: { Args: never; Returns: string }
      generate_po_amendment_number: { Args: never; Returns: string }
      generate_po_number: { Args: never; Returns: string }
      generate_pr_number: { Args: never; Returns: string }
      generate_project_code: { Args: never; Returns: string }
      generate_putaway_number: { Args: never; Returns: string }
      generate_quality_inspection_number: { Args: never; Returns: string }
      generate_quote_number: { Args: never; Returns: string }
      generate_release_number: { Args: never; Returns: string }
      generate_rfp_number: { Args: never; Returns: string }
      generate_rfq_number: { Args: never; Returns: string }
      generate_safety_incident_number: { Args: never; Returns: string }
      generate_safety_inspection_number: { Args: never; Returns: string }
      generate_sales_order_number: { Args: never; Returns: string }
      generate_srn_number: { Args: { _company_id: string }; Returns: string }
      generate_supplier_code: { Args: never; Returns: string }
      generate_transfer_number: { Args: never; Returns: string }
      generate_work_order_number: { Args: never; Returns: string }
      get_all_companies_minimal: {
        Args: never
        Returns: {
          code: string
          id: string
          name: string
        }[]
      }
      get_all_effective_location_companies: {
        Args: never
        Returns: {
          company_id: string
          is_inherited: boolean
          location_id: string
          source_location_id: string
        }[]
      }
      get_all_warehouse_location_companies: {
        Args: never
        Returns: {
          company_id: string
          location_id: string
        }[]
      }
      get_approval_console:
        | {
            Args: { user_id?: string }
            Returns: {
              amount: number
              assigned_to: string
              assigned_to_name: string
              created_at: string
              currency: string
              description: string
              entity_data: Json
              entity_id: string
              id: string
              priority_text: string
              stage: string
              stage_order: number
              status_text: string
              title: string
              type: string
              view_url: string
            }[]
          }
        | {
            Args: { p_limit?: number; user_id?: string }
            Returns: {
              amount: number
              assigned_to: string
              assigned_to_name: string
              created_at: string
              currency: string
              description: string
              entity_data: Json
              entity_id: string
              id: string
              priority_text: string
              stage: string
              stage_order: number
              status_text: string
              title: string
              type: string
              view_url: string
            }[]
          }
      get_balance_sheet: {
        Args: { p_as_of_date: string; p_company_id: string }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          account_type: string
          balance: number
          category: string
          level_depth: number
          parent_id: string
        }[]
      }
      get_bin_scoped_stock_movements: {
        Args: { p_bin_id?: string; p_item_id: string; p_location_id?: string }
        Returns: {
          bin_code: string
          bin_id: string
          bin_name: string
          created_at: string
          created_by: string
          id: string
          location_code: string
          location_id: string
          location_name: string
          notes: string
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_id: string
          reference_type: string
          total_value: number
          transaction_type: string
          unit_cost: number
        }[]
      }
      get_cash_flow_statement: {
        Args: { p_company_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          account_name: string
          activity_type: string
          amount: number
          category: string
          is_subtotal: boolean
        }[]
      }
      get_company_approved_suppliers: {
        Args: { target_company_id: string }
        Returns: {
          credit_limit: number
          is_preferred: boolean
          payment_terms: string
          supplier_code: string
          supplier_id: string
          supplier_name: string
          supplier_type: string
        }[]
      }
      get_company_approvers: {
        Args: {
          p_approval_level?: Database["public"]["Enums"]["approval_level_type"]
          p_company_id: string
          p_department?: string
        }
        Returns: {
          approval_level: Database["public"]["Enums"]["approval_level_type"]
          can_approve_up_to_amount: number
          department: string
          email: string
          full_name: string
          is_primary: boolean
          user_id: string
        }[]
      }
      get_company_hod: { Args: { p_company_id: string }; Returns: string }
      get_company_inventory_at_location: {
        Args: { p_company_id: string; p_location_id: string }
        Returns: {
          available_quantity: number | null
          base_uom: string | null
          catalog_item_id: string
          company_id: string | null
          condition: string | null
          created_at: string
          created_by: string | null
          current_stock: number | null
          id: string
          is_loanable: boolean
          location_id: string | null
          max_stock_level: number | null
          min_stock_level: number | null
          notes: string | null
          reorder_level: number | null
          reserved_quantity: number | null
          secondary_uom: string | null
          selling_price: number | null
          status: string
          track_secondary_quantity: boolean
          unit_cost: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "warehouse_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_company_manager: { Args: { p_company_id: string }; Returns: string }
      get_construction_labour_directory: {
        Args: never
        Returns: {
          category: string
          company_id: string
          contact_number: string
          created_at: string
          created_by: string
          daily_rate: number
          email: string
          employee_id: string
          epf_no: string
          hourly_rate: number
          id: string
          labour_company: string
          location_id: string
          name: string
          notes: string
          project_id: string
          skill_level: string
          status: string
          trade: string
          updated_at: string
        }[]
      }
      get_current_tenant_id: { Args: never; Returns: string }
      get_dashboard_finance_pulse: {
        Args: { p_company_id?: string }
        Returns: Json
      }
      get_dashboard_health_strip: {
        Args: { p_company_id?: string; p_location_id?: string }
        Returns: Json
      }
      get_dashboard_procurement_pulse: {
        Args: { p_company_id?: string }
        Returns: Json
      }
      get_dashboard_sourcing_pulse: {
        Args: { p_company_id?: string }
        Returns: Json
      }
      get_dashboard_warehouse_pulse: {
        Args: { p_company_id?: string; p_location_id?: string }
        Returns: Json
      }
      get_effective_location_company_ids: {
        Args: { p_location_id: string }
        Returns: {
          company_id: string
        }[]
      }
      get_effective_locations_for_companies: {
        Args: { p_company_ids: string[] }
        Returns: {
          depth: number
          id: string
          name: string
          parent_id: string
          type: string
        }[]
      }
      get_effective_locations_for_company: {
        Args: { p_company_id: string }
        Returns: {
          depth: number
          id: string
          name: string
          parent_id: string
          type: string
        }[]
      }
      get_location_ancestors: {
        Args: { _location_id: string }
        Returns: {
          company_id: string
          depth: number
          id: string
          name: string
          parent_id: string
          type: string
        }[]
      }
      get_location_company_assignments_admin: {
        Args: { p_location_id: string }
        Returns: {
          assignment_mode: string
          direct_company_ids: string[]
          effective_company_ids: string[]
          inheritance_source_id: string
          inheritance_source_name: string
        }[]
      }
      get_location_hierarchy: { Args: { _company_id?: string }; Returns: Json }
      get_location_subtree_ids: {
        Args: { p_location_id: string }
        Returns: string[]
      }
      get_location_with_ancestors: {
        Args: { p_location_id: string }
        Returns: {
          location_id: string
        }[]
      }
      get_pending_sap_sync_items: {
        Args: { _company_id: string; _limit?: number; _table_name: string }
        Returns: Json[]
      }
      get_performance_summary: { Args: { p_days?: number }; Returns: Json }
      get_profit_loss_report: {
        Args: {
          p_company_id: string
          p_comparison_end?: string
          p_comparison_start?: string
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          account_type: string
          comparison_period_amount: number
          current_period_amount: number
          level_depth: number
          parent_id: string
          variance_amount: number
          variance_percent: number
        }[]
      }
      get_public_asset: { Args: { p_id: string }; Returns: Json }
      get_public_bin_allocation_qr: { Args: { p_id: string }; Returns: Json }
      get_published_supplier_form: {
        Args: { _slug: string }
        Returns: {
          company_id: string
          company_name: string
          schema: Json
          version: number
        }[]
      }
      get_root_location_id: { Args: { _location_id: string }; Returns: string }
      get_stock_bearing_locations_for_company: {
        Args: { p_company_id: string }
        Returns: {
          depth: number
          id: string
          is_standalone_warehouse: boolean
          name: string
          parent_id: string
          type: string
        }[]
      }
      get_subtree_bin_ids: {
        Args: { p_location_id: string }
        Returns: {
          id: string
        }[]
      }
      get_tool_candidate_items: {
        Args: {
          p_category_ids?: string[]
          p_company_ids: string[]
          p_limit?: number
          p_location_id?: string
        }
        Returns: {
          category_code: string
          category_id: string
          category_name: string
          company_id: string
          current_stock: number
          description: string
          id: string
          item_code: string
          location_id: string
          name: string
          unit_abbreviation: string
          unit_cost: number
          unit_id: string
        }[]
      }
      get_tool_catalog_candidate_counts: {
        Args: { p_target_company_id?: string; p_tool_category_ids?: string[] }
        Returns: {
          all_count: number
          suggested_count: number
          tools_count: number
        }[]
      }
      get_tool_catalog_candidates:
        | {
            Args: {
              p_category_ids?: string[]
              p_include_all_categories?: boolean
              p_limit?: number
              p_search?: string
              p_target_company_id?: string
              p_target_location_id?: string
            }
            Returns: {
              category_code: string
              category_id: string
              category_name: string
              current_stock: number
              description: string
              id: string
              image_url: string
              inventory_item_id: string
              inventory_location_id: string
              item_code: string
              name: string
              status: string
              unit_abbreviation: string
              unit_cost: number
              unit_id: string
            }[]
          }
        | {
            Args: {
              p_category_ids?: string[]
              p_include_all_categories?: boolean
              p_limit?: number
              p_offset?: number
              p_search?: string
              p_target_company_id?: string
              p_target_location_id?: string
            }
            Returns: {
              category_code: string
              category_id: string
              category_name: string
              current_stock: number
              description: string
              id: string
              image_url: string
              inventory_item_id: string
              inventory_location_id: string
              item_code: string
              name: string
              status: string
              unit_abbreviation: string
              unit_cost: number
              unit_id: string
            }[]
          }
      get_trial_balance: {
        Args: { p_as_of_date: string; p_company_id: string }
        Returns: {
          account_code: string
          account_name: string
          account_type: string
          credit_balance: number
          debit_balance: number
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_company_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_location_ids: { Args: { _user_id: string }; Returns: string[] }
      get_warehouse_catalog_count: {
        Args: {
          p_category_id?: string
          p_search?: string
          p_status?: string
          p_supplier_id?: string
        }
        Returns: number
      }
      get_warehouse_catalog_page: {
        Args: {
          p_category_id?: string
          p_cursor_code?: string
          p_cursor_created?: string
          p_cursor_id?: string
          p_cursor_name?: string
          p_limit?: number
          p_search?: string
          p_sort_by?: string
          p_sort_dir?: string
          p_status?: string
          p_supplier_id?: string
        }
        Returns: {
          barcode: string
          brand: string
          category_id: string
          created_at: string
          description: string
          id: string
          image_url: string
          item_code: string
          name: string
          reorder_level: number
          selling_price: number
          sku: string
          status: string
          supplier_id: string
          supplier_name: string
          unit_cost: number
          unit_id: string
        }[]
      }
      get_warehouse_tools_list: {
        Args: {
          p_company_id?: string
          p_limit?: number
          p_location_id?: string
        }
        Returns: {
          available_quantity: number
          catalog_item_id: string
          category_id: string
          category_name: string
          company_id: string
          condition: string
          created_at: string
          created_by: string
          description: string
          id: string
          image_url: string
          issued_quantity: number
          location_id: string
          location_name: string
          name: string
          notes: string
          tool_code: string
          total_quantity: number
          unit_abbreviation: string
          unit_cost: number
          unit_id: string
          unit_name: string
          updated_at: string
          warehouse_item_id: string
        }[]
      }
      has_construction_access: { Args: { _user_id: string }; Returns: boolean }
      has_dashboard_access: {
        Args: { _dashboard_id: string; _user_id: string }
        Returns: boolean
      }
      has_finance_access: { Args: { _user_id: string }; Returns: boolean }
      has_hr_access: { Args: { _user_id: string }; Returns: boolean }
      has_manager_access: { Args: { _user_id: string }; Returns: boolean }
      has_module_access: {
        Args: { _module_key: string; _user_id: string }
        Returns: boolean
      }
      has_operation_access: {
        Args: { _module_key: string; _operation: string; _user_id: string }
        Returns: boolean
      }
      has_po_approval_role: {
        Args: { _role_name: string; _user_id: string }
        Returns: boolean
      }
      has_procurement_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _app_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_sales_access: { Args: { _user_id: string }; Returns: boolean }
      has_senior_finance_access: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_warehouse_access: { Args: { _user_id: string }; Returns: boolean }
      import_partial_pieces: {
        Args: { p_company_id: string; p_rows: Json }
        Returns: Json
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_company_hod: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: boolean
      }
      is_company_manager: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: boolean
      }
      is_same_company: { Args: { _target_user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_supplier_member: { Args: { _supplier_id: string }; Returns: boolean }
      is_supplier_owner: { Args: { _supplier_id: string }; Returns: boolean }
      issue_tool_from_bin: {
        Args: {
          p_bin_id: string
          p_company_id?: string
          p_department?: string
          p_expected_return_date?: string
          p_expected_return_time?: string
          p_issue_date: string
          p_issued_to_name: string
          p_notes?: string
          p_purpose?: string
          p_quantity: number
          p_tool_id: string
        }
        Returns: string
      }
      journal_entry_has_sensitive_accounts: {
        Args: { je_id: string }
        Returns: boolean
      }
      list_bins_at_location: {
        Args: { p_location_id: string }
        Returns: {
          bin_code: string
          bin_type_id: string
          capacity: number
          company_id: string
          current_quantity: number
          id: string
          location_id: string
          name: string
          parent_bin_id: string
          status: string
        }[]
      }
      list_bins_for_location_inherited: {
        Args: { p_location_id: string }
        Returns: {
          bin_code: string
          bin_type_id: string
          capacity: number
          company_id: string
          current_quantity: number
          id: string
          inherited_from_location_id: string
          inherited_from_location_name: string
          is_global_template: boolean
          location_id: string
          name: string
          status: string
        }[]
      }
      list_partial_piece_items: {
        Args: {
          p_company_id: string
          p_limit?: number
          p_location_id?: string
          p_offset?: number
          p_search?: string
        }
        Returns: {
          base_uom: string
          catalog_item_id: string
          has_inventory_row: boolean
          item_code: string
          item_name: string
          parent_item_id: string
          piece_count: number
          secondary_uom: string
          total_count: number
          track_secondary_quantity: boolean
          unit_cost: number
        }[]
      }
      list_partial_pieces: {
        Args: {
          p_company_id: string
          p_limit?: number
          p_location_id?: string
          p_offset?: number
          p_parent_item_id?: string
          p_search?: string
          p_status?: string
        }
        Returns: {
          age_days: number
          base_uom: string
          batch_number: string
          bin_code: string
          bin_id: string
          created_at: string
          id: string
          label: string
          location_id: string
          location_name: string
          notes: string
          original_piece_count: number
          parent_item_code: string
          parent_item_id: string
          parent_item_name: string
          parent_item_status: string
          piece_code: string
          piece_count: number
          secondary_uom: string
          size_uom: string
          size_value: number
          source_ref: string
          status: string
          total_size_value: number
          track_secondary_quantity: boolean
          unit_cost: number
          updated_at: string
        }[]
      }
      list_warehouse_catalog: {
        Args: {
          _category_id?: string
          _cursor_created_at?: string
          _cursor_id?: string
          _limit?: number
          _search?: string
          _status?: string
          _supplier_id?: string
        }
        Returns: {
          barcode: string
          brand: string
          category_id: string
          category_name: string
          created_at: string
          description: string
          id: string
          image_url: string
          is_batch_tracked: boolean
          is_serialized: boolean
          item_code: string
          manufacturer: string
          max_stock_level: number
          min_stock_level: number
          name: string
          notes: string
          reorder_level: number
          selling_price: number
          sku: string
          status: string
          supplier_id: string
          supplier_name: string
          total_count: number
          unit_cost: number
          unit_id: string
          unit_name: string
          updated_at: string
        }[]
      }
      list_warehouse_inventory: {
        Args: {
          _category_id?: string
          _company_id?: string
          _cursor_created_at?: string
          _cursor_id?: string
          _cursor_item_code?: string
          _cursor_name?: string
          _cursor_stock?: number
          _limit?: number
          _location_ids?: string[]
          _owner_label?: string
          _search?: string
          _sort_by?: string
          _sort_dir?: string
          _status?: string
          _stock_mode?: string
          _supplier_id?: string
        }
        Returns: {
          available_quantity: number
          bins: Json
          brand: string
          category_id: string
          category_name: string
          company_id: string
          created_at: string
          current_stock: number
          description: string
          id: string
          image_url: string
          item_code: string
          manufacturer: string
          max_stock_level: number
          min_stock_level: number
          name: string
          reorder_level: number
          reserved_quantity: number
          selling_price: number
          status: string
          stock_owners: string[]
          supplier_id: string
          supplier_name: string
          unit_abbreviation: string
          unit_cost: number
          unit_id: string
          unit_name: string
          updated_at: string
        }[]
      }
      log_einvoice_event: {
        Args: {
          p_einvoice_id: string
          p_event_type: Database["public"]["Enums"]["einvoice_event_type"]
          p_ip?: string
          p_payload?: Json
          p_user_agent?: string
        }
        Returns: string
      }
      log_supplier_portal_event: {
        Args: { _action: string; _metadata?: Json; _supplier_id: string }
        Returns: number
      }
      match_bank_transactions: {
        Args: { p_import_id: string }
        Returns: {
          confidence_score: number
          match_reason: string
          matched_transaction_id: string
          statement_line_id: string
        }[]
      }
      next_catalog_item_code: {
        Args: { p_category_code: string }
        Returns: string
      }
      next_partial_piece_code: {
        Args: { p_company_id: string }
        Returns: string
      }
      next_partial_piece_code_for_item: {
        Args: { p_company_id: string; p_parent_item_id: string }
        Returns: string
      }
      process_fifo_batch_issue: {
        Args: {
          p_company_id: string
          p_issue_item_id: string
          p_item_id: string
          p_quantity_issued: number
        }
        Returns: undefined
      }
      process_material_issue_stock_update:
        | {
            Args: {
              p_bin_allocation_id?: string
              p_item_id: string
              p_location_id: string
              p_min_id?: string
              p_min_number?: string
              p_quantity_issued: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_bin_allocation_id?: string
              p_item_id: string
              p_location_id: string
              p_min_id?: string
              p_min_number?: string
              p_quantity_issued: number
              p_secondary_quantity_issued?: number
            }
            Returns: undefined
          }
      process_material_return_stock_update:
        | {
            Args: {
              p_bin_allocation_id?: string
              p_item_id: string
              p_mrn_id?: string
              p_mrn_number?: string
              p_quantity_returned: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_bin_allocation_id?: string
              p_company_id?: string
              p_item_id: string
              p_mrn_id?: string
              p_mrn_number?: string
              p_quantity_returned: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_bin_allocation_id?: string
              p_company_id?: string
              p_item_id: string
              p_mrn_id?: string
              p_mrn_number?: string
              p_quantity_returned: number
              p_secondary_quantity_returned?: number
            }
            Returns: undefined
          }
      purge_inactive_inventory_item: {
        Args: { p_item_id: string; p_reason: string }
        Returns: Json
      }
      purge_inactive_inventory_items_bulk: {
        Args: { p_item_ids: string[]; p_reason: string }
        Returns: {
          id: string
          message: string
          status: string
        }[]
      }
      recompute_item_primary_location: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      reconcile_stock_batch:
        | {
            Args: {
              p_company_id: string
              p_item_ids: string[]
              p_overrides?: Json
              p_user_id?: string
            }
            Returns: {
              action: string
              item_code: string
              item_id: string
              message: string
            }[]
          }
        | {
            Args: {
              p_company_id: string
              p_item_ids: string[]
              p_location_id?: string
              p_overrides?: Json
              p_user_id?: string
            }
            Returns: {
              action: string
              item_code: string
              item_id: string
              message: string
            }[]
          }
      record_workflow_action: {
        Args: {
          p_comments?: string
          p_metadata?: Json
          p_request_id: string
          p_stage: string
        }
        Returns: undefined
      }
      relocate_warehouse_bin: {
        Args: {
          _bin_id: string
          _mode: string
          _new_location_id: string
          _reason?: string
        }
        Returns: Json
      }
      remove_item_from_inventory: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      report_abc_classification: {
        Args: {
          p_category_id?: string
          p_company_id: string
          p_months?: number
        }
        Returns: {
          abc_class: string
          category_name: string
          consumption_qty: number
          consumption_value: number
          cumulative_pct: number
          item_code: string
          item_name: string
        }[]
      }
      report_ap_aging: {
        Args: {
          p_as_of_date?: string
          p_company_id: string
          p_supplier_id?: string
        }
        Returns: {
          amount_paid: number
          bucket: string
          bucket_0_30: number
          bucket_31_60: number
          bucket_61_90: number
          bucket_90_plus: number
          currency: string
          days_overdue: number
          due_date: string
          invoice_date: string
          invoice_number: string
          net_amount: number
          outstanding: number
          supplier_name: string
        }[]
      }
      report_ar_aging: {
        Args: {
          p_as_of_date?: string
          p_company_id: string
          p_customer_id?: string
        }
        Returns: {
          amount_received: number
          bucket: string
          bucket_0_30: number
          bucket_31_60: number
          bucket_61_90: number
          bucket_90_plus: number
          currency: string
          customer_name: string
          days_overdue: number
          due_date: string
          invoice_date: string
          invoice_number: string
          net_amount: number
          outstanding: number
        }[]
      }
      report_asset_register: {
        Args: {
          p_company_id: string
          p_location_id?: string
          p_status?: string
        }
        Returns: {
          accumulated_depreciation: number
          asset_id: string
          asset_tag: string
          brand: string
          category: string
          condition: string
          depreciation_method: string
          depreciation_rate: number
          location_name: string
          name: string
          net_book_value: number
          purchase_date: string
          purchase_price: number
          salvage_value: number
          serial_number: string
          status: string
          useful_life_years: number
        }[]
      }
      report_batch_traceability: {
        Args: {
          p_batch_number?: string
          p_company_id: string
          p_direction?: string
          p_item_code?: string
          p_notes_op?: string
          p_notes_terms?: string[]
        }
        Returns: {
          batch_number: string
          counterparty: string
          event_date: string
          event_type: string
          item_code: string
          item_name: string
          notes: string
          quantity: number
          reference_number: string
          trace_direction: string
          unit_cost: number
        }[]
      }
      report_bin_utilisation: {
        Args: { p_company_id: string; p_location_id?: string }
        Returns: {
          available_capacity: number
          bin_code: string
          bin_name: string
          capacity: number
          current_quantity: number
          location_name: string
          status: string
          utilisation_pct: number
        }[]
      }
      report_cash_bank_statement: {
        Args: {
          p_bank_account_id?: string
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
        }
        Returns: {
          account_name: string
          bank_name: string
          credit_amount: number
          currency: string
          debit_amount: number
          description: string
          is_reconciled: boolean
          reference_number: string
          running_balance: number
          transaction_date: string
          transaction_type: string
        }[]
      }
      report_construction_budget_variance: {
        Args: { p_company_id: string; p_project_id?: string }
        Returns: {
          actual_amount: number
          budget_code: string
          category: string
          committed_amount: number
          description: string
          planned_amount: number
          project_code: string
          project_name: string
          quantity: number
          unit: string
          unit_cost: number
          variance_amount: number
          variance_pct: number
        }[]
      }
      report_construction_dsr_summary: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_project_id?: string
        }
        Returns: {
          attendance_absent: number
          attendance_present: number
          labor_count: number
          project_code: string
          project_name: string
          report_date: string
          report_number: string
          skilled_labor_count: number
          status: string
          subcontractor_count: number
          temperature_high: number
          temperature_low: number
          unskilled_labor_count: number
          visitor_count: number
          weather_conditions: string
        }[]
      }
      report_construction_material_movements: {
        Args: { p_company_id: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          item_code: string
          item_name: string
          location_name: string
          notes: string
          performed_by: string
          quantity_change: number
          transaction_date: string
          transaction_type: string
        }[]
      }
      report_construction_progress: {
        Args: { p_company_id: string }
        Returns: {
          actual_cost: number
          actual_end_date: string
          completion_percentage: number
          days_elapsed: number
          days_total: number
          estimated_budget: number
          project_code: string
          project_name: string
          schedule_variance_pct: number
          start_date: string
          status: string
          target_end_date: string
        }[]
      }
      report_contract_expiry: {
        Args: { p_company_id: string; p_horizon_days?: number }
        Returns: {
          auto_renew: boolean
          contract_number: string
          contract_title: string
          contract_type: string
          contract_value: number
          counterparty_name: string
          currency: string
          days_to_expiry: number
          effective_date: string
          expiry_date: string
          owner_id: string
          renewal_count: number
          status: string
        }[]
      }
      report_cycle_count_variance: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_location_id?: string
          p_notes_op?: string
          p_notes_terms?: string[]
        }
        Returns: {
          count_date: string
          count_number: string
          item_code: string
          item_name: string
          location_name: string
          physical_quantity: number
          status: string
          system_quantity: number
          variance_percentage: number
          variance_quantity: number
          variance_reason: string
          variance_value: number
        }[]
      }
      report_fixed_asset_register: {
        Args: { p_as_of_date?: string; p_company_id: string }
        Returns: {
          accumulated_depreciation: number
          asset_id: string
          asset_tag: string
          category: string
          depreciation_method: string
          depreciation_rate: number
          location_name: string
          name: string
          net_book_value: number
          purchase_date: string
          purchase_price: number
          salvage_value: number
          serial_number: string
          status: string
          useful_life_years: number
        }[]
      }
      report_general_ledger_detail: {
        Args: {
          p_account_id?: string
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
        }
        Returns: {
          account_code: string
          account_name: string
          cost_center: string
          credit_amount: number
          debit_amount: number
          description: string
          journal_date: string
          journal_number: string
          journal_type: string
          reference_number: string
        }[]
      }
      report_grn_register: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_supplier_id?: string
        }
        Returns: {
          approved_at: string
          grn_date: string
          grn_number: string
          invoice_date: string
          invoice_number: string
          line_count: number
          po_number: string
          remarks: string
          status: string
          supplier_name: string
          total_qty_received: number
          total_value: number
        }[]
      }
      report_inventory_aging: {
        Args: { p_category_id?: string; p_company_id: string }
        Returns: {
          aging_bucket: string
          category_name: string
          current_stock: number
          days_since_movement: number
          item_code: string
          item_id: string
          item_name: string
          last_movement_at: string
          stock_value: number
          unit_cost: number
        }[]
      }
      report_inventory_valuation: {
        Args: {
          p_as_of_date?: string
          p_category_id?: string
          p_company_id: string
        }
        Returns: {
          category_name: string
          current_stock: number
          fifo_value: number
          item_code: string
          item_id: string
          item_name: string
          last_unit_cost: number
          nrv_adjustment: number
          selling_price: number
          unit_name: string
          weighted_avg_cost: number
          weighted_avg_value: number
        }[]
      }
      report_item_stock_availability: {
        Args: {
          p_bin_id?: string
          p_catalog_item_id?: string
          p_group_by?: string
          p_include_batches?: boolean
          p_include_zero?: boolean
          p_location_id?: string
          p_search_phrase?: string
        }
        Returns: {
          available_qty: number
          batch_number: string
          bin_code: string
          bin_id: string
          bin_name: string
          catalog_item_id: string
          company_id: string
          company_name: string
          item_code: string
          item_name: string
          location_id: string
          location_path: string
          on_hand_qty: number
          reserved_qty: number
          status: string
          stock_value: number
          unit_cost: number
          unit_name: string
        }[]
      }
      report_open_po: {
        Args: { p_company_id: string }
        Returns: {
          currency: string
          days_open: number
          expected_delivery_date: string
          outstanding_value: number
          po_date: string
          po_number: string
          status: string
          supplier_name: string
          total_qty_ordered: number
          total_qty_pending: number
          total_qty_received: number
        }[]
      }
      report_partial_pieces_movement: {
        Args: {
          p_bin_id?: string
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_event_type?: string
          p_item_id?: string
          p_location_id?: string
        }
        Returns: {
          bin_code: string
          bin_id: string
          event_at: string
          event_pieces: number
          event_qty: number
          event_type: string
          event_value: number
          item_code: string
          item_id: string
          item_name: string
          location_id: string
          location_name: string
          notes: string
          parent_piece_code: string
          piece_code: string
          piece_id: string
          reason: string
          size_uom: string
          size_value: number
          unit_cost: number
          user_email: string
        }[]
      }
      report_partial_pieces_on_hand: {
        Args: {
          p_bin_id?: string
          p_category_id?: string
          p_company_id: string
          p_include_zero?: boolean
          p_item_id?: string
          p_location_id?: string
          p_status?: string
        }
        Returns: {
          age_days: number
          base_uom: string
          batch_number: string
          bin_code: string
          bin_id: string
          bin_name: string
          category_id: string
          category_name: string
          created_at: string
          item_code: string
          item_id: string
          item_name: string
          label: string
          location_id: string
          location_name: string
          original_piece_count: number
          piece_code: string
          piece_count: number
          piece_id: string
          secondary_uom: string
          size_uom: string
          size_value: number
          source_ref: string
          status: string
          stock_value: number
          total_size: number
          unit_cost: number
        }[]
      }
      report_pending_approvals: {
        Args: { p_company_id: string }
        Returns: {
          amount: number
          currency: string
          current_status: string
          days_pending: number
          document_number: string
          document_type: string
          module: string
          submitted_date: string
          title: string
        }[]
      }
      report_po_register: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_status?: string
        }
        Returns: {
          actual_delivery_date: string
          approved_date: string
          currency: string
          expected_delivery_date: string
          final_amount: number
          line_count: number
          po_date: string
          po_number: string
          status: string
          supplier_name: string
        }[]
      }
      report_pr_register: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_status?: string
        }
        Returns: {
          approved_date: string
          department: string
          line_count: number
          pr_number: string
          priority: string
          requested_date: string
          required_date: string
          status: string
          title: string
          total_estimated_amount: number
        }[]
      }
      report_production_daily_output: {
        Args: { p_company_id: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          efficiency_pct: number
          entry_date: string
          input_qty: number
          notes: string
          order_number: string
          output_qty: number
          product_name: string
          stage_name: string
          wastage_qty: number
        }[]
      }
      report_production_efficiency: {
        Args: { p_company_id: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          completion_pct: number
          due_date: string
          order_number: string
          product_name: string
          start_date: string
          status: string
          target_qty: number
          total_input: number
          total_output: number
          total_wastage: number
          wastage_pct: number
          yield_pct: number
        }[]
      }
      report_production_stage_cost: {
        Args: { p_company_id: string; p_order_id?: string }
        Returns: {
          item_name: string
          order_number: string
          product_name: string
          quantity_used: number
          sequence_order: number
          source: string
          stage_name: string
          total_cost: number
          unit_cost: number
          unit_of_measure: string
        }[]
      }
      report_production_wip: {
        Args: { p_company_id: string }
        Returns: {
          completed_at: string
          input_qty: number
          order_number: string
          output_qty: number
          product_name: string
          sequence_order: number
          stage_cost: number
          stage_name: string
          stage_status: string
          started_at: string
          style_no: string
          target_qty: number
          wastage_qty: number
          wip_qty: number
        }[]
      }
      report_quote_comparison: {
        Args: { p_company_id: string; p_request_id?: string }
        Returns: {
          currency: string
          delivery_commitment: string
          evaluation_score: number
          payment_terms: string
          quote_number: string
          request_number: string
          request_title: string
          status: string
          submission_date: string
          supplier_name: string
          total_quoted_amount: number
          validity_period: number
        }[]
      }
      report_report_usage: {
        Args: { p_company_id: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          format: string
          generated_at: string
          generated_by: string
          module_key: string
          report_code: string
          report_title: string
          row_count: number
          user_agent: string
        }[]
      }
      report_rfq_register: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_status?: string
        }
        Returns: {
          budget_estimate: number
          category: string
          currency: string
          evaluation_deadline: string
          invited_count: number
          issue_date: string
          priority: string
          quote_count: number
          request_number: string
          request_type: string
          status: string
          submission_deadline: string
          title: string
        }[]
      }
      report_spend_analysis: {
        Args: { p_company_id: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          currency: string
          period_month: string
          po_count: number
          supplier_name: string
          total_qty: number
          total_spend: number
        }[]
      }
      report_stock_movement_ledger: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_location_id?: string
          p_notes_op?: string
          p_notes_terms?: string[]
        }
        Returns: {
          item_code: string
          item_name: string
          location_name: string
          notes: string
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_type: string
          total_value: number
          transaction_type: string
          txn_date: string
          unit_cost: number
          user_email: string
        }[]
      }
      report_stock_on_hand:
        | {
            Args: {
              p_category_id?: string
              p_company_id: string
              p_include_zero?: boolean
              p_location_id?: string
            }
            Returns: {
              available_quantity: number
              category_id: string
              category_name: string
              current_stock: number
              item_code: string
              item_id: string
              item_name: string
              location_id: string
              location_name: string
              min_stock_level: number
              reorder_level: number
              reserved_quantity: number
              status: string
              stock_value: number
              unit_cost: number
              unit_name: string
            }[]
          }
        | {
            Args: {
              p_bin_id?: string
              p_bin_wise?: boolean
              p_category_id?: string
              p_company_id: string
              p_include_zero?: boolean
              p_location_id?: string
            }
            Returns: {
              available_quantity: number
              bin_code: string
              bin_id: string
              bin_name: string
              category_id: string
              category_name: string
              current_stock: number
              item_code: string
              item_id: string
              item_name: string
              location_id: string
              location_name: string
              min_stock_level: number
              reorder_level: number
              reserved_quantity: number
              status: string
              stock_value: number
              unit_cost: number
              unit_name: string
            }[]
          }
      report_supplier_scorecard: {
        Args: { p_company_id: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          avg_evaluation_score: number
          category: string
          on_time_delivery_pct: number
          open_action_items: number
          rating: number
          status: string
          supplier_code: string
          supplier_name: string
          total_pos: number
          total_spend: number
        }[]
      }
      report_system_audit_log: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_module?: string
        }
        Returns: {
          details: string
          event_time: string
          event_type: string
          module: string
          reference: string
          user_id: string
        }[]
      }
      report_three_way_match_exceptions: {
        Args: { p_company_id: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          currency: string
          grn_number: string
          invoice_amount: number
          invoice_date: string
          invoice_number: string
          po_number: string
          status: string
          supplier_name: string
          three_way_match_status: string
        }[]
      }
      report_tool_ledger: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_status?: string
        }
        Returns: {
          department: string
          expected_return_date: string
          issue_date: string
          issue_number: string
          issued_to_name: string
          last_condition: string
          last_return_date: string
          outstanding_qty: number
          purpose: string
          quantity_issued: number
          quantity_returned: number
          status: string
          tool_code: string
          tool_name: string
        }[]
      }
      report_trial_balance: {
        Args: { p_as_of_date?: string; p_company_id: string }
        Returns: {
          account_category: string
          account_code: string
          account_name: string
          account_type: string
          closing_balance: number
          opening_balance: number
          period_credit: number
          period_debit: number
        }[]
      }
      resolve_public_portal_company: {
        Args: { _slug: string }
        Returns: {
          code: string
          id: string
          logo_url: string
          name: string
        }[]
      }
      return_tool_to_bin: {
        Args: {
          p_bin_id: string
          p_company_id?: string
          p_condition: string
          p_condition_notes?: string
          p_issue_id: string
          p_notes?: string
          p_quantity: number
          p_return_date: string
          p_returned_by_name?: string
        }
        Returns: string
      }
      run_fx_revaluation: {
        Args: {
          p_as_of_date: string
          p_base_currency?: string
          p_company_id: string
        }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          currency: string
          current_rate: number
          foreign_balance: number
          original_base_balance: number
          revalued_balance: number
          unrealized_gain_loss: number
        }[]
      }
      search_warehouse_item_catalog: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          brand: string
          category_name: string
          id: string
          item_code: string
          name: string
          rank: number
          status: string
          unit_name: string
        }[]
      }
      set_bin_sharing: {
        Args: { _bin_id: string; _is_shared: boolean }
        Returns: {
          bin_code: string
          bin_type_id: string | null
          capacity: number | null
          company_id: string | null
          created_at: string
          created_by: string | null
          current_quantity: number | null
          description: string | null
          id: string
          is_global_template: boolean
          is_shared: boolean
          location_id: string | null
          name: string
          notes: string | null
          parent_bin_id: string | null
          root_location_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "warehouse_bins"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_location_company_assignments_admin: {
        Args: {
          p_assignment_mode: string
          p_company_ids: string[]
          p_location_id: string
        }
        Returns: undefined
      }
      set_peppol_environment: {
        Args: {
          p_company_id: string
          p_env: Database["public"]["Enums"]["peppol_environment"]
        }
        Returns: undefined
      }
      split_partial_piece: {
        Args: { p_first_size: number; p_id: string; p_second_size: number }
        Returns: Json
      }
      srn_number_exists: {
        Args: { _company_id: string; _exclude_id?: string; _srn_number: string }
        Returns: boolean
      }
      stock_audit_summary: {
        Args: { p_company_id?: string }
        Returns: {
          bin_count: number
          bin_total: number
          current_stock: number
          id: string
          item_code: string
          name: string
          status: string
          variance: number
        }[]
      }
      stock_audit_summary_by_location: {
        Args: { p_company_id: string; p_location_id: string }
        Returns: {
          bin_count: number
          bin_total: number
          current_stock: number
          id: string
          item_code: string
          name: string
          status: string
          variance: number
        }[]
      }
      tool_adjustment_post_ledger: {
        Args: {
          p_company_id: string
          p_delta: number
          p_notes?: string
          p_reason: string
          p_reference_id: string
          p_warehouse_item_id: string
        }
        Returns: undefined
      }
      tool_issue_post_ledger: {
        Args: {
          p_company_id: string
          p_notes?: string
          p_quantity: number
          p_reference_id: string
          p_warehouse_item_id: string
        }
        Returns: undefined
      }
      tool_return_post_ledger: {
        Args: {
          p_company_id: string
          p_condition: string
          p_notes?: string
          p_quantity: number
          p_reference_id: string
          p_warehouse_item_id: string
        }
        Returns: undefined
      }
      transfer_assets_to_department: {
        Args: { p_request_id: string }
        Returns: Json
      }
      transfer_stock_fifo: {
        Args: {
          p_company_id: string
          p_from_bin_id: string
          p_item_id: string
          p_quantity: number
          p_to_bin_id: string
          p_transfer_id?: string
          p_transfer_number?: string
          p_user_id: string
        }
        Returns: Json
      }
      update_partial_piece: {
        Args: { p_id: string; p_payload: Json }
        Returns: undefined
      }
      update_reservation_on_issue: {
        Args: { p_quantity_issued: number; p_reservation_id: string }
        Returns: undefined
      }
      update_sap_sync_status: {
        Args: {
          _record_id: string
          _sap_doc_number?: string
          _status: string
          _table_name: string
        }
        Returns: undefined
      }
      update_warehouse_catalog_item: {
        Args: {
          p_barcode?: string
          p_brand?: string
          p_catalog_item_id: string
          p_category_id?: string
          p_description?: string
          p_image_url?: string
          p_is_batch_tracked?: boolean
          p_is_serialized?: boolean
          p_manufacturer?: string
          p_name?: string
          p_notes?: string
          p_sku?: string
          p_status?: string
          p_supplier_id?: string
          p_unit_id?: string
        }
        Returns: string
      }
      upsert_warehouse_inventory: {
        Args: {
          p_base_uom?: string
          p_catalog_item_id: string
          p_company_id: string
          p_location_id?: string
          p_max_stock_level?: number
          p_min_stock_level?: number
          p_notes?: string
          p_reorder_level?: number
          p_secondary_uom?: string
          p_selling_price?: number
          p_status?: string
          p_track_secondary?: boolean
          p_unit_cost?: number
        }
        Returns: string
      }
      user_has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_location_access: {
        Args: { _location_id: string; _user_id: string }
        Returns: boolean
      }
      validate_bpo_release: {
        Args: { p_bpo_id: string; p_requested_amount: number }
        Returns: boolean
      }
      validate_po_for_grn: { Args: { p_po_id: string }; Returns: boolean }
      verify_admin_operation: {
        Args: { _operation_name: string }
        Returns: boolean
      }
      verify_einvoice_event_chain: {
        Args: { p_einvoice_id: string }
        Returns: {
          actual_hash: string
          event_id: string
          expected_hash: string
          is_valid: boolean
        }[]
      }
      verify_realtime_coverage: {
        Args: never
        Returns: {
          issue: string
          table_name: string
        }[]
      }
    }
    Enums: {
      account_category:
        | "current_asset"
        | "fixed_asset"
        | "other_asset"
        | "current_liability"
        | "long_term_liability"
        | "equity"
        | "retained_earnings"
        | "operating_revenue"
        | "other_revenue"
        | "operating_expense"
        | "cogs"
        | "other_expense"
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      action_type:
        | "flagged"
        | "blacklisted"
        | "cleared"
        | "escalated"
        | "resolved"
        | "updated"
        | "reviewed"
      amendment_type:
        | "price_change"
        | "quantity_change"
        | "term_extension"
        | "item_addition"
        | "item_removal"
        | "other"
      app_role: "super_admin" | "admin" | "manager" | "user" | "supplier"
      approval_level_type:
        | "hod"
        | "manager"
        | "finance"
        | "procurement"
        | "custom"
      asset_approval_action: "approved" | "rejected" | "requested_changes"
      asset_approval_level: "hod" | "procurement" | "management"
      asset_fulfillment_method: "from_stock" | "purchase" | "transfer"
      asset_request_item_status:
        | "pending"
        | "approved"
        | "rejected"
        | "fulfilled"
        | "partially_fulfilled"
        | "delivered"
        | "received"
        | "purchased"
        | "returned"
      asset_request_item_type: "from_master" | "new_item"
      asset_request_priority: "low" | "medium" | "high" | "urgent"
      asset_request_status:
        | "draft"
        | "pending_hod_approval"
        | "pending_procurement_approval"
        | "approved"
        | "rejected"
        | "fulfilled"
        | "partially_fulfilled"
        | "cancelled"
        | "pending_delivery"
        | "pending_receipt"
        | "purchased"
        | "returned"
        | "partially_returned"
      billing_frequency:
        | "one_time"
        | "monthly"
        | "quarterly"
        | "annually"
        | "milestone_based"
      blacklist_status: "blacklisted" | "watchlist" | "cleared"
      blanket_contract_status:
        | "draft"
        | "active"
        | "suspended"
        | "expired"
        | "closed"
        | "cancelled"
      blanket_contract_type:
        | "blanket_po"
        | "contract_po"
        | "framework_agreement"
      bpo_release_status:
        | "draft"
        | "submitted"
        | "approved"
        | "sent"
        | "received"
        | "completed"
        | "cancelled"
      calculation_type:
        | "count"
        | "sum"
        | "average"
        | "percentage"
        | "custom_sql"
      confidentiality_level:
        | "public"
        | "internal"
        | "confidential"
        | "highly_confidential"
      contract_amendment_type:
        | "price_change"
        | "term_extension"
        | "scope_change"
        | "party_change"
        | "termination_clause"
        | "value_adjustment"
        | "obligation_change"
        | "payment_terms_change"
        | "other"
      contract_document_type:
        | "main_contract"
        | "amendment"
        | "annex"
        | "supporting_document"
        | "signed_copy"
        | "scan"
        | "certificate"
        | "insurance"
        | "compliance_document"
        | "correspondence"
        | "other"
      contract_party_type:
        | "internal"
        | "external"
        | "supplier"
        | "customer"
        | "partner"
        | "guarantor"
      contract_priority: "low" | "medium" | "high" | "critical"
      contract_risk_level: "low" | "medium" | "high" | "critical"
      contract_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "active"
        | "suspended"
        | "expired"
        | "terminated"
        | "renewed"
        | "closed"
      contract_type:
        | "supplier_contract"
        | "customer_contract"
        | "service_agreement"
        | "employment_contract"
        | "nda"
        | "lease_agreement"
        | "partnership_agreement"
        | "framework_agreement"
        | "software_license"
        | "consulting_agreement"
        | "other"
      dashboard_visibility: "private" | "role_based" | "company_wide"
      delivery_status:
        | "pending_receipt"
        | "partially_received"
        | "fully_received"
      einvoice_compliance_profile:
        | "peppol_bis_3"
        | "ksa_zatca_phase2"
        | "it_sdi"
        | "fr_facturx"
      einvoice_country_mandate: "zatca" | "sdi" | "facturx"
      einvoice_direction: "outbound" | "inbound"
      einvoice_document_type: "invoice" | "credit_note" | "debit_note"
      einvoice_event_type:
        | "created"
        | "updated"
        | "validated"
        | "submitted"
        | "ack_received"
        | "rejected"
        | "matched"
        | "posted"
        | "cancelled"
      einvoice_match_status: "unmatched" | "partial" | "matched" | "discrepancy"
      einvoice_status:
        | "draft"
        | "validated"
        | "ready_to_send"
        | "sent"
        | "received"
        | "accepted"
        | "rejected"
        | "paid"
        | "cancelled"
        | "submission_failed"
        | "delivered"
      evaluation_recommendation:
        | "strongly_recommend"
        | "recommend"
        | "neutral"
        | "not_recommend"
        | "reject"
      invitation_status: "invited" | "viewed" | "declined" | "submitted"
      journal_status: "draft" | "posted" | "void" | "reversed"
      journal_type:
        | "manual"
        | "system_generated"
        | "opening_balance"
        | "closing"
        | "adjusting"
        | "reversing"
        | "recurring"
      kpi_category:
        | "procurement"
        | "warehouse"
        | "finance"
        | "sourcing"
        | "custom"
      material_request_priority: "low" | "normal" | "medium" | "high" | "urgent"
      material_request_status:
        | "draft"
        | "pending_hod_approval"
        | "pending_management_approval"
        | "approved"
        | "rejected"
        | "cancelled"
        | "issued"
        | "partially_received"
        | "completed"
      mfa_policy: "disabled" | "optional" | "required_admins" | "required_all"
      normal_balance: "debit" | "credit"
      obligation_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "overdue"
        | "waived"
        | "disputed"
      obligation_type:
        | "deliverable"
        | "milestone"
        | "payment"
        | "service_level"
        | "compliance_requirement"
        | "reporting"
        | "renewal_action"
        | "inspection"
      partial_piece_status: "available" | "reserved" | "consumed" | "scrapped"
      peppol_environment: "sandbox" | "live"
      period_status: "open" | "closed" | "locked"
      permission_level: "view" | "edit" | "admin"
      po_amendment_type:
        | "price_change"
        | "quantity_change"
        | "delivery_date_change"
        | "terms_change"
        | "item_addition"
        | "item_removal"
        | "other"
      po_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "sent"
        | "acknowledged"
        | "partially_received"
        | "completed"
        | "cancelled"
        | "pending_dept_head_approval"
      pr_priority: "low" | "medium" | "high" | "urgent"
      pr_status:
        | "draft"
        | "submitted"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "cancelled"
      quote_status:
        | "draft"
        | "submitted"
        | "under_evaluation"
        | "shortlisted"
        | "awarded"
        | "rejected"
      renewal_type: "auto_renewal" | "manual_review" | "renegotiation_required"
      report_period_type: "daily" | "weekly" | "monthly"
      rfq_rfp_priority: "low" | "medium" | "high" | "urgent"
      rfq_rfp_publish_type: "public" | "invited" | "limited"
      rfq_rfp_status:
        | "draft"
        | "published"
        | "in_progress"
        | "evaluation"
        | "awarded"
        | "cancelled"
        | "closed"
      rfq_rfp_type: "rfq" | "rfp"
      risk_category:
        | "quality"
        | "delivery"
        | "financial"
        | "compliance"
        | "ethical"
        | "legal"
        | "operational"
        | "other"
      risk_flag_status: "active" | "resolved" | "under_review" | "escalated"
      risk_severity: "low" | "medium" | "high" | "critical"
      signature_method: "physical" | "electronic" | "esign_platform"
      signature_status:
        | "unsigned"
        | "pending"
        | "partially_signed"
        | "fully_signed"
      social_media_platform:
        | "facebook"
        | "instagram"
        | "linkedin"
        | "twitter"
        | "youtube"
        | "tiktok"
        | "whatsapp"
        | "pinterest"
        | "snapchat"
        | "other"
      stock_reference_type:
        | "manual"
        | "grn"
        | "mrn"
        | "adjustment"
        | "transfer"
        | "project"
      stock_transaction_type:
        | "opening_stock"
        | "goods_receipt"
        | "material_issue"
        | "material_return"
        | "adjustment"
        | "transfer_in"
        | "transfer_out"
        | "project_issue"
        | "project_return"
      urgency_level: "normal" | "urgent" | "emergency"
      widget_type:
        | "kpi_card"
        | "line_chart"
        | "bar_chart"
        | "pie_chart"
        | "table"
        | "gauge"
        | "area_chart"
      workflow_stage:
        | "submitted"
        | "hod_approved"
        | "hod_rejected"
        | "procurement_approved"
        | "procurement_rejected"
        | "delivered"
        | "received"
        | "fulfilled"
        | "cancelled"
        | "purchased"
        | "returned"
        | "items_purchased"
        | "added_to_asset_list"
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
      account_category: [
        "current_asset",
        "fixed_asset",
        "other_asset",
        "current_liability",
        "long_term_liability",
        "equity",
        "retained_earnings",
        "operating_revenue",
        "other_revenue",
        "operating_expense",
        "cogs",
        "other_expense",
      ],
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      action_type: [
        "flagged",
        "blacklisted",
        "cleared",
        "escalated",
        "resolved",
        "updated",
        "reviewed",
      ],
      amendment_type: [
        "price_change",
        "quantity_change",
        "term_extension",
        "item_addition",
        "item_removal",
        "other",
      ],
      app_role: ["super_admin", "admin", "manager", "user", "supplier"],
      approval_level_type: [
        "hod",
        "manager",
        "finance",
        "procurement",
        "custom",
      ],
      asset_approval_action: ["approved", "rejected", "requested_changes"],
      asset_approval_level: ["hod", "procurement", "management"],
      asset_fulfillment_method: ["from_stock", "purchase", "transfer"],
      asset_request_item_status: [
        "pending",
        "approved",
        "rejected",
        "fulfilled",
        "partially_fulfilled",
        "delivered",
        "received",
        "purchased",
        "returned",
      ],
      asset_request_item_type: ["from_master", "new_item"],
      asset_request_priority: ["low", "medium", "high", "urgent"],
      asset_request_status: [
        "draft",
        "pending_hod_approval",
        "pending_procurement_approval",
        "approved",
        "rejected",
        "fulfilled",
        "partially_fulfilled",
        "cancelled",
        "pending_delivery",
        "pending_receipt",
        "purchased",
        "returned",
        "partially_returned",
      ],
      billing_frequency: [
        "one_time",
        "monthly",
        "quarterly",
        "annually",
        "milestone_based",
      ],
      blacklist_status: ["blacklisted", "watchlist", "cleared"],
      blanket_contract_status: [
        "draft",
        "active",
        "suspended",
        "expired",
        "closed",
        "cancelled",
      ],
      blanket_contract_type: [
        "blanket_po",
        "contract_po",
        "framework_agreement",
      ],
      bpo_release_status: [
        "draft",
        "submitted",
        "approved",
        "sent",
        "received",
        "completed",
        "cancelled",
      ],
      calculation_type: ["count", "sum", "average", "percentage", "custom_sql"],
      confidentiality_level: [
        "public",
        "internal",
        "confidential",
        "highly_confidential",
      ],
      contract_amendment_type: [
        "price_change",
        "term_extension",
        "scope_change",
        "party_change",
        "termination_clause",
        "value_adjustment",
        "obligation_change",
        "payment_terms_change",
        "other",
      ],
      contract_document_type: [
        "main_contract",
        "amendment",
        "annex",
        "supporting_document",
        "signed_copy",
        "scan",
        "certificate",
        "insurance",
        "compliance_document",
        "correspondence",
        "other",
      ],
      contract_party_type: [
        "internal",
        "external",
        "supplier",
        "customer",
        "partner",
        "guarantor",
      ],
      contract_priority: ["low", "medium", "high", "critical"],
      contract_risk_level: ["low", "medium", "high", "critical"],
      contract_status: [
        "draft",
        "pending_approval",
        "approved",
        "active",
        "suspended",
        "expired",
        "terminated",
        "renewed",
        "closed",
      ],
      contract_type: [
        "supplier_contract",
        "customer_contract",
        "service_agreement",
        "employment_contract",
        "nda",
        "lease_agreement",
        "partnership_agreement",
        "framework_agreement",
        "software_license",
        "consulting_agreement",
        "other",
      ],
      dashboard_visibility: ["private", "role_based", "company_wide"],
      delivery_status: [
        "pending_receipt",
        "partially_received",
        "fully_received",
      ],
      einvoice_compliance_profile: [
        "peppol_bis_3",
        "ksa_zatca_phase2",
        "it_sdi",
        "fr_facturx",
      ],
      einvoice_country_mandate: ["zatca", "sdi", "facturx"],
      einvoice_direction: ["outbound", "inbound"],
      einvoice_document_type: ["invoice", "credit_note", "debit_note"],
      einvoice_event_type: [
        "created",
        "updated",
        "validated",
        "submitted",
        "ack_received",
        "rejected",
        "matched",
        "posted",
        "cancelled",
      ],
      einvoice_match_status: ["unmatched", "partial", "matched", "discrepancy"],
      einvoice_status: [
        "draft",
        "validated",
        "ready_to_send",
        "sent",
        "received",
        "accepted",
        "rejected",
        "paid",
        "cancelled",
        "submission_failed",
        "delivered",
      ],
      evaluation_recommendation: [
        "strongly_recommend",
        "recommend",
        "neutral",
        "not_recommend",
        "reject",
      ],
      invitation_status: ["invited", "viewed", "declined", "submitted"],
      journal_status: ["draft", "posted", "void", "reversed"],
      journal_type: [
        "manual",
        "system_generated",
        "opening_balance",
        "closing",
        "adjusting",
        "reversing",
        "recurring",
      ],
      kpi_category: [
        "procurement",
        "warehouse",
        "finance",
        "sourcing",
        "custom",
      ],
      material_request_priority: ["low", "normal", "medium", "high", "urgent"],
      material_request_status: [
        "draft",
        "pending_hod_approval",
        "pending_management_approval",
        "approved",
        "rejected",
        "cancelled",
        "issued",
        "partially_received",
        "completed",
      ],
      mfa_policy: ["disabled", "optional", "required_admins", "required_all"],
      normal_balance: ["debit", "credit"],
      obligation_status: [
        "pending",
        "in_progress",
        "completed",
        "overdue",
        "waived",
        "disputed",
      ],
      obligation_type: [
        "deliverable",
        "milestone",
        "payment",
        "service_level",
        "compliance_requirement",
        "reporting",
        "renewal_action",
        "inspection",
      ],
      partial_piece_status: ["available", "reserved", "consumed", "scrapped"],
      peppol_environment: ["sandbox", "live"],
      period_status: ["open", "closed", "locked"],
      permission_level: ["view", "edit", "admin"],
      po_amendment_type: [
        "price_change",
        "quantity_change",
        "delivery_date_change",
        "terms_change",
        "item_addition",
        "item_removal",
        "other",
      ],
      po_status: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "sent",
        "acknowledged",
        "partially_received",
        "completed",
        "cancelled",
        "pending_dept_head_approval",
      ],
      pr_priority: ["low", "medium", "high", "urgent"],
      pr_status: [
        "draft",
        "submitted",
        "pending_approval",
        "approved",
        "rejected",
        "cancelled",
      ],
      quote_status: [
        "draft",
        "submitted",
        "under_evaluation",
        "shortlisted",
        "awarded",
        "rejected",
      ],
      renewal_type: ["auto_renewal", "manual_review", "renegotiation_required"],
      report_period_type: ["daily", "weekly", "monthly"],
      rfq_rfp_priority: ["low", "medium", "high", "urgent"],
      rfq_rfp_publish_type: ["public", "invited", "limited"],
      rfq_rfp_status: [
        "draft",
        "published",
        "in_progress",
        "evaluation",
        "awarded",
        "cancelled",
        "closed",
      ],
      rfq_rfp_type: ["rfq", "rfp"],
      risk_category: [
        "quality",
        "delivery",
        "financial",
        "compliance",
        "ethical",
        "legal",
        "operational",
        "other",
      ],
      risk_flag_status: ["active", "resolved", "under_review", "escalated"],
      risk_severity: ["low", "medium", "high", "critical"],
      signature_method: ["physical", "electronic", "esign_platform"],
      signature_status: [
        "unsigned",
        "pending",
        "partially_signed",
        "fully_signed",
      ],
      social_media_platform: [
        "facebook",
        "instagram",
        "linkedin",
        "twitter",
        "youtube",
        "tiktok",
        "whatsapp",
        "pinterest",
        "snapchat",
        "other",
      ],
      stock_reference_type: [
        "manual",
        "grn",
        "mrn",
        "adjustment",
        "transfer",
        "project",
      ],
      stock_transaction_type: [
        "opening_stock",
        "goods_receipt",
        "material_issue",
        "material_return",
        "adjustment",
        "transfer_in",
        "transfer_out",
        "project_issue",
        "project_return",
      ],
      urgency_level: ["normal", "urgent", "emergency"],
      widget_type: [
        "kpi_card",
        "line_chart",
        "bar_chart",
        "pie_chart",
        "table",
        "gauge",
        "area_chart",
      ],
      workflow_stage: [
        "submitted",
        "hod_approved",
        "hod_rejected",
        "procurement_approved",
        "procurement_rejected",
        "delivered",
        "received",
        "fulfilled",
        "cancelled",
        "purchased",
        "returned",
        "items_purchased",
        "added_to_asset_list",
      ],
    },
  },
} as const
