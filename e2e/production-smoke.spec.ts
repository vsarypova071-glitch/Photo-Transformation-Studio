// Проверка задеплоенного frontend на реальном проде (ai-fotosessia.ru).
// Реальные: главная страница, статические ассеты, /api/balance, /api/photos/upload,
// /api/styles. Замокан ТОЛЬКО /api/generation/single — потому что Gateway
// сейчас ещё не пофикшен (maxMessageChars=4000, отдельная, не сегодняшняя
// задача) и реальная генерация гарантированно провалится на валидации Gateway,
// не дойдя до экрана результата. Мок здесь — не обход проверки, а единственный
// способ безопасно проверить фронтенд-фикс без траты последнего кредита
// тестового аккаунта на заведомо неудачный реальный вызов.
//
// Тестовый аккаунт cust_test_phase2_1778307413 — существующий, с 1 кредитом,
// не реальный пользователь. Реального списания не будет: подмена ответа
// происходит на уровне браузера, запрос до бэкенда не долетает.
//
// Запуск: npx playwright test e2e/production-smoke.spec.ts

import { test, expect, type Page } from '@playwright/test';

const PROD_URL = 'https://www.ai-fotosessia.ru';
const TEST_CUSTOMER_KEY = 'cust_test_phase2_1778307413';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

test.use({ baseURL: PROD_URL });

function trackConsoleAndNetworkErrors(page: Page) {
  const consoleErrors: string[] = [];
  const failed404s: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.status() === 404 && /\/assets\//.test(res.url())) {
      failed404s.push(`${res.status()} ${res.url()}`);
    }
  });

  return { consoleErrors, failed404s };
}

test.describe('Production smoke — задеплоенный frontend, ai-fotosessia.ru', () => {
  test('главная → студия → загрузка → стили → (мок) генерация → 3 действия результата', async ({ page }, testInfo) => {
    const { consoleErrors, failed404s } = trackConsoleAndNetworkErrors(page);

    // Мокаем ТОЛЬКО generation/single — единственный небезопасный/сейчас
    // заведомо неработающий вызов. Всё остальное идёт в реальный бэкенд.
    let generationMocked = false;
    await page.route('**/api/generation/single', async (route) => {
      generationMocked = true;
      await route.fulfill({
        json: {
          generationId: 'prod-smoke-mock-1',
          imageUrl: 'https://example.com/prod-smoke-result.png',
          ttlMinutes: 30,
          balance: 1, // тестовый мок, реальный баланс не трогаем
        },
      });
    });

    // Логинимся под существующим тестовым аккаунтом (не реальный пользователь),
    // чтобы попасть в студию через штатную кнопку «Перейти в студию» без оплаты.
    await page.addInitScript((key) => {
      window.localStorage.setItem('customer_key', key);
    }, TEST_CUSTOMER_KEY);

    await page.goto('/');
    await expect(page.getByText('AI Фотосессия').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `e2e/screenshots/PROD-home-${testInfo.project.name}.png` });

    const continueBtn = page.getByText(/перейти в студию/i);
    await expect(continueBtn).toBeVisible({ timeout: 15000 }); // реальный /api/balance должен вернуть balance=1
    await continueBtn.click();

    await expect(page.getByRole('checkbox', { name: /согласие на обработку/i })).toBeVisible();
    await page.getByRole('checkbox', { name: /согласие на обработку/i }).check();

    // Реальная загрузка тестового фото через настоящий /api/photos/upload
    await page.setInputFiles('input[type="file"]', {
      name: 'prod-smoke-selfie.jpg',
      mimeType: 'image/jpeg',
      buffer: TINY_PNG,
    });
    await expect(page.getByText('Выберите стиль')).toBeVisible({ timeout: 15000 });

    // Реальный список стилей — превью действительно загружаются (настоящие assets)
    const firstStyleImg = page.locator('div.grid img').first();
    await expect(firstStyleImg).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/PROD-choose-${testInfo.project.name}.png` });

    // Выбираем первый доступный стиль и жмём «Сгенерировать» — упадёт на
    // реальный (замоканный) /api/generation/single
    await page.locator('div.grid button').first().click();
    await page.getByRole('button', { name: /сгенерировать \(/i }).click();

    await expect(page.getByText('Готово')).toBeVisible({ timeout: 15000 });
    expect(generationMocked).toBe(true);

    await page.screenshot({ path: `e2e/screenshots/PROD-result-${testInfo.project.name}.png`, fullPage: true });

    // TTL-баннер не блокирует «Выбрать другой стиль»
    await expect(page.getByRole('button', { name: 'Скачать фото', exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Выбрать другой стиль' }).click();

    await expect(page.getByText('Выберите стиль')).toBeVisible();
    await expect(page.getByAltText('Ваше фото')).toBeVisible(); // фото сохранилось
    await page.screenshot({ path: `e2e/screenshots/PROD-choose-photo-kept-${testInfo.project.name}.png`, fullPage: true });

    // Возвращаемся на результат ещё раз и проверяем «Заменить исходное фото»
    await page.locator('div.grid button').first().click();
    await page.getByRole('button', { name: /сгенерировать \(/i }).click();
    await expect(page.getByText('Готово')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Заменить исходное фото' }).click();
    await expect(page.getByText('Выбрать селфи')).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/PROD-replace-photo-${testInfo.project.name}.png`, fullPage: true });

    console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
    console.log('ASSET_404S:', JSON.stringify(failed404s));
    expect(failed404s, `404 on frontend assets: ${failed404s.join(', ')}`).toEqual([]);
  });
});
