#!/usr/bin/env python3
"""Production tiled 2x upscaler: Real-ESRGAN-General-x4v3, ONNX Runtime CPU.

Вызывается ТОЛЬКО из server/services/upscale.ts:
    venv/bin/python upscale.py -i <input.png> -o <output.tmp.png>

Контракт:
  - вход/выход — единственные принимаемые параметры;
  - модель фиксирована: <папка скрипта>/model/real_esrgan_general_x4v3.onnx;
  - tile 128, overlap 16, максимум 2 CPU-потока, без Vulkan/GPU/PyTorch;
  - модель x4, финальный результат — ровно 2x от входа (Lanczos downscale);
  - любой сбой -> ненулевой exit code, выходной файл не считается валидным
    (Node-сторона проверяет его отдельно и при ошибке оставляет оригинал);
  - в stdout/stderr — только безопасная диагностика (размеры, время, коды).

Замер на Beget VPS (2x EPYC 2.0GHz): 1023x1537 -> 2046x3074 за ~60 s,
пик RAM ~1 GB. Скрипт деплоится в /opt/upscale/ вручную (см. README.md рядом);
веса модели и venv в git не хранятся.
"""

import argparse
import math
import sys
import time
from pathlib import Path

EXIT_BAD_ARGS = 2
EXIT_INPUT_ERROR = 3
EXIT_MODEL_MISSING = 4
EXIT_INFERENCE_ERROR = 5
EXIT_OUTPUT_ERROR = 6

TILE = 128
OVERLAP = 16
STRIDE = TILE - 2 * OVERLAP  # 96
MODEL_SCALE = 4
OUT_SCALE = 2
THREADS = 2
# Предохранитель по RAM: вход крупнее не обрабатываем — float32-буфер
# x4-результата растёт квадратично (2000 px по стороне ⇒ ~0.77 ГБ буфер;
# 4096 дал бы ~3.2 ГБ и OOM на VPS). Согласовано с maxResultDimensionPx=4000
# в server/services/upscale.ts (вход ≤2000 ⇒ результат ≤4000).
MAX_INPUT_DIMENSION = 2000

MODEL_PATH = Path(__file__).resolve().parent / "model" / "real_esrgan_general_x4v3.onnx"


def fail(code: int, message: str) -> "NoReturn":  # noqa: F821 - py3.12 ok without import
    print(f"upscale.py error: {message}", file=sys.stderr, flush=True)
    sys.exit(code)


def main() -> int:
    parser = argparse.ArgumentParser(allow_abbrev=False)
    parser.add_argument("-i", "--input", required=True)
    parser.add_argument("-o", "--output", required=True)
    try:
        args = parser.parse_args()
    except SystemExit:
        return EXIT_BAD_ARGS

    in_path = Path(args.input)
    out_path = Path(args.output)
    if not in_path.is_file():
        fail(EXIT_INPUT_ERROR, "input file does not exist or is not a regular file")
    # Формат сохранения выбирается по расширению выходного пути (Node-сторона
    # всегда передаёт tmp-путь с расширением исходника): png -> PNG, jpg -> JPEG.
    out_format = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG"}.get(out_path.suffix.lower())
    if out_format is None:
        fail(EXIT_BAD_ARGS, "output must be a .png/.jpg/.jpeg path")
    if not MODEL_PATH.is_file():
        fail(EXIT_MODEL_MISSING, "model file missing next to script (model/real_esrgan_general_x4v3.onnx)")

    import numpy as np
    import onnxruntime as ort
    from PIL import Image

    t0 = time.time()
    try:
        img = Image.open(in_path)
        img.load()
        img = img.convert("RGB")
    except Exception as e:  # повреждённый вход — штатный отказ
        fail(EXIT_INPUT_ERROR, f"cannot decode input image: {type(e).__name__}")

    w, h = img.size
    if w == 0 or h == 0 or w > MAX_INPUT_DIMENSION or h > MAX_INPUT_DIMENSION:
        fail(EXIT_INPUT_ERROR, f"unsupported input size {w}x{h}")
    print(f"upscale.py: input {w}x{h}", flush=True)

    try:
        so = ort.SessionOptions()
        so.intra_op_num_threads = THREADS
        so.inter_op_num_threads = 1
        sess = ort.InferenceSession(str(MODEL_PATH), sess_options=so, providers=["CPUExecutionProvider"])
        inp_name = sess.get_inputs()[0].name

        arr = np.asarray(img, dtype=np.float32) / 255.0  # H,W,3
        ny = math.ceil(h / STRIDE)
        nx = math.ceil(w / STRIDE)
        pad_bottom = ny * STRIDE - h + OVERLAP
        pad_right = nx * STRIDE - w + OVERLAP
        padded = np.pad(arr, ((OVERLAP, pad_bottom), (OVERLAP, pad_right), (0, 0)), mode="reflect")

        result = np.zeros((ny * STRIDE * MODEL_SCALE, nx * STRIDE * MODEL_SCALE, 3), dtype=np.float32)
        for iy in range(ny):
            for ix in range(nx):
                y0 = iy * STRIDE
                x0 = ix * STRIDE
                tile = padded[y0 : y0 + TILE, x0 : x0 + TILE, :]
                nchw = np.expand_dims(tile.transpose(2, 0, 1), 0)
                up = sess.run(None, {inp_name: nchw})[0][0]  # 3,512,512
                up_hwc = up.transpose(1, 2, 0)
                core = up_hwc[
                    OVERLAP * MODEL_SCALE : (OVERLAP + STRIDE) * MODEL_SCALE,
                    OVERLAP * MODEL_SCALE : (OVERLAP + STRIDE) * MODEL_SCALE,
                    :,
                ]
                result[
                    y0 * MODEL_SCALE : (y0 + STRIDE) * MODEL_SCALE,
                    x0 * MODEL_SCALE : (x0 + STRIDE) * MODEL_SCALE,
                    :,
                ] = core

        result = result[: h * MODEL_SCALE, : w * MODEL_SCALE, :]
        x4 = Image.fromarray((np.clip(result, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8))
        final = x4.resize((w * OUT_SCALE, h * OUT_SCALE), Image.LANCZOS)
    except Exception as e:
        fail(EXIT_INFERENCE_ERROR, f"inference failed: {type(e).__name__}")

    try:
        if out_format == "PNG":
            final.save(out_path, format="PNG")
        else:
            # JPEG не поддерживает alpha/палитру; результат апскейла всегда RGB,
            # но конвертируем защитно. Параметры зафиксированы: quality=95,
            # subsampling=0 (4:4:4 — без потери цветовой резкости на деталях).
            if final.mode != "RGB":
                final = final.convert("RGB")
            final.save(out_path, format="JPEG", quality=95, subsampling=0, optimize=False, progressive=False)
    except Exception as e:
        fail(EXIT_OUTPUT_ERROR, f"cannot write output: {type(e).__name__}")

    print(
        f"upscale.py: done {w}x{h} -> {final.size[0]}x{final.size[1]} in {time.time() - t0:.1f}s",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
