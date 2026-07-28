// Regression tests from the full-catalog audit (2026-07-28), updated after the
// fix pass for the two FAIL findings (scandinavian_minimal misclassification,
// adult gender-block leaking into kids styles) and the bw_portrait WARNING
// (full-body composition variety). The social_portrait "no full body" WARNING
// fix was itself reversed the same day — full body is a supported product
// decision again (social media = posts/Reels/personal brand, not just an
// avatar) — see section 8 below for the reinstated full-body pool/tests.
// Run: `npm test --prefix server`
//
// Style-prompt fixtures below are verbatim copies of the real production DB
// text captured at audit time (server/db `styles.prompt`), not paraphrases —
// so a fixture going stale is itself informative (DB text changed since).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildPrompt,
  buildNegativePrompt,
  buildSocialPortraitMinimalPrompt,
  buildSocialPortraitShortPrompt,
} from '../services/prompts';

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
  try { return fn(); } finally { Math.random = original; }
}

// ---------------------------------------------------------------------------
// 1. Feature flags / bypass routes that can skip the main buildPrompt() path.
//    Guards against silent drift: if these ever get re-activated on production
//    without updating their content to match the living-beauty concept, this
//    is where that mismatch would first become visible.
// ---------------------------------------------------------------------------

test('buildSocialPortraitMinimalPrompt() still contains its original restrictive content (documents what SOCIAL_PORTRAIT_MINIMAL=1 would currently ship, in case it is ever re-enabled)', () => {
  const p = withSeededRandom(9001, () => buildSocialPortraitMinimalPrompt('female'));
  assert.match(p, /Do not beautify/);
  assert.match(p, /do not rejuvenate/);
  assert.match(p, /no smile, no teeth/);
  assert.match(p, /do NOT turn or tilt the head/);
});

test('buildSocialPortraitShortPrompt() (InstantID/Replicate path) still contains its original restrictive negative prompt', () => {
  const { negativePrompt } = withSeededRandom(9002, () => buildSocialPortraitShortPrompt('female'));
  assert.match(negativePrompt, /\byounger face\b/);
  assert.match(negativePrompt, /\bbeauty filter\b/);
});

// ---------------------------------------------------------------------------
// 2. social_portrait routing (already fixed, commit 8f9c5cf) — guard against
//    regressing back to the old frontal-locked, anti-beauty socialPortraitBlock.
// ---------------------------------------------------------------------------

const SOCIAL_PORTRAIT_REAL_PROMPT = '[PREMIUM INFLUENCER PORTRAIT] Completely replace all clothing with a modern, high-end fashion outfit — structured premium fabrics (silk, cashmere, fine wool).';

test('social_portrait main buildPrompt() path stays connected to the living-beauty system (CHARACTER/ACTION/COMPOSITION/BEAUTY)', () => {
  const p = buildPrompt({ styleId: 'social_portrait', stylePrompt: SOCIAL_PORTRAIT_REAL_PROMPT, genderMode: 'female' });
  assert.match(p, /^CHARACTER: /m);
  assert.match(p, /^ACTION: /m);
  assert.match(p, /^COMPOSITION: /m);
  assert.match(p, /professional, natural-looking beauty retouching/);
  assert.doesNotMatch(p, /HEAD ANGLE — CRITICAL FOR IDENTITY/);
});

// ---------------------------------------------------------------------------
// 3. FIXED (audit finding #1): detectIsEditorial()'s LIFESTYLE_KEYWORDS
//    substring match had no styleId safety net for scandinavian_minimal, whose
//    real prompt contains "cozy" twice — it was silently misclassified as
//    lifestyle, dropping the entire editorial/living-beauty machinery and
//    injecting childLifestyleBlock into an adult luxury style. Fixed by adding
//    'scandinavian_minimal' to EDITORIAL_STYLE_ID_OVERRIDE (same pattern as
//    social_portrait).
// ---------------------------------------------------------------------------

const SCANDINAVIAN_MINIMAL_REAL_PROMPT = '[ALPINE LUXURY] Swiss Alps luxury chalet interior — warm wooden beams and panels, panoramic glass window view of snow-covered mountains in bright winter daylight, cozy premium textiles, warm fireplace amber glow. Bright winter daylight through large glass with warm interior contrast — light, warm, expensive. Premium winter fashion: oversized cashmere sweater, luxury knit in snow white, warm camel or ice blue, elegant winter coat. Warm cozy expensive winter lifestyle. Color palette: snow white, ice blue, warm wood amber, soft camel, gentle firelight.';

