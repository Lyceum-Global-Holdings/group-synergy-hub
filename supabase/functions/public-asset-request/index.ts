import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssetRequestItem {
  asset_master_id?: string;
  item_name: string;
  item_description?: string;
  quantity_requested: number;
  justification?: string;
}

interface PublicAssetRequestData {
  requester_name: string;
  requester_email: string;
  department: string;
  contact_number?: string;
  purpose: string;
  justification?: string;
  required_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  items: AssetRequestItem[];
  company_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const requestData: PublicAssetRequestData = await req.json();
    
    console.log('Received public asset request:', { 
      requester_name: requestData.requester_name,
      requester_email: requestData.requester_email,
      items_count: requestData.items.length 
    });

    // Validate required fields
    if (!requestData.requester_name || !requestData.requester_email || 
        !requestData.department || !requestData.purpose || 
        !requestData.required_date || !requestData.items || requestData.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requestData.requester_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate request number
    const { data: requestNumberData, error: requestNumberError } = await supabaseClient
      .rpc('generate_asset_request_number');

    if (requestNumberError) {
      console.error('Error generating request number:', requestNumberError);
      throw requestNumberError;
    }

    const request_number = requestNumberData;

    // Create asset request
    const { data: assetRequest, error: requestError } = await supabaseClient
      .from('asset_requests')
      .insert({
        request_number,
        request_date: new Date().toISOString().split('T')[0],
        requester_name: requestData.requester_name,
        department: requestData.department,
        contact_number: requestData.contact_number,
        purpose: requestData.purpose,
        justification: requestData.justification,
        required_date: requestData.required_date,
        priority: requestData.priority,
        status: 'pending_hod_approval',
        company_id: requestData.company_id,
        notes: 'Public request via web form',
        requested_by: null, // Public request - no user ID
        created_by: null // Public request - no user ID
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating asset request:', requestError);
      throw requestError;
    }

    console.log('Asset request created:', assetRequest.id);

    // Create asset request items
    const items = requestData.items.map((item, index) => ({
      request_id: assetRequest.id,
      line_number: index + 1,
      request_type: item.asset_master_id ? 'from_master' : 'new_item',
      asset_master_id: item.asset_master_id,
      item_name: item.item_name,
      item_description: item.item_description,
      quantity_requested: item.quantity_requested,
      quantity_approved: null,
      quantity_fulfilled: 0,
      unit_price_estimate: 0,
      total_price_estimate: 0,
      justification: item.justification,
      status: 'pending'
    }));

    const { error: itemsError } = await supabaseClient
      .from('asset_request_items')
      .insert(items);

    if (itemsError) {
      console.error('Error creating asset request items:', itemsError);
      throw itemsError;
    }

    console.log('Asset request items created:', items.length);

    // Send confirmation email (optional - would need Resend API key)
    // const emailSent = await sendConfirmationEmail(requestData.requester_email, request_number);

    return new Response(
      JSON.stringify({
        success: true,
        request_number,
        request_id: assetRequest.id,
        message: 'Asset request submitted successfully',
        tracking_info: {
          request_number,
          status: 'pending_hod_approval',
          submitted_date: assetRequest.request_date,
          items_count: items.length
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in public-asset-request function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.details || error.hint || null
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
