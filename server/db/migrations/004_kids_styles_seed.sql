-- Migration 004: seed 5 PREMIUM CHILDREN styles into the existing `styles` table.
-- Идемпотентно: ON CONFLICT (id) DO NOTHING — повторный запуск не дублирует.
--
-- ВАЖНО:
--   • Существующие 13 взрослых стилей (миграция 003) НЕ трогаются.
--   • Backend (server/services/prompts.ts, generation.ts) НЕ меняется.
--   • Архитектура prompt'а — [A] IDENTITY LOCK + [B] STYLE BIBLE +
--     [C] SHOT VARIATION POOLS — целиком уложена в поле `prompt` каждого
--     стиля. Модель сама делает random pick из перечисленных пулов при
--     каждой генерации, что даёт разные кадры одной luxury photoshoot
--     при сохранении identity ребёнка.
--   • Стили подобраны под реальные preview-фото (см. миграцию 005).
--
-- Применять ТОЛЬКО ВМЕСТЕ с миграцией 003 (или после неё) — иначе таблица
-- styles будет содержать только детские стили, а взрослые пропадут до
-- следующего применения 003. Frontend fallback на bundle покрывает
-- этот edge-case, но best practice — применять обе миграции в одной
-- транзакции деплоя.
--
-- Категория: 'Детские' (русское имя, как в продуктовом ТЗ).
-- legacy_category = NULL.
-- club_only = false (на текущем этапе доступны всем).
-- sort_order: 1010-1050 — отдельный диапазон от взрослых стилей (10-200).
-- preview_url: NULL здесь, привязывается миграцией 005 после загрузки файлов.

INSERT INTO styles (id, title, description, prompt, category, legacy_category, sort_order, active, club_only, preview_url) VALUES

