# Frontend on GitHub Pages (free)

Site: **https://impactx26.github.io/noobsabhaeducaro/** (owner `ImpactX26`, repository `noobsabhaeducaro`, taken from the git remote).
Only the React frontend is published, by `.github/workflows/pages.yml`, on every push to `integration/frontend-backend`.
The NestJS backend is not deployed by this.

## One-time GitHub settings (required, otherwise the workflow fails)

1. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Repository **Settings → Environments → `github-pages` → Deployment branches and tags**: allow
   `integration/frontend-backend` (by default only the default branch may deploy, and the deploy job would be rejected).
3. Pages for a *private* repository needs a paid GitHub plan; a public repository is free.
4. Optional: **Settings → Secrets and variables → Actions → Variables** → add `VITE_API_BASE_URL` (a public backend URL, no
   trailing slash). Never store an API key there: it ends up in the public JavaScript.

Then push, or run **Actions → Deploy frontend to GitHub Pages → Run workflow**. The first run prints the site URL.

## What the build does

- `VITE_BASE_PATH=/noobsabhaeducaro/` makes every asset URL start with the repository subpath. Without it (local dev, Vercel) the base stays `/`.
- The app has no URL routes (screens are in-memory), so a refresh cannot 404. Images in `public/` are referenced through `asset()` so they follow the base path.
- `VITE_DEMO_MODE=true` makes the site open in **DEMO MODE**.

## DEMO MODE (for presenting without a backend)

A banner on every screen says: *simulated results from fictional sample data, not live Gemini processing, not a real account.*

| What you see | What it really is |
|---|---|
| Sign-in | Any details open one fixed, fictional session. No account exists, nothing is sent anywhere. |
| Uploaded documents | Only the **file name** is used. Files are not read, uploaded or stored. |
| Extracted facts, score, requirements | Fixed fictional sample facts chosen by document type, scored by fixed rules. |
| Conflict | CV says graduation 2024, degree certificate says 2025: the agent asks which is correct; answering re-evaluates. |
| Document-type check | A file name that looks like a passport / ID / invoice / receipt is rejected as a mismatch (simulation). |
| Agent | A few fixed rules (conflict, then missing document, then next step). Never Gemini. |

**Real authentication is not weakened.** Demo mode only swaps the API client inside the browser. Choosing **Use live backend**
(banner or login screen) switches back to `VITE_API_BASE_URL`, where the real backend still checks every sign-in and ownership;
the demo session token is discarded on every switch. Demo code contains no keys and never contacts a server.

Local use: `VITE_DEMO_MODE=true npm run dev` starts in demo mode; with nothing set the app is unchanged and uses the live backend.
The choice can also be toggled in the UI (remembered for the browser tab).

## Environment variables (frontend, all public)

| Variable | Used for |
|---|---|
| `VITE_BASE_PATH` | Base path of the site (`/noobsabhaeducaro/` on Pages; unset elsewhere) |
| `VITE_DEMO_MODE` | `true` = open in demo mode |
| `VITE_API_BASE_URL` | Public URL of the live backend (default `http://localhost:3001`) |

`GEMINI_API_KEY` and every other secret stay on the backend host only. Never add them to the frontend or to Pages.
