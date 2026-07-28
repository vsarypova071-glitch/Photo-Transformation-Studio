// Тесты v11 «живой фотосессии»: identity-контур, эмоция/действие, вариативность
// серии, отсутствие противоречий, лимит Gateway.
// Run: `npm test --prefix server`

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, buildNegativePrompt } from '../services/prompts';

// ---------------------------------------------------------------------------
// Все pickFromArray()/pickCharacterState()/pickComposition() и т.п. в prompts.ts
// используют глобальный Math.random() без возможности инъекции RNG. Тесты на
// вариативность/анти-повтор ниже поэтому не полагаются на "почти гарантированно
// повезёт со случайностью" — они на время своего выполнения подменяют
// Math.random() на детерминированный seeded-генератор (mulberry32) и
// восстанавливают оригинал в finally. Это даёт: 1) полностью воспроизводимую,
// одинаковую на каждом прогоне последовательность выборов; 2) отсутствие
// теоретической (пусть и исчезающе малой) вероятности случайного флейка.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withSeededRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

const BUSINESS_ELITE =
  '[CEO DAYLIGHT] Modern architectural glass tower — bright clean daylight through floor-to-ceiling windows, sparkling city skyline in background, polished steel and glass premium interior. Fashion: precision power suit in deep navy or charcoal. Color palette: deep navy, steel blue, crisp white, graphite.';

const MASTER_OF_LIFE =
  '[MEN: MASTER OF LIFE] A powerful executive man standing on a rocky cliff edge overlooking the African savanna at golden hour, a huge majestic lion beside him.';

const KIDS_ICE_GRACE = `[IDENTITY LOCK — must hold across every generation of this style]
Identity preservation directive: preserve the exact facial identity of the reference child — exact eye shape, exact eye color and iris pattern. Preserve the exact age range. Forbidden: replacing the child, plastic doll skin.

[STYLE BIBLE — locked aesthetic of this photoshoot]
Olympic-style editorial of a young figure skater inside a professional ice arena. Wardrobe code: elegant figure skating costume in pale ice blue with intricate silver crystal beadwork.

[SHOT VARIATION — randomise on every generation]
- Framing: close-up | portrait shoulders-up | mid-shot waist-up | three-quarter mid-glide | full body
- Pose: classical opening stance | mid-glide | spiral hold | preparing to spin
The result must look like one frame from a premium Olympic-quality figure skating editorial.`;

// ---------------------------------------------------------------------------
// 1. Identity preservation
// ---------------------------------------------------------------------------

test('buildPrompt includes the identity lock (face geometry, age/body/skin, hair, acceptance test)', () => {
  const p = buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female' });
  assert.match(p, /IDENTITY LOCK — HIGHEST PRIORITY/);
  assert.match(p, /FACE GEOMETRY/);
  assert.match(p, /AGE, BODY & SKIN/);
  assert.match(p, /unmistakably the same person at their most attractive/);
});

test('identity lock allows delicate rejuvenation and beauty retouching but bounds them to the same age category', () => {
  const p = buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female' });
  assert.match(p, /subtly younger/);
  assert.match(p, /professional, natural-looking beauty retouching/);
  assert.match(p, /never like a different generation or a radically different age/);
  assert.doesNotMatch(p, /no rejuvenation/);
});

test('identity lock allows refined hair styling but still locks cut, length and color', () => {
  const p = buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female' });
  assert.match(p, /no change of haircut, length, or color/);
  assert.match(p, /volume, waves, smoothness, a neat professional finish — may be refined for a polished/);
});

test('full-body generations get the reinforced (short) full-body identity addendum', () => {
  const p = buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female', isFullBody: true });
  assert.match(p, /FULL-BODY DISTANCE \(reinforcement\)/);
});

// ---------------------------------------------------------------------------
// 2. Emotion (CHARACTER) and concrete ACTION are present for standard editorial styles
// ---------------------------------------------------------------------------

test('a standard editorial style gets a CHARACTER, ACTION and COMPOSITION line', () => {
  const p = buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female' });
  assert.match(p, /^CHARACTER: .+$/m);
  assert.match(p, /^ACTION: .+$/m);
  assert.match(p, /^COMPOSITION: .+$/m);
});

test('MEN cinematic style gets a CHARACTER and ENVIRONMENT INTERACTION line, plus its own pose/atmosphere', () => {
  const p = buildPrompt({ styleId: 'master_of_life', stylePrompt: MASTER_OF_LIFE, genderMode: 'male', isFullBody: true });
  assert.match(p, /^CHARACTER: .+$/m);
  assert.match(p, /^ENVIRONMENT INTERACTION: .+$/m);
  assert.match(p, /^POSE: .+$/m);
  assert.match(p, /NO MAKEUP of any kind/);
  assert.match(p, /LION DIRECTION/);
});

