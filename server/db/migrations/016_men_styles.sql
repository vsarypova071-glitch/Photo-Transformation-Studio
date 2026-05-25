-- Migration 016: MEN Premium Cinematic styles (4 styles)
-- Additive: ON CONFLICT DO NOTHING — безопасно запускать повторно.
--
-- Категория: legacy_category = 'men' (новое значение, добавлено в StyleCategory на фронте).
-- Превью: null — берётся из bundle (src/assets/styles/...) через adapt() в styles.ts.
-- Промпт: содержит [MEN: <NAME>] тег для детектирования в buildPrompt() server-side.
--
-- Откат (вручную):
--   DELETE FROM styles WHERE id IN
--     ('men_desert_king','men_big_catch','men_king_ocean','men_master_life');
-- ============================================================================

INSERT INTO styles (id, title, description, category, legacy_category, preview_url, prompt, sort_order, active, club_only)
VALUES

-- ── DESERT KING ──────────────────────────────────────────────────────────────
(
  'men_desert_king',
  'DESERT KING',
  'Luxury desert adventure — SUV, каньон, закат. Мужская сила и свобода.',
  NULL,
  'men',
  NULL,
  '[MEN: DESERT KING]
Medium full-body shot of a ruggedly handsome man standing confidently beside a modern dark-green luxury desert-spec SUV in a sandy canyon at sunset. The driver door is open revealing a detailed tan leather interior. He wears a black open utility jacket over a toned masculine torso and dark technical shorts. Golden hour volumetric lighting, dust particles floating in warm canyon air, cinematic depth of field, realistic masculine skin texture, expensive adventure aesthetics, raw masculine energy. The man radiates calm dominance and adventurous freedom.',
  100,
  true,
  false
),

-- ── BIG CATCH ────────────────────────────────────────────────────────────────
(
  'men_big_catch',
  'BIG CATCH',
  'Cinematic рыбалка — трофейный момент с характером и настоящей радостью.',
  NULL,
  'men',
  NULL,
  '[MEN: BIG CATCH]
Raw cinematic photograph of a man proudly holding a huge monstrous Northern Pike on a misty lake at sunrise. He wears a functional olive green tactical outdoor suit with a luxury watch visible on his wrist. Broad confident smile, direct eye contact with camera — genuine masculine pride and joy. Dramatic golden hour sun flare over the water, atmospheric morning mist drifting across the lake surface, weathered wooden dock beneath his feet. Detailed realistic fish scales and texture, believable fish anatomy and proportions. Editorial outdoor fishing magazine style. Realistic film grain. Warm cinematic color grade.',
  110,
  true,
  false
),

-- ── KING OF THE OCEAN ────────────────────────────────────────────────────────
(
  'men_king_ocean',
  'KING OF THE OCEAN',
  'Luxury yacht lifestyle — атлетизм, океан, тропический закат.',
  NULL,
  'men',
  NULL,
  '[MEN: KING OF THE OCEAN]
Medium full-body shot of a confident athletic man standing on the deck of a luxury modern white yacht at tropical ocean sunset. Wet skin texture with visible natural water droplets on a toned athletic torso, open premium black jacket worn loosely, dark shorts, luxury watch catching the golden light. Cinematic golden ocean lighting, tropical paradise atmosphere, sun flare through evening clouds reflecting across the water. Ocean wind subtly moving the jacket fabric. Luxury resort lifestyle aesthetic, premium commercial photography feel. The man projects calm confidence and masculine power.',
  120,
  true,
  false
),

-- ── MASTER OF LIFE ───────────────────────────────────────────────────────────
(
  'men_master_life',
  'MASTER OF LIFE',
  'Alpha-лидер рядом со львом — сила, стиль, африканский закат.',
  NULL,
  'men',
  NULL,
  '[MEN: MASTER OF LIFE]
Full body shot of a powerful man in a charcoal tailored business suit standing confidently beside a huge majestic adult male lion on a rocky cliff overlooking a vast African savanna at golden sunset. One hand in trouser pocket, calm dominant stance, direct eye contact with camera. The lion is enormous and photorealistic with a full mane — detailed realistic fur texture, correct anatomy, believable natural proportions. They stand as equals in power and composure. Warm African golden hour lighting, cinematic sun flare, soft dust particles in the evening air, dramatic long shadows over the savanna below. Wind subtly moving the suit jacket fabric. Alpha leader energy, editorial corporate photography at its most cinematic and powerful.',
  130,
  true,
  false
)

ON CONFLICT (id) DO NOTHING;

-- ── Sanity check ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_men INTEGER;
BEGIN
  SELECT count(*) INTO n_men
    FROM styles
   WHERE legacy_category = 'men' AND active = true;

  RAISE NOTICE 'Migration 016: men_styles active = % (expect 4)', n_men;
END $$;