test('FIXED: scandinavian_minimal is classified as editorial despite "cozy" in its real prompt, and gets the full living-beauty machinery', () => {
  const p = buildPrompt({ styleId: 'scandinavian_minimal', stylePrompt: SCANDINAVIAN_MINIMAL_REAL_PROMPT, genderMode: 'female' });
  assert.match(p, /IDENTITY LOCK — HIGHEST PRIORITY/);
  assert.match(p, /professional, natural-looking beauty retouching/, 'adult BEAUTY & FRESHNESS-equivalent language must be present');
  assert.match(p, /^CHARACTER: /m);
  assert.match(p, /^ACTION: /m);
  assert.match(p, /^ENVIRONMENT INTERACTION: /m);
  assert.match(p, /^COMPOSITION: /m);
  assert.match(p, /^LIGHTING: /m);
  assert.match(p, /^OUTFIT INSPIRATION: /m, 'adult editorial wardrobe line must be present');
  assert.doesNotMatch(p, /CHILD EMOTION & CINEMATIC LIFE/, 'child-lifestyle block must not appear in an adult luxury style');
  assert.doesNotMatch(p, /luxury glamour child model/, 'kids-specific AVOID extras must not appear in an adult style');
});

// ---------------------------------------------------------------------------
// 4. FIXED (audit finding #2): genderPositiveBlock/menGenderBlock used to be
//    added unconditionally for EVERY style (not gated by isEditorial), so
//    every kids-style generation received adult fashion/beauty-routine
//    language: "This is a female portrait. The subject is a woman... Refined
//    makeup applied naturally" (or the male equivalent, including a shaving
//    instruction). Fixed with a dedicated CHILD_IDENTITY_LOCK (replaces the
//    adult IDENTITY_LOCK for the lifestyle branch) and buildChildSubjectBlock()
//    (replaces genderPositiveBlock/menGenderBlock — uses "girl"/"boy"/"child").
// ---------------------------------------------------------------------------

const KIDS_BALLET_REAL_PROMPT_SNIPPET = '[KIDS: BALLET] A young girl figure skater / ballet dancer in an elegant pale blue costume with crystal beadwork, premium Olympic/ballet editorial aesthetic.';

test('FIXED: kids styles no longer receive the adult "This is a female/male portrait ... makeup/grooming" gender-styling block', () => {
  const pFemale = buildPrompt({ styleId: 'kids_ballet', stylePrompt: KIDS_BALLET_REAL_PROMPT_SNIPPET, genderMode: 'female' });
  assert.doesNotMatch(pFemale, /This is a female portrait\. The subject is a woman/);
  assert.doesNotMatch(pFemale, /Refined makeup applied naturally/);
  assert.match(pFemale, /^SUBJECT: This is a real girl\./m);

  const pMale = buildPrompt({ styleId: 'kids_ballet', stylePrompt: KIDS_BALLET_REAL_PROMPT_SNIPPET, genderMode: 'male' });
  assert.doesNotMatch(pMale, /This is a male portrait\. The subject is a man/);
  assert.doesNotMatch(pMale, /clean shave or light stubble/);
  assert.match(pMale, /^SUBJECT: This is a real boy\./m);

  const pNeutral = buildPrompt({ styleId: 'kids_ballet', stylePrompt: KIDS_BALLET_REAL_PROMPT_SNIPPET });
  assert.match(pNeutral, /^SUBJECT: This is a real child\./m, 'no genderMode supplied → neutral "child" wording');
});

