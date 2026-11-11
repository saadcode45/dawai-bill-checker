import { NextResponse } from "next/server";
import { calcBill, type BillItemInput, type PharmacyMedicine } from "@/lib/calc";
import { getSupabaseBrowser } from "@/lib/supabase";

/**
 * POST /api/calculate — server-side bill calculation.
 * Body: { items: BillItemInput[], slug?: string, medicines?: PharmacyMedicine[] }
 * If `slug` is given, prices are loaded from that pharmacy's list in
 * Supabase (never trust client-sent prices). Otherwise the caller must
 * supply `medicines` (demo mode, e.g. the sample pharmacy).
 * Returns the same Bill shape the patient page renders.
 */
export async function POST(req: Request) {
  let body: { items?: BillItemInput[]; slug?: string; medicines?: PharmacyMedicine[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "No medicines to calculate." }, { status: 400 });
  let medicines: PharmacyMedicine[] = Array.isArray(body.medicines) ? body.medicines : [];
  if (body.slug) {
    const sb = getSupabaseBrowser();
    if (!sb) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    const { data: pharmacy } = await sb.from("dawai_pharmacies").select("id").eq("slug", body.slug).maybeSingle();
    if (!pharmacy) return NextResponse.json({ error: "Pharmacy not found." }, { status: 404 });
    const { data } = await sb
      .from("dawai_medicines")
      .select("id, name, type, pack_price, pack_qty, pack_unit, similar_medicine_id")
      .eq("pharmacy_id", pharmacy.id);
    medicines = (data ?? []) as PharmacyMedicine[];
  }
  const bill = calcBill(items, medicines);
  return NextResponse.json({ bill });
}
