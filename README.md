# FamilyTree

An interactive family tree in English and Marathi, published on GitHub Pages at https://p23ghodake.github.io/FamilyTree/. Anyone can browse; approved family editors sign in to add and update members, and changes are saved back to this repository.

## Features

- **Header:** switch between **Tree**, **Trace** (find how two people are related), **Timeline** and **Statistics**. Editors also get **Add member**, **Undo** and **Redo**. Language, theme, avatar style, the guided tour and admin tools are in the settings menu. On phones these move into a ☰ menu that opens from the bottom.
- **Search and filters:** the round search button (or the `/` key) opens a compact search bar. Its filter button offers **Living only**, **Hide females**, **Marriage eligible** and a location filter. **Hide females is on by default**; **Clear** turns every filter off.
- **Member details:** clicking a person opens a small panel with dates, age, occupation, location, notes, and links to parents, spouses and children.
- **Add and edit members:** a step-by-step form: **Relationship** (child, spouse, parent or not linked, with a searchable list of people), then **Who** (photo, names, gender), then **Dates & details** (all optional). The Marathi name is filled in automatically and can be edited. When adding a child or spouse from a person's menu, the relationship step is skipped. When editing, any step can be opened and saved directly. Uploaded photos are resized to 400 px JPEGs.
- **Sign in:** choose **Continue with GitHub** or **Continue with email**. Errors are shown inside the form, with a Caps Lock warning on the password field.
- **Sharing:** share links open a read-only snapshot of the tree (see below).
- **Accessibility:** dialogs trap keyboard focus, close with Escape and return focus to where you were. All text is available in English and Marathi.

## Roles and permissions

| Who | Browse | Add / edit members | Delete members | Reset shared data | Export JSON / PNG, Print |
|---|---|---|---|---|---|
| Guest (not signed in) | Bundled copy | – | – | – | – |
| Read-only user (`READONLY_GITHUB_USERS`) | Live data | – | – | – | – |
| Editor (`ALLOWED_GITHUB_USERS`) | Live data | ✓ | – | – | – |
| Admin signed in with email/password | Live data | ✓ | – | – | ✓ |
| Admin signed in **with GitHub** | Live data | ✓ | ✓ | ✓ | ✓ |

Admins are the GitHub account `p23ghodake` and the GitHub account whose verified email is `ghodake.pankaj@gmail.com`. They must also be listed in `ALLOWED_GITHUB_USERS` to save anything. **Deleting members and Reset require a session signed in through GitHub**; an email/password session is refused even for the admin email. The Edge Function enforces this as well: it compares each save with the current file on GitHub and rejects saves that remove members unless the session signed in with GitHub on an admin account. Undoing your own *add* counts as a removal, so it is also limited to that admin.

The frontend admin list is in `src/lib/admin.ts`. On the server, set the optional `ADMIN_USERS` Edge Function secret (comma-separated GitHub usernames or GitHub emails) to override the built-in list; keep both in sync.

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

Set the `ALLOWED_GITHUB_USERS` Edge Function secret to a comma-separated list of GitHub usernames allowed to read/write data (for example `npx supabase secrets set ALLOWED_GITHUB_USERS=user1,user2`); other signed-in users get a 403. Entries may be GitHub usernames or emails (for email/password users created in Supabase Authentication → Users). Optionally set `READONLY_GITHUB_USERS` for users who can load data but not save changes.

Authorization uses the verified GitHub provider identity or a confirmed email, not editable user metadata. The sign-in method used for delete and reset permissions is read from the validated access token. Redeploy the `family-data` Edge Function after updating its authorization code:

```sh
npx supabase functions deploy family-data --project-ref <project-ref>
```

Set or update the `GITHUB_TOKEN` Edge Function secret in the Supabase Dashboard, or use the ignored `supabase/.env` method above. The function keeps JWT verification enabled; it also validates each access token with Supabase Auth. Its Contents API target is `src/data/g_familyData.json` in `p23ghodake/FamilyTree`.

### Shared snapshots and reset

Shared links open read-only snapshots without importing or saving them to GitHub. Keep the link's `tree` query parameter to reopen the same snapshot after a reload. Legacy links containing processed tree data are also supported.

The Reset control is shown only to the admin signed in with GitHub who has edit access. After explicit confirmation, it replaces **all shared family trees on GitHub** with the original bundled dataset, affecting every user. It is not a browser-only reset. Data-changing controls remain locked until the current save finishes.

### GitHub Pages deployment

Set the two Actions **variables** described above, then push to `main` or run the Pages workflow. For local development, copy `.env.example` to `.env`, fill in the public Supabase URL and key, and run:

```sh
npm install
npm start
```

The `build/` folder is local build output; the Pages workflow builds the site itself on every push to `main`.

## Tests

```sh
npm test
```

On Windows, if npm passes flags incorrectly, run the tools directly:

```sh
node node_modules/typescript/bin/tsc --noEmit
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --ci --runInBand
```

Main test files: `src/components/functional.test.tsx`, `src/components/ux.test.tsx`, `src/context/FamilyTreeContext.test.tsx`, `src/lib/admin.test.ts` and the `src/processing/*.test.ts` files.
