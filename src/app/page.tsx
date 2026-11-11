import Link from "next/link";

// Home page: what the system is, in both languages, and the two doors in:
// pharmacy owner -> /owner, patient -> scan a QR (/p/<slug>).
// Mobile-first: one column, full-width buttons, 360px safe.

const btn =
  "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-[17px] font-bold";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10 pt-6">
      <header className="text-center">
        <p className="text-sm font-bold tracking-wide text-emerald-700">💊 DAWAI BILL CHECKER</p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-tight text-neutral-900">
          دوائی بل چیکر
        </h1>
        <p className="mt-1 text-[17px] font-semibold text-neutral-700">
          Dawai lene se pehle bill maloom karein
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
          Scan the pharmacy QR, upload your doctor&apos;s slip or type the medicine names,
          and see your bill before you buy. Apne budget ke hisab se bill bhi adjust karein.
        </p>
      </header>

      <section className="mt-6 space-y-3">
        <Link href="/owner" className={`${btn} bg-emerald-700 text-white shadow`}>
          🏪 Pharmacy Owner — Login / Register
        </Link>
        <Link href="/p/my-pharmacy" className={`${btn} bg-neutral-900 text-white shadow`}>
          🧾 Patient — Check My Bill (Demo Pharmacy)
        </Link>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-[17px] font-bold">Kaise kaam karta hai? / How it works</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-neutral-700">
          <li>Pharmacy owner adds medicines with price — full pack price.</li>
          <li>Patient scans the pharmacy QR code at the counter.</li>
          <li>Upload the doctor&apos;s slip photo, or type medicine names.</li>
          <li>Bill dikhta hai — packs needed, price, total. Ye aik andaza hai, asal bill counter par hoga.</li>
          <li>Budget batayein — kam din ki dawai ya kuch dawai nikal dein, patient khud choose kare.</li>
          <li>Final bill pharmacy waly ko dikha dein.</li>
        </ol>
      </section>

      <section className="mt-4 rounded-2xl bg-emerald-50 p-4">
        <h2 className="text-[16px] font-bold text-emerald-900">Patient ke liye — For patients</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-emerald-900">
          No login, no app install. Sirf QR scan karein. Urdu ya Roman Urdu — jo aasan lage, woh select karein.
        </p>
      </section>

      <p className="mt-6 text-center text-[13px] text-neutral-500">
        Dawai Bill Checker — pilot for one pharmacy, then paid pharmacies.
      </p>
    </main>
  );
}
