# Team Manual App

A lightweight iOS-style team manual app with:

- Sign-in by email magic link
- Shared team profiles stored in Supabase
- Profile images stored in Supabase Storage
- Landing cards showing name, image and location only
- Full profile view on click
- Owner-only edit/delete permissions enforced by Supabase Row Level Security
- Ready to deploy on Vercel or Netlify and embed via iframe

## Setup

1. Create a free Supabase project.
2. Go to Supabase > SQL Editor and run `supabase-schema.sql`.
3. In Supabase > Project Settings > API, copy:
   - Project URL
   - anon public key
4. Copy `.env.example` to `.env` and add those values:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Install and run locally:

```bash
npm install
npm run dev
```

## Deploy

Deploy to Vercel or Netlify and add the same environment variables there.

## iframe example

```html
<iframe
  src="https://your-team-manual-app.vercel.app"
  width="100%"
  height="900"
  frameborder="0">
</iframe>
```

## Important

The UI hides edit/delete buttons for non-owners, but the real protection is in `supabase-schema.sql` via Row Level Security.
