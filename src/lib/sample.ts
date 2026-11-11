// Sample slip from the user's real prescription (2026-11-10).
// Medicines in the centre-right box; BP/pulse on the left (ignored);
// days once on the far right edge: 1 ہفتہ = 7 days for all.
// NO prices here — prices come only from the pharmacy's own list.
// Used for the demo bill and for the local calculation test.

import type { BillItemInput } from "./calc";

export const SAMPLE_SLIP_ITEMS: BillItemInput[] = [
  { name: "Remethan", dose: "1+1", days: 7 },
  { name: "Myolax", dose: "1+1", days: 7 },
  { name: "Lacolep", dose: "1+1", days: 7 },
  { name: "Eskem", dose: "1", days: 7 },
  { name: "Caldree", dose: "1", days: 7 },
  { name: "Sunvit", dose: "1", days: 7, injEveryDays: 7 },
];

export const SAMPLE_SEED_MEDICINES = [
  { name: "Remethan", type: "Tab", pack_qty: 10, pack_unit: "tabs" },
  { name: "Myolax", type: "Tab", pack_qty: 10, pack_unit: "tabs" },
  { name: "Lacolep", type: "Tab", pack_qty: 10, pack_unit: "tabs" },
  { name: "Eskem", type: "Cap", pack_qty: 10, pack_unit: "caps" },
  { name: "Caldree", type: "Tab", pack_qty: 10, pack_unit: "tabs" },
  { name: "Sunvit", type: "Inj", pack_qty: 1, pack_unit: "inj" },
] as const;
