// Prompt building is now handled server-side in the generate-photo edge function.
// This file is kept for backward compatibility.

export function buildPrompt(
  styleKeywords: string,
  garment: string,
  isPremium: boolean
): string {
  return `${styleKeywords}\n${garment}\n${isPremium ? "Premium mode" : ""}`;
}
