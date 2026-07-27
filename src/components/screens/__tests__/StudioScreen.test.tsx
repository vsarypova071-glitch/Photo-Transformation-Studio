// Тесты переходов состояния StudioScreen — конкретно вокруг экрана результата:
// result -> choose (фото сохраняется), result -> upload (фото стирается),
// нулевой баланс не блокирует возврат к стилям, покупка открывается только
// при реальной попытке сгенерировать без кредитов.
//
// Run: `npm test`

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioScreen from '../StudioScreen';
import type { Style } from '@/types';

afterEach(() => {
  cleanup();
});

vi.mock('@/services/studio', () => ({
  studio: {
    getBalance: vi.fn(),
    uploadPhoto: vi.fn(),
    generateOne: vi.fn(),
    generatePair: vi.fn(),
  },
}));

import { studio } from '@/services/studio';

const mockedStudio = studio as unknown as {
  uploadPhoto: ReturnType<typeof vi.fn>;
  generateOne: ReturnType<typeof vi.fn>;
  generatePair: ReturnType<typeof vi.fn>;
  getBalance: ReturnType<typeof vi.fn>;
};

const STYLE_A: Style = {
  id: 'style_a',
  name: 'Стиль А',
  category: 'realistic',
  description: 'Тестовый стиль A',
  prompt: 'prompt a',
  previewUrl: 'https://example.com/a.jpg',
};
const STYLE_B: Style = {
  id: 'style_b',
  name: 'Стиль Б',
  category: 'realistic',
  description: 'Тестовый стиль B',
  prompt: 'prompt b',
  previewUrl: 'https://example.com/b.jpg',
};

function makeFile() {
  return new File(['fake-image-bytes'], 'selfie.jpg', { type: 'image/jpeg' });
}

async function uploadPhotoAndReachChoose(user: ReturnType<typeof userEvent.setup>) {
  // Согласие на биометрию — без него input[type=file] не рендерится
  const consent = screen.getByRole('checkbox', { name: /согласие на обработку/i });
  await user.click(consent);

  const fileInput = document.body.querySelector('input[type="file"]');
  if (!fileInput) throw new Error('file input not found after checking consent');
  await user.upload(fileInput as HTMLInputElement, makeFile());

  await waitFor(() => expect(screen.getByText('Выберите стиль')).toBeInTheDocument());
}

// Карточка стиля — кликабельная <button>, обёртывающая <img alt=name> и текстовые
// <p> с тем же именем/описанием; accessible name из-за этого — конкатенация всех
// этих кусков, поэтому ищем по видимому тексту названия и поднимаемся до <button>.
function getStyleCardButton(style: Style): HTMLElement {
  const nameNode = screen.getByText(style.name, { selector: 'p' });
  const button = nameNode.closest('button');
  if (!button) throw new Error(`style card button not found for ${style.name}`);
  return button;
}

