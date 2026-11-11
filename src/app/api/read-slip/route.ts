import { NextResponse } from "next/server";
import { askGeminiJson, friendlyGeminiError, SLIP_PROMPT } from "@/lib/gemini";
import { parseDaysUrdu, parseInjFrequency } from "@/lib/calc";

export const maxDuration = 60;

/**
 * POST /api/read-slip — multipart form with `image` (the slip photo).
 * Gemini vision reads ONLY the middle medicine box + days on the right
 * edge (see SLIP_PROMPT). The response is normalised here: days strings
 * become numbers, injection frequencies become days.
 * Returns { items, commonDays, commonDaysRaw } or a plain error message.
 * The patient MUST confirm this list on screen before any bill is shown.
 */
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "AI reading is not configured yet (GEMINI_API_KEY missing). Please type the medicine names instead." },
      { status: 503 }
    );
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Photo is too large (max 8 MB)." }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const mimeType = file.type || "image/jpeg";
  // Downscale note: the browser already sends a photo; Gemini handles it.
  let parsed: unknown;
  try {
    parsed = await askGeminiJson(SLIP_PROMPT, [{ mimeType, data: base64 }]);
  } catch (e) {
    return NextResponse.json({ error: friendlyGeminiError(e) }, { status: 503 });
  }
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "The slip could not be read. Please type the medicine names instead." }, { status: 422 });
  }
  const raw = parsed as {
    items?: Array<{ name?: string | null; type?: string; dose?: string; days?: number | string; daysRaw?: string; note?: string | null; injFrequency?: string | null; confidence?: number }>;
    commonDays?: number | string | null;
    commonDaysRaw?: string | null;
  };
  const commonDays =
    typeof raw.commonDays === "number"
      ? raw.commonDays
      : raw.commonDaysRaw
        ? parseDaysUrdu(String(raw.commonDaysRaw))
        : typeof raw.commonDays === "string"
          ? parseDaysUrdu(raw.commonDays)
          : null;
  const items = (raw.items ?? [])
    .filter((it) => it && (it.name || it.dose))
    .map((it) => {
      const days =
        typeof it.days === "number"
          ? it.days
          : it.daysRaw
            ? parseDaysUrdu(String(it.daysRaw))
            : typeof it.days === "string"
              ? parseDaysUrdu(it.days)
              : null;
      return {
        name: it.name ?? "",
        type: it.type ?? "Tab",
        dose: it.dose ?? "1",
        days: days ?? commonDays ?? 7,
        daysRaw: it.daysRaw ?? raw.commonDaysRaw ?? null,
        note: it.note ?? null,
        injEveryDays: it.injFrequency ? parseInjFrequency(it.injFrequency) : null,
        confidence: typeof it.confidence === "number" ? it.confidence : null,
      };
    });
  if (items.length === 0) {
    return NextResponse.json({ error: "No medicines could be read from this photo. Please type the medicine names instead." }, { status: 422 });
  }
  return NextResponse.json({ items, commonDays, commonDaysRaw: raw.commonDaysRaw ?? null });
}
