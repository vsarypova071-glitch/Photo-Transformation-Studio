# Фоновый бесплатный HD-апскейл — провижининг /opt/upscale на VPS

Серверная логика: `server/services/upscale.ts` (очередь, валидация, атомарная
замена). Этот каталог содержит только Python-скрипт инференса. **Веса модели и
venv в git не хранятся.**

## Однократная установка на Beget VPS (вручную, НЕ через deploy.sh)

```bash
mkdir -p /opt/upscale/model
cd /opt/upscale

# 1. venv (нужен пакет python3.12-venv — на VPS уже установлен)
python3 -m venv venv
./venv/bin/pip install onnxruntime numpy pillow

# 2. Модель — официальный ONNX-экспорт Qualcomm AI Hub
#    (huggingface.co/qualcomm/Real-ESRGAN-General-x4v3, лицензия исходной
#    Real-ESRGAN — BSD-3-Clause). SHA256 архива:
#    78eac9f3922790b890a7f2e894d4932dcb398b2939c9439dbd23cc153c97f8b0
curl -sL -o model.zip 'https://qaihub-public-assets.s3.us-west-2.amazonaws.com/qai-hub-models/models/real_esrgan_general_x4v3/releases/v0.59.0/real_esrgan_general_x4v3-onnx-float.zip'
sha256sum model.zip   # сверить!
unzip -j model.zip -d model 'real_esrgan_general_x4v3-onnx-float/real_esrgan_general_x4v3.onnx' 'real_esrgan_general_x4v3-onnx-float/real_esrgan_general_x4v3.data'
rm model.zip

# 3. Скрипт инференса из репозитория
scp scripts/upscale/upscale.py root@62.113.111.113:/opt/upscale/upscale.py

# 4. Smoke-check (без включения флага)
./venv/bin/python upscale.py -i /path/to/test.png -o /tmp/out.png
```

## Включение

Только после smoke-check: `UPSCALE_ENABLED=true` в `/var/www/ai-fotosessia.ru/api/.env`
и `pm2 restart poto-api`. Выключение — поставить `false` и рестарт; никакие
другие компоненты не затрагиваются.

## Замеры (тест 30.07.2026 на этом VPS)

1023×1537 → 2046×3074: ~60 с, пик RAM ~1 ГБ, влияние на API — нулевое
(очередь в один worker + nice 19 + ionice idle).
