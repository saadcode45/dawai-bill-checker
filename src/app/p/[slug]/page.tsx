"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calcBill, fuzzyMatch, reduceDaysToBudget, type Bill, type BillItemInput, type PharmacyMedicine } from "@/lib/calc";
import { t, type Lang } from "@/lib/i18n";
import { SAMPLE_SEED_MEDICINES, SAMPLE_SLIP_ITEMS } from "@/lib/sample";

const DOSES = ["1", "1+1", "1+1+1", "1+0+1", "0+1+1", "1+0+0"];

const btn =
  "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-[17px] font-bold";
const inputCls =
  "w-full min-h-[52px] rounded-xl border border-neutral-300 bg-white px-4 text-[16px] outline-none focus:border-emerald-700";

interface RowItem extends BillItemInput { id: string; note?: string | null; }

let rowId = 0;
function newRow(partial?: Partial<RowItem>): RowItem {
  return { id: `r${++rowId}`, name: "", dose: "1+1", days: 7, injEveryDays: null, ...(partial ?? {}) };
}

const DEMO_MEDICINES: PharmacyMedicine[] = SAMPLE_SEED_MEDICINES.map((m, i) => ({
  id: `demo-${i}`,
  name: m.name,
  type: m.type as PharmacyMedicine["type"],
  pack_price: 0, // NOT a real price — owner must set it. Never invent prices.
  pack_qty: m.pack_qty,
  pack_unit: m.pack_unit,
  similar_medicine_id: null,
}));

type Step = "lang" | "mode" | "confirm" | "bill" | "budget" | "adjust" | "final";

