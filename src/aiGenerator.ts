import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { UserAnalysis } from "../types";
import { buildPrompt } from "./lib/promptBuilder";

// Всегда бери ключ с бэкенда/секретов. Не храни ключ на фронте.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  if (idx === -1) return dataUrl; // на случай если уже чистый base64
  return dataUrl.slice(idx + 1);
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function analyzeUserPhoto(base64Image: string): Promise<UserAnalysis> {
  const ai = getAI();
  const model = "gemini-3-flash-preview";

  const prompt = `
Ты — эксперт по портретной визуалистике.
Задача: описать внешность по фото для сохранения узнаваемости в будущей генерации (без обещаний абсолютного совпадения).
Верни ТОЛЬКО JSON строго по схеме.

Поля:
- faceShape: строка (например: "oval" | "heart" | "square" | "round")
- gender: строка ("male" | "female")
- hairColor: точный оттенок
- hairLength: точная длина (например "short pixie", "shoulder length", "long")
- eyeColor: точный цвет радужки
- uniqueFeatures: массив коротких маркеров, которые важно НЕ менять (например: "high cheekbones", "straight narrow nose bridge", "almond eyes", "soft jawline", "beauty mark on left cheek")

Правила:
- Не выдумывай несуществующие детали.
- Не делай выводы о личности/возрасте/национальности.
- Только визуальные признаки, полезные для портретной узнаваемости.
`.trim();

  const imageData = stripDataUrlPrefix(base64Image);

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            data: imageData,
            mimeType: "image/jpeg",
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          faceShape: { type: Type.STRING },
          gender: { type: Type.STRING },
          hairColor: { type: Type.STRING },
          hairLength: { type: Type.STRING },
          eyeColor: { type: Type.STRING },
          uniqueFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["faceShape", "gender", "hairColor", "hairLength", "eyeColor", "uniqueFeatures"],
      },
    },
  });

  const text = response.text ?? "";
  const parsed = safeJsonParse<UserAnalysis>(text);

  if (!parsed) throw new Error("Ошибка анализа: ответ не JSON.");
  if (!parsed.faceShape || !parsed.gender) throw new Error("Ошибка анализа: не хватает ключевых полей.");
  if (!Array.isArray(parsed.uniqueFeatures)) parsed.uniqueFeatures = [];

  return parsed;
}

export async function generateFashionPhoto(
  analysis: UserAnalysis,
  styleKeywords: string,
  userWishes: string,
  framing: string,
  angle: string,
  originalImageBase64: string
): Promise<{ imageUrl: string; prompt: string }> {
  const ai = getAI();
  const modelName = "gemini-3-pro-image-preview";

const finalPrompt = buildPrompt({
  styleKeywords,
  isPremium: false
});

  const markers = (analysis.uniqueFeatures ?? []).join(", ");

  const imageData = stripDataUrlPrefix(originalImageBase64);

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        // ВАЖНО: референс обязательно в запросе
        {
          inlineData: {
            data: imageData,
            mimeType: "image/jpeg",
          },
        },
        { text: finalPrompt },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "3:4",
        imageSize: "1K",
      },
    },
  });

  // Достаём base64-картинку из ответа
  let imageUrl = "";
  const cand = response.candidates?.[0];
  const parts = cand?.content?.parts ?? [];

  for (const p of parts) {
    if ((p as any).inlineData?.data) {
      const b64 = (p as any).inlineData.data as string;
      imageUrl = `data:image/png;base64,${b64}`;
      break;
    }
  }

  if (!imageUrl) {
    throw new Error("Production error: модель не вернула изображение.");
  }

  return { imageUrl, prompt: finalPrompt };
}
