# FamilyTree

## GitHub-backed family data

Family data remains in `src/data/g_familyData.json` in this repository. The React app authenticates with Supabase GitHub OAuth and calls the `family-data` Edge Function; that function verifies the Supabase user and uses a fine-grained GitHub token to read or update the file through the GitHub Contents API. No family-data database/table is used.

### Supabase and GitHub setup

1. Create a Supabase project. In **Authentication → Providers → GitHub**, enable GitHub and enter a GitHub OAuth App client ID and client secret. In the OAuth App, set its callback URL to `https://<project-ref>.supabase.co/auth/v1/callback`.
2. In Supabase **Authentication → URL Configuration**, allow the production redirect `https://p23ghodake.github.io/FamilyTree/` and local redirect `http://localhost:3000/`.
3. Create a GitHub fine-grained personal access token restricted to `p23ghodake/FamilyTree`, with **Contents: Read and write** only. Do not put it in React `.env` files or GitHub Pages variables.
4. Add the token as the Edge Function secret named `GITHUB_TOKEN` in Supabase **Project Settings → Edge Functions → Secrets**, or create an untracked `supabase/.env` containing `GITHUB_TOKEN=<token>` and run `supabase secrets set --env-file supabase/.env`. This file is ignored by Git and is not a React environment file. Supabase supplies `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the function.
5. Copy the Supabase project URL and browser-safe anon/publishable key into a local `.env` file using `.env.example` as a template. These two `REACT_APP_` values are public browser configuration, not secrets.
6. In the GitHub repository's **Settings → Secrets and variables → Actions → Variables**, define `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` with those same public values. The Pages workflow injects them at build time.

No Supabase database, table, service-role key, or GitHub token is needed by the frontend.

### Deploy the Edge Function

Install the Supabase CLI, then authenticate, link the project, and deploy:

```sh
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase functions deploy family-data
```

Set or update the `GITHUB_TOKEN` Edge Function secret in the Supabase Dashboard, or use the ignored `supabase/.env` method above. The function keeps JWT verification enabled; it also validates each access token with Supabase Auth. Its Contents API target is `src/data/g_familyData.json` in `p23ghodake/FamilyTree`.

### GitHub Pages deployment

Set the two Actions **variables** described above, then push to `main` or run the Pages workflow. For local development, copy `.env.example` to `.env`, fill in the public Supabase URL and key, and run:

```sh
npm install
npm start
```