import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// Signs a user in with a one-time MFA recovery code.
//
// Supabase has no native recovery codes, and consuming one cannot raise the
// session to AAL2 — so the app kept sending the user back to the code screen.
// Instead, a valid code removes the user's authenticator (admin API): with no
// verified factor the session no longer needs AAL2, and the app sends the user
// to /account/mfa to enrol a new authenticator and get fresh recovery codes.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(401, { success: false, error: 'Sign in first.' });
    }

    // Acts as the signed-in user, so the RPC hashes the code with their id.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json(401, { success: false, error: 'Sign in first.' });
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!code) {
      return json(200, { success: false, error: 'Enter a recovery code.' });
    }

    // Consume first: a code works once, and nothing is removed unless it is valid.
    const { data: accepted, error: consumeError } = await userClient.rpc(
      'consume_mfa_recovery_code',
      { p_code: code },
    );
    if (consumeError) {
      console.error('consume_mfa_recovery_code failed:', consumeError);
      return json(500, { success: false, error: 'Could not check the recovery code. Try again.' });
    }
    if (!accepted) {
      return json(200, { success: false, error: 'That recovery code is wrong or has already been used.' });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: factorList, error: listError } = await admin.auth.admin.mfa.listFactors({
      userId: user.id,
    });
    if (listError) throw listError;

    const factors = factorList?.factors ?? [];
    for (const factor of factors) {
      const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: user.id,
      });
      if (deleteError) throw deleteError;
    }

    // The remaining codes belonged to the removed authenticator.
    const { error: codesError } = await admin
      .from('user_mfa_recovery_codes')
      .delete()
      .eq('user_id', user.id);
    if (codesError) console.error('Could not clear old recovery codes:', codesError);

    const { error: auditError } = await admin.from('security_audit_log').insert({
      changed_by: user.id,
      action: 'MFA_RECOVERY_CODE_USED',
      before_value: { factors_removed: factors.map((f) => f.id) },
      after_value: null,
    });
    if (auditError) console.error('Could not write audit entry:', auditError);

    console.log(`MFA recovery code used by ${user.id}; removed ${factors.length} factor(s)`);
    return json(200, { success: true, factorsRemoved: factors.length });
  } catch (error) {
    console.error('mfa-recovery error:', error);
    return json(500, {
      success: false,
      error: 'Your recovery code was accepted, but your authenticator could not be reset. Contact an administrator.',
    });
  }
});
