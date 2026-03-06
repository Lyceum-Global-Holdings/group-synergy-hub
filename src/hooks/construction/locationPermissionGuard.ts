import { supabase } from "@/integrations/supabase/client";

const LOCATION_ACCESS_ERROR = "You can only add inventory to locations you have edit access to.";

/**
 * Guards inventory write operations to edit-permitted locations.
 * Admin and Super Admin users are allowed to edit all locations.
 */
export async function assertUserCanEditLocation(userId: string, locationId?: string | null) {
  if (!locationId) return;

  const [adminRes, superAdminRes] = await Promise.all([
    supabase.rpc("is_admin", { _user_id: userId }),
    supabase.rpc("is_super_admin", { _user_id: userId }),
  ]);

  if (adminRes.error) throw adminRes.error;
  if (superAdminRes.error) throw superAdminRes.error;

  const canEditAllLocations = adminRes.data === true || superAdminRes.data === true;
  if (canEditAllLocations) return;

  const { data: permission, error: permissionError } = await supabase
    .from("user_location_permissions")
    .select("location_id")
    .eq("user_id", userId)
    .eq("location_id", locationId)
    .eq("permission_type", "edit")
    .maybeSingle();

  if (permissionError) throw permissionError;
  if (!permission) throw new Error(LOCATION_ACCESS_ERROR);
}
