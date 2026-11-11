// Dawai Bill Checker — pure calculation + matching logic.
// No prices are invented here: every price comes from the pharmacy's own
// medicine list. This file has no I/O so it can be unit-tested with node.

export type MedicineType = "Tab" | "Cap" | "Syrup" | "Inj" | "Sachet" | "Cream" | "Drops";

export interface PharmacyMedicine {
  id: string;
  name: string;
  type: MedicineType;
  /** Price in Rs for ONE full pack / box / bottle. 0 = not set yet. */
  pack_price: number;
  /** How many units are inside one pack (e.g. 10 tabs, 1 inj, 10 sachets). */
  pack_qty: number;
  pack_unit: string;
  similar_medicine_id?: string | null;
}

export interface BillItemInput {
  /** Medicine name as read from the slip or typed by the patient. */
  name: string;
  /** Dose as written, e.g. "1+1", "1+1+1", "1+0+1", "1" (once daily). */
  dose: string;
  /** Number of days for this medicine. */
  days: number;
  /** For injections: how often, e.g. "1 per week" or "1 in 10 days". */
  injEveryDays?: number | null;
}

export interface BillLine {
  requestedName: string;
  medicine: PharmacyMedicine | null;
  /** The medicine the patient will actually get/pay for (similar, if substituted). */
  billedName: string;
  substituted: boolean;
  dose: string;
  perDay: number;
  days: number;
  unitsNeeded: number;
  packsNeeded: number;
  packPrice: number;
  lineTotal: number;
  priceNotSet: boolean;
  notFound: boolean;
}

export interface Bill {
  lines: BillLine[];
  total: number;
  hasUnsetPrices: boolean;
  hasNotFound: boolean;
}

/** "1+1+1" -> 3, "1+1" -> 2, "1+0+1" -> 2, "1" -> 1, "1/2+1/2" -> 1. */
export function parseDose(dose: string): number {
  const raw = (dose || "").trim();
  if (!raw) return 1;
  // Half-tablet notation: 1/2 counts as 0.5.
  const parts = raw.split("+").map((p) => p.trim());
  let total = 0;
  for (const p of parts) {
    if (p.includes("/")) {
      const [a, b] = p.split("/").map(Number);
      if (b) total += a / b;
    } else {
      const n = Number(p);
      total += Number.isFinite(n) ? n : 1;
    }
  }
  return total > 0 ? total : 1;
}

const URDU_DIGITS: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function normalizeDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => URDU_DIGITS[d] ?? d);
}

const URDU_NUMBER_WORDS: Record<string, number> = {
  "ایک": 1, "دو": 2, "تین": 3, "چار": 4, "پانچ": 5,
  "چھ": 6, "سات": 7, "آٹھ": 8, "نو": 9, "دس": 10,
  "گیارہ": 11, "بارہ": 12, "تیرہ": 13, "چودہ": 14, "پندرہ": 15,
  "بیس": 20, "تیس": 30,
  "ek": 1, "do": 2, "teen": 3, "chaar": 4, "paanch": 5, "chay": 6,
  "saat": 7, "aath": 8, "nau": 9, "das": 10,
};

/**
 * Parse a days value written in Urdu / Roman Urdu / digits.
 * Handles: "7", "5 din", "1 ہفتہ", "ایک ہفتہ", "پانچ دن", "۵ دن",
 * "1 hafta", "2 haftay", "1 mah", "1 month".
 * Returns days as a number, or null when it cannot be understood.
 */
export function parseDaysUrdu(raw: string): number | null {
  if (!raw) return null;
  const s = normalizeDigits(raw.trim().toLowerCase());
  // Weeks: "1 hafta", "ایک ہفتہ", "2 haftay", "1 week"
  const weekMatch = s.match(/(\d+)\s*(hafta|haftay|week|ہفتہ|ہفتے)/);
  if (weekMatch) return Number(weekMatch[1]) * 7;
  for (const [word, n] of Object.entries(URDU_NUMBER_WORDS)) {
    if (s.includes(word) && /(hafta|haftay|week|ہفتہ|ہفتے)/.test(s)) return n * 7;
  }
  // Months: "1 mah", "1 month", "ایک ماہ"
  const monthMatch = s.match(/(\d+)\s*(mah|maah|month|ماہ|مہینہ)/);
  if (monthMatch) return Number(monthMatch[1]) * 30;
  for (const [word, n] of Object.entries(URDU_NUMBER_WORDS)) {
    if (s.includes(word) && /(mah|maah|month|ماہ|مہینہ)/.test(s)) return n * 30;
  }
  // Days: "7", "5 din", "پانچ دن", "۵ دن", "7 days"
  const numMatch = s.match(/(\d+)/);
  if (numMatch) return Number(numMatch[1]);
  for (const [word, n] of Object.entries(URDU_NUMBER_WORDS)) {
    if (s.includes(word)) return n;
  }
  return null;
}

