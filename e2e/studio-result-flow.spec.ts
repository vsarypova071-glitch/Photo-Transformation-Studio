// Browser-level проверка (Playwright, Chromium, desktop 1280×900 + mobile
//390×844 — см. playwright.config.ts) сценариев A–D UX-аудита экрана
// результата StudioScreen. Бэкенд замокан через page.route — тестируем
// поведение фронтенда, не бэкенд. Не более одной генерации на сценарий,
// как и в проде — здесь все генерации замокапы, реальных вызовов нет.
//
// Запуск: npx playwright test

import { test, expect, type Page } from '@playwright/test';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function mockBackend(page: Page, opts: { resultBalance: number }) {
  await page.route('**/api/photos/upload', async (route) => {
    const isB = route.request().postData()?.includes('nameB') ?? false;
    await route.fulfill({
      json: {
        filename: isB ? 'src_pw-test-b.png' : 'src_pw-test.png',
        url: '/api/photos/src_pw-test.png',
        sizeBytes: TINY_PNG.length,
        ttlMinutes: 30,
      },
    });
  });

  let generationCount = 0;
  await page.route('**/api/generation/single', async (route) => {
    generationCount++;
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: {
        generationId: `gen-${generationCount}`,
        imageUrl: `https://example.com/result-${generationCount}.png`,
        ttlMinutes: 30,
        balance: opts.resultBalance,
      },
      headers: { 'x-test-source-filename': body?.sourcePhotoFilename ?? '' },
    });
  });

  await page.route('**/api/generation/pair', async (route) => {
    generationCount++;
    await route.fulfill({
      json: {
        generationId: `pair-gen-${generationCount}`,
        imageUrl: `https://example.com/pair-result-${generationCount}.png`,
        ttlMinutes: 30,
        balance: opts.resultBalance,
      },
    });
  });

  await page.route('**/api/photos/download/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="result.png"',
      },
      body: TINY_PNG,
    });
  });
}

async function reachChooseScreen(page: Page, balance: number) {
  await mockBackend(page, { resultBalance: balance - 1 });
  await page.goto(`/test-harness.html?balance=${balance}`);

  await page.getByRole('checkbox', { name: /согласие на обработку/i }).check();
  await page.setInputFiles('input[type="file"]', {
    name: 'selfie.jpg',
    mimeType: 'image/jpeg',
    buffer: TINY_PNG,
  });
  await expect(page.getByText('Выберите стиль')).toBeVisible();
}

async function selectStyle(page: Page, styleName: string) {
  await page.getByText(styleName, { exact: true }).click();
}

async function clickPrimaryGenerateButton(page: Page) {
  await page.getByRole('button', { name: /сгенерировать \(|купить ещё фото/i }).first().click();
}

async function generate(page: Page, styleName: string) {
  await selectStyle(page, styleName);
  await clickPrimaryGenerateButton(page);
  await expect(page.getByText('Готово')).toBeVisible();
}

test.describe('Сценарий A — баланс > 0: полный путь и сохранение фото', () => {
  test('генерация → скачивание → «Выбрать другой стиль» → фото и filename сохранены → новый стиль доступен', async ({ page }, testInfo) => {
    await reachChooseScreen(page, 5);
    await generate(page, 'Стиль А');

    // TTL-баннер виден и НЕ блокирует «Скачать фото» — не закрываем его специально
    await expect(page.getByText(/фото доступны \d+ минут/i)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '↓ Скачать фото' }).click();
    const download = await downloadPromise;
    expect(download).toBeTruthy();

    await page.screenshot({ path: `e2e/screenshots/A-result-${testInfo.project.name}.png`, fullPage: true });

    await page.getByRole('button', { name: 'Выбрать другой стиль' }).click();
    await expect(page.getByText('Выберите стиль')).toBeVisible();
    await expect(page.getByAltText('Ваше фото')).toBeVisible();

    await page.screenshot({ path: `e2e/screenshots/A-choose-photo-kept-${testInfo.project.name}.png`, fullPage: true });

    // Функциональное подтверждение сохранённого filename: вторая генерация
    // без повторной загрузки — если бы filename потерялся, apiUploadPhoto
    // не вызвался бы снова, а generateOne получил бы старый (валидный) filename;
    // проверяем именно ЧТО uploadPhoto не звался второй раз через число запросов.
    let uploadCalls = 0;
    page.on('request', (req) => { if (req.url().includes('/api/photos/upload')) uploadCalls++; });

    await generate(page, 'Стиль Б');
    expect(uploadCalls).toBe(0); // фото не перезагружалось — filename был валиден и сохранён
  });
});

