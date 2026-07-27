// Dev-only test harness — НЕ часть production-сборки (это отдельная HTML-точка
// входа, vite build по умолчанию собирает только index.html, этот файл в dist/
// не попадает). Нужен для browser-level проверки StudioScreen в реальном
// браузере/viewport-ах через Playwright, без прохождения всей воронки App.tsx
// (welcome → ... → tariff → оплата → studio).
//
// Параметры через query-string:
//   ?balance=0   — начальный баланс (по умолчанию 5)

import React from 'react';
import ReactDOM from 'react-dom/client';
import StudioScreen from './components/screens/StudioScreen';
import type { Style } from './types';
import './index.css';

const params = new URLSearchParams(window.location.search);
const initialBalance = Number(params.get('balance') ?? '5');

const TEST_STYLES: Style[] = [
  {
    id: 'style_a',
    name: 'Стиль А',
    category: 'realistic',
    description: 'Тестовый стиль A',
    prompt: 'prompt a',
    previewUrl: 'https://placehold.co/400x533/png?text=Style+A',
  },
  {
    id: 'style_b',
    name: 'Стиль Б',
    category: 'realistic',
    description: 'Тестовый стиль B',
    prompt: 'prompt b',
    previewUrl: 'https://placehold.co/400x533/png?text=Style+B',
  },
  {
    id: 'style_pair',
    name: 'Пара',
    category: 'together',
    description: 'Тестовый парный стиль',
    prompt: 'prompt pair',
    previewUrl: 'https://placehold.co/400x533/png?text=Pair',
  },
];

function Harness() {
  const [balance, setBalance] = React.useState(initialBalance);
  return (
    <StudioScreen
      customerKey="cust_playwright_test"
      initialBalance={balance}
      onBalanceChange={setBalance}
      onBuyMore={() => {
        document.title = 'BUY_MORE_CALLED';
      }}
      styles={TEST_STYLES}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>
);
