import { GoogleGenerativeAI } from "@google/generative-ai";

/** Server-only Gemini helper. GEMINI_API_KEY is read only on the server. */
export function getGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

/** Models to try in order when the main one is busy. Same fallback chain as
 *  Memora: 3.8 Flash -> 3.6 Flash -> 3.5 Flash-Lite. A 404 moves to the
 *  next model at once (retired name), a 503/429 is retried once per model. */
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

export function geminiModel(modelName: string) {
  const genai = getGemini();
  if (!genai) return null;
  return genai.getGenerativeModel({ model: modelName });
}

/** Ask Gemini for strict JSON. Returns parsed JSON, or throws on failure.
 *  Nothing is retried once 25 seconds have passed, so a slow failing model
 *  cannot eat the whole 60-second serverless window. */
export async function askGeminiJson(prompt: string, images?: Array<{ mimeType: string; data: string }>) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }];
  for (const img of images ?? []) parts.push({ inlineData: img });
  const started = Date.now();
  let lastError: unknown = null;
  for (const modelName of GEMINI_MODELS) {
    const model = geminiModel(modelName);
    if (!model) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent(parts as never);
        const text = result.response.text();
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start < 0 || end < 0) return null;
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {
          return null;
        }
      } catch (e) {
        lastError = e;
        if (isModelNotFound(e)) break;
        if (!isRetryableGeminiError(e)) throw e;
        if (Date.now() - started > 25000) throw e;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  throw lastError ?? new Error("Gemini is busy");
}

function isModelNotFound(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /404|not found|NOT_FOUND/i.test(msg);
}

function isRetryableGeminiError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /503|429|overloaded|high demand|UNAVAILABLE|RESOURCE_EXHAUSTED|Service Unavailable/i.test(msg);
}

export function friendlyGeminiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/503|overloaded|high demand|UNAVAILABLE|Service Unavailable/i.test(msg))
    return "Gemini is busy right now (high demand). Please try again in a minute.";
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg))
    return "Gemini's limit was reached. Please try again in a little while.";
  return "The AI could not read this slip. Please type the medicine names instead.";
}

/**
 * Doctor-slip reading prompt. The slip layout the user showed us:
 * - Medicines are in the centre-right box. Read ONLY that box.
 * - The LEFT side has BP, pulse, disease notes — IGNORE it completely.
 *   Never return BP, pulse, a disease, or a person's name as a medicine.
 * - Days are written in Urdu on the RIGHT edge, usually ONCE for all
 *   medicines (e.g. 1 ہفتہ = 7 days). If a medicine has its own days
 *   written beside it, use those for that medicine.
 * - Doses look like 1+1, 1+1+1, 1+0+1. Some dose instructions are in Urdu
 *   under a medicine (e.g. ناشتے سے پہلے = before breakfast,
 *   روزانہ ایک بار = once daily) — keep them as `note`, they do not change
 *   the dose unless they say once daily (dose "1").
 * - Injections have their frequency written under them in Urdu, usually
 *   1 per week or 1 in 10 days — return it as `injFrequency`.
 * Handwriting is often light/faint: return your best reading plus a
 * confidence 0-1 per medicine. The patient MUST confirm the list before
 * any bill is shown, so a low-confidence reading is fine — never invent
 * a medicine name you cannot read at all; use null and let the patient type it.
 */
export const SLIP_PROMPT = `
You are reading a Pakistani doctor's prescription slip in a photo.
LAYOUT — follow it exactly:
- Read ONLY the medicines in the centre-right box.
- IGNORE the left side completely: BP, pulse, disease notes, patient name, age, date. Never return those as medicines.
- Days are written in Urdu on the RIGHT edge, usually ONCE for all medicines. Convert them: 1 ہفتہ / 1 hafta / ایک ہفتہ = 7 days, 1 ماہ / 1 month / ایک ماہ = 30 days, 5 din / پانچ دن = 5 days. If a medicine has its own days beside it, use those for that medicine only.
- Dose is written under each medicine like 1+1, 1+1+1, 1+0+1. Keep it exactly as written.
- Urdu instructions under a medicine (e.g. ناشتے سے پہلے, روزانہ ایک بار) go in "note". If the note says once daily, dose is "1".
- For injections, the frequency is written under them in Urdu (usually 1 per week or 1 in 10 days). Return it in "injFrequency" as e.g. "1 per week" or "1 in 10 days", or null.
- The form before a name (Tab. / Cap. / Inj. / Syp.) tells you the type: Tab, Cap, Inj, Syrup.
- Handwriting is often light and faint. Give your best reading and a confidence 0-1 for each medicine. If you cannot read a name at all, put null for name — do NOT invent a name.
Return ONLY valid JSON in this shape:
{"items":[{"name":"Remethan","type":"Tab","dose":"1+1","days":7,"daysRaw":"1 ہفتہ","note":null,"injFrequency":null,"confidence":0.8}],"commonDays":7,"commonDaysRaw":"1 ہفتہ"}
"commonDays" is the days value written once on the right edge for all medicines, or null if each medicine has its own days. "days" for each item is its own days, or commonDays when the slip gives one value for all.
`;
