-- First, clean up users with multiple roles - keep only the first role assigned
WITH ranked_roles AS (
  SELECT 
    id,
    user_id,
    role_id,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
  FROM public.user_roles
)
DELETE FROM public.user_roles 
WHERE id IN (
  SELECT id FROM ranked_roles WHERE rn > 1
);

-- Drop the existing unique constraint on (user_id, role_id)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_id_key;

-- Add new unique constraint on just user_id to enforce single role per user
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT user_roles_user_id_unique ON public.user_roles IS 'Each user can only have one role assigned';