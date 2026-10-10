# CivicLens — See the Issue. Spark Action.

CivicLens is an AI-assisted civic-reporting prototype that helps people turn a photo of a public problem into a structured report. It combines image-based issue analysis, location confirmation, complaint tracking, an authority-oriented incident dashboard, resolution verification, and a clearly labelled demonstration rewards experience.

> **Project stage: prototype / demonstration.** CivicLens is not an official municipal submission channel, and this repository does not establish an operational integration with any government authority. Sample reward offers and `DEMO-...` coupon codes are fictional and have no merchant value.

**Live demo:** [civiclens-project.vercel.app](https://civiclens-project.vercel.app)
**Repository:** [github.com/aayushmalve/civiclens](https://github.com/aayushmalve/civiclens)

---

## Contents

- [Why CivicLens](#why-civiclens)
- [Features](#features)
- [How the workflow works](#how-the-workflow-works)
- [Technology stack](#technology-stack)
- [Routes and application structure](#routes-and-application-structure)
- [API reference](#api-reference)
- [Demo rewards: rules and limitations](#demo-rewards-rules-and-limitations)
- [Getting started locally](#getting-started-locally)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Development and build commands](#development-and-build-commands)
- [Deploying with GitHub and Vercel](#deploying-with-github-and-vercel)
- [Testing and release checklist](#testing-and-release-checklist)
- [Troubleshooting](#troubleshooting)
- [Security, privacy, and responsible use](#security-privacy-and-responsible-use)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Why CivicLens

Residents regularly encounter potholes, waste accumulation, damaged public infrastructure, overflowing drains, broken streetlights, and other local issues. Turning those observations into useful reports can take time: people need to describe the problem, identify the location, and communicate enough evidence for someone else to act on it.

CivicLens explores a simpler flow:

**Photo → AI-assisted analysis → confirmed location → structured complaint → tracking and review.**

A prototype rewards wallet demonstrates how verified civic participation could be encouraged with practical everyday benefits. The reward experience is simulated for demonstrations; it does not promise real discounts or imply a participating merchant or government endorsement.

## Features

### 1. Photo-based civic issue analysis

- Accepts image uploads through the report page.
- Sends the image and an evidence-focused prompt to the Google GenAI API using the configured Gemma model.
- Produces a structured result including issue category, title, severity, confidence, description, visible evidence, potential risk, recommended action, and a complaint draft.
- The analysis prompt instructs the model to stay grounded in visible evidence and not invent hidden causes, exact measurements, ownership, injuries, or legal conclusions.
- Handles image formats based on browser MIME information and a list of common image extensions. Provider support for an individual format can still vary.

AI output is a draft to help a human report an issue; it is not an official inspection or a determination by a government authority.

### 2. Location detection and confirmation

- Attempts to extract GPS coordinates from image EXIF metadata with `exifr`.
- Supports browser/device geolocation where the user grants permission.
- Provides a location search endpoint backed by Photon for address and landmark lookup.
- Lets the user review or correct the location before submission.
- Displays mapped incidents using Leaflet and OpenStreetMap tiles.

EXIF coordinates may be absent or stale, and browser geolocation can be approximate. Users should confirm the location before submitting a report.

### 3. Complaint submission and tracking

- Converts the analysis into a structured complaint.
- Assigns a complaint ID and records category, title, description, report draft, severity, confidence, evidence, risk, recommended action, department, status, timestamps, and location.
- Provides a tracking page to find a complaint by its ID.
- Uses the following workflow statuses in the prototype: `Submitted`, `Assigned`, `In Progress`, and `Resolved`.

These statuses describe records inside this prototype. They do not mean a complaint was officially received by a municipality or that public work has been scheduled.

### 4. Authority-oriented dashboard

- Shows report and open-case summary metrics.
- Highlights high-severity cases.
- Plots incidents with available coordinates on an interactive map.
- Allows the dashboard operator to inspect a report and update its prototype status.

The dashboard is a demonstration interface. It is not authenticated as an official authority console in this version.

### 5. Resolution verification

- Provides a before/after image workflow for a reported issue.
- Uses the configured Google GenAI API to compare the supplied images and generate a structured assessment.
- Captures a verdict (`RESOLVED`, `PARTIALLY RESOLVED`, or `NOT RESOLVED`), confidence, comparison summary, evidence, remaining issue, and recommendation.
- Records the verification result on the complaint.

AI comparison can be mistaken and should not be treated as a binding inspection or proof of government action.

### 6. Demonstration rewards wallet

The reward feature demonstrates the mechanics of a future civic-participation incentive programme:

- Anonymous demo wallet with a sample starter balance of **120 points**.
- Six illustrative offers across food and drink, shopping, everyday needs, and community recognition.
- Report submission creates a pending review item; uploading alone does not award points.
- A simulated quality-review action can award **25 demo points** to a complete, unique report once.
- Report submission proofs are short-lived and single-use, tying a newly created complaint to the wallet that initiated the flow.
- The server stores balances, claims, expiry/redemption state, and a reward ledger in PostgreSQL/Neon.
- Claiming an offer deducts points and creates a unique `DEMO-...` code with an expiry.
- Expired codes and repeat simulated redemption are blocked by server-side checks.
- Prototype duplicate detection uses a title/category fingerprint and is only a heuristic.
- Resetting a demo wallet returns its balance to the starter amount, voids its active coupons, and retains ledger history.

**All offers, codes, review outcomes, and redemption events are demonstrations.** No purchase occurs; no real merchant is obligated to honour the codes; and no physical gift is delivered.

## How the workflow works

```mermaid
flowchart TD
    A[Resident chooses an image] --> B[AI-assisted issue analysis]
    B --> C[Review and confirm location]
    C --> D[Create structured civic complaint]
    D --> E[Receive complaint ID]
    E --> F[Track status]
    D --> G[Link report to anonymous demo wallet]
    G --> H[Pending simulated quality review]
    H --> I{Passes prototype checks?}
    I -- No --> J[No points awarded]
    I -- Yes --> K[Award 25 demo points once]
    K --> L[Claim sample reward]
    L --> M[Unique demo coupon with expiry]
    M --> N[Simulated one-time redemption]
```

## Technology stack

| Area | Technology | Purpose |
|---|---|---|
| Web framework | Next.js App Router (`next` 16.3.8 in the project manifest) | Pages, layouts, and server API routes |
| UI | React 19, TypeScript | Interactive client components and typed application code |
| Styling | Tailwind CSS 4 plus shared CSS | Responsive layouts and shared visual system |
| AI | `@google/genai` | Image analysis and before/after resolution assessment |
| Image metadata | `exifr` | EXIF GPS extraction when present in an uploaded image |
| Database | Neon serverless PostgreSQL via `@neondatabase/serverless` | Complaint records and demo reward records |
| Maps | Leaflet, React Leaflet, OpenStreetMap tiles | Incident map and map controls |
| Hosting | Vercel (configured deployment) | Web deployment and serverless routes |
| Source control | Git and GitHub | Version history and deployment trigger |

The exact dependency versions are defined in `package.json` and `package-lock.json`. Use the lockfile when installing dependencies.

## Routes and application structure

### Main pages

| Route | Purpose |
|---|---|
| `/` | Photo upload, AI analysis, location confirmation, complaint drafting and submission |
| `/track` | Look up a submitted complaint and inspect its status and details |
| `/dashboard` | Authority-oriented report summary, status controls, and incident map |
| `/verify` | Submit before/after images and review an AI-assisted resolution assessment |
| `/rewards` | Demo wallet, pending report review, sample catalogue, claims, codes and activity ledger |

### Important source paths

```text
src/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts            # AI image analysis + photo EXIF GPS
│   │   ├── complaints/route.ts         # List/create complaints + reward proof
│   │   ├── complaints/[id]/route.ts    # Complaint status update endpoint
│   │   ├── demo-rewards/route.ts       # Demo wallet, points, claims, redemption
│   │   ├── geocode/route.ts            # Photon location search
│   │   └── verify/route.ts             # Before/after resolution assessment
│   ├── dashboard/MapView.tsx           # Interactive incident map
│   ├── dashboard/page.tsx              # Authority dashboard
│   ├── rewards/page.tsx                # Demonstration rewards interface
│   ├── track/page.tsx                  # Complaint tracking
│   ├── verify/page.tsx                 # Resolution verification interface
│   ├── page.tsx                        # Main reporting experience
│   ├── layout.tsx                      # Root document and metadata
│   └── globals.css                     # Shared styles and page design system
├── components/
│   └── CivicLensHeader.tsx              # Shared logo lockup and route tabs
└── lib/
    ├── complaints.ts                    # Complaint database types and operations
    └── demo-rewards.ts                  # Reward catalogue and shared demo types

database/
└── demo_rewards.sql                     # PostgreSQL/Neon rewards schema
public/
└── brand/civiclens-logo.png             # CivicLens brand asset
```

`database/demo_rewards.sql` creates the reward-related tables. The complaint API expects the base `complaints` table to already exist in the configured database; this rewards migration is not a replacement for the complaint schema.

## API reference

All endpoints are part of this prototype and are served by the same Next.js application.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/analyze` | Accept an image in multipart form data and return a structured AI analysis; may include GPS extracted from image metadata |
| `GET` | `/api/geocode?q=<search>` | Search addresses or landmarks and return normalized location results |
| `GET` | `/api/complaints` | Return stored complaints |
| `POST` | `/api/complaints` | Validate required fields and create a complaint; the demo rewards flow can include a short-lived submission proof |
| `PATCH` | `/api/complaints/[id]` | Update an allowed complaint status |
| `POST` | `/api/verify` | Compare before/after images and save an AI-assisted verification result |
| `GET` | `/api/demo-rewards` | Load the current anonymous demo wallet, reward catalogue, reports, claims, and recent ledger entries |
| `POST` | `/api/demo-rewards` | Execute a demo action, including issuing/submitting report proofs, registering sample reports, running a simulated review, claiming an offer, redeeming a code, and resetting the demo wallet |

Request and response structures are defined in the corresponding `route.ts` files. Check those files before integrating another client; this prototype's API is not a versioned public API.

## Demo rewards: rules and limitations

### Data model

The reward migration defines these tables:

- `civiclens_demo_reward_accounts` — anonymous wallet ID and server-side balance.
- `civiclens_demo_reward_reports` — linked submitted/sample reports, quality-check results, duplicate fingerprint, status and awarded points.
- `civiclens_demo_reward_report_tokens` — hashed short-lived, single-use report-submission proofs.
- `civiclens_demo_reward_claims` — coupon-style codes, points cost, status and expiry/redemption timestamps.
- `civiclens_demo_reward_ledger` — idempotent event history for starter credit, submission/review, duplicate blocks, claims, redemptions, expirations and resets.

### What the backend protects

- The wallet ID is carried in a signed, HTTP-only cookie; the client does not authoritatively set the point balance.
- Short-lived report submission proofs are tied to the report ID and wallet and are consumed on successful complaint creation.
- Reward review and claim/redemption state is stored in PostgreSQL, not treated as trusted browser state.
- Idempotency keys and database constraints help prevent duplicate award/claim/redemption events.
- The server checks report completeness, basic location/evidence presence, duplicate fingerprints, coupon expiry, and prior redemption.

### What it does not protect

This is not production-grade identity or anti-fraud. The wallet is anonymous; clearing its cookie can create a fresh demo wallet. Title/category matching is a simple duplicate signal and can both miss real duplicates and flag legitimate similar reports. The quality-review action is simulated, not an approval by a human moderator or a government officer. Rate limiting, authenticated identities, robust cross-account abuse detection, appeals/moderation tools, audit retention policy, and monitoring would be needed before public deployment.

## Getting started locally

### Prerequisites

- Node.js compatible with the Next.js version used by this project.
- npm.
- A Google AI API key permitted to call the configured model.
- A Neon/PostgreSQL database containing the base `complaints` table and credentials with permission to use the rewards schema.

### 1. Clone the repository

```bash
git clone https://github.com/aayushmalve/civiclens.git
cd civiclens
```

If you are already working in `~/Desktop/civic-lens`, do not clone over that directory. Work in the existing repository instead.

### 2. Install dependencies

```bash
npm ci
```

Use `npm install` only if there is no valid lockfile or you intentionally need to refresh dependencies.

### 3. Configure local environment

Create `.env.local` in the project root. Do not commit this file.

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
GEMINI_API_KEY="your-google-ai-api-key"
DEMO_REWARD_SECRET="replace-with-a-long-random-secret"
```

`DEMO_REWARD_SECRET` is recommended for signing demo-wallet cookies. The rewards API also supports `AUTH_SECRET` as a fallback; if neither is configured, it may fall back to `DATABASE_URL`. Prefer a dedicated random secret in local and hosted environments. Generate one locally with:

```bash
openssl rand -hex 32
```

Never paste API keys or database URLs into GitHub issues, commits, screenshots, or public logs. The `.gitignore` excludes `.env*`; do not override that protection.

### 4. Prepare the database

Use the same `DATABASE_URL` as the complaint API. Apply `database/demo_rewards.sql` in the Neon SQL Editor, or let the rewards API create its tables on first use if the database role has DDL permissions.

The included migration covers the demo reward tables only. The application also relies on the existing base `complaints` schema used by `src/lib/complaints.ts`. Back up the database before running schema changes against any non-demo environment.

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required? | Used for |
|---|---|---|
| `DATABASE_URL` | Yes for database-backed complaints and rewards | Neon/Postgres connection string; also used as a fallback wallet-cookie signing secret |
| `GEMINI_API_KEY` | Required for AI analysis and image-based verification | Google GenAI API credential |
| `DEMO_REWARD_SECRET` | Strongly recommended | Dedicated secret to sign anonymous demo-wallet cookies |
| `AUTH_SECRET` | Optional fallback | Alternate signing secret if `DEMO_REWARD_SECRET` is not configured |

Set environment values both locally (`.env.local`) and in the Vercel Project Settings for the deployment environments where they are needed. Do not prefix secrets with `NEXT_PUBLIC_`.

## Development and build commands

```bash
# Run the dev server
npm run dev

# Run a production build (recommended before every push)
npm run build

# Start the production build locally
npm run start

# Run ESLint
npm run lint
```

Before pushing, check the working tree and whitespace:

```bash
git status --short
git diff --check
```

A successful production build is necessary, but not sufficient, to prove the database and browser workflows work. Complete the [testing checklist](#testing-and-release-checklist) as well.

## Deploying with GitHub and Vercel

### GitHub

The repository's canonical URL is `https://github.com/aayushmalve/civiclens.git`. To correct an older remote URL that redirects to this repository:

```bash
git remote set-url origin https://github.com/aayushmalve/civiclens.git
git remote -v
```

After editing files:

```bash
git status --short
npm run build

git add README.md \
  src/app/page.tsx \
  src/app/globals.css \
  src/app/layout.tsx \
  src/app/rewards/page.tsx \
  src/app/track/page.tsx \
  src/app/dashboard/page.tsx \
  src/app/dashboard/MapView.tsx \
  src/app/verify/page.tsx \
  src/app/api/complaints/route.ts \
  src/app/api/demo-rewards/route.ts \
  src/components/CivicLensHeader.tsx \
  src/lib/demo-rewards.ts \
  database/demo_rewards.sql \
  public/brand/civiclens-logo.png

git diff --cached --check
git diff --cached --stat
git commit -m "Document CivicLens and update prototype"
git push -u origin HEAD
```

The explicit file list is intentional: it avoids accidentally committing backup files, exported source dumps, local data, or `.env.local`. If some listed path has intentionally been moved or removed in your checkout, adjust the list after reviewing `git status --short`.

### Vercel

1. Import/connect the canonical GitHub repository `aayushmalve/civiclens` in Vercel.
2. Confirm the production branch matches the branch you push (currently `main`, unless changed in Vercel settings).
3. Add `DATABASE_URL`, `GEMINI_API_KEY`, and `DEMO_REWARD_SECRET` under **Project Settings → Environment Variables** for Production and any Preview/Development environments that need them.
4. Trigger a redeploy after changing environment variables.
5. In Deployments, verify the newest production deployment reaches **Ready** and inspect the build logs if it fails.
6. Test the stable production domain and the routes listed above. A generated deployment-specific URL may point at a Preview or an older deployment; verify the environment label before sharing it.

## Testing and release checklist

### Build and configuration

- [ ] `npm ci` completes without errors.
- [ ] `npm run build` passes on the exact commit intended for deployment.
- [ ] `DATABASE_URL` and `GEMINI_API_KEY` are set in the intended environment.
- [ ] The rewards API can create/read its tables or the SQL migration has been applied.
- [ ] No secrets, database exports, backup files, or temporary code dumps are staged for Git.

### Main reporting workflow

- [ ] Upload a supported image.
- [ ] Confirm the AI result is visibly grounded in the image and contains category, severity, evidence, risk and recommended action.
- [ ] Confirm the location from EXIF/device search and manually correct it if necessary.
- [ ] Submit the complaint and record the complaint ID.
- [ ] Open `/track` and retrieve the complaint by ID.
- [ ] Check that the dashboard displays its record and map pin when coordinates exist.

### Rewards demonstration

- [ ] `/rewards` loads without hydration warnings or browser console errors.
- [ ] The anonymous wallet starts with 120 demo points.
- [ ] A newly submitted report appears as pending review and does not earn points on upload alone.
- [ ] The simulated review awards 25 points once for a complete unique report.
- [ ] An incomplete or duplicate report does not earn points.
- [ ] Claiming an affordable reward deducts points and produces a unique `DEMO-...` code.
- [ ] An expired code cannot be redeemed.
- [ ] A code can be marked redeemed only once.
- [ ] Refreshing the page preserves server-backed wallet state for the same cookie.
- [ ] All sample rewards are visibly labelled as demo-only and are not presented as real merchant offers.

### Visual and deployed experience

- [ ] The shared header appears consistently on `/`, `/track`, `/dashboard`, `/verify`, and `/rewards`.
- [ ] Active navigation state matches the page.
- [ ] Large bold headings have readable character spacing and do not clip at common mobile widths.
- [ ] Maps load and remain usable on desktop and mobile.
- [ ] Vercel's newest production deployment is marked **Ready**.
- [ ] The stable production domain shows the same release as the latest production deployment.

## Troubleshooting

### `Module not found: Can't resolve '@/components/CivicLensHeader'`

Check that `src/components/CivicLensHeader.tsx` exists, is committed, and is pushed to the branch Vercel builds. Check `git status`, `git ls-files src/components/CivicLensHeader.tsx`, and Vercel's repository/branch settings.

### `Property 'active' does not exist on type 'IntrinsicAttributes'`

The shared header must define an `active` prop matching the values used by each page (for example, `report`, `track`, `authority`, `rewards`). Confirm the header component version matches the pages that import it, then run `npm run build` before pushing.

### Hydration mismatch on `/rewards`

Inspect the first client/server mismatch in the browser console. Avoid using different initial client and server values for `disabled`, balances, local dates, or random codes. The rewards page should render a deterministic initial shell and fetch the anonymous wallet after hydration. Clear `.next` only after stopping the dev server if stale development output is suspected.

### Reward API returns 500/503

Check the server-side Vercel log. Verify `DATABASE_URL` points to the correct database, the account has the necessary table permissions, and `DEMO_REWARD_SECRET` is configured. Never expose full connection strings in a public issue.

### Vercel deploys but the live site looks unchanged

Confirm the new deployment is marked **Production**, not Preview. Check the commit SHA, branch, build logs, and configured production domain. Hard-refresh or test in a private window after the deployment becomes Ready.

### Dashboard map is blank or a marker does not appear

A map marker requires a valid latitude/longitude on a complaint. Confirm the user selected the correct location and the saved complaint has a non-null `location` object. Map tiles require network access to OpenStreetMap.

## Security, privacy, and responsible use

- Keep `.env.local`, `DATABASE_URL`, `GEMINI_API_KEY`, signing secrets, and any access tokens out of Git and public logs.
- Do not use actual sensitive complaints or private personal information as public demo data.
- Uploaded photographs may contain EXIF GPS coordinates. Confirm location handling is appropriate before using real residents' images.
- Do not claim that the AI is always correct. Provide human review and a correction path for incorrect classifications or locations.
- The current authority dashboard and anonymous demo wallet do not provide government-grade access control or identity assurance.
- The demo rewards mechanism is not a production fraud-control system. A public launch requires authenticated users, role-based authority access, robust abuse/rate-limits, moderated verification, monitoring, data-retention rules, and legitimate merchant offers.
- The service should not be represented as officially connected to a municipal or state-government system unless a real integration is approved and implemented.

## Roadmap

Potential work before a public or government deployment:

1. Add authenticated citizen accounts and role-based authority access.
2. Define a formal report review and appeal workflow for human moderators or participating authorities.
3. Improve duplicate detection using location radius, image similarity, time windows, and moderator feedback.
4. Add rate limiting, abuse monitoring, idempotent retry protections, and operational alerts.
5. Establish data retention, privacy notice, consent, deletion and audit policies.
6. Integrate municipal intake systems only through authorised APIs and agreements.
7. Add a sponsor/merchant management workflow for actual offers, inventory, eligibility and redemption verification.
8. Run accessibility, security, load, and browser/device testing before a wider release.

## Contributing

1. Create a branch for each feature or fix.
2. Keep changes scoped and avoid committing generated files, backups, secrets, or real personal data.
3. Run `npm run build` before opening a pull request.
4. Describe the change, how it was tested, any database migration, and any remaining limitations.
5. Do not mark a workflow as production-ready based only on mocked tests; report what was tested against the real database and deployment.

## License

No license terms are declared by this README. Unless a `LICENSE` file is added, users should not assume the project has an open-source license granting redistribution or modification rights. Choose and add an appropriate license if you intend to publish the code for community reuse.
