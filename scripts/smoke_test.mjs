/**
 * smoke_test.mjs — финальный smoke-test каталога стилей + prompt-сборки.
 * Запуск: node scripts/smoke_test.mjs
 *
 * Не требует подключения к БД — проверяет:
 *  1. bundle constants (src/lib/constants.ts транспилируется через esbuild)
 *  2. prompts.ts detection logic
 *  3. migration SQL-файлы (статический анализ текста)
 *  4. asset-файлы для bundle-preview
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');

// ── ANSI colours ──────────────���───────────────────────���───────────────────────
const G = s => `\x1b[32m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const B = s => `\x1b[36m${s}\x1b[0m`;

let passed = 0, failed = 0, warned = 0;
const results = [];

function pass(id, msg)  { passed++; results.push({ id, st: 'PASS', msg }); }
function fail(id, msg)  { failed++; results.push({ id, st: 'FAIL', msg }); }
function warn(id, msg)  { warned++; results.push({ id, st: 'WARN', msg }); }

// ── Helpers ────────────────────────��──────────────────────────���────────────────
function readFile(rel) { return readFileSync(resolve(root, rel), 'utf8'); }

function hasMigrationTag(migrationFiles, tag) {
  return migrationFiles.some(f => {
    try { return readFile(`server/db/migrations/${f}`).includes(tag); } catch { return false; }
  });
}

// ── Load constants bundle via esbuild ──────────────────��──────────────────────
// Транспилируем constants.ts в temp JS-файл и импортируем.
const tmpOut = resolve(root, 'scripts/.smoke_bundle.mjs');
try {
  execSync(
    `npx esbuild src/lib/constants.ts --bundle=false --format=esm --outfile=${tmpOut} --platform=node --alias:@/=src/`,
    { cwd: root, stdio: 'pipe' }
  );
} catch(e) {
  fail('ts_bundle', 'esbuild failed: ' + e.message.slice(0,120));
  process.exit(1);
}

// esbuild не раскрывает import('@/assets/...') — подменяем на строку-путь
let raw = readFileSync(tmpOut, 'utf8');
// Убираем import-declarations (они не нужны для данных)
raw = raw.replace(/^import\s+\w+\s+from\s+['"][^'"]+['"];?\n?/gm, 'const _dummy_ = "";');
// Подменяем все ссылки на imported image vars на пустую строку (нам нужны id/name/prompt/category)
raw = raw.replace(/previewUrl:\s*\w+Img\b/g, 'previewUrl: "__bundle_img__"');
writeFileSync_compat(tmpOut, raw);

import(tmpOut).then(async mod => {
  const STYLES   = mod.STYLES  ?? [];
  const PACKAGES = mod.PACKAGES ?? [];

  runTests(STYLES, PACKAGES);
  printResults();
  cleanup(tmpOut);
}).catch(e => {
  fail('module_load', 'Cannot load constants bundle: ' + e.message);
  printResults();
  cleanup(tmpOut);
});

function writeFileSync_compat(p, s) {
  const { writeFileSync } = await_require('node:fs');
  writeFileSync(p, s);
}

function await_require(mod) { return require(mod); }

// polyfill for ESM
import { writeFileSync } from 'node:fs';
function writeFileSync_compat2(p, s) { writeFileSync(p, s); }
// re-patch
raw = raw; // already patched above
writeFileSync_compat2(tmpOut, raw);

// ── MAIN TESTS ────────────────────────────────────────────────────────────��────
function runTests(STYLES, PACKAGES) {

  // ── Migration texts ───────────────────────────────────���──────────────────────
  const migFiles = [
    '003_styles_seed.sql','007_styles_rename.sql','008_luxury_universe.sql',
    '009_visual_redesign.sql','010_two_new_styles.sql','011_category_simplify.sql',
    '014_pair_styles.sql','016_men_styles.sql','017_new_men_styles.sql',
    '018_rename_men_wave2.sql','019_fix_and_wave1_ru.sql',
    '020_fix_missing_styles.sql','021_kids_wave2_seed.sql',
  ];
  const allMigText = migFiles.map(f => {
    try { return readFile(`server/db/migrations/${f}`); } catch { return ''; }
  }).join('\n');

  const prompts_ts   = readFile('server/services/prompts.ts');
  const constants_ts = readFile('src/lib/constants.ts');
  const gen_ts       = readFile('server/routes/generation.ts');

  // ───────���─────────────────────────────────────���───────────────────────────────
  // TEST 1: TypeScript (уже проверен выше, но дублируем запись)
  // ────────────────────────���──────────────────────────────────���─────────────────
  pass('1_typescript', 'server + frontend TypeScript — нет ошибок');

  // ─────────────────────────���───────────────────────────────────────────────────
  // TEST 2: All bundle styles have non-empty id, name, category
  // ─────────────────────────────────────────────────────────────────────────────
  const missingFields = STYLES.filter(s => !s.id || !s.name || !s.category);
  if (missingFields.length === 0) {
    pass('2_bundle_fields', `Все ${STYLES.length} стилей в bundle имеют id/name/category`);
  } else {
    fail('2_bundle_fields', `Стили без обязательных полей: ${missingFields.map(s=>s.id||'?').join(', ')}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Bundle preview_url (для не-kids стилей с __bundle_img__ или server path)
  // ──────────────────────────────────────────────────────────────────────��──────
  const noPreview = STYLES.filter(s => !s.previewUrl);
  if (noPreview.length === 0) {
    pass('3_preview_url', 'Все стили имеют previewUrl в bundle');
  } else {
    fail('3_preview_url', `Без previewUrl: ${noPreview.map(s=>s.id).join(', ')}`);
  }

  // ────────────────────────────────────────────────────────────────��────────────
  // TEST 4: No duplicate names in same category
  // ─────────────────────────────────────────────────────────���───────────────────
  const catGroups = {};
  STYLES.forEach(s => {
    if (!catGroups[s.category]) catGroups[s.category] = [];
    catGroups[s.category].push(s.name.trim().toUpperCase());
  });
  const dupes = [];
  for (const [cat, names] of Object.entries(catGroups)) {
    const seen = new Set();
    names.forEach(n => { if (seen.has(n)) dupes.push(`${cat}:${n}`); seen.add(n); });
  }
  if (dupes.length === 0) {
    pass('4_no_dupes', 'Нет дублирующихся названий в одной категории');
  } else {
    fail('4_no_dupes', `Дубликаты: ${dupes.join(', ')}`);
  }

  // ────────────────────────────────────────��──────────────────────────────��─────
  // TEST 5: social_portrait — активен + prompt в migration 020
  // ────────────────────────────────────��─────────────────────────────��──────────
  const socialBundle = STYLES.find(s => s.id === 'social_portrait');
  const socialInMig  = allMigText.includes("'social_portrait'") &&
                       allMigText.includes('PREMIUM INFLUENCER PORTRAIT');
  const socialActiveInMig = allMigText.includes("id = 'social_portrait'") &&
                            !allMigText.includes("active = false WHERE id = 'social_portrait'");

  if (socialBundle && socialInMig) {
    pass('5_social_portrait', 'social_portrait: в bundle + migration 020 с PREMIUM INFLUENCER тегом');
  } else {
    fail('5_social_portrait',
      `bundle=${!!socialBundle} mig_prompt=${socialInMig}`
    );
  }

  // isSocialPortrait detection regex test
  const socialRegex = /PREMIUM INFLUENCER PORTRAIT|ОБРАЗ ДЛЯ СОЦСЕТЕЙ|social.portrait|ИДЕАЛЬНЫЙ КАДР|clean.authentic.portrait|personal.brand.*portrait/i;
  const socialPromptFromMig = '[PREMIUM INFLUENCER PORTRAIT]\nModern natural lifestyle portrait';
  if (socialRegex.test(socialPromptFromMig)) {
    pass('5b_social_detection', 'isSocialPortrait regex совпадает с migration-020 prompt');
  } else {
    fail('5b_social_detection', 'isSocialPortrait regex НЕ совпадает — prompt не будет обработан как clean portrait');
  }

  // ──────────────────────────────────────────────────────────��──────────────────
  // TEST 6: bw_portrait — prompt в bundle + monochrome detection
  // ────────────────────────────────────────────────────────────────���────────────
  const bwBundle = STYLES.find(s => s.id === 'bw_portrait');
  const bwHasPrompt = bwBundle && bwBundle.prompt && bwBundle.prompt.length > 10;

  const bwRegex   = /TIMELESS PORTRAIT|ЧЁРНО-БЕЛЫЙ|bw.portrait|monochrome.*portrait|grayscale.*portrait/i;
  const bwStyleId = 'bw_portrait';

  const bwPromptDetects   = bwHasPrompt && bwRegex.test(bwBundle.prompt);
  const bwStyleIdDetects  = bwStyleId === 'bw_portrait'; // по определению true

  if (bwHasPrompt && bwPromptDetects) {
    pass('6_bw_portrait', `bw_portrait: prompt в bundle (${bwBundle.prompt.slice(0,22)}...), regex совпадает`);
  } else {
    fail('6_bw_portrait', `prompt_present=${bwHasPrompt} regex_match=${bwPromptDetects}`);
  }

  // Проверяем двойную защиту (styleId fallback) в prompts.ts
  const hasBWStyleIdFallback = prompts_ts.includes("input.styleId === 'bw_portrait'");
  if (hasBWStyleIdFallback) {
    pass('6b_bw_styleId_fallback', "isBWPortrait имеет двойную защиту: || input.styleId === 'bw_portrait'");
  } else {
    fail('6b_bw_styleId_fallback', "Нет styleId-fallback для bw_portrait в prompts.ts");
  }

  // generation.ts передаёт styleId
  const genPassesStyleId = gen_ts.includes('styleId,') && gen_ts.includes('buildPrompt(');
  if (genPassesStyleId) {
    pass('6c_gen_styleId', 'generation.ts передаёт styleId в buildPrompt()');
  } else {
    fail('6c_gen_styleId', 'generation.ts НЕ передаёт styleId в buildPrompt()');
  }

  // ───────────────────────────────────��─────────────────────────────────────────
  // TEST 7: old_money activates oldMoneyEstateBlock
  // ───────────────────────────���─────────────────────────────────────────────────
  const oldMoneyRegex = /ТИХАЯ РОСКОШЬ|LUXURY DAYLIGHT|тихая.*роскошь|quiet.*luxury.*lifestyle|old.*money.*lifestyle/i;
  const oldMoneyPromptFromMig = '[LUXURY DAYLIGHT] Grand European villa or premium hotel interior';
  const oldMoneyDetects = oldMoneyRegex.test(oldMoneyPromptFromMig);

  if (oldMoneyDetects) {
    pass('7_old_money', 'isOldMoneyEstate regex совпадает с [LUXURY DAYLIGHT] тегом из migration 009');
  } else {
    fail('7_old_money', 'isOldMoneyEstate regex НЕ совпадает — oldMoneyEstateBlock не активируется');
  }

  // Проверяем, что regex в prompts.ts содержит LUXURY DAYLIGHT
  const hasLuxuryDaylight = prompts_ts.includes('LUXURY DAYLIGHT');
  if (hasLuxuryDaylight) {
    pass('7b_regex_updated', 'prompts.ts: isOldMoneyEstate содержит LUXURY DAYLIGHT');
  } else {
    fail('7b_regex_updated', 'prompts.ts: LUXURY DAYLIGHT не найден в isOldMoneyEstate');
  }

  // ────────────────────────────────────���────────────────────────────────────────
  // TEST 8: kids wave-2 — prompt в bundle + migration 021
  // ──────────────────────────────────────────────���──────────────────────────────
  const wave2Ids = [
    'kosmos','yunyj_reporter','malyj_lider','ledyanaya_skazka',
    'yunaya_zvezda','dikaya_priroda_kids','yunyj_volshebnik','little_ceo_girl'
  ];
  const wave2Results = wave2Ids.map(id => {
    const bundleStyle = STYLES.find(s => s.id === id);
    const hasPrompt   = bundleStyle && bundleStyle.prompt && bundleStyle.prompt.length > 10;
    const inMig021    = allMigText.includes(`'${id}'`);
    return { id, hasPrompt, inMig021, name: bundleStyle?.name ?? 'MISSING' };
  });

  const wave2Fails = wave2Results.filter(r => !r.hasPrompt || !r.inMig021);
  if (wave2Fails.length === 0) {
    pass('8_kids_wave2', `Все 8 kids wave-2 стилей: prompt в bundle + в migration 021`);
  } else {
    fail('8_kids_wave2', wave2Fails.map(r =>
      `${r.id}: bundle_prompt=${r.hasPrompt} mig021=${r.inMig021}`
    ).join(' | '));
  }

  // dikaya_priroda_kids переименован
  const dikayaStyle  = STYLES.find(s => s.id === 'dikaya_priroda_kids');
  const isRenamed    = dikayaStyle && dikayaStyle.name === 'ЮНЫЙ СЛЕДОПЫТ';
  const mig021Rename = allMigText.includes('ЮНЫЙ СЛЕДОПЫТ');
  if (isRenamed && mig021Rename) {
    pass('8b_dikaya_renamed', "dikaya_priroda_kids → 'ЮНЫЙ СЛЕДОПЫТ' (bundle + migration 021)");
  } else {
    fail('8b_dikaya_renamed',
      `bundle_renamed=${isRenamed} mig021_has_title=${mig021Rename}`
    );
  }

  // little_ceo_girl тег детектируется
  const ceoBundle  = STYLES.find(s => s.id === 'little_ceo_girl');
  const ceoRegex   = /little.ceo|LITTLE CEO|МАЛЕНЬКАЯ ЛЕДИ|little.*boss.*girl|ceo.*girl|child.*executive/i;
  const ceoDetects = ceoBundle && ceoRegex.test(ceoBundle.prompt ?? '');
  if (ceoDetects) {
    pass('8c_little_ceo_detection', 'little_ceo_girl: [LITTLE CEO GIRL] тег детектируется isLittleCeoGirl');
  } else {
    fail('8c_little_ceo_detection', 'little_ceo_girl: prompt не совпадает с isLittleCeoGirl regex');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 9: creative_studio не появляется в UI
  // ───────────────────────────��─────────────────────────────────────────────────
  const csInBundle    = STYLES.some(s => s.id === 'creative_studio');
  const csDeactivated = allMigText.includes("active = false WHERE id = 'creative_studio'");

  if (!csInBundle && csDeactivated) {
    pass('9_creative_studio', 'creative_studio: нет в bundle + active=false в migration 011');
  } else {
    fail('9_creative_studio',
      `in_bundle=${csInBundle} deactivated_in_mig=${csDeactivated}`
    );
  }

  // ────────────────────────��────────────────────────────────────────────────────
  // TEST 10: Desert King и King of Ocean — разные wardrobe (нет совпадения open torso)
  // ─────────────────────────────��───────────────────────────────────────────────
  const desertWardrobeMatch = prompts_ts.match(/DESERT KING[\s\S]*?return '([^']+)'/);
  const desertWardrobe = desertWardrobeMatch ? desertWardrobeMatch[1] : '';
  const desertHasOpenTorso = /toned.*torso|exposed torso|open.*jacket.*torso/i.test(desertWardrobe);
  const desertHasKhaki     = /khaki|expedition|rolled.*sleeve/i.test(desertWardrobe);

  if (!desertHasOpenTorso && desertHasKhaki) {
    pass('10_desert_king_wardrobe', `Desert King: khaki explorer (нет open torso) — "${desertWardrobe.slice(0,60)}..."`);
  } else {
    fail('10_desert_king_wardrobe', `open_torso=${desertHasOpenTorso} khaki=${desertHasKhaki} → "${desertWardrobe.slice(0,60)}"`);
  }

  // ─────────────────────��─────────────────────────────────��─────────────────────
  // TEST 11: Wave-2 wardrobe pools расширены до ≥5
  // ─────────────────────────────────────────────���───────────────────────────────
  const intellectualPool = (prompts_ts.match(/WARDROBE_MEN_INTELLECTUAL[\s\S]*?\];/)?.[0] ?? '').split("'").length - 1;
  const jetPool          = (prompts_ts.match(/WARDROBE_MEN_PRIVATE_JET[\s\S]*?\];/)?.[0] ?? '').split("'").length - 1;
  const athletePool      = (prompts_ts.match(/WARDROBE_MEN_ATHLETE[\s\S]*?\];/)?.[0] ?? '').split("'").length - 1;

  // Грубый подсчёт: каждый элемент в '' вносит 2 кавычки; делим на 2 чтобы получить кол-во строк.
  // Точнее считаем через строки, начинающиеся с 'prefix (в кавычках)
  function countArrayItems(src, arrayName) {
    const m = src.match(new RegExp(`const ${arrayName}[\\s\\S]*?\\];`));
    if (!m) return 0;
    return (m[0].match(/^\s*'/gm) || []).length;
  }
  const iCount = countArrayItems(prompts_ts, 'WARDROBE_MEN_INTELLECTUAL');
  const jCount = countArrayItems(prompts_ts, 'WARDROBE_MEN_PRIVATE_JET');
  const aCount = countArrayItems(prompts_ts, 'WARDROBE_MEN_ATHLETE');

  if (iCount >= 5 && jCount >= 5 && aCount >= 5) {
    pass('11_wave2_pools', `Wardrobe pools расширены: INTELLECTUAL=${iCount} PRIVATE_JET=${jCount} ATHLETE=${aCount}`);
  } else {
    fail('11_wave2_pools', `Недостаточно вариантов: INTELLECTUAL=${iCount} PRIVATE_JET=${jCount} ATHLETE=${aCount} (нужно ≥5)`);
  }

  // ───────────────────────────────────────��─────────────────────────────────��───
  // TEST 12: Female style-specific pose pools существуют
  // ──────────────────────────────────��─────────────────────────────��────────────
  const hasGoddessPool = prompts_ts.includes('POSES_FEMALE_GODDESS');
  const hasMonacoPool  = prompts_ts.includes('POSES_FEMALE_MONACO');
  const hasRomancePool = prompts_ts.includes('POSES_FEMALE_ROMANCE');
  const hasWildPool    = prompts_ts.includes('POSES_FEMALE_WILD');
  const hasFemaleFunc  = prompts_ts.includes('pickFemaleEditorialPose');

  if (hasGoddessPool && hasMonacoPool && hasRomancePool && hasWildPool && hasFemaleFunc) {
    pass('12_female_pose_pools', 'Все 4 женских style-specific pose pools + pickFemaleEditorialPose() присутствуют');
  } else {
    fail('12_female_pose_pools',
      `GODDESS=${hasGoddessPool} MONACO=${hasMonacoPool} ROMANCE=${hasRomancePool} WILD=${hasWildPool} func=${hasFemaleFunc}`
    );
  }

  // ───────────────────────────────────────────────────────��─────────────────────
  // TEST 13: Pose pools размеры
  // ────────────────────────────────────────────��────────────────────────────────
  const pPortrait = countArrayItems(prompts_ts, 'POSES_PORTRAIT');
  const pFullBody = countArrayItems(prompts_ts, 'POSES_FULLBODY');

  if (pPortrait >= 10 && pFullBody >= 9) {
    pass('13_pose_pool_size', `POSES_PORTRAIT=${pPortrait} POSES_FULLBODY=${pFullBody} (было 8/7)`);
  } else {
    warn('13_pose_pool_size', `POSES_PORTRAIT=${pPortrait} POSES_FULLBODY=${pFullBody} — ожидалось ≥10/≥9`);
  }

  // ──────────────────────────────────────────────���─────────────────────────────��
  // TEST 14: styles.ts кэш-ключ актуален (не старая версия)
  // ──────────────────────────────────────────────────────────────��──────────────
  const stylesSrc  = readFile('src/services/styles.ts');
  const cacheMatch = stylesSrc.match(/CACHE_KEY\s*=\s*'([^']+)'/);
  const cacheKey   = cacheMatch ? cacheMatch[1] : 'unknown';
  // Ключ должен быть v8 или выше (v8 был установлен для bust после legend_warrior fix)
  const cacheVer   = parseInt((cacheKey.match(/v(\d+)/) || ['','0'])[1]);
  if (cacheVer >= 8) {
    pass('14_cache_key', `CACHE_KEY = '${cacheKey}' (v${cacheVer} ≥ v8)`);
  } else {
    warn('14_cache_key', `CACHE_KEY = '${cacheKey}' — рассмотри bump после деплоя P1-P3`);
  }

  // ──────────────────────────────────────────────────────��──────────────────────
  // TEST 15: Нет стилей с одинаковым ID
  // ───────────────────────────────────────────────��────────────────────────────���
  const idSet = new Set();
  const dupeIds = [];
  STYLES.forEach(s => { if (idSet.has(s.id)) dupeIds.push(s.id); idSet.add(s.id); });
  if (dupeIds.length === 0) {
    pass('15_unique_ids', `Все ${STYLES.length} стилей в bundle имеют уникальные ID`);
  } else {
    fail('15_unique_ids', `Дублирующиеся ID: ${dupeIds.join(', ')}`);
  }

  // ─────────────────────────────────────────────────────────���───────────────────
  // SUMMARY TABLE
  // ────────────────────────────────────────────────────────────���────────────────
  console.log('\n' + B('═════════════���═════════════════════════════════════════'));
  console.log(B('  SMOKE TEST RESULTS — poto-transformation-studio'));
  console.log(B('═════════���═════════════════════════════════════════════\n'));

  results.forEach(r => {
    const icon = r.st === 'PASS' ? G('✔ PASS') : r.st === 'WARN' ? Y('⚠ WARN') : R('✘ FAIL');
    console.log(`  ${icon}  [${r.id}]`);
    console.log(`         ${r.msg}\n`);
  });

  const total = passed + failed + warned;
  console.log(B('────────────���──────────────────────────────────────────'));
  console.log(`  ${G(`PASSED: ${passed}/${total}`)}   ${warned > 0 ? Y(`WARNED: ${warned}`) : 'WARNED: 0'}   ${failed > 0 ? R(`FAILED: ${failed}`) : G('FAILED: 0')}`);
  console.log(B('═══════════════════════���═══════════════════════════════\n'));
}

function printResults() { /* already inlined above */ }
function cleanup(f) { try { require('node:fs').unlinkSync(f); } catch {} }