-- ============================================================================
-- 1. kids_sport_champion — Юный чемпион (футбол на стадионе)
-- ============================================================================
(
  'kids_sport_champion',
  'Юный чемпион',
  'Кинематографичный портрет ребёнка-футболиста на большом стадионе под софитами.',
$prompt$
[IDENTITY LOCK — must hold across every generation of this style]
Identity preservation directive: preserve the exact facial identity of the reference child — exact eye shape, exact eye color and iris pattern, exact cheekbone structure, exact jawline, exact nose bridge, exact lip shape, exact ear shape, exact hairline, exact hair color and texture. Preserve the exact age range of the reference child. Preserve realistic skin texture with natural pores and a healthy post-effort flush; subtle natural sweat sheen is acceptable, but never plastic gloss. Preserve natural body proportions appropriate for the child's age — never exaggerate musculature, never enlarge eyes, never reshape the face. Forbidden: replacing the child, generating a different child, plastic doll skin, anime eyes, cartoon proportions, comic-book hero look, fantasy aura, glowing eyes, aggressive snarl. Identity must remain recognisable as the same child across every generated variation.

[STYLE BIBLE — locked aesthetic of this photoshoot]
Cinematic stadium football editorial of a child athlete. Palette: deep navy, burgundy, rich green grass, warm tungsten floodlights against cool night sky. Wardrobe code: clean modern child football kit — solid navy/burgundy striped jersey OR plain navy jersey, matching shorts, knee-high football socks, real football boots; no real club crests, no real player names, no logos belonging to real brands or clubs (generic kit). Setting: empty professional football stadium at night — real green pitch with visible grass blades and white field markings, blurred crowd in deep bokeh, stadium railings and advertising boards visible only as soft bokeh, never readable text. Light philosophy: stadium floodlights from above and behind creating a strong rim around hair and shoulders, warm tungsten key on the face, cool ambient on background, real shadow drama, occasional fine mist or grass-particles in air. Camera: Canon EOS R5 with 70-200mm f/2.8 L IS at 135mm, low ISO, slight motion crispness on dynamic frames, ESPN editorial colour grade, Champions League broadcast aesthetic. Reference editorials: Nike Football Junior global campaigns, ESPN Body Issue (junior mood, fully clothed), Sports Illustrated for Kids, La Liga youth academy editorial portraits. Mood: focused effort, hero but humble, calm power.

[SHOT VARIATION — randomise on every generation]
For THIS specific frame, pick exactly one independent random value from each of the following pools. Do not repeat the same combination on subsequent generations of this style:
- Framing: close-up of focused eyes with stadium lights as bokeh | portrait shoulders-up | mid-shot waist-up with ball | three-quarter with ball at feet | full body running | full body silhouette in floodlight rim | wide environmental of pitch
- Camera angle: low-angle hero from grass level | eye-level | slight high-angle from coach perspective | profile mid-stride | three-quarter from behind | over-the-shoulder onto ball
- Pose: standing with ball under foot | mid-dribble step | preparing to kick | tying boot lace | hands on hips catching breath | jogging back to position | turning back to look at camera | celebrating quietly with raised arm
- Hands: gripping ball | one hand on hip | both hands on knees | adjusting hair | pulling shirt collar | wiping forehead with forearm | one arm raised slight celebration
- Gaze: focused on ball at feet | direct calm intensity to camera | looking off into distance | looking up to floodlights | looking sideways at imagined teammate | eyes nearly closed mid-breath
- Expression: focused calm | quiet determination | gentle confidence | post-effort exhale | small humble smile | thoughtful before action
- Movement: static still | mid-step running | ball rolling under foot | hair lifted by motion | jersey fabric in motion | breath visible in cool night air
- Lighting variation: hard top floodlight + warm rim from behind | side floodlight with deep shadow on far side | full back-rim silhouette with face in fill | warm key + cool blue background | strong front floodlight with dramatic falloff | mixed warm-cool stadium light
- Wardrobe detail: jersey fully tucked | jersey slightly untucked | sleeves at wrist | sleeves pushed to elbow | socks pulled high | socks slightly down | shin guards visible | hair damp from effort | hair dry tousled
- Environment detail: ball at feet | ball mid-bounce | empty pitch around | corner flag in distant bokeh | goalpost in background bokeh | white pitch markings visible | nothing extra
- Atmospheric: fine grass particles in floodlight beam | breath visible in cool air | mist drifting low across pitch | crisp clear night | shallow shadow play on grass

The result must look like a unique frame from one cinematic premium child football editorial. Vary pose, framing and details strongly between generations. Identity, age and proportions of the reference child are non-negotiable.
$prompt$,
  'Детские', NULL, 1010, true, false, NULL
),