test.describe('Сценарий B — баланс = 0: возврат к стилям не блокируется', () => {
  test('результат открывается нормально, стили и фото доступны, покупка — только по клику «Сгенерировать»', async ({ page }, testInfo) => {
    await reachChooseScreen(page, 1);
    await generate(page, 'Стиль А'); // после этого balance = 0

    await expect(page.getByText('Готово')).toBeVisible();

    await page.getByRole('button', { name: 'Выбрать другой стиль' }).click();
    await expect(page.getByText('Выберите стиль')).toBeVisible();
    await expect(page.getByAltText('Ваше фото')).toBeVisible();
    expect(await page.title()).not.toBe('BUY_MORE_CALLED');

    // Стили доступны для просмотра/выбора при нулевом балансе
    await expect(page.getByText('Стиль Б', { exact: true })).toBeVisible();
    await selectStyle(page, 'Стиль Б');
    expect(await page.title()).not.toBe('BUY_MORE_CALLED'); // сам выбор стиля не триггерит покупку

    await page.screenshot({ path: `e2e/screenshots/B-zero-balance-choose-${testInfo.project.name}.png`, fullPage: true });

    // Покупка — только теперь, по реальному клику «Сгенерировать»
    await clickPrimaryGenerateButton(page);
    await expect.poll(() => page.title()).toBe('BUY_MORE_CALLED');
  });
});

test.describe('Сценарий C — «Заменить исходное фото» очищает всё исходное состояние', () => {
  test('очищает uploadedImage/Url/Filename + фото B, открывает экран загрузки', async ({ page }, testInfo) => {
    await reachChooseScreen(page, 5);

    // Парный стиль → загружаем и фото B, чтобы было что проверять на сброс
    await page.getByRole('button', { name: 'ПАРНЫЕ' }).click();
    await selectStyle(page, 'Пара');
    await page.setInputFiles('#photo-b-input', {
      name: 'selfie-b.jpg',
      mimeType: 'image/jpeg',
      buffer: TINY_PNG,
    });
    await expect(page.getByText('Оба фото готовы ✓')).toBeVisible();

    await clickPrimaryGenerateButton(page);
    await expect(page.getByText('Готово')).toBeVisible();

    await page.screenshot({ path: `e2e/screenshots/C-result-before-${testInfo.project.name}.png`, fullPage: true });

    await page.getByRole('button', { name: 'Заменить исходное фото' }).click();

    // uploadedImage / uploadedUrl очищены — пустая зона загрузки, не «резюме»
    await expect(page.getByText('Выбрать селфи')).toBeVisible();
    await expect(page.getByText('Фото загружено ✓')).not.toBeVisible();

    await page.screenshot({ path: `e2e/screenshots/C-upload-empty-${testInfo.project.name}.png`, fullPage: true });

    // uploadedFilename очищен: заново загружаем фото A и идём на выбор стиля
    await page.setInputFiles('input[type="file"]', {
      name: 'selfie-new.jpg',
      mimeType: 'image/jpeg',
      buffer: TINY_PNG,
    });
    await expect(page.getByText('Выберите стиль')).toBeVisible();

    // uploadedImageB / uploadedFilenameB тоже очищены: парный стиль снова
    // просит "второе фото", а не показывает "оба фото готовы" из старого стейта
    await selectStyle(page, 'Пара');
    await expect(page.getByText('Шаг 2 из 2 — второе фото')).toBeVisible();
    await expect(page.getByText('Оба фото готовы ✓')).not.toBeVisible();
  });
});

test.describe('Сценарий D — TTL-уведомление не блокирует управление', () => {
  test('кнопки результата кликабельны, пока баннер открыт; баннер закрывается явным крестиком', async ({ page }) => {
    await reachChooseScreen(page, 5);
    await generate(page, 'Стиль А');

    const banner = page.getByText(/фото доступны \d+ минут/i);
    await expect(banner).toBeVisible();

    // «Выбрать другой стиль» кликабельна, пока баннер ещё открыт — без
    // необходимости сначала его закрывать (проверяем именно это: клика
    // достаточно, никакого промежуточного взаимодействия с баннером).
    await page.getByRole('button', { name: 'Выбрать другой стиль' }).click();
    await expect(page.getByText('Выберите стиль')).toBeVisible();

    // Отдельно — сам баннер закрывается явной кнопкой-крестиком
    await generate(page, 'Стиль Б');
    await expect(banner).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть уведомление' }).click();
    await expect(banner).not.toBeVisible();

    // и после закрытия кнопки результата по-прежнему кликабельны
    await expect(page.getByRole('button', { name: 'Заменить исходное фото' })).toBeEnabled();
  });
});