/** "1 per week" -> 7, "1 in 10 days" -> 10, "haftay mein 1" -> 7. */
export function parseInjFrequency(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = normalizeDigits(raw.trim().toLowerCase());
  if (/(hafta|week|ہفتہ)/.test(s)) {
    const m = s.match(/(\d+)/);
    return m ? Number(m[1]) * 7 : 7;
  }
  const m = s.match(/(\d+)\s*(din|day|days|دن)/);
  if (m) return Number(m[1]);
  const n = s.match(/(\d+)/);
  return n ? Number(n[1]) : null;
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Small Levenshtein distance for fuzzy matching against the pharmacy list. */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

/**
 * Find the closest medicine in the pharmacy's own list.
 * Exact match first, then prefix, then Levenshtein within a small distance
 * (handwriting misreads like Revethan -> Remethan are 1-2 edits away).
 */
export function fuzzyMatch(name: string, list: PharmacyMedicine[]): PharmacyMedicine | null {
  const norm = normalizeName(name);
  if (!norm) return null;
  for (const med of list) if (normalizeName(med.name) === norm) return med;
  for (const med of list) {
    const n = normalizeName(med.name);
    if (n.startsWith(norm) || norm.startsWith(n)) return med;
  }
  let best: PharmacyMedicine | null = null;
  let bestDist = Infinity;
  for (const med of list) {
    const d = levenshtein(norm, normalizeName(med.name));
    if (d < bestDist) { bestDist = d; best = med; }
  }
  // Allow up to ~25% of the name length in edits, at least 2.
  const allowed = Math.max(2, Math.floor(norm.length * 0.25));
  return best && bestDist <= allowed ? best : null;
}

export function isSyrupLike(type: MedicineType): boolean {
  return type === "Syrup" || type === "Cream" || type === "Drops";
}

/**
 * One bill line. Tablets/capsules/sachets: dose x days, rounded UP to full
 * packs. Syrups/creams/drops: 1 full bottle normally; more if the course is
 * long (units = dose spoons per day is not tracked, so a syrup is 1 bottle
 * per 7 days of course as a safe estimate — the pharmacy corrects it at the
 * counter). Injections: from the Urdu frequency under the medicine.
 */
export function calcLine(item: BillItemInput, list: PharmacyMedicine[]): BillLine {
  const perDay = parseDose(item.dose);
  const days = Math.max(1, Math.round(item.days || 1));
  let med = fuzzyMatch(item.name, list);
  let substituted = false;
  if (med?.similar_medicine_id) {
    const similar = list.find((m) => m.id === med!.similar_medicine_id);
    if (similar) { med = similar; substituted = true; }
  }
  if (!med) {
    return {
      requestedName: item.name, medicine: null, billedName: item.name,
      substituted: false, dose: item.dose, perDay, days,
      unitsNeeded: 0, packsNeeded: 0, packPrice: 0, lineTotal: 0,
      priceNotSet: false, notFound: true,
    };
  }
  const packQty = Math.max(1, med.pack_qty || 1);
  let unitsNeeded: number;
  let packsNeeded: number;
  if (med.type === "Inj") {
    const every = item.injEveryDays ?? 7;
    packsNeeded = Math.max(1, Math.ceil(days / Math.max(1, every)));
    unitsNeeded = packsNeeded * packQty;
  } else if (isSyrupLike(med.type)) {
    // 1 full bottle per course; a long course needs another bottle per week.
    packsNeeded = Math.max(1, Math.ceil(days / 7));
    unitsNeeded = packsNeeded * packQty;
  } else {
    unitsNeeded = Math.ceil(perDay * days);
    packsNeeded = Math.ceil(unitsNeeded / packQty);
  }
  const packPrice = med.pack_price || 0;
  return {
    requestedName: item.name, medicine: med, billedName: med.name,
    substituted, dose: item.dose, perDay, days,
    unitsNeeded, packsNeeded, packPrice,
    lineTotal: packsNeeded * packPrice,
    priceNotSet: packPrice <= 0, notFound: false,
  };
}

export function calcBill(items: BillItemInput[], list: PharmacyMedicine[]): Bill {
  const lines = items.map((it) => calcLine(it, list));
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  return {
    lines, total,
    hasUnsetPrices: lines.some((l) => l.priceNotSet),
    hasNotFound: lines.some((l) => l.notFound),
  };
}

/** Reduce days uniformly until the bill fits the budget (never below 1 day). */
export function reduceDaysToBudget(items: BillItemInput[], list: PharmacyMedicine[], budget: number): { items: BillItemInput[]; bill: Bill } {
  let current = items.map((it) => ({ ...it }));
  let bill = calcBill(current, list);
  while (bill.total > budget && current.some((it) => it.days > 1)) {
    current = current.map((it) => ({ ...it, days: Math.max(1, it.days - 1) }));
    bill = calcBill(current, list);
  }
  return { items: current, bill };
}
