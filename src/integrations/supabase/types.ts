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
          id: string
          po_id: string | null
          product_name: string
          status: string
          style_no: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          bom_number: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          po_id?: string | null
          product_name: string
          status?: string
          style_no?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          bom_number?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          po_id?: string | null
          product_name?: string
          status?: string
          style_no?: string | null
          updated_at?: string
          version?: string | null
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
          id: string
          item_id: string
          min_id: string
          notes: string | null
          quantity_issued: number
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          min_id: string
          notes?: string | null
          quantity_issued: number
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          min_id?: string
          notes?: string | null
          quantity_issued?: number
          total_cost?: number | null
          unit_cost?: number | null
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
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          issue_date: string
          issued_to: string
          min_number: string
          notes: string | null
          purpose: string | null
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
          department?: string | null
          id?: string
          issue_date?: string
          issued_to: string
          min_number: string
          notes?: string | null
          purpose?: string | null
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
          department?: string | null
          id?: string
          issue_date?: string
          issued_to?: string
          min_number?: string
          notes?: string | null
          purpose?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: []
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
          status: string
          supplier_id: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          approved_by?: string | null
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
          status?: string
          supplier_id: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          approved_by?: string | null
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
          status?: string
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
            foreignKeyName: "purchase_requisitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      suppliers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          category: string | null
          city: string | null
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
        Relationships: []
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
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          type: string
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
          type: string
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
      generate_grn_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_min_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_mrn_number: {
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
      generate_supplier_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_public_asset: {
        Args: { p_id: string }
        Returns: Json
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
      pr_priority: "low" | "medium" | "high" | "urgent"
      pr_status:
        | "draft"
        | "submitted"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "cancelled"
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
      pr_priority: ["low", "medium", "high", "urgent"],
      pr_status: [
        "draft",
        "submitted",
        "pending_approval",
        "approved",
        "rejected",
        "cancelled",
      ],
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
