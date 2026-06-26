-- Costume Rental — multiple images per costume (product gallery).
--
-- image_urls holds the full ordered gallery; image_url stays as the cover
-- (first image) for cards/lists. Backfill the gallery from existing covers.

ALTER TABLE public.rental_costumes
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

UPDATE public.rental_costumes
   SET image_urls = ARRAY[image_url]
 WHERE image_url IS NOT NULL
   AND image_url <> ''
   AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);