test('FIXED: kids styles use CHILD_IDENTITY_LOCK, not the adult IDENTITY_LOCK beauty/rejuvenation language', () => {
  const p = buildPrompt({ styleId: 'kids_ballet', stylePrompt: KIDS_BALLET_REAL_PROMPT_SNIPPET, genderMode: 'female' });
  assert.match(p, /IDENTITY LOCK — HIGHEST PRIORITY/);
  assert.match(p, /This is a photograph of a real child/);
  assert.match(p, /preserve the child's exact real age and age category/);
  assert.doesNotMatch(p, /\bsubtly younger\b/);
  assert.doesNotMatch(p, /professional, natural-looking beauty retouching/);
  // "makeup" legitimately appears as something FORBIDDEN ("no makeup", "adult
  // makeup") — check it's never instructed/applied, not that the word is absent.
  assert.doesNotMatch(p, /Refined makeup applied/i);
  assert.doesNotMatch(p, /apply(?:ing)? makeup/i);
  assert.doesNotMatch(p, /best real version of themselves/i);
});

test('FIXED: kids styles keep the existing safe childLifestyleBlock and its variability untouched', () => {
  const p = buildPrompt({ styleId: 'kids_ballet', stylePrompt: KIDS_BALLET_REAL_PROMPT_SNIPPET, genderMode: 'female' });
  assert.match(p, /CHILD EMOTION & CINEMATIC LIFE/);
  assert.match(p, /luxury glamour child model/, 'kids-specific AVOID protections must remain');
  const envSet = withSeededRandom(9100, () =>
    new Set(Array.from({ length: 10 }, () =>
      buildPrompt({ styleId: 'kids_ballet', stylePrompt: KIDS_BALLET_REAL_PROMPT_SNIPPET, genderMode: 'female' })
        .match(/^ENVIRONMENT INTERACTION: (.+)$/m)?.[1])));
  assert.ok(envSet.size >= 2, `expected environment variety, got: ${[...envSet]}`);
});

// ---------------------------------------------------------------------------
// 5. MEN cinematic tag detection — all 8 [MEN: ...] catalog styles must carry
//    both the generic [MEN: tag and their specific sub-tag, or they silently
//    fall back to generic pose/wardrobe/atmosphere instead of their bespoke one.
// ---------------------------------------------------------------------------

const MEN_TAG_FIXTURES: Array<[string, string]> = [
  ['men_desert_king', '[MEN: DESERT KING] Medium full-body shot of a ruggedly handsome man standing confidently.'],
  ['men_big_catch', '[MEN: BIG CATCH] Raw cinematic photograph of a man proudly holding a huge monstrous fish.'],
  ['men_king_ocean', '[MEN: KING OF THE OCEAN] Medium full-body shot of a confident athletic man standing on a yacht.'],
  ['men_master_life', '[MEN: MASTER OF LIFE] Full body shot of a powerful man in a charcoal tailored business suit.'],
  ['tech_founder', '[MEN: INTELLECTUAL] Premium cinematic editorial portrait of an intelligent, educated man.'],
  ['private_jet', '[MEN: PRIVATE JET] Luxury cinematic portrait of a confident successful man relaxing on a jet.'],
  ['surfer', '[MEN: ATHLETE] Cinematic editorial portrait of a fit athletic man in premium sportswear.'],
  ['legend_warrior', '[MEN: LEGEND WARRIOR] Epic cinematic portrait of a rugged powerful warrior wearing armor.'],
];

for (const [styleId, stylePrompt] of MEN_TAG_FIXTURES) {
  test(`MEN cinematic style ${styleId}: male generation gets its bespoke POSE/ATMOSPHERE, not the generic fallback`, () => {
    const p = buildPrompt({ styleId, stylePrompt, genderMode: 'male' });
    assert.match(p, /^CHARACTER: /m);
    assert.match(p, /^ENVIRONMENT INTERACTION: /m);
    assert.doesNotMatch(p, /^ACTION: /m, 'MEN cinematic styles use POSE, not the generic ACTION line');
    assert.doesNotMatch(p, /^COMPOSITION: /m, 'MEN cinematic styles use POSE, not the generic COMPOSITION line');
    assert.match(p, /^POSE: /m);
  });
}

// ---------------------------------------------------------------------------
// 6. Generic LIFESTYLE_KEYWORDS false-positive guard — reusable check any
//    adult style's real stylePrompt can be run through before it ships, so the
//    next "cozy"/"home"-style incident is caught before deploy instead of after.
// ---------------------------------------------------------------------------

function wouldBeMisclassifiedAsLifestyle(stylePrompt: string, styleId: string): boolean {
  const p = buildPrompt({ styleId, stylePrompt, genderMode: 'female' });
  return !/^CHARACTER: /m.test(p);
}

test('LIFESTYLE_KEYWORDS false-positive guard: a style whose real text is adult/editorial must not be silently misclassified as lifestyle', () => {
  assert.equal(wouldBeMisclassifiedAsLifestyle(SCANDINAVIAN_MINIMAL_REAL_PROMPT, 'scandinavian_minimal'), false,
    'fixed via EDITORIAL_STYLE_ID_OVERRIDE — flip back to true only if that override is ever removed');
  assert.equal(wouldBeMisclassifiedAsLifestyle('[ALPINE LUXURY] Warm fireplace amber glow, premium winter fashion.', 'scandinavian_minimal_hypothetical_safe_text'), false);
});

// ---------------------------------------------------------------------------
// 7. FIXED (audit WARNING): bw_portrait's full-body composition pool had
//    exactly one entry — 0% variability for that specific combo. Expanded to
//    4, keeping the strict frontal-head lock (the one proven-sensitive point).
// ---------------------------------------------------------------------------

test('FIXED: bw_portrait full-body compositions now vary (no longer a single static line) while staying frontal-locked', () => {
  withSeededRandom(9200, () => {
    const compositions = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const p = buildPrompt({ styleId: 'bw_portrait', stylePrompt: '', genderMode: 'female', isFullBody: true });
      const c = p.match(/^COMPOSITION: (.+)$/m)?.[1] ?? '';
      compositions.add(c);
      assert.match(c, /face frontal to the camera/, 'frontal lock must remain — the one proven-sensitive point for this style');
      assert.doesNotMatch(c, /profile|three-quarter/i);
    }
    assert.ok(compositions.size >= 2, `expected full-body composition variety, got: ${[...compositions]}`);
  });
});