-- ============================================================================
-- 2. kids_cozy_childhood — Уют детства (вечер у камина с мишкой)
-- ============================================================================
(
  'kids_cozy_childhood',
  'Уют детства',
  'Тёплый уютный вечерний портрет ребёнка с плюшевым мишкой у камина — медовый свет, кашемировый плед, дом.',
$prompt$
[IDENTITY LOCK — must hold across every generation of this style]
Identity preservation directive: preserve the exact facial identity of the reference child — exact eye shape, exact eye color and iris pattern, exact cheekbone structure, exact jawline, exact nose bridge, exact lip shape, exact ear shape, exact hairline, exact hair color and texture. Preserve the exact age range of the reference child. Preserve realistic skin texture with natural pores; warm candlelight glow on cheeks is acceptable, but never plastic doll smoothness. Preserve natural body proportions for the child's age. Forbidden: replacing the child, plastic doll skin, anime eyes, cartoon proportions, exaggerated cuteness, over-large eyes, glow effects, fantasy halo, glittery filters. Identity must remain recognisable as the same child across every variation.

[STYLE BIBLE — locked aesthetic of this photoshoot]
Cozy intimate evening child editorial at home with a beloved teddy bear. Palette: cream, oat, soft amber, warm honey, gentle blue from frosted window in deep background. Wardrobe code: chunky cream knit cardigan or oversized soft sweater, simple cotton underneath, no logos, no Christmas-themed costumes, hair tousled in natural soft top-bun or loose. Always include a soft plush teddy bear (light brown, classic, slightly worn-in) — held, hugged, or resting nearby. Setting: classic warm European living room in evening — softly lit fireplace with embers, mantel with candles in glass holders, framed family photographs out of focus, neutral linen sofa with chunky knit throw, frosted or icy window in distant background, single small table lamp adding warm fill. Light philosophy: warm low candlelight + soft fireplace glow as key, slight cool ambient from frosted window, deep but never harsh shadows; intimate low-key. Camera: Leica SL2 with 50mm Summilux f/1.4, gentle warm tonal grade, soft natural color, fine grain, slight film halation around bright candle highlights. Reference editorials: Kinfolk Family evenings, Cabin Porn winter interiors, Aman Resorts winter retreat editorials, Vogue Bambini home stories. Mood: cozy, safe, slow evening, real family warmth.

[SHOT VARIATION — randomise on every generation]
For THIS specific frame, pick exactly one independent random value from each pool. Do not repeat combinations:
- Framing: extreme close-up of face with bear in soft focus | classic close-up portrait | mid-shot hugging bear | three-quarter on sofa | full body curled on sofa | wide environmental of room with fireplace
- Camera angle: eye-level with child on sofa | slight low-angle from floor | slight high-angle observational | profile facing fireplace | over-the-shoulder onto bear's face | three-quarter turn
- Pose: hugging bear close to chest | sitting cross-legged with bear in lap | lying on side with bear under arm | resting head on bear | reaching out to fireplace warmth | curled under knit throw | sitting on floor by hearth
- Hands: both arms around bear | one hand on bear's ear | both hands holding bear's paws | one hand under cheek | one hand on knit throw edge | hands resting in lap
- Gaze: direct soft eye contact | looking down at bear | looking off-camera at fireplace | eyes nearly closed peaceful | looking up dreamily | looking off at frosted window
- Expression: soft inner real smile | quiet contemplation | sleepy peaceful | gentle wonder | tiny shy half-smile | calm neutral
- Movement: static still | slight head tilt | hair shifting softly | bear shifting in arms | knit throw being pulled closer
- Lighting variation: candlelight from camera-right + fireplace fill | strong fireplace key from below-left, warm | mantel candles soft top-key | mixed warm key + cool blue from window | low-key chiaroscuro with face emerging from shadow | soft lamp warm side-light
- Wardrobe detail: sweater sleeves long over hands | sleeves pushed up | hair in top-bun | hair loose over shoulders | hair half-up | socks visible | barefoot on rug
- Environment detail: knit throw wrapped around | mug of warm milk nearby | open storybook face-down | candles on mantel flickering | small wreath or pine sprigs (no kitsch) | photograph frame in soft bokeh | small dog or cat partially in frame | nothing extra
- Atmospheric: soft warm glow halation around candles | very subtle hearth smoke haze | slight frost pattern on distant window | shadow play on wall behind | quiet still air

The result must look like a unique tender frame from one warm cozy children evening editorial. Each generation visually differs; identity and age remain constant.
$prompt$,
  'Детские', NULL, 1020, true, false, NULL
),