export default function PatientPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState("");
  const [lang, setLang] = useState<Lang | null>(null);
  const [step, setStep] = useState<Step>("lang");
  const [pharmacyName, setPharmacyName] = useState("");
  const [medicines, setMedicines] = useState<PharmacyMedicine[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [rows, setRows] = useState<RowItem[]>([newRow()]);
  const [sameDays, setSameDays] = useState(true);
  const [commonDays, setCommonDays] = useState(7);
  const [reading, setReading] = useState(false);
  const [readErr, setReadErr] = useState("");
  const [bill, setBill] = useState<Bill | null>(null);
  const [billItems, setBillItems] = useState<BillItemInput[]>([]);
  const [budget, setBudget] = useState("");
  const [adjustChoice, setAdjustChoice] = useState<"fewer" | "remove" | null>(null);
  const [finalItems, setFinalItems] = useState<BillItemInput[]>([]);
  const [finalBill, setFinalBill] = useState<Bill | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [kept, setKept] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Load the pharmacy (slug comes from the route params promise).
  useEffect(() => {
    params.then(({ slug: s }) => {
      setSlug(s);
      fetch(`/api/pharmacy?slug=${encodeURIComponent(s)}`)
        .then(async (r) => {
          if (!r.ok) throw new Error("not found");
          const j = await r.json();
          setPharmacyName(j.pharmacy?.name ?? s);
          setMedicines((j.medicines ?? []) as PharmacyMedicine[]);
        })
        .catch(() => {
          // No Supabase / unknown slug: demo pharmacy with the 6 sample
          // medicines and NO prices (owner must set them).
          if (s === "my-pharmacy") {
            setDemoMode(true);
            setPharmacyName("Demo Pharmacy (My Pharmacy)");
            setMedicines(DEMO_MEDICINES);
          } else {
            setLoadErr("Pharmacy not found. Check the QR code and try again.");
          }
        });
    });
  }, [params]);

  function updateRow(id: string, patch: Partial<RowItem>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function itemsFromRows(rs: RowItem[]): BillItemInput[] {
    return rs
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        dose: r.dose,
        days: sameDays ? commonDays : r.days,
        injEveryDays: r.injEveryDays ?? null,
      }));
  }

  async function calculate(items: BillItemInput[]): Promise<Bill> {
    // Server-side calculation when the pharmacy is real; local fallback
    // (same locked rules in lib/calc.ts) for demo mode / offline.
    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoMode ? { items, medicines } : { items, slug }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.bill) return j.bill as Bill;
      }
    } catch { /* fall through to local calc */ }
    return calcBill(items, medicines);
  }

  async function showBill() {
    const items = itemsFromRows(rows);
    if (items.length === 0) return;
    setBillItems(items);
    setBill(await calculate(items));
    setStep("bill");
  }

  function downscale(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => resolve(b ? new File([b], file.name, { type: "image/jpeg" }) : file), "image/jpeg", 0.85);
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setReadErr("");
    setReading(true);
    try {
      const small = await downscale(file);
      const form = new FormData();
      form.append("image", small);
      const res = await fetch("/api/read-slip", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not read the slip.");
      const items = (j.items ?? []) as Array<{ name: string; dose: string; days: number; injEveryDays?: number | null; note?: string | null }>;
      if (items.length === 0) throw new Error("no items");
      const common = typeof j.commonDays === "number" ? j.commonDays : 7;
      setCommonDays(common);
      setSameDays(true);
      setRows(items.map((it) => newRow({
        name: it.name ?? "",
        dose: it.dose ?? "1+1",
        days: it.days ?? common,
        injEveryDays: it.injEveryDays ?? null,
        note: it.note ?? null,
      })));
      setStep("confirm"); // COMPULSORY confirmation before any total is shown.
    } catch (e) {
      setReadErr(e instanceof Error ? e.message : "Could not read the slip.");
    } finally {
      setReading(false);
    }
  }

  function loadSampleSlip() {
    setCommonDays(7);
    setSameDays(true);
    setRows(SAMPLE_SLIP_ITEMS.map((it) => newRow(it)));
    setStep("confirm");
  }

  const budgetNum = Number(budget);
  const overBudget = bill !== null && Number.isFinite(budgetNum) && budgetNum > 0 && bill.total > budgetNum;

  async function goToAdjust() {
    if (!bill || !overBudget) {
      // Bill fits the budget — straight to the final screen, nothing changed.
      setFinalItems(billItems);
      setFinalBill(bill);
      setChangeNote("");
      setStep("final");
      return;
    }
    setStep("adjust");
  }

  async function applyFewerDays() {
    const { items, bill: nb } = reduceDaysToBudget(billItems, medicines, budgetNum);
    setFinalItems(items);
    setFinalBill(nb);
    const oldDays = billItems[0]?.days ?? 0;
    const newDays = items[0]?.days ?? 0;
    setChangeNote(
      lang === "ur"
        ? `دن کم کر دیے گئے: ${oldDays} دن سے ${newDays} دن`
        : `Din kam kar diye gaye: ${oldDays} din se ${newDays} din`
    );
    setStep("final");
  }

  const keptItems = useMemo(
    () => billItems.filter((_, i) => kept[String(i)] !== false),
    [billItems, kept]
  );
  const keptBill = useMemo(
    () => (step === "adjust" || step === "final" ? calcBill(keptItems, medicines) : null),
    [keptItems, medicines, step]
  );

  function applyRemove() {
    const removed = billItems.filter((_, i) => kept[String(i)] === false).map((it) => it.name);
    setFinalItems(keptItems);
    setFinalBill(keptBill);
    setChangeNote(
      removed.length > 0
        ? lang === "ur"
          ? `یہ دوائیاں نکال دی گئیں: ${removed.join("، ")}`
          : `Ye dawaiyan nikal di gayein: ${removed.join(", ")}`
        : ""
    );
    setStep("final");
  }

  function startAgain() {
    setRows([newRow()]);
    setBill(null);
    setFinalBill(null);
    setBudget("");
    setAdjustChoice(null);
    setKept({});
    setChangeNote("");
    setStep("mode");
  }

  const L = (lang ?? "roman") as Lang;

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-12 pt-6">
      <header className="text-center">
        <h1 className="text-[24px] font-extrabold leading-tight">💊 {t(L, "appName")}</h1>
        <p className="mt-1 text-[16px] font-semibold text-neutral-700">{pharmacyName || slug}</p>
        {demoMode && (
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[14px] font-semibold text-amber-800">
            Demo pharmacy — prices are not set yet. The owner must set real prices in the owner panel.
          </p>
        )}
        {loadErr && <p className="mt-2 rounded-xl bg-red-50 p-3 text-[15px] font-semibold text-red-700">{loadErr}</p>}
      </header>

      {step === "lang" && (
        <section className="mt-6 space-y-3">
          <h2 className="text-center text-[20px] font-bold">{t("roman", "chooseLanguage")} / زبان منتخب کریں</h2>
          <button onClick={() => { setLang("ur"); setStep("mode"); }} className={`${btn} bg-emerald-700 text-white`}>
            اردو — Urdu
          </button>
          <button onClick={() => { setLang("roman"); setStep("mode"); }} className={`${btn} bg-neutral-900 text-white`}>
            Roman Urdu
          </button>
        </section>
      )}

      {step === "mode" && lang && (
        <section className="mt-6 space-y-3">
          <p className="text-center text-[17px] font-semibold text-neutral-700">{t(lang, "scanOrType")}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPhoto(e.target.files?.[0])}
          />
          <button onClick={() => fileRef.current?.click()} disabled={reading} className={`${btn} bg-emerald-700 text-white disabled:opacity-50`}>
            {reading ? t(lang, "readingSlip") : `📷 ${t(lang, "uploadSlip")}`}
          </button>
          <button
            onClick={() => { setRows(rows.length ? rows : [newRow()]); setStep("confirm"); }}
            className={`${btn} bg-neutral-900 text-white`}
          >
            ✍️ {t(lang, "typeNames")}
          </button>
          <button onClick={loadSampleSlip} className={`${btn} bg-neutral-100 text-neutral-900`}>
            🧪 Try sample slip (Remethan, Myolax… 1 ہفتہ)
          </button>
          {readErr && <p className="rounded-xl bg-red-50 p-3 text-[15px] font-semibold text-red-700">{readErr}</p>}
          <button onClick={() => setStep("lang")} className="w-full py-2 text-center text-[15px] font-bold text-emerald-700">
            {t(lang, "back")} — Language / زبان
          </button>
        </section>
      )}

      {step === "confirm" && lang && (
        <section className="mt-6">
          <h2 className="text-[20px] font-bold">{t(lang, "confirmTitle")}</h2>
          <p className="mt-1 text-[15px] text-neutral-600">{t(lang, "confirmNote")}</p>

          <label className="mt-4 flex min-h-[52px] cursor-pointer items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
            <input type="checkbox" checked={sameDays} onChange={(e) => setSameDays(e.target.checked)} className="h-6 w-6 accent-emerald-700" />
            <span className="text-[16px] font-bold">{t(lang, "sameDaysForAll")}</span>
          </label>
          {sameDays && (
            <label className="mt-3 block text-[15px] font-bold">{t(lang, "daysForAll")}
              <input className={inputCls + " mt-1"} type="number" min={1} max={90} inputMode="numeric" value={commonDays}
                onChange={(e) => setCommonDays(Math.max(1, Number(e.target.value) || 1))} />
            </label>
          )}

          <div className="mt-3 space-y-3">
            <datalist id="dawai-names">
              {medicines.map((m) => <option key={m.id} value={m.name} />)}
            </datalist>
            {rows.map((r) => {
              const match = r.name.trim() ? fuzzyMatch(r.name, medicines) : null;
              return (
                <div key={r.id} className="rounded-2xl bg-white p-3 shadow-sm">
                  <label className="block text-[14px] font-bold">{t(lang, "medicine")}
                    <input
                      className={inputCls + " mt-1"}
                      value={r.name}
                      list="dawai-names"
                      onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      placeholder="e.g. Remethan"
                    />
                  </label>
                  {r.name.trim() && (
                    <p className="mt-1 text-[14px] font-semibold text-emerald-700">
                      {match ? `✓ ${match.name} — ${match.pack_price > 0 ? `Rs ${match.pack_price} / pack` : t(lang, "priceNotSet")}` : `⚠ ${t(lang, "notFound")}`}
                    </p>
                  )}
                  {r.note && <p className="mt-1 text-[14px] text-neutral-500">{r.note}</p>}
                  <div className="mt-2 flex gap-2">
                    <label className="block flex-1 text-[14px] font-bold">{t(lang, "dose")}
                      <select className={inputCls + " mt-1"} value={r.dose} onChange={(e) => updateRow(r.id, { dose: e.target.value })}>
                        {DOSES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </label>
                    {!sameDays && (
                      <label className="block flex-1 text-[14px] font-bold">{t(lang, "days")}
                        <input className={inputCls + " mt-1"} type="number" min={1} max={90} inputMode="numeric" value={r.days}
                          onChange={(e) => updateRow(r.id, { days: Math.max(1, Number(e.target.value) || 1) })} />
                      </label>
                    )}
                    <button onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="mt-6 min-h-[52px] shrink-0 rounded-xl bg-red-50 px-3 text-[14px] font-bold text-red-700">
                      ✕
                    </button>
                  </div>
                  {match?.type === "Inj" && (
                    <label className="mt-2 block text-[14px] font-bold">Injection — every how many days?
                      <input className={inputCls + " mt-1"} type="number" min={1} inputMode="numeric"
                        value={r.injEveryDays ?? 7}
                        onChange={(e) => updateRow(r.id, { injEveryDays: Math.max(1, Number(e.target.value) || 7) })} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={() => setRows((rs) => [...rs, newRow()])} className={`${btn} mt-3 bg-neutral-100 text-neutral-900`}>
            ＋ {t(lang, "addMedicine")}
          </button>
          <button onClick={showBill} className={`${btn} mt-3 bg-emerald-700 text-white`}>
            {t(lang, "showBill")} →
          </button>
          <button onClick={() => setStep("mode")} className="mt-2 w-full py-2 text-center text-[15px] font-bold text-emerald-700">
            {t(lang, "back")}
          </button>
        </section>
      )}

      {(step === "bill" || step === "budget" || step === "adjust") && lang && bill && (
        <section className="mt-6">
          <h2 className="text-[20px] font-bold">
            {step === "bill" ? t(lang, "total") : step === "budget" ? t(lang, "budgetQuestion") : t(lang, "adjustQuestion")}
          </h2>

          <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
            {bill.lines.map((line, i) => (
              <div key={i} className="border-b border-neutral-100 p-3 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-[16px] font-bold">
                    {line.billedName}
                    {line.substituted && <span className="text-[13px] font-semibold text-neutral-500"> (similar)</span>}
                  </p>
                  <p className="shrink-0 text-[16px] font-bold">
                    {line.priceNotSet ? t(lang, "priceNotSet") : line.notFound ? t(lang, "notFound") : `Rs ${line.lineTotal}`}
                  </p>
                </div>
                <p className="mt-1 text-[14px] text-neutral-600">
                  {line.dose} × {line.days} {t(lang, "days")} = {line.unitsNeeded} units → {line.packsNeeded} {t(lang, "packs")}
                  {!line.priceNotSet && !line.notFound && ` × Rs ${line.packPrice}`}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between bg-neutral-50 p-4">
              <p className="text-[18px] font-extrabold">{t(lang, "total")}</p>
              <p className="text-[22px] font-extrabold">Rs {bill.total}</p>
            </div>
          </div>
          <p className="mt-2 text-[14px] text-neutral-600">{t(lang, "estimateNote")}</p>
          {bill.hasUnsetPrices && (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[15px] font-semibold text-amber-800">
              ⚠ {t(lang, "priceNotSet")} — ask the pharmacy for the real price of those medicines.
            </p>
          )}

          {step === "bill" && (
            <div className="mt-4 space-y-3">
              <button onClick={() => setStep("budget")} className={`${btn} bg-emerald-700 text-white`}>
                {t(lang, "budgetQuestion")} →
              </button>
              <button onClick={() => { setFinalItems(billItems); setFinalBill(bill); setChangeNote(""); setStep("final"); }} className={`${btn} bg-neutral-900 text-white`}>
                {t(lang, "showToPharmacy")} →
              </button>
              <button onClick={() => setStep("confirm")} className="w-full py-2 text-center text-[15px] font-bold text-emerald-700">
                {t(lang, "back")}
              </button>
            </div>
          )}

          {step === "budget" && (
            <div className="mt-4 space-y-3">
              <label className="block text-[16px] font-bold">{t(lang, "yourBudget")}
                <input className={inputCls + " mt-1"} type="number" min={0} step="10" inputMode="numeric" value={budget}
                  onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 2000" />
              </label>
              <button onClick={goToAdjust} disabled={!budget || budgetNum <= 0} className={`${btn} bg-emerald-700 text-white disabled:opacity-50`}>
                {t(lang, "next")} →
              </button>
              <button onClick={() => setStep("bill")} className="w-full py-2 text-center text-[15px] font-bold text-emerald-700">
                {t(lang, "back")}
              </button>
            </div>
          )}

          {step === "adjust" && (
            <div className="mt-4 space-y-3">
              {!adjustChoice && (
                <>
                  <button onClick={() => { setAdjustChoice("fewer"); applyFewerDays(); }} className={`${btn} bg-emerald-700 text-white`}>
                    {t(lang, "fewerDays")}
                  </button>
                  <button onClick={() => {
                    setAdjustChoice("remove");
                    setKept(Object.fromEntries(billItems.map((_, i) => [String(i), true])));
                  }} className={`${btn} bg-neutral-900 text-white`}>
                    {t(lang, "removeSome")}
                  </button>
                </>
              )}
              {adjustChoice === "remove" && keptBill && (
                <>
                  <p className="rounded-2xl bg-white p-3 text-[15px] font-semibold shadow-sm">
                    {t(lang, "total")}: Rs {keptBill.total} — Budget: Rs {budgetNum}
                    {keptBill.total > budgetNum && <span className="text-red-700"> (Rs {keptBill.total - budgetNum} over)</span>}
                  </p>
                  {billItems.map((it, i) => (
                    <label key={i} className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                      <input
                        type="checkbox"
                        checked={kept[String(i)] !== false}
                        onChange={(e) => setKept((k) => ({ ...k, [String(i)]: e.target.checked }))}
                        className="h-6 w-6 shrink-0 accent-emerald-700"
                      />
                      <span className="min-w-0 flex-1 break-words text-[16px] font-bold">{it.name} — {it.dose} × {it.days} {t(lang, "days")}</span>
                      <span className="shrink-0 text-[15px] font-bold">Rs {bill.lines[i]?.lineTotal ?? 0}</span>
                    </label>
                  ))}
                  <button onClick={applyRemove} className={`${btn} bg-emerald-700 text-white`}>
                    {t(lang, "showBill")} — Rs {keptBill.total} →
                  </button>
                </>
              )}
              <button onClick={() => { setAdjustChoice(null); setStep("budget"); }} className="w-full py-2 text-center text-[15px] font-bold text-emerald-700">
                {t(lang, "back")}
              </button>
            </div>
          )}
        </section>
      )}

      {step === "final" && lang && finalBill && (
        <section className="mt-6">
          <div className="rounded-2xl bg-emerald-700 p-5 text-white">
            <p className="text-[19px] font-bold leading-relaxed">{t(lang, "showToPharmacy")}</p>
            <p className="mt-2 text-[15px] opacity-90">
              {lang === "ur" ? "Ab ye bill pharmacy waly ko dikha dein ya usay bata dein ke ye chahiye" : "اب یہ بل فارمیسی والے کو دکھا دیں یا اسے بتا دیں کہ یہ چاہیے"}
            </p>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
            {finalBill.lines.map((line, i) => (
              <div key={i} className="flex items-start justify-between gap-2 border-b border-neutral-100 p-3 last:border-0">
                <p className="min-w-0 break-words text-[16px] font-bold">{line.billedName} <span className="text-[14px] font-normal text-neutral-500">× {line.packsNeeded} {t(lang, "packs")}</span></p>
                <p className="shrink-0 text-[16px] font-bold">{line.priceNotSet ? t(lang, "priceNotSet") : `Rs ${line.lineTotal}`}</p>
              </div>
            ))}
            <div className="flex items-center justify-between bg-neutral-50 p-4">
              <p className="text-[18px] font-extrabold">{t(lang, "total")}</p>
              <p className="text-[22px] font-extrabold">Rs {finalBill.total}</p>
            </div>
          </div>

          {changeNote && (
            <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-[16px] font-semibold text-amber-900">
              {t(lang, "whatChanged")}: {changeNote}
            </p>
          )}
          <p className="mt-2 text-[14px] text-neutral-600">{t(lang, "estimateNote")}</p>

          <button onClick={startAgain} className={`${btn} mt-4 bg-neutral-900 text-white`}>
            {t(lang, "startAgain")}
          </button>
        </section>
      )}
    </main>
  );
}