// ---------------------------------------------------------------------------
// 3. A simulated series of the same style produces varied frames (no two
//    generations should read as the identical static photo).
// ---------------------------------------------------------------------------

test('repeated generations of the same style vary composition and action (not one static frame)', () => {
  withSeededRandom(1, () => {
    const outputs = Array.from({ length: 12 }, () =>
      buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female' }));
    const compositions = new Set(outputs.map((p) => p.match(/^COMPOSITION: (.+)$/m)?.[1]));
    const actions = new Set(outputs.map((p) => p.match(/^ACTION: (.+)$/m)?.[1]));
    assert.ok(compositions.size >= 2, `expected composition variety, got: ${[...compositions]}`);
    assert.ok(actions.size >= 2, `expected action variety, got: ${[...actions]}`);
  });
});

test('a simulated 6-photo series of one style yields at least 4 distinct character/action/composition combinations', () => {
  withSeededRandom(2, () => {
    const combos = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const p = buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female' });
      const combo = [
        p.match(/^CHARACTER: (.+)$/m)?.[1],
        p.match(/^ACTION: (.+)$/m)?.[1],
        p.match(/^COMPOSITION: (.+)$/m)?.[1],
      ].join('|');
      combos.add(combo);
    }
    assert.ok(combos.size >= 4, `expected >= 4 distinct combinations in 6 draws, got ${combos.size}`);
  });
});

// ---------------------------------------------------------------------------
// 4. No contradictory instructions
// ---------------------------------------------------------------------------

test('ACTION never claims a gaze direction — only COMPOSITION governs gaze (regression guard for a real bug found in review: "glancing back over one shoulder" + "profile, gaze forward, not at the lens" contradicted each other)', () => {
  withSeededRandom(3, () => {
    for (let i = 0; i < 60; i++) {
      const p = buildPrompt({
        styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female', isFullBody: i % 2 === 0,
      });
      const actionLine = p.match(/^ACTION: (.+)$/m)?.[1] ?? '';
      assert.doesNotMatch(actionLine, /camera|lens|gaze|glancing/i, `ACTION leaked a gaze claim: "${actionLine}"`);
    }
  });
});

test('the old global "avoid strong head turns / profiles" instruction no longer blocks standard editorial styles', () => {
  const p = buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female' });
  assert.doesNotMatch(p, /avoid strong head turns/i);
});

test('a standard editorial style (not frontal-locked) can render profile or three-quarter composition across repeated calls', () => {
  withSeededRandom(4, () => {
    const compositions = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const p = buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female' });
      compositions.add(p.match(/^COMPOSITION: (.+)$/m)?.[1] ?? '');
    }
    const hasVariety = [...compositions].some((c) => /profile|three-quarter/i.test(c));
    assert.ok(hasVariety, `expected a profile/three-quarter composition across 40 draws, got: ${[...compositions]}`);
  });
});

