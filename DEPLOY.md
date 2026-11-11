# Deploy — manual steps (auto-deploy is blocked)

Auto-deploy via the Vercel connector is blocked by the same 403 Memora hit:
`403: Not authorized: Trying to access resource under scope "saad-c6c5"`.
The Vercel team `saad-c6c5` needs re-authorisation (the connector asks the
user to approve team access) before any connector deploy works. Do NOT keep
retrying the connector — do the manual route below instead. It is the same
route the user used for Memora.

## 1. GitHub — create the repo and push

On github.com (user `saadcode45`), create an empty repo named
`dawai-bill-checker` (public or private, no README). Then, from this folder:

```bash
cd ~/workspace/dawai-bill-checker
git remote add origin https://github.com/saadcode45/dawai-bill-checker.git
git branch -M main
git push -u origin main
```

The repo is already committed locally (`git log` shows the commit, 31 files,
working tree clean). `.env.local` is git-ignored — no secrets are in the commit.

## 2. Supabase — run the schema (once)

Supabase Dashboard > SQL Editor, project `dzqmpwjarunwjskmjzcm`
(the same project Memora uses) > run the whole file `supabase/schema.sql`.
It creates `dawai_pharmacies` + `dawai_medicines` (RLS: public read,
owner-only write). Safe to run more than once.

Then: **Authentication > Sign In / Providers > Email > "Confirm email" = OFF.**
Without this, owner sign-up will not return a session (email rate limits).

## 3. Vercel — import and deploy

1. Vercel Dashboard > Add New > Project > Import `saadcode45/dawai-bill-checker`.
2. Framework: Next.js (auto-detected). No build settings to change.
3. Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://dzqmpwjarunwjskmjzcm.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (from Supabase > Settings > API)
   - `SUPABASE_SERVICE_ROLE_KEY` = (server only, same place)
   - `GEMINI_API_KEY` = (the Gemini key already used for Memora — server only)
4. Deploy. Live URL will be like `https://dawai-bill-checker.vercel.app`.

## 4. First-run check (pilot pharmacy)

1. Open the live URL > Owner > Register with the owner's email + password.
2. Create the pharmacy (slug `my-pharmacy` for the pilot).
3. Click "Add the 6 sample medicines" — they arrive with price 0 ("Set price").
4. Set the real price for each medicine (full pack price).
5. Download the QR, print it, paste it at the counter.
6. On a phone, scan the QR (or open `/p/my-pharmacy`), pick a language,
   tap "Try sample slip" — confirm the list, see the bill, try a budget.
7. Photo upload needs `GEMINI_API_KEY` set in Vercel; without it, patients
   use typing mode and the photo button shows a clear message.
