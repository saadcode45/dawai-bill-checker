import { NextResponse } from "next/server";
import { getSupabaseBrowser } from "@/lib/supabase";

/**
 * GET /api/pharmacy?slug=my-pharmacy
 * Public read: returns the pharmacy + its full medicine price list.
 * Prices are public by design (patients must see them without logging in).
 * When Supabase is not configured, returns 503 so the patient page falls
 * back to its built-in demo pharmacy instead of failing silently.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "Missing slug." }, { status: 400 });
  const sb = getSupabaseBrowser();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: pharmacy, error: pErr } = await sb
    .from("dawai_pharmacies")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (pErr || !pharmacy) return NextResponse.json({ error: "Pharmacy not found." }, { status: 404 });
  const { data: medicines, error: mErr } = await sb
    .from("dawai_medicines")
    .select("id, name, type, pack_price, pack_qty, pack_unit, similar_medicine_id")
    .eq("pharmacy_id", pharmacy.id)
    .order("name");
  if (mErr) return NextResponse.json({ error: "Could not load medicines." }, { status: 500 });
  return NextResponse.json({ pharmacy, medicines: medicines ?? [] });
}
