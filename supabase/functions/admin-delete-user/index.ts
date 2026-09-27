import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// Removes a user's access for good (super admins only).
//
// Deleting a login needs the service role, so the browser could never do it
// and the login survived. This function:
//   1. blocks the login immediately (it can no longer sign in or refresh),
//   2. removes the user's role, company, module and location access,
//   3. deletes the login — which also deletes the profile — when the user
//      appears on no records.
// Most records (created_by, approved_by, …) reference the login, so for anyone
// who has done work the delete is refused by the database; the login is then
// soft-deleted (still blocked) and the profile marked deactivated, so history
// still shows who did what.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Effectively permanent (about 100 years).
const BAN_DURATION = '876000h';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(401, { success: false, error: 'Sign in first.' });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) {
      return json(401, { success: false, error: 'Sign in first.' });
    }

    const { data: isSuperAdmin, error: roleError } = await userClient.rpc('is_super_admin', {
      _user_id: caller.id,
    });
    if (roleError) {
      console.error('is_super_admin failed:', roleError);
      return json(500, { success: false, error: 'Could not check your permissions. Try again.' });
    }
    if (!isSuperAdmin) {
      return json(403, { success: false, error: 'Only super administrators can delete users.' });
    }

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    if (!userId) {
      return json(400, { success: false, error: 'Choose a user to delete.' });
    }
    if (userId === caller.id) {
      return json(400, { success: false, error: "You can't delete your own account." });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
    const loginExists = !targetError && !!target?.user;

    // 1. Block the login first, so it stops working even if a later step fails.
    if (loginExists) {
      const { error: banError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: BAN_DURATION,
      });
      if (banError) {
        console.error('Could not block login:', banError);
        return json(500, { success: false, error: 'Could not block this login. Nothing was changed.' });
      }
    }

    // 2. Remove every kind of access.
    for (const table of ['user_roles', 'user_company_access', 'user_modules', 'user_location_permissions']) {
      const { error } = await admin.from(table).delete().eq('user_id', userId);
      if (error) console.error(`Could not clear ${table}:`, error);
    }

    // 3. Delete the login when nothing references it. Otherwise soft-delete it:
    //    the row stays (records keep their references) but sessions end, the
    //    login can't be used and the email address is freed. If even that
    //    fails, the ban from step 1 still blocks it.
    let outcome: 'deleted' | 'deactivated' = 'deleted';
    if (loginExists) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.log(`Login ${userId} is referenced by records; deactivating instead:`, deleteError.message);
        outcome = 'deactivated';
        const { error: softError } = await admin.auth.admin.deleteUser(userId, true);
        if (softError) console.log('Soft delete failed; the login stays blocked:', softError.message);
      }
    }

    if (outcome === 'deactivated') {
      const { error } = await admin
        .from('profiles')
        .update({ deactivated_at: new Date().toISOString(), deactivated_by: caller.id })
        .eq('user_id', userId);
      if (error) console.error('Could not mark profile deactivated:', error);
    } else {
      // The login cascade removes the profile; this also covers orphan profiles.
      await admin.from('profiles').delete().eq('user_id', userId);
    }

    const { error: auditError } = await admin.from('security_audit_log').insert({
      changed_by: caller.id,
      action: outcome === 'deleted' ? 'USER_DELETED' : 'USER_DEACTIVATED',
      before_value: { user_id: userId, email: target?.user?.email ?? null },
      after_value: { outcome },
    });
    if (auditError) console.error('Could not write audit entry:', auditError);

    return json(200, { success: true, outcome });
  } catch (error) {
    console.error('admin-delete-user error:', error);
    return json(500, { success: false, error: 'Something went wrong. The login may already be blocked; check the user list.' });
  }
});
