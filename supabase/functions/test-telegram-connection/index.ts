import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestConnectionRequest {
  company_id: string;
  // For initial setup, user provides bot_token and chat_id before saving
  bot_token?: string;
  chat_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is admin or super_admin
    const { data: roleData, error: roleError } = await supabase
      .rpc('is_admin', { _user_id: user.id });
    
    if (roleError || !roleData) {
      console.error('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin privileges required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { company_id, bot_token: providedToken, chat_id: providedChatId }: TestConnectionRequest = await req.json();

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: 'Company ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to this company
    const { data: membership, error: membershipError } = await supabase
      .from('user_companies')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', company_id)
      .maybeSingle();

    if (membershipError || !membership) {
      // Check if user is super_admin (can access any company)
      const { data: isSuperAdmin } = await supabase
        .rpc('is_super_admin', { _user_id: user.id });
      
      if (!isSuperAdmin) {
        return new Response(
          JSON.stringify({ error: 'Access denied to this company' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let botToken: string;
    let chatIds: string[];

    // If tokens are provided directly (for initial setup/testing before saving), use them
    // Otherwise fetch from database
    if (providedToken && providedChatId) {
      botToken = providedToken;
      chatIds = providedChatId.split(',').map(id => id.trim()).filter(Boolean);
      console.log('Using provided credentials for testing');
    } else {
      // Fetch from database (server-side only, never exposed to client)
      const { data: settings, error: settingsError } = await supabase
        .from('telegram_settings')
        .select('bot_token, chat_id')
        .eq('company_id', company_id)
        .maybeSingle();

      if (settingsError) {
        console.error('Error fetching telegram settings:', settingsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch Telegram settings' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!settings?.bot_token || !settings?.chat_id) {
        return new Response(
          JSON.stringify({ error: 'Telegram credentials not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      botToken = settings.bot_token;
      chatIds = settings.chat_id.split(',').map((id: string) => id.trim()).filter(Boolean);
    }

    if (chatIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid chat IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing connection to ${chatIds.length} chat(s)`);

    // Test connection by sending a test message to each chat
    const results: { chatId: string; success: boolean; error?: string }[] = [];

    for (const chatId of chatIds) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '✅ Test connection successful! Your Telegram settings are configured correctly.',
          }),
        });

        const result = await response.json();

        if (result.ok) {
          results.push({ chatId, success: true });
          console.log(`Test message sent successfully to chat ${chatId}`);
        } else {
          results.push({ chatId, success: false, error: result.description });
          console.error(`Failed to send to chat ${chatId}:`, result.description);
        }
      } catch (err) {
        results.push({ chatId, success: false, error: String(err) });
        console.error(`Error sending to chat ${chatId}:`, err);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const allSuccess = successCount === chatIds.length;

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        all_success: allSuccess,
        sent_count: successCount,
        total_chats: chatIds.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in test-telegram-connection:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

