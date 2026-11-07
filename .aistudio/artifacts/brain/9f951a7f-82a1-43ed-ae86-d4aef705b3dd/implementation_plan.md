# Cloudflare Pages & GitHub Deployment Fix Plan

Make **CAxis** deploy reliably to Cloudflare Pages every time you export from AI Studio to GitHub, and ensure live updates appear immediately without stale PWA caching.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Why Cloudflare didn't start a deployment when you clicked "Export to GitHub":**
> 1. **Branch / Repository Mismatch (Most Common)**: When you use AI Studio's **Export to GitHub** button more than once, AI Studio often exports to a **newly created repository** (e.g., `caxis-1`) or a **separate branch** instead of pushing directly onto the `main` branch of the repository connected to Cloudflare Pages.
> 2. **GitHub App Webhook Permission**: If you created a new repo during export, the Cloudflare Pages GitHub App only has webhook permissions for the original repo unless "All repositories" is enabled in GitHub → Settings → Applications → Cloudflare Pages.
> 3. **Hidden Build Blocker on Public NPM**: Even after Cloudflare detects the push, `package.json` currently lists internal sandbox version ranges (such as `vite@^8.3.0`, `typescript@^7.0.2`, `vite-plugin-pwa@^2.0.0`) that do not exist on the public npm registry (`registry.npmjs.org`) used by Cloudflare's build servers.

- **Confirmed Diagnosis**: No deployment started in the Cloudflare dashboard after using the AI Studio "Export to GitHub" button.
- **Planned Codebase + Configuration Fixes**:
  1. Normalize dependency ranges in the project configuration to standard public npm registry versions so Cloudflare Pages builds never fail with `ETARGET` version errors.
  2. Add Cloudflare Pages `_headers` and `_redirects` rules so `index.html` and `sw.js` are never stuck in edge/browser cache (`Cache-Control: no-cache`), while hashed assets cache for 1 year.
  3. Enable `skipWaiting`, `clientsClaim`, and `cleanupOutdatedCaches` in the PWA service worker configuration so every new Cloudflare deployment takes effect immediately for returning users.

---

## 1. Overview & How to Trigger Your Cloudflare Deployment Right Now

Before or after applying the codebase fixes below, verify these 3 quick checks in your GitHub and Cloudflare dashboards:

1. **Check Where AI Studio Exported Your Code on GitHub**:
   - Open your GitHub profile (`github.com/<your-username>?tab=repositories`).
   - Check if AI Studio created a **second repository** with a similar name, or open your main repository and click the **Branches** dropdown (top-left above the file list) to see if AI Studio pushed to a new branch instead of `main`.
   - If it landed on a different branch, merge that branch into `main` via a Pull Request on GitHub—this immediately triggers Cloudflare Pages.
2. **Check Cloudflare's Production Branch & Webhook**:
   - In **Cloudflare Dashboard → Workers & Pages → [Your CAxis Project] → Settings → Builds & deployments**, confirm **Production branch** matches the branch you are pushing to (`main` or `master`).
   - If the latest commit is already on `main` in the connected repository and Cloudflare still hasn't started a build, go to **Deployments → Create deployment** (or **Retry deployment**) to trigger it manually, and verify **GitHub → Settings → Applications → Cloudflare Pages** has access to that repository.

---

## 2. User Experience & Visual Design

- **Zero Visual Regressions**: All current UI styling—including the permanent Dark Mode theme, the `Syne` `CAxis` logo with subtle white glow, `Montserrat` bold header navigation tabs, the animated coordinate background, and the 4-column editorial footer with the giant cropped `CAXIS` watermark—remains 100% intact.
- **Instant Live Updates on Redeploy**: With `skipWaiting` and `clientsClaim` active alongside Cloudflare `no-cache` headers for `sw.js` and `index.html`, refreshing the live Cloudflare URL immediately displays the newest deployment without requiring users to clear site data.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Public NPM Registry Compatibility**
  - *Chosen Approach*: Pin standard, publicly published semver ranges (`vite@^6.2.0`, `typescript@~5.8.2`, `vite-plugin-pwa@^0.21.1`, `@tailwindcss/vite@^4.1.14`, `@vitejs/plugin-react@^4.3.4`, `katex@^0.16.21`, `@supabase/supabase-js@^2.49.1`).
  - *Why*: Cloudflare Pages installs packages from `registry.npmjs.org` using Node/npm or Bun. Standardizing these versions prevents Cloudflare builds from failing during `npm install`.
- **Decision 2: Cloudflare Edge Cache & SPA Routing Configuration**
  - *Chosen Approach*: Include `_redirects` (`/* /index.html 200`) and `_headers` (`Cache-Control: public, max-age=0, must-revalidate` on `/index.html`, `/sw.js`, and `/manifest.webmanifest`).
  - *Why*: Cloudflare CDN aggressively caches static files by default. Explicit `_headers` ensure browsers always check for a new service worker and HTML entrypoint on every deployment.

---

## 4. Technical Architecture & Deployment Flow *(Technical Reference)*

```
┌──────────────────────────┐
│  AI Studio Export        │
│  (Push to GitHub `main`) │
└────────────┬─────────────┘
             │ GitHub Webhook
             ▼
┌──────────────────────────────────────────────────────────┐
│  Cloudflare Pages Build Environment                      │
│  • Build command: npm run build                          │
│  • Build output directory: dist                          │
│  • Uses standardized public npm versions                 │
└────────────┬─────────────────────────────────────────────┘
             │ Deploys static bundle + Cloudflare rules
             ▼
┌──────────────────────────────────────────────────────────┐
│  Cloudflare Edge CDN (`dist/`)                           │
│  ├─ /index.html & /sw.js  (max-age=0, must-revalidate)   │
│  ├─ /assets/*             (max-age=31536000, immutable)  │
│  └─ /_redirects           (SPA fallback to /index.html)  │
└────────────┬─────────────────────────────────────────────┘
             │ Browser loads app
             ▼
┌──────────────────────────────────────────────────────────┐
│  Workbox Service Worker (`skipWaiting` + `clientsClaim`) │
│  • Purges outdated precaches automatically               │
│  • Activates new UI immediately on reload                │
└──────────────────────────────────────────────────────────┘
```