-- ============================================================================
-- 3. kids_ballet — Маленькая балерина (классический театр)
-- ============================================================================
(
  'kids_ballet',
  'Маленькая балерина',
  'Классическая театральная фотосессия юной балерины на сцене старинной оперы — золото, бархат, тиара.',
$prompt$
[IDENTITY LOCK — must hold across every generation of this style]
Identity preservation directive: preserve the exact facial identity of the reference child — exact eye shape, exact eye color and iris pattern, exact cheekbone structure, exact jawline, exact nose bridge, exact lip shape, exact ear shape, exact hairline. The hair will be styled into a clean classical ballet bun, but the hairline and hair color remain those of the reference child. Preserve the exact age range. Preserve realistic skin texture with natural pores; subtle stage-light highlights are acceptable, but never plastic doll smoothness. Preserve natural body proportions for the child's age — never elongate the neck, never slim the limbs, never adultify the face. Forbidden: replacing the child, plastic doll skin, anime eyes, cartoon proportions, exaggerated cuteness, sexualisation of pose, adult stylisation, over-retouching. Identity must remain recognisable as the same child across every variation.

[STYLE BIBLE — locked aesthetic of this photoshoot]
Classical theatrical editorial of a young ballerina inside a historic European opera house. Palette: dusty rose, warm gold, deep crimson velvet, warm tungsten with rich shadow. Wardrobe code: classical pink-rose ballet tutu with delicate gold embroidery and beadwork down the bodice, soft tulle layered skirt, structured corseted top, off-shoulder tulle ruffles at the arms; clean silk or satin pointe shoes; hair tied into a clean classical ballet bun; small refined gold tiara or none; tasteful and age-appropriate at all times. Setting: classical opera house — ornate gilded balconies and box seats in deep background bokeh, glowing tungsten foot-lights and box-light bulbs along curved balcony tiers, heavy red velvet curtain partly visible, ornate gilded proscenium arch overhead. Light philosophy: warm tungsten stage front-light from below and side, deep falloff into rich shadow, strong rim along bun and shoulders from a high backstage source, real atmospheric haze of theatre dust. Camera: Hasselblad H6D-100c with 100mm f/2.2 lens, deep tonal range, classical portrait grade, slight film halation around tungsten highlights. Reference editorials: Vogue Bambini ballet editorials, Bolshoi Theatre official portrait photography, Royal Ballet School portraits, Valentino Couture campaigns. Mood: refined classical grace, dignified, cinematic theatrical poise.

[SHOT VARIATION — randomise on every generation]
For THIS specific frame, pick exactly one independent random value from each pool. Do not repeat combinations:
- Framing: extreme close-up of face with bokeh balcony lights behind | classic close-up portrait shoulders-up | mid-shot waist-up with tutu detail | three-quarter | full body in classical ballet stance | wide environmental of stage with tiny figure
- Camera angle: eye-level | slight low-angle hero from orchestra pit perspective | slight high-angle from balcony | profile facing wing | three-quarter turn toward camera | over-the-shoulder looking back
- Pose: standing in first position with hands clasped | classical port-de-bras with one arm raised | curtsey-like reverence | mid-pirouette held still | sitting on edge of stage with tutu spread | resting hands on tutu | walking onto stage looking up | back to camera looking over shoulder
- Hands: clasped softly in front | both hands on tutu edges | one hand resting on shoulder | classical ballet hand position to side | hands behind back | one hand near tiara
- Gaze: direct calm eye contact | looking off-stage left toward wings | looking off-stage right at imagined audience | looking up to ceiling chandeliers | looking down composed | eyes briefly closed in stillness
- Expression: composed dignified | soft closed-mouth smile | focused concentration before performance | quiet wonder | thoughtful | tiny shy half-smile
- Movement: static still in classical pose | slight head turn motion | tutu gently moving | tulle of arm ruffle in air | hair stray strand near temple | breath of stillness
- Lighting variation: warm front-stage tungsten with deep falloff | strong rim from upstage source halo around bun | classical Rembrandt with shadow side toward camera | side wing-light cutting across | soft top key from above with falloff | half-silhouette against red velvet curtain
- Wardrobe detail: tiara visible and centred | no tiara, hair plain bun | off-shoulder ruffles symmetrical | small earrings | bare arms | thin shoulder strap visible | tutu fluffed | tutu compressed
- Environment detail: balcony tier lights bokeh | red velvet curtain partly drawn | gilded proscenium arch overhead | distant chandelier in soft bokeh | empty orchestra seats blurred | sheet music stand in deep bokeh | nothing extra
- Atmospheric: fine theatre dust in tungsten beam | warm halation around bulb lights | subtle haze | crisp clean stage air | shallow shadow play on stage floor

The result must look like one unique frame from a classical premium ballet editorial inside a historic opera house. Vary pose and framing strongly between generations. Identity, age, and natural proportions of the reference child remain non-negotiable.
$prompt$,
  'Детские', NULL, 1030, true, false, NULL
),

