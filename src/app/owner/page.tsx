"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import AuthForm from "@/components/AuthForm";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";
import { SAMPLE_SEED_MEDICINES } from "@/lib/sample";
import type { MedicineType, PharmacyMedicine } from "@/lib/calc";

const TYPES: MedicineType[] = ["Tab", "Cap", "Syrup", "Inj", "Sachet", "Cream", "Drops"];

const inputCls =
  "w-full min-h-[52px] rounded-xl border border-neutral-300 bg-white px-4 text-[16px] outline-none focus:border-emerald-700";
const btn =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-5 text-[17px] font-bold";
const smallBtn =
  "flex min-h-[44px] items-center justify-center rounded-xl px-4 text-[15px] font-bold";

interface PharmacyRow { id: string; name: string; slug: string; }

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-pharmacy";
}

export default function OwnerPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pharmacy, setPharmacy] = useState<PharmacyRow | null>(null);
  const [medicines, setMedicines] = useState<PharmacyMedicine[]>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [patientLink, setPatientLink] = useState("");

  // Create-pharmacy form
  const [pharmName, setPharmName] = useState("");
  const [pharmSlug, setPharmSlug] = useState("my-pharmacy");
  // Add-medicine form
  const [mName, setMName] = useState("");
  const [mType, setMType] = useState<MedicineType>("Tab");
  const [mPrice, setMPrice] = useState("");
  const [mQty, setMQty] = useState("10");
  const [mUnit, setMUnit] = useState("tabs");
  const [mSimilar, setMSimilar] = useState("");
  // Edit price
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const loadMedicines = useCallback(async (pharmacyId: string) => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const { data } = await sb
      .from("dawai_medicines")
      .select("id, name, type, pack_price, pack_qty, pack_unit, similar_medicine_id")
      .eq("pharmacy_id", pharmacyId)
      .order("name");
    setMedicines((data ?? []) as PharmacyMedicine[]);
  }, []);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) { setLoading(false); return; }
    sb.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user ?? null;
      setUserEmail(user?.email ?? null);
      if (user) {
        const { data: rows } = await sb
          .from("dawai_pharmacies")
          .select("id, name, slug")
          .eq("owner_id", user.id)
          .limit(1);
        const row = (rows?.[0] ?? null) as PharmacyRow | null;
        setPharmacy(row);
        if (row) {
          loadMedicines(row.id);
          const link = `${window.location.origin}/p/${row.slug}`;
          setPatientLink(link);
          QRCode.toDataURL(link, { width: 512, margin: 2 }).then(setQrUrl).catch(() => {});
        }
      }
      setLoading(false);
    });
  }, [loadMedicines]);

  async function signOut() {
    await getSupabaseBrowser()?.auth.signOut();
    window.location.reload();
  }

  async function createPharmacy(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg("");
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    setBusy(true);
    const slug = slugify(pharmSlug);
    const { data, error } = await sb
      .from("dawai_pharmacies")
      .insert({ owner_id: user.id, name: pharmName.trim(), slug })
      .select("id, name, slug")
      .single();
    setBusy(false);
    if (error) { setErr(error.message.includes("duplicate") ? "That link name is already taken. Try another." : error.message); return; }
    setPharmacy(data as PharmacyRow);
    setMsg("Pharmacy created. Now add your medicines below.");
    const link = `${window.location.origin}/p/${slug}`;
    setPatientLink(link);
    QRCode.toDataURL(link, { width: 512, margin: 2 }).then(setQrUrl).catch(() => {});
  }

  async function seedSample() {
    if (!pharmacy) return;
    setErr(""); setMsg("");
    const sb = getSupabaseBrowser();
    if (!sb) return;
    setBusy(true);
    const existing = new Set(medicines.map((m) => m.name.toLowerCase()));
    const toAdd = SAMPLE_SEED_MEDICINES.filter((m) => !existing.has(m.name.toLowerCase())).map((m) => ({
      pharmacy_id: pharmacy.id, name: m.name, type: m.type, pack_price: 0, pack_qty: m.pack_qty, pack_unit: m.pack_unit,
    }));
    if (toAdd.length === 0) { setMsg("Sample medicines are already in your list."); setBusy(false); return; }
    const { error } = await sb.from("dawai_medicines").insert(toAdd);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(`${toAdd.length} sample medicines added with price 0 — set their real prices below.`);
    loadMedicines(pharmacy.id);
  }

  async function addMedicine(e: React.FormEvent) {
    e.preventDefault();
    if (!pharmacy) return;
    setErr(""); setMsg("");
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const price = Number(mPrice);
    if (!mName.trim()) { setErr("Medicine name is required."); return; }
    if (!Number.isFinite(price) || price < 0) { setErr("Enter a valid price (0 if not set yet)."); return; }
    setBusy(true);
    const { error } = await sb.from("dawai_medicines").insert({
      pharmacy_id: pharmacy.id,
      name: mName.trim(),
      type: mType,
      pack_price: price,
      pack_qty: Math.max(1, Number(mQty) || 1),
      pack_unit: mUnit.trim() || "tabs",
      similar_medicine_id: mSimilar || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMName(""); setMPrice(""); setMSimilar("");
    setMsg("Medicine added.");
    loadMedicines(pharmacy.id);
  }

  async function savePrice(id: string) {
    const price = Number(editPrice);
    if (!Number.isFinite(price) || price < 0) { setErr("Enter a valid price."); return; }
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const { error } = await sb.from("dawai_medicines").update({ pack_price: price }).eq("id", id);
    if (error) { setErr(error.message); return; }
    setEditId(null);
    if (pharmacy) loadMedicines(pharmacy.id);
  }

  async function deleteMedicine(id: string, name: string) {
    if (!window.confirm(`Delete ${name}?`)) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;
    await sb.from("dawai_medicines").delete().eq("id", id);
    if (pharmacy) loadMedicines(pharmacy.id);
  }

  const shown = medicines.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10 text-center text-[16px] font-semibold text-neutral-600">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-12 pt-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-[24px] font-extrabold">🏪 Pharmacy Owner</h1>
        {userEmail && (
          <button onClick={signOut} className="min-h-[44px] rounded-xl bg-neutral-200 px-4 text-[15px] font-bold">
            Sign out
          </button>
        )}
      </header>
      {userEmail && <p className="mt-1 break-words text-[14px] text-neutral-600">{userEmail}</p>}

      {!isSupabaseConfigured() && (
        <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-[15px] font-semibold text-amber-800">
          Supabase is not configured yet. Add the keys to .env.local — see README.
        </p>
      )}

      {!userEmail && (
        <div className="mt-4">
          <AuthForm />
          <p className="mt-3 text-center text-[14px] text-neutral-600">
            <a href="/" className="font-bold text-emerald-700">← Back to home</a>
          </p>
        </div>
      )}

      {userEmail && !pharmacy && (
        <form onSubmit={createPharmacy} className="mt-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-[18px] font-bold">Create your pharmacy</h2>
          <p className="text-[15px] text-neutral-600">One pharmacy per account for the pilot. Paid multi-pharmacy comes later.</p>
          <label className="block text-[15px] font-bold">Pharmacy name
            <input className={inputCls + " mt-1"} value={pharmName} onChange={(e) => { setPharmName(e.target.value); setPharmSlug(slugify(e.target.value)); }} required placeholder="e.g. Al-Shifa Pharmacy" />
          </label>
          <label className="block text-[15px] font-bold">Link name (for the QR)
            <input className={inputCls + " mt-1"} value={pharmSlug} onChange={(e) => setPharmSlug(slugify(e.target.value))} required />
            <span className="text-[13px] font-normal text-neutral-500">Patient link will be /p/{pharmSlug || "my-pharmacy"}</span>
          </label>
          {err && <p className="rounded-xl bg-red-50 p-3 text-[15px] font-semibold text-red-700">{err}</p>}
          <button type="submit" disabled={busy} className={`${btn} bg-emerald-700 text-white disabled:opacity-50`}>
            {busy ? "Please wait…" : "Create Pharmacy"}
          </button>
        </form>
      )}

      {userEmail && pharmacy && (
        <>
          {msg && <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-[15px] font-semibold text-emerald-700">{msg}</p>}
          {err && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-[15px] font-semibold text-red-700">{err}</p>}

          <section className="mt-4 rounded-2xl bg-white p-4 text-center shadow-sm">
            <h2 className="text-[18px] font-bold">{pharmacy.name}</h2>
            <p className="break-all text-[14px] text-neutral-600">{patientLink}</p>
            {qrUrl ? (
              <img src={qrUrl} alt="Pharmacy QR code" className="mx-auto mt-3 h-56 w-56 rounded-xl border" />
            ) : (
              <p className="mt-3 text-[15px] text-neutral-500">Generating QR…</p>
            )}
            <p className="mt-2 text-[15px] font-semibold">Print this QR and paste it at the counter.</p>
            <div className="mt-3 flex gap-2">
              {qrUrl && (
                <a href={qrUrl} download={`${pharmacy.slug}-qr.png`} className={`${smallBtn} flex-1 bg-neutral-900 text-white`}>
                  Download QR
                </a>
              )}
              <a href={patientLink} target="_blank" rel="noreferrer" className={`${smallBtn} flex-1 bg-emerald-700 text-white`}>
                Open patient page
              </a>
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-[18px] font-bold">Add medicine — one by one</h2>
            <p className="mt-1 text-[14px] text-neutral-600">Price is for the FULL pack / box / bottle. Quantity is what is inside one pack.</p>
            <form onSubmit={addMedicine} className="mt-3 space-y-3">
              <label className="block text-[15px] font-bold">Medicine name
                <input className={inputCls + " mt-1"} value={mName} onChange={(e) => setMName(e.target.value)} required placeholder="e.g. Remethan" />
              </label>
              <label className="block text-[15px] font-bold">Type
                <select className={inputCls + " mt-1"} value={mType} onChange={(e) => setMType(e.target.value as MedicineType)}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-[15px] font-bold">Full pack price (Rs)
                <input className={inputCls + " mt-1"} type="number" min="0" step="1" inputMode="decimal" value={mPrice} onChange={(e) => setMPrice(e.target.value)} required placeholder="e.g. 300 (0 = not set yet)" />
              </label>
              <div className="flex gap-2">
                <label className="block flex-1 text-[15px] font-bold">Qty inside pack
                  <input className={inputCls + " mt-1"} type="number" min="1" step="1" inputMode="numeric" value={mQty} onChange={(e) => setMQty(e.target.value)} required />
                </label>
                <label className="block flex-1 text-[15px] font-bold">Unit
                  <input className={inputCls + " mt-1"} value={mUnit} onChange={(e) => setMUnit(e.target.value)} required placeholder="tabs" />
                </label>
              </div>
              <label className="block text-[15px] font-bold">Similar medicine (optional)
                <select className={inputCls + " mt-1"} value={mSimilar} onChange={(e) => setMSimilar(e.target.value)}>
                  <option value="">— None —</option>
                  {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <span className="text-[13px] font-normal text-neutral-500">If this one is not available, bill the similar one instead.</span>
              </label>
              <button type="submit" disabled={busy} className={`${btn} bg-emerald-700 text-white disabled:opacity-50`}>
                {busy ? "Adding…" : "＋ Add Medicine"}
              </button>
            </form>
            <button onClick={seedSample} disabled={busy} className={`${btn} mt-3 bg-neutral-100 text-neutral-900 disabled:opacity-50`}>
              Add the 6 sample medicines (price 0 — set prices after)
            </button>
          </section>

          <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-[18px] font-bold">My medicines ({medicines.length})</h2>
            <input
              className={inputCls + " mt-3"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine…"
            />
            {shown.length === 0 && <p className="mt-3 text-[15px] text-neutral-500">No medicines yet. Add your first one above.</p>}
            <ul className="mt-3 space-y-3">
              {shown.map((m) => (
                <li key={m.id} className="rounded-xl border border-neutral-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-[16px] font-bold">{m.name} <span className="text-[13px] font-semibold text-neutral-500">({m.type})</span></p>
                      <p className="text-[14px] text-neutral-600">Pack: {m.pack_qty} {m.pack_unit}</p>
                      {m.similar_medicine_id && (
                        <p className="text-[13px] text-neutral-500">Similar: {medicines.find((x) => x.id === m.similar_medicine_id)?.name ?? "—"}</p>
                      )}
                    </div>
                    <button onClick={() => deleteMedicine(m.id, m.name)} className="min-h-[44px] shrink-0 rounded-xl bg-red-50 px-3 text-[14px] font-bold text-red-700">
                      Delete
                    </button>
                  </div>
                  {editId === m.id ? (
                    <div className="mt-2 flex gap-2">
                      <input className={inputCls} type="number" min="0" step="1" inputMode="decimal" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="New price Rs" />
                      <button onClick={() => savePrice(m.id)} className={`${smallBtn} bg-emerald-700 text-white`}>Save</button>
                      <button onClick={() => setEditId(null)} className={`${smallBtn} bg-neutral-200`}>Cancel</button>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[16px] font-bold">
                        {m.pack_price > 0 ? `Rs ${m.pack_price}` : <span className="text-amber-700">⚠ Set price</span>}
                      </p>
                      <button onClick={() => { setEditId(m.id); setEditPrice(String(m.pack_price)); }} className={`${smallBtn} bg-neutral-100`}>
                        Edit price
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
