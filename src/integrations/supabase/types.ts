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
      asset_master: {
        Row: {
          asset_name: string
          brand: string | null
          category_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          current_value: number | null
          description: string | null
          id: string
          image_url: string | null
          purchase_price: number | null
          status: string | null
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          asset_name: string
          brand?: string | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          purchase_price?: number | null
          status?: string | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          asset_name?: string
          brand?: string | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          purchase_price?: number | null
          status?: string | null
          subcategory_id?: string | null
          updated_at?: string
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
      bill_of_materials: {
        Row: {
          bom_number: string
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          finished_good_id: string | null
          id: string
          po_id: string | null
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
          finished_good_id?: string | null
          id?: string
          po_id?: string | null
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
          finished_good_id?: string | null
          id?: string
          po_id?: string | null
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
            foreignKeyName: "bill_of_materials_finished_good_id_fkey"
            columns: ["finished_good_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
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
            foreignKeyName: "bill_of_materials_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
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
      bom_items: {
        Row: {
          bom_id: string
          category: string | null
          colour: string | null
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
          colour?: string | null
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
          colour?: string | null
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
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          modules: Json | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          modules?: Json | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          modules?: Json | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          cpo_id: string
          created_at: string
          delivery_date: string | null
          description: string | null
          finished_good_id: string | null
          id: string
          item_name: string
          quantity_ordered: number
          status: string
          total_price: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          cpo_id: string
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          finished_good_id?: string | null
          id?: string
          item_name: string
          quantity_ordered?: number
          status?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          cpo_id?: string
          created_at?: string
          delivery_date?: string | null
          description?: string | null
          finished_good_id?: string | null
          id?: string
          item_name?: string
          quantity_ordered?: number
          status?: string
          total_price?: number | null
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
          lead_time_days: number | null
          location_id: string | null
          maximum_stock: number | null
          minimum_stock: number | null
          product_code: string
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
          lead_time_days?: number | null
          location_id?: string | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          product_code: string
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
          lead_time_days?: number | null
          location_id?: string | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          product_code?: string
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
          warehouse_item_id?: string | null
        }
        Relationships: []
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
            foreignKeyName: "goods_receipt_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
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
          created_at: string
          description: string | null
          grn_id: string
          id: string
          item_code: string | null
          item_name: string
          po_item_id: string | null
          quality_status: string | null
          quantity_ordered: number | null
          quantity_received: number
          remarks: string | null
          total_cost: number | null
          unit_of_measure: string
          unit_price: number | null
          updated_at: string
          warehouse_item_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          grn_id: string
          id?: string
          item_code?: string | null
          item_name: string
          po_item_id?: string | null
          quality_status?: string | null
          quantity_ordered?: number | null
          quantity_received: number
          remarks?: string | null
          total_cost?: number | null
          unit_of_measure?: string
          unit_price?: number | null
          updated_at?: string
          warehouse_item_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          grn_id?: string
          id?: string
          item_code?: string | null
          item_name?: string
          po_item_id?: string | null
          quality_status?: string | null
          quantity_ordered?: number | null
          quantity_received?: number
          remarks?: string | null
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
          created_at: string
          description: string | null
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
          total_cost: number | null
          unit_cost: number | null
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
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
          total_cost?: number | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
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
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_issue_items_min_id_fkey"
            columns: ["min_id"]
            isOneToOne: false
            referencedRelation: "material_issue_notes"
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
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          contact_number?: string | null
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
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          company_id?: string | null
          contact_number?: string | null
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
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
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
          created_at: string
          description: string | null
          id: string
          item_code: string | null
          item_id: string
          line_number: number | null
          notes: string | null
          purpose: string | null
          quantity_approved: number | null
          quantity_requested: number
          request_id: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_code?: string | null
          item_id: string
          line_number?: number | null
          notes?: string | null
          purpose?: string | null
          quantity_approved?: number | null
          quantity_requested: number
          request_id: string
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_code?: string | null
          item_id?: string
          line_number?: number | null
          notes?: string | null
          purpose?: string | null
          quantity_approved?: number | null
          quantity_requested?: number
          request_id?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_request_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
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
          management_approval_date: string | null
          management_approved_by: string | null
          management_comments: string | null
          min_id: string | null
          notes: string | null
          priority: string
          purpose: string
          rejection_reason: string | null
          request_date: string
          request_number: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_number?: string | null
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
          management_approval_date?: string | null
          management_approved_by?: string | null
          management_comments?: string | null
          min_id?: string | null
          notes?: string | null
          priority?: string
          purpose: string
          rejection_reason?: string | null
          request_date?: string
          request_number: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_number?: string | null
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
          management_approval_date?: string | null
          management_approved_by?: string | null
          management_comments?: string | null
          min_id?: string | null
          notes?: string | null
          priority?: string
          purpose?: string
          rejection_reason?: string | null
          request_date?: string
          request_number?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
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
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_return_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
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
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "pick_lists_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_approvals: {
        Row: {
          action: Database["public"]["Enums"]["po_status"]
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          po_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["po_status"]
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          po_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["po_status"]
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
            referencedRelation: "warehouse_items"
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
            referencedRelation: "warehouse_items"
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
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          approved_by: string | null
          approved_date: string | null
          buyer_id: string | null
          company_id: string | null
          created_at: string
          created_by: string
          currency: string | null
          delivery_terms: string | null
          discount_amount: number | null
          expected_delivery_date: string | null
          final_amount: number | null
          id: string
          notes: string | null
          payment_terms: string | null
          po_date: string
          po_number: string
          pr_id: string | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          approved_by?: string | null
          approved_date?: string | null
          buyer_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          delivery_terms?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          final_amount?: number | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          po_date?: string
          po_number: string
          pr_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          approved_by?: string | null
          approved_date?: string | null
          buyer_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          delivery_terms?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          final_amount?: number | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          po_date?: string
          po_number?: string
          pr_id?: string | null
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
            referencedRelation: "warehouse_items"
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
            referencedRelation: "warehouse_items"
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
        ]
      }
      stock_transactions: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_id: string | null
          reference_type: Database["public"]["Enums"]["stock_reference_type"]
          total_value: number | null
          transaction_type: Database["public"]["Enums"]["stock_transaction_type"]
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change: number
          reference_id?: string | null
          reference_type: Database["public"]["Enums"]["stock_reference_type"]
          total_value?: number | null
          transaction_type: Database["public"]["Enums"]["stock_transaction_type"]
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change?: number
          reference_id?: string | null
          reference_type?: Database["public"]["Enums"]["stock_reference_type"]
          total_value?: number | null
          transaction_type?: Database["public"]["Enums"]["stock_transaction_type"]
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "warehouse_items"
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
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          registration_request_id: string
          stage: string
          status: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          registration_request_id: string
          stage: string
          status?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          registration_request_id?: string
          stage?: string
          status?: string
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
            referencedRelation: "warehouse_items"
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
            referencedRelation: "warehouse_items"
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
            referencedRelation: "warehouse_items"
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
      warehouse_assets: {
        Row: {
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
          description: string | null
          id: string
          location_id: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: string
          subcategory_id: string | null
          sublocation_id: string | null
          updated_at: string
        }
        Insert: {
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
          description?: string | null
          id?: string
          location_id?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string
          subcategory_id?: string | null
          sublocation_id?: string | null
          updated_at?: string
        }
        Update: {
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
          description?: string | null
          id?: string
          location_id?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string
          subcategory_id?: string | null
          sublocation_id?: string | null
          updated_at?: string
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
          location_id: string | null
          name: string
          notes: string | null
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
          location_id?: string | null
          name: string
          notes?: string | null
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
          location_id?: string | null
          name?: string
          notes?: string | null
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
        ]
      }
      warehouse_items: {
        Row: {
          barcode: string | null
          brand: string | null
          category_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          current_stock: number | null
          description: string | null
          id: string
          is_batch_tracked: boolean | null
          is_serialized: boolean | null
          item_code: string
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
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          description?: string | null
          id?: string
          is_batch_tracked?: boolean | null
          is_serialized?: boolean | null
          item_code: string
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
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          description?: string | null
          id?: string
          is_batch_tracked?: boolean | null
          is_serialized?: boolean | null
          item_code?: string
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
            foreignKeyName: "warehouse_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "item_units"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locations: {
        Row: {
          capacity: number | null
          company_id: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          current_usage: number | null
          description: string | null
          id: string
          location_code: string | null
          name: string
          parent_id: string | null
          physical_address: string | null
          status: string | null
          type: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          company_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          current_usage?: number | null
          description?: string | null
          id?: string
          location_code?: string | null
          name: string
          parent_id?: string | null
          physical_address?: string | null
          status?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          company_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          current_usage?: number | null
          description?: string | null
          id?: string
          location_code?: string | null
          name?: string
          parent_id?: string | null
          physical_address?: string | null
          status?: string | null
          type?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_admin: {
        Args: { _role_name?: string; _user_id: string }
        Returns: undefined
      }
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
      generate_asset_id: {
        Args: {
          _brand?: string
          _category_id: string
          _subcategory_id?: string
        }
        Returns: string
      }
      generate_bom_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_cpo_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_customer_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_cycle_count_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_evaluation_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_grn_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_min_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_mr_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_mrn_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_pick_list_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_po_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_pr_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_putaway_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_quote_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_rfp_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_rfq_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_sales_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_supplier_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_transfer_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_public_asset: {
        Args: { p_id: string }
        Returns: Json
      }
      get_user_company_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _app_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "manager" | "user"
      evaluation_recommendation:
        | "strongly_recommend"
        | "recommend"
        | "neutral"
        | "not_recommend"
        | "reject"
      invitation_status: "invited" | "viewed" | "declined" | "submitted"
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
      stock_reference_type: "manual" | "grn" | "mrn" | "adjustment" | "transfer"
      stock_transaction_type:
        | "opening_stock"
        | "goods_receipt"
        | "material_issue"
        | "material_return"
        | "adjustment"
        | "transfer_in"
        | "transfer_out"
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
      app_role: ["super_admin", "admin", "manager", "user"],
      evaluation_recommendation: [
        "strongly_recommend",
        "recommend",
        "neutral",
        "not_recommend",
        "reject",
      ],
      invitation_status: ["invited", "viewed", "declined", "submitted"],
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
      stock_reference_type: ["manual", "grn", "mrn", "adjustment", "transfer"],
      stock_transaction_type: [
        "opening_stock",
        "goods_receipt",
        "material_issue",
        "material_return",
        "adjustment",
        "transfer_in",
        "transfer_out",
      ],
    },
  },
} as const