async function generateOnce(user: ReturnType<typeof userEvent.setup>, style: Style, resultBalance: number) {
  mockedStudio.generateOne.mockResolvedValueOnce({
    generationId: `gen-${style.id}`,
    imageUrl: `https://example.com/result-${style.id}.jpg`,
    ttlMinutes: 30,
    balance: resultBalance,
  });
  await user.click(getStyleCardButton(style));
  await user.click(screen.getByRole('button', { name: /сгенерировать \(/i }));
  await waitFor(() => expect(screen.getByText('Готово')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  // biometryConsent читает начальное значение из localStorage — оно переживает
  // между тестами в одном jsdom-процессе, иначе клик по чекбоксу в следующем
  // тесте снимает уже стоящую с прошлого теста галочку вместо того, чтобы её ставить.
  localStorage.clear();
  mockedStudio.uploadPhoto.mockResolvedValue({
    url: 'https://example.com/uploaded.jpg',
    filename: 'src_test-fixed-filename.jpg',
    dimensions: { width: 800, height: 600 },
    ttlMinutes: 30,
  });
});

function renderStudio(initialBalance: number, onBuyMore = vi.fn()) {
  const onBalanceChange = vi.fn();
  render(
    <StudioScreen
      customerKey="cust_test"
      initialBalance={initialBalance}
      onBalanceChange={onBalanceChange}
      onBuyMore={onBuyMore}
      styles={[STYLE_A, STYLE_B]}
    />
  );
  return { onBalanceChange, onBuyMore };
}

describe('result -> choose (Выбрать другой стиль) сохраняет исходное фото', () => {
  test('фото остаётся видно и функционально после возврата к выбору стиля', async () => {
    const user = userEvent.setup();
    renderStudio(5);

    await uploadPhotoAndReachChoose(user);
    await generateOnce(user, STYLE_A, 4);

    await user.click(screen.getByRole('button', { name: 'Выбрать другой стиль' }));

    // Снова на экране выбора стиля, фото на месте
    await waitFor(() => expect(screen.getByText('Выберите стиль')).toBeInTheDocument());
    expect(screen.getByAltText('Ваше фото')).toBeInTheDocument();

    // Функциональная проверка: генерация другого стиля НЕ требует повторной
    // загрузки — тот же sourcePhotoFilename, что и в первый раз.
    await generateOnce(user, STYLE_B, 3);
    expect(mockedStudio.generateOne).toHaveBeenCalledTimes(2);
    const firstCallFilename = mockedStudio.generateOne.mock.calls[0][0].sourcePhotoFilename;
    const secondCallFilename = mockedStudio.generateOne.mock.calls[1][0].sourcePhotoFilename;
    expect(secondCallFilename).toBe(firstCallFilename);
    expect(secondCallFilename).toBe('src_test-fixed-filename.jpg');

    // uploadPhoto вызывался только один раз — за весь сценарий
    expect(mockedStudio.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  test('работает одинаково независимо от баланса (нулевой баланс не блокирует возврат)', async () => {
    const user = userEvent.setup();
    const { onBuyMore } = renderStudio(1);

    await uploadPhotoAndReachChoose(user);
    await generateOnce(user, STYLE_A, 0); // последний кредит потрачен

    await user.click(screen.getByRole('button', { name: 'Выбрать другой стиль' }));

    await waitFor(() => expect(screen.getByText('Выберите стиль')).toBeInTheDocument());
    expect(screen.getByAltText('Ваше фото')).toBeInTheDocument();
    expect(onBuyMore).not.toHaveBeenCalled();
  });
});

describe('result -> upload (Заменить исходное фото) стирает фото', () => {
  test('после клика показывается пустая зона загрузки, а не «Фото загружено»', async () => {
    const user = userEvent.setup();
    renderStudio(5);

    await uploadPhotoAndReachChoose(user);
    await generateOnce(user, STYLE_A, 4);

    await user.click(screen.getByRole('button', { name: 'Заменить исходное фото' }));

    await waitFor(() => expect(screen.getByText('Выбрать селфи')).toBeInTheDocument());
    expect(screen.queryByText('Фото загружено ✓')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Ваше фото')).not.toBeInTheDocument();
  });
});

describe('покупка при нулевом балансе — отдельное действие', () => {
  test('покупка НЕ вызывается при простом переходе к стилям, но вызывается при попытке сгенерировать', async () => {
    const user = userEvent.setup();
    const { onBuyMore } = renderStudio(1);

    await uploadPhotoAndReachChoose(user);
    await generateOnce(user, STYLE_A, 0);

    await user.click(screen.getByRole('button', { name: 'Выбрать другой стиль' }));
    await waitFor(() => expect(screen.getByText('Выберите стиль')).toBeInTheDocument());
    expect(onBuyMore).not.toHaveBeenCalled();

    // Теперь реальная попытка сгенерировать без кредитов — вот тут покупка и должна открыться.
    // На экране два элемента с текстом «Купить ещё фото»: основная кнопка
    // «Сгенерировать» (сменившая текст из-за нулевого баланса) и отдельная
    // вспомогательная кнопка ниже — берём именно основную (первую в DOM).
    await user.click(getStyleCardButton(STYLE_B));
    const [primaryGenerateBtn] = screen.getAllByRole('button', { name: /купить ещё фото/i });
    await user.click(primaryGenerateBtn);

    expect(onBuyMore).toHaveBeenCalledTimes(1);
    expect(mockedStudio.generateOne).toHaveBeenCalledTimes(1); // только первый (успешный) вызов, не второй
  });
});