-- ============================================================================
-- 4. kids_savanna — Саванна (закат, акация, львёнок, золотое платье)
-- ============================================================================
(
  'kids_savanna',
  'Саванна',
  'Кинематографичный закатный портрет ребёнка-принцессы в саванне рядом с миролюбивым львёнком — золотая магическая атмосфера.',
$prompt$
[IDENTITY LOCK — must hold across every generation of this style]
Identity preservation directive: preserve the exact facial identity of the reference child — exact eye shape, exact eye color and iris pattern, exact cheekbone structure, exact jawline, exact nose bridge, exact lip shape, exact ear shape, exact hairline, exact hair color and texture. Preserve the exact age range of the reference child. Preserve realistic skin texture with natural pores; warm golden-hour glow on skin is acceptable, but never plastic doll smoothness or over-orange tan. Preserve natural body proportions for the child's age. Forbidden: replacing the child, plastic doll skin, anime eyes, cartoon proportions, exaggerated cuteness, over-large eyes, fairy-overlay glow, glittery aura, CGI-character look. Identity must remain recognisable as the same child across every variation.

[STYLE BIBLE — locked aesthetic of this photoshoot]
Cinematic golden-hour child editorial in an African savanna with a calm lion cub companion. Palette: warm gold, amber, sienna, soft dusty rose, deep coral sunset. Wardrobe code: long flowing princess-style dress in soft gold with delicate embroidery, beadwork and subtle sparkle (photographic, not CGI shine); tulle and silk-organza layered skirt; refined gold tiara on natural hair (loose curls preferred); barefoot or simple sandals; tasteful and age-appropriate. Companion: a single small lion cub — calm, resting beside or leaning against the child, NEVER aggressive, NEVER baring teeth, photographed with realistic wildlife photography quality (real fur texture, real amber eyes, no cartoon stylisation). The cub may be touching the child gently — paw on lap, head against shoulder, side-by-side on a rock. Setting: African savanna at full golden hour — single acacia tree silhouette, golden tall grass, distant rocky outcrops or kopjes, optional distant fairytale castle silhouette far on horizon (small, soft, photographic — not heavy fantasy CGI), warm dusty haze. Light philosophy: low golden sun behind subjects creating strong warm rim around hair and dress edges, soft warm fill on faces, real lens flare subtle and tasteful, real atmospheric dust. Camera: Sony A1 with 85mm f/1.4 GM, Kodak Portra 400 emulation, soft halation, slight bloom, warm cinematic grade. Reference editorials: Disney live-action campaign portraits, National Geographic emotional wildlife editorial, Annie Leibovitz Vogue fairytale series. Mood: enchanted, regal-but-tender, cinematic poster, sincere connection between child and animal.

[SHOT VARIATION — randomise on every generation]
For THIS specific frame, pick exactly one independent random value from each pool. Do not repeat combinations:
- Framing: extreme close-up of child's face with cub fur softly in foreground | classic close-up portrait | mid-shot child holding cub | three-quarter sitting on rock | full body together | wide environmental savanna landscape with two small figures
- Camera angle: eye-level low to ground | slight low-angle hero from below | slight high-angle observational | profile facing sun | three-quarter turn toward camera | over-the-shoulder of cub onto child's face
- Pose: sitting on rocky outcrop with cub leaning against | kneeling beside cub | standing tall with cub at feet looking up | sitting in grass with cub head on lap | walking past camera with cub following | turning back over shoulder | crouched at cub's level forehead-to-forehead | embracing cub gently
- Hands: one hand resting on cub's back | both arms around cub gently | one hand smoothing dress | hand reaching toward cub's nose | hands clasped softly | one hand lifting tiara hair | hand on rocky surface
- Gaze: direct calm eye contact in golden flare | looking off toward sunset horizon | looking down at cub with affection | eyes briefly closed feeling sun | looking up to acacia branches | looking back over shoulder
- Expression: serene wonder | soft closed-mouth smile | quiet awe | gentle compassion toward cub | dignified calm | tiny natural laugh
- Movement: static still | slight head turn | hair lifted by warm breeze | dress fabric in soft motion | cub blinking slowly | hand brushing grass
- Lighting variation: full backlight rim with sun flare between subjects | three-quarter back-rim warm | side warm low light | low front warm sun | nearly silhouette against sunset | soft after-sunset blue-warm edge
- Wardrobe detail: dress flowing freely | dress gathered to one side | tiara visible centred | tiara softly off to one side in hair | sleeves visible | bare shoulders | hair fully loose | hair partly held back
- Environment detail: single acacia tree dominant in frame | distant castle silhouette tiny on horizon | only flat grass plain | rocky kopje as seat | scattered wildflowers in foreground | distant herd silhouettes far away | nothing extra
- Atmospheric: warm golden dust haze | gentle late-afternoon heat shimmer | crisp clear evening | slight backlight bloom | shallow shadow play across grass

The result must look like one cinematic frame from a premium fairytale-realism photoshoot — real photography quality, no CGI character look. Vary pose, framing and environment between generations. Identity, age and natural proportions of the reference child remain non-negotiable. The lion cub must always read as a calm, gentle real animal — never threatening, never anthropomorphic.
$prompt$,
  'Детские', NULL, 1040, true, false, NULL
),

