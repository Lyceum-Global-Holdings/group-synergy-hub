import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedApproval, ApprovalFilters, ApprovalPriority } from "@/types/approval";
import { differenceInDays, startOfDay } from "date-fns";

export function useApprovalConsole(filters?: ApprovalFilters) {
  return useQuery({
    queryKey: ['approval-console', filters],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const approvals: UnifiedApproval[] = [];
      
      // Fetch all approval types in parallel
      const [
        supplierApprovals,
        poApprovals,
        prApprovals,
        cpoApprovals,
        productionApprovals,
        assetApprovals,
        materialRequests,
        stockTransfers,
        grnRecords,
      ] = await Promise.all([
        fetchSupplierApprovals(user.id),
        fetchPOApprovals(user.id),
        fetchPRApprovals(user.id),
        fetchCPOApprovals(user.id),
        fetchProductionApprovals(user.id),
        fetchAssetApprovals(user.id),
        fetchMaterialRequestApprovals(user.id),
        fetchStockTransferApprovals(user.id),
        fetchGRNApprovals(user.id),
      ]);
      
      // Normalize and combine all approvals
      approvals.push(
        ...normalizeSupplierApprovals(supplierApprovals),
        ...normalizePOApprovals(poApprovals),
        ...normalizePRApprovals(prApprovals),
        ...normalizeCPOApprovals(cpoApprovals),
        ...normalizeProductionApprovals(productionApprovals),
        ...normalizeAssetApprovals(assetApprovals),
        ...normalizeMaterialRequestApprovals(materialRequests),
        ...normalizeStockTransferApprovals(stockTransfers),
        ...normalizeGRNApprovals(grnRecords),
      );
      
      // Apply filters
      let filtered = approvals;
      
      if (filters?.type) {
        filtered = filtered.filter(a => a.type === filters.type);
      }
      
      if (filters?.priority) {
        filtered = filtered.filter(a => a.priority === filters.priority);
      }
      
      if (filters?.status) {
        filtered = filtered.filter(a => a.status === filters.status);
      }
      
      if (filters?.overdue) {
        filtered = filtered.filter(a => a.is_overdue);
      }
      
      if (filters?.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        filtered = filtered.filter(a => 
          a.title.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query)
        );
      }
      
      // Sort by priority and age
      filtered.sort((a, b) => {
        const priorityWeight: Record<ApprovalPriority, number> = { 
          urgent: 4, high: 3, medium: 2, low: 1 
        };
        const aPriority = priorityWeight[a.priority];
        const bPriority = priorityWeight[b.priority];
        
        if (aPriority !== bPriority) return bPriority - aPriority;
        return b.age_days - a.age_days;
      });
      
      return filtered;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Helper functions to fetch different approval types
async function fetchSupplierApprovals(userId: string) {
  try {
    const { data, error } = await supabase
      .from('supplier_approval_workflow')
      .select(`
        *,
        supplier_registration_requests!registration_request_id(
          id,
          supplier_data
        )
      `)
      .eq('status', 'pending')
      .eq('assigned_to', userId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching supplier approvals:', error);
    return [];
  }
}

async function fetchPOApprovals(userId: string) {
  try {
    const { data: pending, error: error1 } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers(supplier_name),
        created_by_profile:profiles!created_by(full_name)
      `)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });
    
    const { data: deptHead, error: error2 } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers(supplier_name),
        created_by_profile:profiles!created_by(full_name)
      `)
      .eq('status', 'pending_dept_head_approval')
      .order('created_at', { ascending: false });
    
    if (error1) console.error('Error fetching pending POs:', error1);
    if (error2) console.error('Error fetching dept head POs:', error2);
    
    return [...(pending || []), ...(deptHead || [])];
  } catch (error) {
    console.error('Error fetching PO approvals:', error);
    return [];
  }
}

async function fetchPRApprovals(userId: string) {
  try {
    const { data, error } = await supabase
      .from('purchase_requisitions')
      .select(`
        *,
        items:pr_items(*),
        requested_by_profile:profiles!requested_by(full_name)
      `)
      .in('status', ['submitted', 'pending_approval'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching PR approvals:', error);
    return [];
  }
}

async function fetchCPOApprovals(userId: string) {
  try {
    const { data, error } = await supabase
      .from('customer_purchase_orders')
      .select(`
        *,
        customer:customers(customer_name),
        created_by_profile:profiles!created_by(full_name)
      `)
      .eq('pending_approval', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching CPO approvals:', error);
    return [];
  }
}

async function fetchProductionApprovals(userId: string) {
  try {
    const { data, error } = await supabase
      .from('finished_goods_batches')
      .select(`
        *,
        finished_goods!finished_good_id(item_name, sku),
        created_by_profile:profiles!created_by(full_name)
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching production approvals:', error);
    return [];
  }
}

async function fetchAssetApprovals(userId: string) {
  try {
    const { data, error } = await supabase
      .from('asset_requests')
      .select(`
        *,
        requested_by_profile:profiles!requested_by(full_name)
      `)
      .in('status', ['pending_hod_approval', 'pending_procurement_approval'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching asset approvals:', error);
    return [];
  }
}

async function fetchMaterialRequestApprovals(userId: string) {
  try {
    const { data, error } = await supabase
      .from('material_requests')
      .select(`
        *,
        items:material_request_items(*),
        created_by_profile:profiles!created_by(full_name)
      `)
      .in('status', ['pending_hod_approval', 'pending_management_approval'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching material request approvals:', error);
    return [];
  }
}

async function fetchStockTransferApprovals(userId: string) {
  // Stock transfers table doesn't exist yet
  return [];
}

async function fetchGRNApprovals(userId: string) {
  try {
    const { data, error } = await supabase
      .from('goods_receipt_notes')
      .select(`
        *,
        purchase_order:purchase_orders(po_number, supplier:suppliers(supplier_name)),
        created_by_profile:profiles!created_by(full_name)
      `)
      .eq('status', 'submitted')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching GRN approvals:', error);
    return [];
  }
}

// Normalization functions
function normalizeSupplierApprovals(data: any[]): UnifiedApproval[] {
  return data.map(item => {
    const ageDays = differenceInDays(new Date(), new Date(item.created_at));
    const supplierData = item.supplier_registration_requests?.supplier_data || {};
    const companyName = supplierData.company_name || supplierData.companyName || 'Unknown';
    const businessNature = supplierData.business_nature || supplierData.businessNature || 'Supplier registration approval';
    const estimatedBusiness = supplierData.estimated_annual_business || supplierData.estimatedAnnualBusiness || 0;
    
    return {
      id: item.id,
      type: 'supplier_registration' as const,
      title: `Supplier: ${companyName}`,
      description: businessNature,
      priority: estimatedBusiness > 500000 ? 'high' : estimatedBusiness > 100000 ? 'medium' : 'low',
      status: 'pending' as const,
      assigned_to: item.assigned_to,
      assigned_to_name: item.assigned_to_name || 'Unknown',
      stage: item.stage_name,
      stage_order: item.stage_order,
      created_at: item.created_at,
      age_days: ageDays,
      sla_deadline: null,
      is_overdue: ageDays > 5,
      amount: estimatedBusiness,
      currency: 'USD',
      entity_id: item.registration_request_id,
      entity_data: item,
      can_approve: true,
      can_reject: true,
      can_request_info: true,
      requires_comments: false,
      view_url: '/sourcing/supplier-registration',
    };
  });
}

function normalizePOApprovals(data: any[]): UnifiedApproval[] {
  return data.map(item => {
    const ageDays = differenceInDays(new Date(), new Date(item.created_at));
    
    return {
      id: item.id,
      type: 'purchase_order' as const,
      title: `PO-${item.po_number}`,
      description: `Purchase Order from ${item.suppliers?.supplier_name || 'Unknown'}`,
      priority: item.final_amount > 100000 ? 'urgent' : item.final_amount > 50000 ? 'high' : 'medium',
      status: 'pending' as const,
      assigned_to: item.created_by,
      assigned_to_name: item.created_by_profile?.full_name || 'Unknown',
      stage: item.status === 'pending_approval' ? 'Merchandiser' : 'Department Head',
      stage_order: item.approval_level || 1,
      created_at: item.created_at,
      age_days: ageDays,
      sla_deadline: null,
      is_overdue: ageDays > 3,
      amount: item.final_amount,
      currency: item.currency || 'USD',
      entity_id: item.id,
      entity_data: item,
      can_approve: true,
      can_reject: true,
      can_request_info: false,
      requires_comments: true,
      view_url: '/procurement/purchase-order',
    };
  });
}

function normalizePRApprovals(data: any[]): UnifiedApproval[] {
  return data.map(item => {
    const ageDays = differenceInDays(new Date(), new Date(item.created_at));
    
    return {
      id: item.id,
      type: 'purchase_requisition' as const,
      title: `PR-${item.pr_number}`,
      description: `${item.title || 'Purchase Requisition'} - ${item.department || 'Unknown Dept'}`,
      priority: item.total_estimated_amount > 50000 ? 'high' : 'medium',
      status: 'pending' as const,
      assigned_to: item.requested_by,
      assigned_to_name: item.requested_by_profile?.full_name || 'Unknown',
      stage: 'Approval',
      stage_order: 1,
      created_at: item.created_at,
      age_days: ageDays,
      sla_deadline: null,
      is_overdue: ageDays > 2,
      amount: item.total_estimated_amount,
      currency: 'USD',
      entity_id: item.id,
      entity_data: item,
      can_approve: true,
      can_reject: true,
      can_request_info: false,
      requires_comments: false,
      view_url: '/procurement/purchase-requisition',
    };
  });
}

function normalizeCPOApprovals(data: any[]): UnifiedApproval[] {
  return data.map(item => {
    const ageDays = differenceInDays(new Date(), new Date(item.created_at));
    
    return {
      id: item.id,
      type: 'customer_po' as const,
      title: `CPO-${item.cpo_number}`,
      description: `Customer PO - ${item.customer?.customer_name || 'Unknown'}`,
      priority: item.total_value > 100000 ? 'high' : 'medium',
      status: 'pending' as const,
      assigned_to: item.created_by,
      assigned_to_name: item.created_by_profile?.full_name || 'Unknown',
      stage: 'Approval',
      stage_order: 1,
      created_at: item.created_at,
      age_days: ageDays,
      sla_deadline: null,
      is_overdue: ageDays > 2,
      amount: item.total_value,
      currency: item.currency || 'USD',
      entity_id: item.id,
      entity_data: item,
      can_approve: true,
      can_reject: true,
      can_request_info: false,
      requires_comments: false,
      view_url: '/tuh-modules/customer-po',
    };
  });
}

function normalizeProductionApprovals(data: any[]): UnifiedApproval[] {
  return data.map(item => {
    const ageDays = differenceInDays(new Date(), new Date(item.created_at));
    
    return {
      id: item.id,
      type: 'production_receipt' as const,
      title: `Batch-${item.batch_number}`,
      description: `Production Receipt - ${item.finished_goods?.item_name || 'Unknown Item'}`,
      priority: 'medium' as const,
      status: 'pending' as const,
      assigned_to: item.created_by,
      assigned_to_name: item.created_by_profile?.full_name || 'Unknown',
      stage: 'QC Approval',
      stage_order: 1,
      created_at: item.created_at,
      age_days: ageDays,
      sla_deadline: null,
      is_overdue: ageDays > 1,
      amount: null,
      currency: null,
      entity_id: item.id,
      entity_data: item,
      can_approve: true,
      can_reject: true,
      can_request_info: false,
      requires_comments: true,
      view_url: '/tuh-modules/finished-goods',
    };
  });
}

function normalizeAssetApprovals(data: any[]): UnifiedApproval[] {
  return data.map(item => {
    const ageDays = differenceInDays(new Date(), new Date(item.created_at));
    
    return {
      id: item.id,
      type: 'asset_request' as const,
      title: `Asset Request - ${item.request_number}`,
      description: `${item.purpose || 'Asset request'} - ${item.department || 'Unknown Dept'}`,
      priority: item.total_estimated_cost > 50000 ? 'high' : 'medium',
      status: 'pending' as const,
      assigned_to: item.requested_by,
      assigned_to_name: item.requested_by_profile?.full_name || 'Unknown',
      stage: item.status === 'pending_hod_approval' ? 'HOD Approval' : 'Procurement Approval',
      stage_order: item.status === 'pending_hod_approval' ? 1 : 2,
      created_at: item.created_at,
      age_days: ageDays,
      sla_deadline: null,
      is_overdue: ageDays > 2,
      amount: item.total_estimated_cost,
      currency: 'USD',
      entity_id: item.id,
      entity_data: item,
      can_approve: true,
      can_reject: true,
      can_request_info: false,
      requires_comments: false,
      view_url: '/warehouse/asset-management',
    };
  });
}

function normalizeMaterialRequestApprovals(data: any[]): UnifiedApproval[] {
  return data.map(item => {
    const ageDays = differenceInDays(new Date(), new Date(item.created_at));
    
    return {
      id: item.id,
      type: 'material_request' as const,
      title: `MR-${item.request_number}`,
      description: `Material Request from ${item.department || 'Unknown Dept'}`,
      priority: 'medium' as const,
      status: 'pending' as const,
      assigned_to: item.created_by,
      assigned_to_name: item.created_by_profile?.full_name || 'Unknown',
      stage: item.status === 'pending_hod_approval' ? 'HOD' : 'Management',
      stage_order: item.status === 'pending_hod_approval' ? 1 : 2,
      created_at: item.created_at,
      age_days: ageDays,
      sla_deadline: null,
      is_overdue: ageDays > 1,
      amount: null,
      currency: null,
      entity_id: item.id,
      entity_data: item,
      can_approve: true,
      can_reject: true,
      can_request_info: false,
      requires_comments: false,
      view_url: '/warehouse/material-issue',
    };
  });
}

function normalizeStockTransferApprovals(data: any[]): UnifiedApproval[] {
  return data.map(item => {
    const ageDays = differenceInDays(new Date(), new Date(item.created_at));
    
    return {
      id: item.id,
      type: 'stock_transfer' as const,
      title: `ST-${item.transfer_number}`,
      description: `Stock Transfer`,
      priority: 'low' as const,
      status: 'pending' as const,
      assigned_to: item.created_by,
      assigned_to_name: item.profiles?.full_name || 'Unknown',
      stage: 'Approval',
      stage_order: 1,
      created_at: item.created_at,
      age_days: ageDays,
      sla_deadline: null,
      is_overdue: ageDays > 2,
      amount: null,
      currency: null,
      entity_id: item.id,
      entity_data: item,
      can_approve: true,
      can_reject: true,
      can_request_info: false,
      requires_comments: false,
      view_url: '/warehouse/stock-transfer',
    };
  });
}

function normalizeGRNApprovals(data: any[]): UnifiedApproval[] {
  return data.map(item => {
    const ageDays = differenceInDays(new Date(), new Date(item.created_at));
    
    return {
      id: item.id,
      type: 'grn' as const,
      title: `GRN-${item.grn_number}`,
      description: `Goods Receipt for ${item.purchase_order?.po_number || 'PO'} from ${item.purchase_order?.supplier?.supplier_name || 'Supplier'}`,
      priority: 'medium' as const,
      status: 'pending' as const,
      assigned_to: item.created_by,
      assigned_to_name: item.created_by_profile?.full_name || 'Unknown',
      stage: 'Verification',
      stage_order: 1,
      created_at: item.created_at,
      age_days: ageDays,
      sla_deadline: null,
      is_overdue: ageDays > 1,
      amount: null,
      currency: null,
      entity_id: item.id,
      entity_data: item,
      can_approve: true,
      can_reject: true,
      can_request_info: false,
      requires_comments: true,
      view_url: '/warehouse/goods-receipt-note',
    };
  });
}
