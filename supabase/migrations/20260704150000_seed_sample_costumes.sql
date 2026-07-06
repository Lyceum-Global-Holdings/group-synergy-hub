-- Sample data for the Costume Catalog: 6 categories, 10 costumes (each with a
-- real, publicly-hosted image), and 27 physical units across sizes so the
-- costumes are rentable end-to-end (add-to-bucket, availability, checkout).
--
-- Idempotent: seeds only the first company (by created_at) and only if the
-- sample set is not already present, so re-running is a no-op. All images are
-- CC-licensed files served from Wikimedia's CDN (upload.wikimedia.org).

DO $$
DECLARE
  v_company uuid;
BEGIN
  SELECT id INTO v_company FROM public.companies ORDER BY created_at LIMIT 1;
  IF v_company IS NULL THEN
    RAISE NOTICE 'seed_sample_costumes: no company found, skipping';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.rental_costumes WHERE costume_code = 'CST-SAMPLE-001') THEN
    RAISE NOTICE 'seed_sample_costumes: sample costumes already present, skipping';
    RETURN;
  END IF;

  -- 1. Categories -----------------------------------------------------------
  INSERT INTO public.rental_categories (name, code, description, company_id)
  SELECT c.name, c.code, c.descr, v_company
  FROM (VALUES
    ('Superheroes',       'SUPER',  'Comic and movie hero suits'),
    ('Princess & Kids',   'KIDS',   'Fairy-tale and children''s costumes'),
    ('Halloween & Party', 'PARTY',  'Spooky and party dress-up'),
    ('Seasonal',          'SEASON', 'Festive and holiday costumes'),
    ('Cultural',          'CULTR',  'Traditional and cultural attire'),
    ('Historical & Formal','HIST',  'Period, historical and formal wear')
  ) AS c(name, code, descr);

  -- 2. Costumes -------------------------------------------------------------
  INSERT INTO public.rental_costumes
    (costume_code, name, description, category_id, color, gender, theme, brand,
     image_url, image_urls, daily_rate, security_deposit, replacement_value, status, company_id)
  SELECT c.code, c.name, c.descr, cat.id, c.color, c.gender, c.theme, c.brand,
         c.img, ARRAY[c.img], c.daily, c.dep, c.repl, 'active', v_company
  FROM (VALUES
    ('CST-SAMPLE-001','Iron Man Armour Suit',
      'Full foam-and-fibreglass powered-armour replica with light-up arc reactor.',
      'Superheroes','Red / Gold','Unisex','Marvel','Studio Replica',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Iron_Man_Cosplay_at_2013_Phoenix_Comicon.jpg/960px-Iron_Man_Cosplay_at_2013_Phoenix_Comicon.jpg',
      4500, 15000, 45000),
    ('CST-SAMPLE-002','Elsa Frozen Gown',
      'Sparkling ice-blue princess gown with sheer cape — a children''s party favourite.',
      'Princess & Kids','Ice Blue','Girls','Disney','Fairy Tale Co.',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Elsa_cosplayer.jpg/960px-Elsa_cosplayer.jpg',
      2500, 8000, 20000),
    ('CST-SAMPLE-003','Classic Pirate Captain',
      'Swashbuckling captain''s coat, ruffled shirt, sash and tricorn hat.',
      'Halloween & Party','Black / Crimson','Men','Buccaneer','Seven Seas',
      'https://upload.wikimedia.org/wikipedia/commons/8/8a/Man_in_pirate_costume.jpg',
      2000, 6000, 15000),
    ('CST-SAMPLE-004','Wicked Witch',
      'Flowing black gown with tattered hem and pointed hat for a spooky night.',
      'Halloween & Party','Black','Women','Hallow','Midnight Attire',
      'https://upload.wikimedia.org/wikipedia/commons/c/c5/Halloween_witch_smiling.jpg',
      1800, 5000, 12000),
    ('CST-SAMPLE-005','Circus Clown',
      'Bright polka-dot jumpsuit with ruffled collar and oversized bow.',
      'Halloween & Party','Multicolour','Unisex','BigTop','Carnival',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Clown_costume.jpg/960px-Clown_costume.jpg',
      1500, 4000, 10000),
    ('CST-SAMPLE-006','Santa Claus Suit',
      'Deluxe plush Father Christmas suit with jacket, trousers, belt, hat and beard.',
      'Seasonal','Red / White','Men','Kris Kringle','Yuletide',
      'https://upload.wikimedia.org/wikipedia/commons/b/b5/Santa-eop2.jpg',
      3000, 9000, 22000),
    ('CST-SAMPLE-007','Traditional Japanese Kimono',
      'Silk furisode kimono with obi sash and floral pattern.',
      'Cultural','Indigo / Gold','Women','Sakura','Heritage',
      'https://upload.wikimedia.org/wikipedia/commons/f/f4/Kimono-coat_1956.jpg',
      3500, 12000, 30000),
    ('CST-SAMPLE-008','Spanish Flamenco Dress',
      'Ruffled red-and-black flamenco dress with matching fan.',
      'Cultural','Red / Black','Women','Sevilla','Heritage',
      'https://upload.wikimedia.org/wikipedia/commons/e/ef/Black_and_red_flamenco_dress_with_orange_fan.jpg',
      2800, 9000, 24000),
    ('CST-SAMPLE-009','Medieval Knight Armour',
      'Full plate-mail replica with helm, breastplate, gauntlets and tabard.',
      'Historical & Formal','Steel','Men','Camelot','Heritage',
      'https://upload.wikimedia.org/wikipedia/commons/8/8d/Armored_Knight_Mounted_on_Horse_%281%29.JPG',
      5000, 18000, 55000),
    ('CST-SAMPLE-010','Regency Wedding Gown',
      'Empire-waist Regency-era wedding gown with lace bodice and train.',
      'Historical & Formal','Ivory','Women','Austen','Heritage',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Regency_style_wedding_dress_costume.jpg/960px-Regency_style_wedding_dress_costume.jpg',
      4000, 14000, 38000)
  ) AS c(code, name, descr, cat_name, color, gender, theme, brand, img, daily, dep, repl)
  LEFT JOIN public.rental_categories cat
    ON cat.company_id = v_company AND cat.name = c.cat_name;

  -- 3. Units (sizes) — unit_code is auto-generated by set_rental_unit_code ---
  INSERT INTO public.rental_costume_units (costume_id, size, condition, status, company_id)
  SELECT rc.id, u.size, u.cond, 'available', v_company
  FROM (VALUES
    ('CST-SAMPLE-001','M','good'),   ('CST-SAMPLE-001','L','new'),   ('CST-SAMPLE-001','XL','good'),
    ('CST-SAMPLE-002','Age 4-6','new'), ('CST-SAMPLE-002','Age 7-9','good'), ('CST-SAMPLE-002','Age 10-12','good'),
    ('CST-SAMPLE-003','M','good'),   ('CST-SAMPLE-003','L','good'),  ('CST-SAMPLE-003','XL','fair'),
    ('CST-SAMPLE-004','S','good'),   ('CST-SAMPLE-004','M','new'),   ('CST-SAMPLE-004','L','good'),
    ('CST-SAMPLE-005','M','good'),   ('CST-SAMPLE-005','L','good'),
    ('CST-SAMPLE-006','L','good'),   ('CST-SAMPLE-006','XL','new'),
    ('CST-SAMPLE-007','S','good'),   ('CST-SAMPLE-007','M','good'),  ('CST-SAMPLE-007','L','new'),
    ('CST-SAMPLE-008','S','good'),   ('CST-SAMPLE-008','M','new'),   ('CST-SAMPLE-008','L','good'),
    ('CST-SAMPLE-009','L','good'),   ('CST-SAMPLE-009','XL','good'),
    ('CST-SAMPLE-010','S','new'),    ('CST-SAMPLE-010','M','good'),  ('CST-SAMPLE-010','L','good')
  ) AS u(code, size, cond)
  JOIN public.rental_costumes rc ON rc.costume_code = u.code;

  RAISE NOTICE 'seed_sample_costumes: seeded 10 costumes + 27 units for company %', v_company;
END $$;
