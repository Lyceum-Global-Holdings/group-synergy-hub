import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AssetRequest, AssetRequestItem, AssetRequestWithItems } from "@/types/assetRequest";

export const useAssetRequests = () => {
  const queryClient = useQueryClient();

  // Fetch all requests
  const { data: requests, isLoading, error } = useQuery({
    queryKey: ["asset-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_requests")
        .select(`
          *,
          asset_request_items (*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AssetRequestWithItems[];
    },
  });

  // Create request
  const createRequestMutation = useMutation({
    mutationFn: async (values: {
      request: Partial<AssetRequest>;
      items: Partial<AssetRequestItem>[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You must be signed in to create a request");

      let companyId = (values.request as any).company_id as string | undefined;
      if (!companyId) {
        const { data: accessRows } = await supabase
          .from("user_company_access")
          .select("company_id")
          .eq("user_id", userId)
          .limit(1);
        companyId = accessRows?.[0]?.company_id;
      }
      if (!companyId) throw new Error("No company assigned to your account");


      const payload = {
        ...values.request,
        company_id: companyId,
        created_by: userId,
      };

      const { data: requestData, error: requestError } = await supabase
        .from("asset_requests")
        .insert([payload as any])
        .select()
        .single();

      if (requestError) throw requestError;


      if (values.items.length > 0) {
        const itemsWithRequestId = values.items.map((item, index) => ({
          ...item,
          request_id: requestData.id,
          line_number: index + 1,
        }));

        const { error: itemsError } = await supabase
          .from("asset_request_items")
          .insert(itemsWithRequestId as any);

        if (itemsError) throw itemsError;
      }

      return requestData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      toast.success("Request created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create request: ${error.message}`);
    },
  });

  // Update request
  const updateRequestMutation = useMutation({
    mutationFn: async (values: {
      id: string;
      request: Partial<AssetRequest>;
      items?: Partial<AssetRequestItem>[];
    }) => {
      const { error: requestError } = await supabase
        .from("asset_requests")
        .update(values.request)
        .eq("id", values.id);

      if (requestError) throw requestError;

      if (values.items) {
        // Delete existing items
        await supabase
          .from("asset_request_items")
          .delete()
          .eq("request_id", values.id);

        // Insert new items
        const itemsWithRequestId = values.items.map((item, index) => ({
          ...item,
          request_id: values.id,
          line_number: index + 1,
        }));

        const { error: itemsError } = await supabase
          .from("asset_request_items")
          .insert(itemsWithRequestId as any);

        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      toast.success("Request updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update request: ${error.message}`);
    },
  });

  // Submit for HOD approval
  const submitForApprovalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("asset_requests")
        .update({ status: "pending_hod_approval" })
        .eq("id", id);

      if (error) throw error;

      // Create workflow history
      await supabase.from("asset_request_workflow_history").insert({
        request_id: id,
        workflow_stage: "submitted",
        performed_by: (await supabase.auth.getUser()).data.user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      toast.success("Request submitted for HOD approval");
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit request: ${error.message}`);
    },
  });

  // HOD Approve
  const hodApproveMutation = useMutation({
    mutationFn: async (values: {
      id: string;
      comments?: string;
      itemApprovals: { item_id: string; quantity_approved: number }[];
    }) => {
      const user = (await supabase.auth.getUser()).data.user;

      // Update request
      const { error: requestError } = await supabase
        .from("asset_requests")
        .update({
          status: "approved",
          hod_approved_by: user?.id,
          hod_approval_date: new Date().toISOString(),
          hod_comments: values.comments,
        })
        .eq("id", values.id);

      if (requestError) throw requestError;

      // Update item quantities
      for (const approval of values.itemApprovals) {
        const { error: itemError } = await supabase
          .from("asset_request_items")
          .update({
            quantity_approved: approval.quantity_approved,
            status: approval.quantity_approved > 0 ? "approved" : "rejected",
          })
          .eq("id", approval.item_id);

        if (itemError) throw itemError;
      }

      // Create workflow history
      await supabase.from("asset_request_workflow_history").insert({
        request_id: values.id,
        workflow_stage: "hod_approved",
        performed_by: user?.id,
        comments: values.comments,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      toast.success("Request approved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve request: ${error.message}`);
    },
  });

  // HOD Reject
  const hodRejectMutation = useMutation({
    mutationFn: async (values: { id: string; reason: string }) => {
      const user = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase
        .from("asset_requests")
        .update({
          status: "rejected",
          rejection_reason: values.reason,
          hod_approved_by: user?.id,
          hod_approval_date: new Date().toISOString(),
        })
        .eq("id", values.id);

      if (error) throw error;

      // Create workflow history
      await supabase.from("asset_request_workflow_history").insert({
        request_id: values.id,
        workflow_stage: "hod_rejected",
        performed_by: user?.id,
        comments: values.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      toast.success("Request rejected");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject request: ${error.message}`);
    },
  });

  // Confirm Purchase
  const confirmPurchaseMutation = useMutation({
    mutationFn: async (values: {
      id: string;
      purchased_date: string;
      purchase_notes?: string;
      itemPurchases: { item_id: string; quantity: number; unit_price?: number }[];
    }) => {
      const user = (await supabase.auth.getUser()).data.user;

      // Get request details
      const { data: request, error: requestFetchError } = await supabase
        .from("asset_requests")
        .select("*, asset_request_items(*)")
        .eq("id", values.id)
        .single();

      if (requestFetchError) throw requestFetchError;

      // Resolve warehouse location: prefer company's main, else fall back to any active warehouse for the company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("main_warehouse_location_id")
        .eq("id", request.company_id)
        .single();

      if (companyError) throw companyError;

      let warehouseLocationId: string | null = company?.main_warehouse_location_id ?? null;
      if (!warehouseLocationId) {
        const { data: fallbackLoc } = await supabase
          .from("warehouse_locations")
          .select("id")
          .eq("company_id", request.company_id)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        warehouseLocationId = fallbackLoc?.id ?? null;
      }

      if (!warehouseLocationId) {
        throw new Error("No warehouse location found for this company. Please create a warehouse location first.");
      }

      // Update request status to purchased
      const { error: requestError } = await supabase
        .from("asset_requests")
        .update({
          status: "pending_delivery",
          purchased_by: user?.id,
          purchased_date: values.purchased_date,
          purchase_notes: values.purchase_notes,
        })
        .eq("id", values.id);

      if (requestError) throw requestError;

      // Update item quantities and prices
      for (const purchase of values.itemPurchases) {
        const updateData: any = {
          quantity_fulfilled: purchase.quantity,
        };
        if (purchase.unit_price !== undefined) {
          updateData.unit_price_estimate = purchase.unit_price;
          updateData.total_price_estimate = purchase.unit_price * purchase.quantity;
        }

        const { error: itemError } = await supabase
          .from("asset_request_items")
          .update(updateData)
          .eq("id", purchase.item_id);

        if (itemError) throw itemError;
      }

      // Create warehouse assets for each fulfilled item
      for (const purchase of values.itemPurchases) {
        if (purchase.quantity > 0) {
          // Find the corresponding item from the request
          const item = request.asset_request_items.find((i: any) => i.id === purchase.item_id);
          
          if (item) {
            // Create individual asset records for each quantity
            for (let i = 0; i < purchase.quantity; i++) {
              const { error: assetError } = await supabase
                .from("warehouse_assets")
                .insert({
                  name: item.item_name,
                  category: item.item_name,
                  brand: item.brand,
                  description: item.item_description,
                  specifications: item.specifications,
                  category_id: item.category_id,
                  subcategory_id: item.subcategory_id,
                  location_id: warehouseLocationId,
                  department_id: null, // Not assigned to department yet
                  status: "active",
                  condition: "good",
                  purchase_price: purchase.unit_price || item.unit_price_estimate,
                  current_value: purchase.unit_price || item.unit_price_estimate,
                  purchase_date: values.purchased_date,
                  company_id: request.company_id,
                  asset_master_id: item.asset_master_id,
                  notes: `From request ${request.request_number}${values.purchase_notes ? ' - ' + values.purchase_notes : ''}`,
                  created_by: user?.id,
                });

              if (assetError) throw assetError;
            }
          }
        }
      }

      // Create workflow history for purchase
      await supabase.from("asset_request_workflow_history").insert({
        request_id: values.id,
        workflow_stage: "items_purchased",
        performed_by: user?.id,
        comments: values.purchase_notes,
      });

      // Create workflow history for adding to asset list
      await supabase.from("asset_request_workflow_history").insert({
        request_id: values.id,
        workflow_stage: "added_to_asset_list",
        performed_by: user?.id,
        comments: "Assets automatically added to main warehouse",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-assets"] });
      toast.success("Purchase confirmed and assets added to warehouse");
    },
    onError: (error: Error) => {
      toast.error(`Failed to confirm purchase: ${error.message}`);
    },
  });

  // Add to Asset List
  const addToAssetListMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const user = (await supabase.auth.getUser()).data.user;

      // Get request details
      const { data: request, error: requestFetchError } = await supabase
        .from("asset_requests")
        .select("*, asset_request_items(*)")
        .eq("id", requestId)
        .single();

      if (requestFetchError) throw requestFetchError;

      // Get company's main warehouse
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("main_warehouse_location_id")
        .eq("id", request.company_id)
        .single();

      if (companyError) throw companyError;

      if (!company.main_warehouse_location_id) {
        throw new Error("Main warehouse not configured for this company");
      }

      // Create warehouse assets for each item
      for (const item of request.asset_request_items) {
        if (item.quantity_fulfilled && item.quantity_fulfilled > 0) {
          const { error: assetError } = await supabase
            .from("warehouse_assets")
            .insert({
              name: item.item_name,
              category: item.item_name,
              brand: item.brand,
              description: item.item_description,
              specifications: item.specifications,
              category_id: item.category_id,
              subcategory_id: item.subcategory_id,
              location_id: company.main_warehouse_location_id,
              department_id: null, // Not assigned to department yet
              status: "active",
              quantity: item.quantity_fulfilled,
              purchase_price: item.unit_price_estimate,
              purchase_date: request.purchased_date,
              company_id: request.company_id,
              source_request_id: request.id,
              source_request_number: request.request_number,
              created_by: user?.id,
            });

          if (assetError) throw assetError;
        }
      }

      // Update request status
      const { error: updateError } = await supabase
        .from("asset_requests")
        .update({ status: "pending_delivery" })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // Create workflow history
      await supabase.from("asset_request_workflow_history").insert({
        request_id: requestId,
        workflow_stage: "added_to_asset_list",
        performed_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-assets"] });
      toast.success("Assets added to warehouse");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add assets: ${error.message}`);
    },
  });

  // Mark as Delivered
  const markAsDeliveredMutation = useMutation({
    mutationFn: async (values: { id: string; notes?: string }) => {
      const user = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase
        .from("asset_requests")
        .update({ status: "pending_receipt" })
        .eq("id", values.id);

      if (error) throw error;

      // Create workflow history
      await supabase.from("asset_request_workflow_history").insert({
        request_id: values.id,
        workflow_stage: "delivered",
        performed_by: user?.id,
        comments: values.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      toast.success("Marked as delivered");
    },
    onError: (error: Error) => {
      toast.error(`Failed to mark as delivered: ${error.message}`);
    },
  });

  // Confirm Receipt (with auto-transfer to department)
  const confirmReceiptMutation = useMutation({
    mutationFn: async (values: { id: string; notes?: string }) => {
      const user = (await supabase.auth.getUser()).data.user;

      // Get request details
      const { data: request, error: requestError } = await supabase
        .from("asset_requests")
        .select("*")
        .eq("id", values.id)
        .single();

      if (requestError) throw requestError;

      // Update request status to fulfilled (since we're accepting receipt)
      const { error: updateError } = await supabase
        .from("asset_requests")
        .update({ status: "fulfilled" })
        .eq("id", values.id);

      if (updateError) throw updateError;

      // Get all assets created from this request
      const { data: assets, error: assetsError } = await supabase
        .from("warehouse_assets")
        .select("*")
        .eq("source_request_id", values.id);

      if (assetsError) throw assetsError;

      // Transfer each asset to the requesting department
      if (assets && request.department_id) {
        for (const asset of assets) {
          // Update asset
          const { error: assetUpdateError } = await supabase
            .from("warehouse_assets")
            .update({ department_id: request.department_id })
            .eq("id", asset.id);

          if (assetUpdateError) throw assetUpdateError;

          // Create transfer record
          await supabase.from("asset_transfers").insert({
            asset_id: asset.id,
            from_location_id: asset.location_id,
            to_location_id: asset.location_id,
            from_department_id: null,
            to_department_id: request.department_id,
            transfer_date: new Date().toISOString(),
            transfer_reason: `Asset request fulfillment: ${request.request_number}`,
            transferred_by: user?.id,
            notes: values.notes,
          });
        }
      }

      // Create workflow history
      await supabase.from("asset_request_workflow_history").insert({
        request_id: values.id,
        workflow_stage: "received",
        performed_by: user?.id,
        comments: values.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-assets"] });
      toast.success("Receipt confirmed and assets transferred to your department");
    },
    onError: (error: Error) => {
      toast.error(`Failed to confirm receipt: ${error.message}`);
    },
  });

  // Accept Request
  const acceptRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const user = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase
        .from("asset_requests")
        .update({
          status: "fulfilled",
          fulfilled_by: user?.id,
          fulfilled_date: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      // Create workflow history
      await supabase.from("asset_request_workflow_history").insert({
        request_id: id,
        workflow_stage: "fulfilled",
        performed_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      toast.success("Request accepted and fulfilled");
    },
    onError: (error: Error) => {
      toast.error(`Failed to accept request: ${error.message}`);
    },
  });

  // Create Return
  const createReturnMutation = useMutation({
    mutationFn: async (values: {
      request_id: string;
      delivery_id: string | null;
      items: { item_id: string; quantity: number; reason: string }[];
      notes?: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase.from("asset_request_returns").insert({
        request_id: values.request_id,
        delivery_id: values.delivery_id,
        items: values.items,
        return_reason: values.items[0]?.reason || "Return requested",
        return_notes: values.notes,
        returned_by: user?.id,
        company_id: (await supabase.auth.getUser()).data.user?.user_metadata?.company_id,
      });

      if (error) throw error;

      // Update request status
      const totalReturned = values.items.reduce((sum, item) => sum + item.quantity, 0);
      // You can add logic to determine if it's partial or full return
      await supabase
        .from("asset_requests")
        .update({ status: "returned" })
        .eq("id", values.request_id);

      // Create workflow history
      await supabase.from("asset_request_workflow_history").insert({
        request_id: values.request_id,
        workflow_stage: "returned",
        performed_by: user?.id,
        comments: values.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      toast.success("Return request created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create return: ${error.message}`);
    },
  });

  // Delete Request
  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete items first
      await supabase.from("asset_request_items").delete().eq("request_id", id);

      // Delete request
      const { error } = await supabase.from("asset_requests").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-requests"] });
      toast.success("Request deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete request: ${error.message}`);
    },
  });

  return {
    requests,
    isLoading,
    error,
    createRequest: createRequestMutation.mutate,
    createRequestAsync: createRequestMutation.mutateAsync,
    isCreating: createRequestMutation.isPending,
    updateRequest: updateRequestMutation.mutate,
    updateRequestAsync: updateRequestMutation.mutateAsync,
    isUpdating: updateRequestMutation.isPending,
    submitForApproval: submitForApprovalMutation.mutate,
    submitForApprovalAsync: submitForApprovalMutation.mutateAsync,
    isSubmitting: submitForApprovalMutation.isPending,
    hodApprove: hodApproveMutation.mutate,
    hodApproveAsync: hodApproveMutation.mutateAsync,
    isHodApproving: hodApproveMutation.isPending,
    hodReject: hodRejectMutation.mutate,
    hodRejectAsync: hodRejectMutation.mutateAsync,
    isHodRejecting: hodRejectMutation.isPending,
    confirmPurchase: confirmPurchaseMutation.mutate,
    confirmPurchaseAsync: confirmPurchaseMutation.mutateAsync,
    isConfirmingPurchase: confirmPurchaseMutation.isPending,
    addToAssetList: addToAssetListMutation.mutate,
    addToAssetListAsync: addToAssetListMutation.mutateAsync,
    isAddingToAssetList: addToAssetListMutation.isPending,
    markAsDelivered: markAsDeliveredMutation.mutate,
    markAsDeliveredAsync: markAsDeliveredMutation.mutateAsync,
    isMarkingDelivered: markAsDeliveredMutation.isPending,
    confirmReceipt: confirmReceiptMutation.mutate,
    confirmReceiptAsync: confirmReceiptMutation.mutateAsync,
    isConfirmingReceipt: confirmReceiptMutation.isPending,
    acceptRequest: acceptRequestMutation.mutate,
    acceptRequestAsync: acceptRequestMutation.mutateAsync,
    isAccepting: acceptRequestMutation.isPending,
    createReturn: createReturnMutation.mutate,
    createReturnAsync: createReturnMutation.mutateAsync,
    isCreatingReturn: createReturnMutation.isPending,
    deleteRequest: deleteRequestMutation.mutate,
    deleteRequestAsync: deleteRequestMutation.mutateAsync,
    isDeleting: deleteRequestMutation.isPending,
  };
};