// ---------------------------------------------------------------------------
// 8. REVERSED (product decision, 2026-07-28): social_portrait full body was
//    briefly disallowed (audit WARNING fix), then reinstated — social media
//    covers posts/Reels/personal brand, not only an avatar close-up. This
//    section replaces the old "reject full body" tests with their opposite:
//    full body must work end-to-end again, with its own composition pool.
//    No DI-testable Express harness exists for routes/generation.ts yet (it
//    imports the real db pool directly, unlike routes/payment.ts's factory
//    pattern), so the route-level checks here are source-level regression
//    guards, same technique as elsewhere in this file.
// ---------------------------------------------------------------------------

test('REVERSED: generation.ts no longer rejects social_portrait + isFullBody — the old guard and its error code are gone', () => {
  const src = fs.readFileSync(path.join(__dirname, '../routes/generation.ts'), 'utf8');
  assert.doesNotMatch(src, /full_body_not_supported/);
  assert.doesNotMatch(src, /styleId === 'social_portrait' && body\.isFullBody/);
});

test('credit debit still runs unconditionally right after style resolution — no residual per-style bypass left behind by the reverted guard', () => {
  const src = fs.readFileSync(path.join(__dirname, '../routes/generation.ts'), 'utf8');
  const marker = 'const stylePrompt = styleRows[0].prompt as string;';
  const styleIdx = src.indexOf(marker);
  const debitIdx = src.indexOf('Atomic debit + create generation row');
  assert.ok(styleIdx !== -1 && debitIdx !== -1, 'expected markers not found in generation.ts');
  const between = src.slice(styleIdx + marker.length, debitIdx);
  assert.doesNotMatch(between, /if\s*\(/, `unexpected conditional between style resolution and credit debit: ${JSON.stringify(between)}`);
});

test('REVERSED: StudioScreen.tsx shows the "Во весь рост" toggle for social_portrait again (no style-specific exclusion left in the JSX condition)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/components/screens/StudioScreen.tsx'), 'utf8');
  assert.doesNotMatch(src, /selectedStyleId !== 'social_portrait'/);
  assert.match(src, /!isPairMode && studioTab !== 'together' && studioTab !== 'male' && \(/,
    'expected the original (pair/male-only) toggle-visibility condition, with the social_portrait exclusion removed');
});

test('social_portrait full body: own COMPOSITIONS_SOCIAL_PORTRAIT_FULLBODY pool is wired in, portrait mode is untouched', () => {
  const portraitCompositions = new Set<string>();
  const fullBodyCompositions = new Set<string>();
  withSeededRandom(9300, () => {
    for (let i = 0; i < 20; i++) {
      const pPortrait = buildPrompt({ styleId: 'social_portrait', stylePrompt: SOCIAL_PORTRAIT_REAL_PROMPT, genderMode: 'female', isFullBody: false });
      const pFull = buildPrompt({ styleId: 'social_portrait', stylePrompt: SOCIAL_PORTRAIT_REAL_PROMPT, genderMode: 'female', isFullBody: true });
      portraitCompositions.add(pPortrait.match(/^COMPOSITION: (.+)$/m)?.[1] ?? '');
      fullBodyCompositions.add(pFull.match(/^COMPOSITION: (.+)$/m)?.[1] ?? '');
    }
  });
  // The two pools must never overlap — proves each mode draws from its own pool.
  const overlap = [...portraitCompositions].filter((c) => fullBodyCompositions.has(c));
  assert.equal(overlap.length, 0, `portrait and full-body composition pools must not overlap, found: ${overlap}`);
  assert.ok(fullBodyCompositions.size >= 2, 'expected full-body composition variety');
});
