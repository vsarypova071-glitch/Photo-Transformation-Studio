// Source of truth для feature-flag'ов CLUB. Все по умолчанию OFF.
// Включаются только через ENV — это позволяет включать поэтапно без redeploy кода.
//
// Любой новый route, который зависит от фичи, должен mount'иться через
// `if (flags.enableX)` в server/index.ts. Если flag === false — route не
// существует физически, GET вернёт 404 (как будто фичи нет вовсе).

function readBool(name: string): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export const flags = Object.freeze({
  enableSubscriptions: readBool('ENABLE_SUBSCRIPTIONS'),
  enableClub:          readBool('ENABLE_CLUB'),
  enableArchive:       readBool('ENABLE_ARCHIVE'),
  enableReferrals:     readBool('ENABLE_REFERRALS'),
  enableWeeklyDrops:   readBool('ENABLE_WEEKLY_DROPS'),
});

export type FeatureFlags = typeof flags;

// Лимиты, которые нам нужны прямо сейчас (Phase 1). Сюда же добавим
// max balance / discount % когда придёт время — пока бизнес-решение:
// - max balance НЕ ограничивать
// - daily limit = 15 / customer_key / сутки
// - club archive: постоянный, free archive: 30 минут (в самом TTL файлов)
// - club discount: 15%
export const limits = Object.freeze({
  dailyGenerationLimit: Number(process.env.DAILY_GENERATION_LIMIT ?? 15),
  freeArchiveTtlMinutes: Number(process.env.FREE_ARCHIVE_TTL_MINUTES ?? 30),
  clubDiscountPercent: Number(process.env.CLUB_DISCOUNT_PERCENT ?? 15),
});

export function summary() {
  return { flags, limits };
}
