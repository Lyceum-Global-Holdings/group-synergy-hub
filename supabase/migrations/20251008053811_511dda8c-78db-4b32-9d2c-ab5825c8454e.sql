-- Assign Super Admin role to sudarakap@lyceumglobal.co
INSERT INTO public.user_roles (user_id, role_id)
VALUES (
  'a5a59024-07b0-4796-b1f8-c95673ad421a',
  'c666c0ab-80e4-416f-9f24-141603e9ee03'
)
ON CONFLICT (user_id, role_id) DO NOTHING;