test('bw_portrait (clean, frontal-locked by design) never renders profile or three-quarter composition', () => {
  withSeededRandom(5, () => {
    for (let i = 0; i < 30; i++) {
      const p = buildPrompt({ styleId: 'bw_portrait', stylePrompt: '', genderMode: 'female' });
      const compositionLine = p.match(/^COMPOSITION: (.+)$/m)?.[1] ?? '';
      assert.doesNotMatch(compositionLine, /profile|three-quarter/i, `bw_portrait leaked non-frontal composition: "${compositionLine}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// 4b. social_portrait — v12 living beauty workflow (connects it to the same
//     IDENTITY_LOCK/CHARACTER/ACTION/ENVIRONMENT INTERACTION/negative-prompt
//     machinery as the rest of the catalog, instead of its own frozen,
//     anti-beauty, frontal-locked block).
// ---------------------------------------------------------------------------

// Real production stylePrompt (server/db/migrations/020_fix_missing_styles.sql).
// Deliberately using the REAL text, not a short stub: it contains "home workspace",
// which is exactly what tripped the LIFESTYLE_KEYWORDS false-positive this suite
// would have caught had a test like this existed before.
const SOCIAL_PORTRAIT_PROMPT = `[PREMIUM INFLUENCER PORTRAIT]
Modern natural lifestyle portrait — authentic, warm, effortlessly expensive.

Setting: sunlit Scandinavian apartment with white walls and warm oak details, soft beautiful window light streaming across clean surfaces; OR a stylish city specialty coffee shop with natural bright daylight and clean neutral background; OR an airy modern home workspace with indoor greenery, soft light, minimal premium decor.

Styling: quality everyday premium wear — smart casual, tasteful neutrals, wearable real clothing. Natural polished makeup. Clean natural hairstyle — not editorial-styled.

Expression: warm confident presence — genuine smile or calm approachable energy. Real, alive, emotionally present. Not blank model stare, not performative beauty shot.

FORBIDDEN: Vogue editorial aesthetic, luxury mansion interior, grand European villa, fashion campaign energy, dramatic cinematic lighting, evening glamour, yacht or resort backgrounds, staged runway posing, extreme makeup, fantasy or cosplay elements.`;

test('regression: social_portrait is correctly classified as editorial even though its real stylePrompt contains a LIFESTYLE_KEYWORDS false-positive ("home workspace")', () => {
  // Before the styleId safety net, detectIsEditorial() silently returned false here
  // (matched 'home' from LIFESTYLE_KEYWORDS), which would have routed social_portrait
  // into the child/family lifestyle branch instead of the editorial one.
  const p = buildPrompt({ styleId: 'social_portrait', stylePrompt: SOCIAL_PORTRAIT_PROMPT, genderMode: 'female' });
  assert.match(p, /^CHARACTER: .+$/m);
  // If detectIsEditorial() had misfired, buildPrompt() would have fallen into the
  // child/family lifestyle branch instead — this text is that branch's real marker.
  assert.doesNotMatch(p, /CHILD EMOTION & CINEMATIC LIFE/);
});

test('social_portrait now uses the main buildPrompt() machinery: IDENTITY_LOCK, CHARACTER, ACTION, ENVIRONMENT INTERACTION, and its own SOCIAL COMPOSITION line', () => {
  const p = buildPrompt({ styleId: 'social_portrait', stylePrompt: SOCIAL_PORTRAIT_PROMPT, genderMode: 'female' });
  assert.match(p, /IDENTITY LOCK — HIGHEST PRIORITY/);
  assert.match(p, /^CHARACTER: .+$/m);
  assert.match(p, /^ACTION: .+$/m);
  assert.match(p, /^ENVIRONMENT INTERACTION: .+$/m);
  assert.match(p, /^COMPOSITION: .+$/m);
});

test('social_portrait prompt includes flattering beauty language (retouching, freshness, makeup, hair styling) and pulls in the shared buildNegativePrompt()', () => {
  const p = buildPrompt({ styleId: 'social_portrait', stylePrompt: SOCIAL_PORTRAIT_PROMPT, genderMode: 'female' });
  assert.match(p, /BEAUTY & FRESHNESS/);
  assert.match(p, /professional, natural-looking beauty retouching/);
  assert.match(p, /subtly younger/);
  assert.match(p, /natural-looking makeup/);
  assert.match(p, /hair styling/i);
  // buildNegativePrompt() output (e.g. the v12 duplicated-face guard) must be present via AVOID.
  assert.match(p, /duplicated face/);
  assert.match(p, /cheap obvious social-media beauty-filter look/);
});

test('social_portrait no longer contains the old conflicting bans (anti-beauty, forced frontal lock, no-smile)', () => {
  const p = buildPrompt({ styleId: 'social_portrait', stylePrompt: SOCIAL_PORTRAIT_PROMPT, genderMode: 'female' });
  assert.doesNotMatch(p, /NO BEAUTY TRANSFORMATION/);
  assert.doesNotMatch(p, /Do not beautify/);
  assert.doesNotMatch(p, /Do not improve attractiveness/i);
  assert.doesNotMatch(p, /\bno rejuvenation\b/i);
  assert.doesNotMatch(p, /must look like THEMSELVES — not like a more attractive/);
  assert.doesNotMatch(p, /HEAD ANGLE — CRITICAL FOR IDENTITY/);
  assert.doesNotMatch(p, /do NOT turn or tilt the head/);
  assert.doesNotMatch(p, /NO three-quarter face angle/);
});

test('social_portrait composition allows safe variability (turn/tilt/off-center/gaze-past-camera) across repeated calls, but never true profile or full body', () => {
  withSeededRandom(7, () => {
    const compositions = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const p = buildPrompt({ styleId: 'social_portrait', stylePrompt: SOCIAL_PORTRAIT_PROMPT, genderMode: 'female' });
      const c = p.match(/^COMPOSITION: (.+)$/m)?.[1] ?? '';
      compositions.add(c);
      assert.doesNotMatch(c, /\bprofile\b/i, `social_portrait composition leaked a profile shot: "${c}"`);
      assert.doesNotMatch(c, /full.?body/i, `social_portrait composition leaked full-body framing: "${c}"`);
      assert.doesNotMatch(c, /extreme/i, `social_portrait composition leaked an extreme angle: "${c}"`);
    }
    assert.ok(compositions.size >= 3, `expected safe variability across 40 draws, got: ${[...compositions]}`);
    const hasBoundedTurn = [...compositions].some((c) => /three-quarter|tilt|off-center|past the (lens|camera)/i.test(c));
    assert.ok(hasBoundedTurn, `expected at least one bounded turn/tilt/off-center/gaze-past-camera composition, got: ${[...compositions]}`);
  });
});

test('social_portrait identity lock (bone structure, geometry, recognizability) is preserved unchanged', () => {
  const p = buildPrompt({ styleId: 'social_portrait', stylePrompt: SOCIAL_PORTRAIT_PROMPT, genderMode: 'female' });
  assert.match(p, /LOCK FACE GEOMETRY — NON-NEGOTIABLE/);
  assert.match(p, /Face identity similarity must remain above 95%/);
  assert.match(p, /FACE GEOMETRY \(copy exactly from the reference photo/);
});

test('social_portrait stays well under the Gateway safety cap', () => {
  withSeededRandom(8, () => {
    for (let i = 0; i < 10; i++) {
      const p = buildPrompt({ styleId: 'social_portrait', stylePrompt: SOCIAL_PORTRAIT_PROMPT, genderMode: 'female' });
      assert.ok(p.length < 27000, `expected < 27000 chars, got ${p.length}`);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Negative prompt: text/logo/watermark present, stale gaze-away ban removed
// ---------------------------------------------------------------------------

test('buildNegativePrompt covers text/logo/watermark and no longer blanket-forbids looking away from camera', () => {
  const neg = buildNegativePrompt();
  assert.match(neg, /watermark/);
  assert.match(neg, /logos/);
  assert.match(neg, /text overlay/);
  assert.doesNotMatch(neg, /looking away from camera/);
  assert.doesNotMatch(neg, /side glance/);
});

test('buildNegativePrompt guards against duplicated/overlapping faces', () => {
  const neg = buildNegativePrompt();
  assert.match(neg, /duplicated face/);
  assert.match(neg, /double face artifact/);
  assert.match(neg, /overlapping facial features/);
  assert.match(neg, /second face in frame/);
});

test('buildNegativePrompt only blocks cheap/extreme beauty artifacts, not flattering retouching', () => {
  const neg = buildNegativePrompt();
  assert.match(neg, /cheap obvious social-media beauty-filter look/);
  assert.doesNotMatch(neg, /\bbeauty filter\b/);
  assert.match(neg, /over-smoothed airbrushed skin/);
  assert.match(neg, /flawless artificial face/);
});

test('buildNegativePrompt bounds age drift both ways without banning delicate rejuvenation', () => {
  const neg = buildNegativePrompt();
  assert.match(neg, /radically different apparent age/);
  assert.match(neg, /unnaturally childlike or excessively rejuvenated face/);
  assert.doesNotMatch(neg, /added wrinkles/);
  assert.doesNotMatch(neg, /older worn appearance/);
});

test('buildNegativePrompt allows hair restyling but still locks haircut and color', () => {
  const neg = buildNegativePrompt();
  assert.match(neg, /different haircut or length/);
  assert.match(neg, /changed hair color/);
  assert.doesNotMatch(neg, /changed hairstyle/);
});

// ---------------------------------------------------------------------------
// 6. Length stays safely under the Gateway limit (30000, deployed on the AI
//    Gateway) — target band 18000-22000, hard cap 27000 per spec.
// ---------------------------------------------------------------------------

test('buildPrompt output stays under the 27000-char safety cap for realistic worst-case styles', () => {
  withSeededRandom(6, () => {
    const cases = [
      buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'female', isFullBody: true }),
      buildPrompt({ styleId: 'business_elite', stylePrompt: BUSINESS_ELITE, genderMode: 'male', isFullBody: true }),
      buildPrompt({ styleId: 'master_of_life', stylePrompt: MASTER_OF_LIFE, genderMode: 'male', isFullBody: true }),
      buildPrompt({ styleId: 'kids_ice_grace', stylePrompt: KIDS_ICE_GRACE, genderMode: 'male', isFullBody: true }),
    ];
    for (const p of cases) {
      assert.ok(p.length < 27000, `expected < 27000 chars, got ${p.length}`);
    }
  });
});