-- ============================================================================
-- 5. kids_ice_grace — Ледяная грация (фигуристка на арене)
-- ============================================================================
(
  'kids_ice_grace',
  'Ледяная грация',
  'Олимпийский редакторский портрет юной фигуристки в ледяном голубом костюме со стразами на профессиональной арене.',
$prompt$
[IDENTITY LOCK — must hold across every generation of this style]
Identity preservation directive: preserve the exact facial identity of the reference child — exact eye shape, exact eye color and iris pattern, exact cheekbone structure, exact jawline, exact nose bridge, exact lip shape, exact ear shape, exact hairline. The hair will be styled into a clean tight ballet/skating bun, but hairline and hair color remain those of the reference child. Preserve the exact age range. Preserve realistic skin texture with natural pores; controlled arena spotlight highlights are acceptable, but never plastic doll smoothness. Preserve natural body proportions for the child's age — never elongate the limbs into adult ballet proportions, never adultify the face, never sexualise the costume cut. Forbidden: replacing the child, plastic doll skin, anime eyes, cartoon proportions, exaggerated cuteness, sexualised pose or cut, fantasy aura, glowing eyes, CGI ice effects. Identity must remain recognisable as the same child across every variation.

[STYLE BIBLE — locked aesthetic of this photoshoot]
Olympic-style editorial of a young figure skater inside a professional ice arena. Palette: pale ice blue, silver, crystal white, deep cool navy in shadow areas, warm spotlight rim accent. Wardrobe code: elegant figure skating costume in pale ice blue with intricate silver crystal beadwork along bodice and shoulders, mesh sheer long sleeves with sparse beading at the cuffs, structured supportive bodice, fitted skirt of soft chiffon mid-thigh length (age-appropriate skating cut, never sexualised); white skating tights; classic white figure skates with ribbon-laced ankles; clean tight ballet/skating bun, optional small subtle hairpin sparkle. Setting: empty professional ice rink arena — real polished ice with skating mark patterns, professional rink boards painted in subtle Olympic-style colours and rings (generic five-ring motif acceptable, no specific brand text), audience deep dark in bokeh, broadcast camera silhouette far in background blur. Light philosophy: hard arena spotlights from above and side creating crisp rim around figure and bun, controlled cool fill from rink ice reflection, real shadow drama, low ambient, occasional fine ice crystal particles in air. Camera: Canon EOS R5 with 70-200mm f/2.8 L IS at 135mm, low ISO, slight motion crispness on dynamic frames, sports editorial low-key cinematic grade. Reference editorials: Olympic figure skating broadcast portraits, Vogue Skating profiles, Stéphane Lavoué athlete portraits, ESPN figure skating editorial. Mood: focused grace, dignified power, cinematic stillness inside motion.

[SHOT VARIATION — randomise on every generation]
For THIS specific frame, pick exactly one independent random value from each pool. Do not repeat combinations:
- Framing: close-up of focused eyes with arena bokeh lights | portrait shoulders-up showing beadwork detail | mid-shot waist-up | three-quarter mid-glide | full body in spread arabesque | full body silhouette against arena light | wide environmental of empty rink
- Camera angle: low-angle hero from ice level | eye-level | slight high-angle from broadcast position | profile mid-glide | three-quarter from behind | over-the-shoulder onto skate blade
- Pose: classical opening stance with arms wide | mid-glide with one leg extended back | spiral hold | preparing to spin with arms in | hands clasped in front bowing | resting one hand on knee post-program | walking off-ice toward camera with skates over shoulder | static portrait stance
- Hands: classical ballet hand position arms wide | one hand reaching forward | hands clasped in front | one hand at chest | both arms raised slightly | one hand on bun fixing
- Gaze: direct calm intensity to camera | looking off into distance toward judges | looking up to arena ceiling lights | looking down composed | eyes briefly closed mid-breath | looking sideways concentrating
- Expression: focused calm | quiet determination | soft closed-mouth confidence | post-program serene exhale | gentle controlled smile | thoughtful pre-program
- Movement: static still | mid-glide motion crisp | hair stray strand caught in motion | costume chiffon in motion | breath slightly visible in cool arena air | skate blade catching light
- Lighting variation: hard top arena spotlight + cool ice reflection fill | side arena spotlight with deep shadow on far side | back-rim with face in shadow but spotlit edge | warm key from one side, cool from ice | low-key with deep shadow | half-silhouette against bright bokeh
- Wardrobe detail: long mesh sleeves visible | sleeves slightly pushed up | skirt in motion | skirt static | crystal beadwork catching light brightly | beadwork in shadow detail | bun with subtle sparkle | bun plain | small earrings
- Environment detail: Olympic-style rings motif visible on rink board | rink boards plain with subtle logo blur | ice surface with skating tracks | broadcast camera silhouette in deep bokeh | distant judges' table | empty crowd seating in bokeh | nothing extra
- Atmospheric: fine ice crystal particles in spotlight | breath visible in cool air | very subtle haze | clean crisp arena air | shallow shadow play on ice

The result must look like one frame from a premium Olympic-quality figure skating editorial. Vary pose, framing and details strongly between generations. Identity, age and natural proportions of the reference child are non-negotiable.
$prompt$,
  'Детские', NULL, 1050, true, false, NULL
)

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Sanity check: сколько детских стилей теперь в БД
-- ============================================================================
DO $$
DECLARE n_kids INTEGER; n_total INTEGER;
BEGIN
  SELECT count(*) INTO n_kids FROM styles WHERE category = 'Детские';
  SELECT count(*) INTO n_total FROM styles;
  RAISE NOTICE 'Migration 004: kids styles = %, total styles = %', n_kids, n_total;
END $$;

-- ============================================================================
-- ROLLBACK (вручную, при необходимости):
--   DELETE FROM styles WHERE id IN (
--     'kids_sport_champion','kids_cozy_childhood','kids_ballet',
--     'kids_savanna','kids_ice_grace'
--   );
-- ============================================================================
