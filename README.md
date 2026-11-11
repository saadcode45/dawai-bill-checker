# Dawai Bill Checker — دوائی بل چیکر

Mobile-first website for Pakistani hospital pharmacies. The pharmacy gets its
own QR code; the patient scans it, uploads the doctor's slip photo or types
medicine names, and sees the bill **before** buying — then adjusts it to their
budget. No login for patients, no app install. Urdu script + Roman Urdu.

**Top priority: mobile.** Designed for a 360–390px Android phone first:
full-width buttons (min 48–56px), one field per row, large readable text,
no sideways scroll, no floating nav that can clip.

## How it works

1. **Owner** (`/owner`): registers/logs in with email + password, creates
   their pharmacy, adds medicines one by one on their phone — name, type
   (Tab/Cap/Syrup/Inj/Sachet/Cream/Drops), full pack price (Rs), quantity
   inside the pack (10 tabs, 1 inj, 10 sachets), optional similar medicine.
   The page shows a big QR code to print and paste at the counter.
2. **Patient** (`/p/<slug>`): picks اردو or Roman Urdu, then either uploads
   the slip photo or types names. Photo mode: Gemini reads ONLY the middle
   medicine box + days on the right edge, ignores BP/pulse/disease on the
   left, then the patient **must confirm/edit the list** before any total
   is shown. Typing mode suggests names from that pharmacy's own list.
3. **Bill**: tablets = dose per day × days, rounded UP to full packs
   (1+1 for 7 days = 14 tabs, pack of 10 = 2 packs). Syrups/creams/drops =
   1 full bottle (another per extra week). Injections = from the Urdu
   frequency under them (1/week, 1 in 10 days). Prices come only from the
   pharmacy's list — **no prices are invented anywhere**. The 6 sample
   medicines (Remethan, Myolax, Lacolep, Eskem, Caldree, Inj Sunvit) are
   seeded with price 0 and marked "Set price" until the owner sets them.
4. **Budget**: after the full bill, the patient is asked in Urdu how much
   they want to spend, then chooses "کم دن کی کر دوں" (fewer days) or
   "کچھ دوائی نکال دوں" (remove some medicines). The final screen shows
   what changed and tells them to show the bill to the pharmacy.
5. **Similar medicine**: if the exact medicine is not in the list, the
   owner-set similar one is billed as a normal line — no explanation is
   shown to the patient. The mapping is set by the owner, never guessed
   by the AI.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your keys — never commit .env.local
npm run dev                  # http://localhost:3000
```

## Supabase setup (run once)

1. In Supabase Dashboard > SQL Editor, run `supabase/schema.sql`
   (tables `dawai_pharmacies` + `dawai_medicines`, `dawai_` prefix — Memora
   tables are untouched). It is safe to run more than once.
2. **Authentication > Sign In / Providers > Email > "Confirm email" = OFF.**
   With confirmation OFF, owner sign-up returns a session immediately and
   is never blocked by email rate limits. This is the same fix Memora needed.

## Deploy to Vercel (manual — see note in the parent report)

1. Push this folder to GitHub as `dawai-bill-checker` (owner `saadcode45`).
2. Vercel Dashboard > Add New > Project > Import that repo.
3. Set Environment Variables (Production + Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (server only), `GEMINI_API_KEY` (server only).
4. Deploy. The patient page is `/p/<slug>`, the owner panel is `/owner`.

## Test the calculation (no server needed)

```bash
node --experimental-strip-types scripts/test-calc.ts 2>/dev/null || npx tsx scripts/test-calc.ts
```

Sample slip check: Remethan 1+1 × 7 days, pack of 10 → 14 tabs → 2 packs.
Injection: 7 days at 1/week → 1 inj; 20 days at 1 in 10 days → 2 inj.
Days parsing: `1 ہفتہ` → 7, `پانچ دن` → 5, `1 hafta` → 7, `1 ماہ` → 30.

## Files

- `src/lib/calc.ts` — locked calculation + Urdu days parsing + fuzzy match (pure, tested)
- `src/lib/i18n.ts` — every patient string in Urdu script + Roman Urdu
- `src/lib/gemini.ts` — Gemini fallback 3.8 → 3.6 → 3.5 Flash-Lite + slip prompt
- `src/lib/supabase.ts` — browser + server Supabase clients
- `src/app/page.tsx` — home; `src/app/owner/page.tsx` — owner panel + QR
- `src/app/p/[slug]/page.tsx` — the whole patient flow (lang → photo/type → confirm → bill → budget → final)
- `src/app/api/pharmacy/route.ts` — public pharmacy + price list
- `src/app/api/read-slip/route.ts` — Gemini slip reading (server only)
- `src/app/api/calculate/route.ts` — server-side bill calculation
- `supabase/schema.sql` — tables + RLS (public read, owner-only write)

## Limits / what is NOT built yet

- No paid subscriptions — pilot is 1 pharmacy (the user's own); multi-pharmacy
  tables are ready, billing is not built.
- No Android Play Store app — the website opens from the QR and works like
  an app on any phone.
- Photo reading needs `GEMINI_API_KEY`; without it, typing mode still works.
- Prices are estimates: "This is an estimate. Final bill is at the counter."
