// Calculation test for the sample slip. Run with:
//   node --experimental-strip-types scripts/test-calc.ts
// TEST PRICES ONLY (100 Rs/pack etc.) — these are NOT real medicine prices;
// they exist only to verify the maths. Real prices come from the pharmacy.

import { calcBill, parseDaysUrdu, parseDose, parseInjFrequency, fuzzyMatch, reduceDaysToBudget, type PharmacyMedicine } from "../src/lib/calc.ts";

let pass = 0, fail = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  if (ok) pass++; else fail++;
}

// --- Dose parsing ---
check("dose 1+1", parseDose("1+1"), 2);
check("dose 1+1+1", parseDose("1+1+1"), 3);
check("dose 1+0+1", parseDose("1+0+1"), 2);
check("dose 1", parseDose("1"), 1);

// --- Urdu days parsing ---
check("days 1 ہفتہ", parseDaysUrdu("1 ہفتہ"), 7);
check("days ایک ہفتہ", parseDaysUrdu("ایک ہفتہ"), 7);
check("days 1 hafta", parseDaysUrdu("1 hafta"), 7);
check("days 2 haftay", parseDaysUrdu("2 haftay"), 14);
check("days پانچ دن", parseDaysUrdu("پانچ دن"), 5);
check("days ۵ دن", parseDaysUrdu("۵ دن"), 5);
check("days 5 din", parseDaysUrdu("5 din"), 5);
check("days 1 ماہ", parseDaysUrdu("1 ماہ"), 30);
check("days 1 month", parseDaysUrdu("1 month"), 30);

// --- Injection frequency ---
check("inj 1 per week", parseInjFrequency("1 per week"), 7);
check("inj 1 in 10 days", parseInjFrequency("1 in 10 days"), 10);
check("inj haftay mein 1", parseInjFrequency("haftay mein 1"), 7);

// --- Sample slip: 6 medicines, 1+1, 1 hafta = 7 days ---
// TEST prices: 100 Rs per pack of 10 (tabs), 500 Rs per injection.
const meds: PharmacyMedicine[] = [
  { id: "1", name: "Remethan", type: "Tab", pack_price: 100, pack_qty: 10, pack_unit: "tabs" },
  { id: "2", name: "Myolax", type: "Tab", pack_price: 100, pack_qty: 10, pack_unit: "tabs" },
  { id: "3", name: "Lacolep", type: "Tab", pack_price: 100, pack_qty: 10, pack_unit: "tabs" },
  { id: "4", name: "Eskem", type: "Cap", pack_price: 100, pack_qty: 10, pack_unit: "caps" },
  { id: "5", name: "Caldree", type: "Tab", pack_price: 100, pack_qty: 10, pack_unit: "tabs" },
  { id: "6", name: "Sunvit", type: "Inj", pack_price: 500, pack_qty: 1, pack_unit: "inj" },
];

check("fuzzy Revethan -> Remethan", fuzzyMatch("Revethan", meds)?.name, "Remethan");
check("fuzzy myolax -> Myolax", fuzzyMatch("myolax", meds)?.name, "Myolax");
check("fuzzy unknown -> null", fuzzyMatch("Zzzqqq", meds), null);

const bill = calcBill([
  { name: "Remethan", dose: "1+1", days: 7 },
  { name: "Myolax", dose: "1+1", days: 7 },
  { name: "Lacolep", dose: "1+1", days: 7 },
  { name: "Eskem", dose: "1", days: 7 },
  { name: "Caldree", dose: "1", days: 7 },
  { name: "Sunvit", dose: "1", days: 7, injEveryDays: 7 },
], meds);
const rem = bill.lines[0];
check("Remethan units (1+1 x 7d)", rem.unitsNeeded, 14);
check("Remethan packs (14 / 10, rounded up, stock only)", rem.packsNeeded, 2);
check("Remethan line total PER UNIT (14 tabs x Rs 10)", rem.lineTotal, 140);
check("Eskem units (1 x 7d)", bill.lines[3].unitsNeeded, 7);
check("Eskem line total PER UNIT (7 caps x Rs 10)", bill.lines[3].lineTotal, 70);
check("Sunvit packs (7d, 1/week)", bill.lines[5].packsNeeded, 1);
check("Sunvit total (1 x 500)", bill.lines[5].lineTotal, 500);
check("grand total PER UNIT (140*3 + 70*2 + 500)", bill.total, 1060);

// --- Injection: 20 days at 1 in 10 days = 2 injections ---
const injBill = calcBill([{ name: "Sunvit", dose: "1", days: 20, injEveryDays: 10 }], meds);
check("Sunvit 20d / 10d = 2 inj", injBill.lines[0].packsNeeded, 2);

// --- Budget: reduce days to fit ---
const reduced = reduceDaysToBudget(
  [{ name: "Remethan", dose: "1+1", days: 7 }],
  meds, 100
);
check("budget 100 fits per-unit -> days reduced to 5 (10 tabs x Rs 10)", reduced.items[0].days, 5);
check("budget reduced total", reduced.bill.total, 100);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
