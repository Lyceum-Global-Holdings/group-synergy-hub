-- Drop the trigger that references non-existent 'attributes' column
DROP TRIGGER IF EXISTS trim_fg_attributes ON public.finished_goods;

-- Also drop the function since it's no longer needed
DROP FUNCTION IF EXISTS public.trim_finished_goods_attributes();