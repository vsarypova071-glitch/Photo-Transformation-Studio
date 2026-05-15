// Frontend-side feature flags. Считываются из import.meta.env.VITE_ENABLE_*.
// Формат значений:  '1' / 'true' / 'yes' / 'on'  → true,  иначе false.
//
// Source of truth — это backend GET /api/config (он же отдаёт flags).
// На фронте нужны для условного рендера UI до первого fetch'a.
// Если фронт показал блок, но backend вернул flag=false — endpoint просто
// ответит 404, фронт это спокойно обработает.

function readBool(name: string): boolean {
  const raw = String((import.meta as any).env?.[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export const flags = Object.freeze({
  enableReferrals:    readBool('VITE_ENABLE_REFERRALS'),
  enableClub:         readBool('VITE_ENABLE_CLUB'),
  enableArchive:      readBool('VITE_ENABLE_ARCHIVE'),
  enableWeeklyDrops:  readBool('VITE_ENABLE_WEEKLY_DROPS'),
});
