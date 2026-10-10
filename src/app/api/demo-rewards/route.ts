import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_REWARD_CATALOG,
  DEMO_REPORT_REWARD,
  DEMO_STARTING_POINTS,
  type DemoRewardState,
} from "@/lib/demo-rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "civiclens_demo_account";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const MAX_LEDGER_ROWS = 100;

let schemaReady: Promise<void> | null = null;

type AccountContext = { accountId: string; token: string; isNew: boolean };
type QueryRow = Record<string, unknown>;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured. Configure Neon before using the server-backed rewards demo.");
  return neon(databaseUrl);
}

function getCookieSecret() {
  const secret = process.env.DEMO_REWARD_SECRET || process.env.AUTH_SECRET || process.env.DATABASE_URL;
  if (!secret) throw new Error("Set DEMO_REWARD_SECRET or DATABASE_URL to sign the demo wallet cookie.");
  return secret;
}

function signAccount(accountId: string) {
  return createHmac("sha256", getCookieSecret()).update(accountId).digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");
  return aBuffer.length === bBuffer.length && aBuffer.length > 0 && timingSafeEqual(aBuffer, bBuffer);
}

function accountFromRequest(request: NextRequest): AccountContext {
  const raw = request.cookies.get(COOKIE_NAME)?.value ?? "";
  const [accountId, signature, extra] = raw.split(".");
  if (!extra && accountId && signature && /^[0-9a-f-]{36}$/i.test(accountId)) {
    try {
      if (safeEqual(signature, signAccount(accountId))) {
        return { accountId, token: `${accountId}.${signature}`, isNew: false };
      }
    } catch {
      // Fall through to a new anonymous demo account when the cookie is invalid.
    }
  }
  const nextId = randomUUID();
  return { accountId: nextId, token: `${nextId}.${signAccount(nextId)}`, isNew: true };
}

function withCookie(response: NextResponse, account: AccountContext) {
  response.cookies.set(COOKIE_NAME, account.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}

async function ensureSchema() {
  const sql = getSql();
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS civiclens_demo_reward_accounts (
        account_id text PRIMARY KEY,
        balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS civiclens_demo_reward_reports (
        report_id text PRIMARY KEY,
        account_id text NOT NULL REFERENCES civiclens_demo_reward_accounts(account_id),
        title text NOT NULL,
        category text NOT NULL,
        fingerprint text NOT NULL,
        status text NOT NULL CHECK (status IN ('pending','verified','duplicate','rejected','reset')),
        quality_ok boolean NOT NULL DEFAULT true,
        quality_reason text,
        points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
        origin text NOT NULL CHECK (origin IN ('submitted-report','sample')),
        server_duplicate boolean NOT NULL DEFAULT false,
        duplicate_of text,
        submitted_at timestamptz NOT NULL DEFAULT now(),
        reviewed_at timestamptz
      )`;
      await sql`ALTER TABLE civiclens_demo_reward_reports ADD COLUMN IF NOT EXISTS quality_ok boolean NOT NULL DEFAULT true`;
      await sql`ALTER TABLE civiclens_demo_reward_reports ADD COLUMN IF NOT EXISTS quality_reason text`;
      await sql`CREATE INDEX IF NOT EXISTS civiclens_demo_reports_fingerprint_idx ON civiclens_demo_reward_reports(fingerprint, status)`;
      await sql`CREATE INDEX IF NOT EXISTS civiclens_demo_reports_account_idx ON civiclens_demo_reward_reports(account_id, submitted_at DESC)`;
      await sql`CREATE TABLE IF NOT EXISTS civiclens_demo_reward_report_tokens (
        token_hash text PRIMARY KEY,
        account_id text NOT NULL REFERENCES civiclens_demo_reward_accounts(account_id),
        report_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz
      )`;
      await sql`CREATE INDEX IF NOT EXISTS civiclens_demo_report_tokens_lookup_idx ON civiclens_demo_reward_report_tokens(report_id, account_id, expires_at)`;
      await sql`CREATE TABLE IF NOT EXISTS civiclens_demo_reward_claims (
        claim_id text PRIMARY KEY,
        account_id text NOT NULL REFERENCES civiclens_demo_reward_accounts(account_id),
        reward_id text NOT NULL,
        reward_title text NOT NULL,
        coupon_code text NOT NULL UNIQUE,
        points_cost integer NOT NULL CHECK (points_cost >= 0),
        status text NOT NULL CHECK (status IN ('claimed','redeemed','expired','void')),
        claimed_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        redeemed_at timestamptz
      )`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS civiclens_demo_claim_once_idx ON civiclens_demo_reward_claims(account_id, reward_id) WHERE status <> 'void'`;
      await sql`CREATE INDEX IF NOT EXISTS civiclens_demo_claims_account_idx ON civiclens_demo_reward_claims(account_id, claimed_at DESC)`;
      await sql`CREATE TABLE IF NOT EXISTS civiclens_demo_reward_ledger (
        id text PRIMARY KEY,
        idempotency_key text NOT NULL UNIQUE,
        account_id text NOT NULL REFERENCES civiclens_demo_reward_accounts(account_id),
        event_type text NOT NULL CHECK (event_type IN ('starter_credit','report_submitted','report_verified','report_rejected','duplicate_blocked','reward_claimed','reward_redeemed','reward_expired','demo_reset')),
        title text NOT NULL,
        details text NOT NULL,
        points_delta integer NOT NULL DEFAULT 0,
        reference text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS civiclens_demo_ledger_account_idx ON civiclens_demo_reward_ledger(account_id, created_at DESC)`;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function ensureAccount(accountId: string) {
  const sql = getSql();
  await sql`INSERT INTO civiclens_demo_reward_accounts (account_id, balance)
    VALUES (${accountId}, ${DEMO_STARTING_POINTS}) ON CONFLICT (account_id) DO NOTHING`;
  await sql`INSERT INTO civiclens_demo_reward_ledger
    (id, idempotency_key, account_id, event_type, title, details, points_delta, reference)
    VALUES (${`starter:${accountId}`}, ${`starter:${accountId}`}, ${accountId}, 'starter_credit', 'Demo starter credit', 'Sample points to explore the prototype; not money or a real benefit.', ${DEMO_STARTING_POINTS}, 'starter')
    ON CONFLICT (idempotency_key) DO NOTHING`;
}

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-IN").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function toIso(value: unknown) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}

async function readState(accountId: string): Promise<DemoRewardState> {
  const sql = getSql();
  const expired = await sql`
    WITH expiring AS (
      UPDATE civiclens_demo_reward_claims
      SET status = 'expired'
      WHERE account_id = ${accountId} AND status = 'claimed' AND expires_at <= now()
      RETURNING account_id, coupon_code, reward_title
    )
    INSERT INTO civiclens_demo_reward_ledger
      (id, idempotency_key, account_id, event_type, title, details, points_delta, reference)
    SELECT 'expired:' || coupon_code, 'expired:' || coupon_code, account_id, 'reward_expired', 'Demo coupon expired', reward_title || ' expired and cannot be redeemed.', 0, coupon_code
    FROM expiring ON CONFLICT (idempotency_key) DO NOTHING`;
  void expired;

  const [accountRows, reportRows, claimRows, ledgerRows] = await Promise.all([
    sql`SELECT balance FROM civiclens_demo_reward_accounts WHERE account_id = ${accountId} LIMIT 1`,
    sql`SELECT report_id, title, category, submitted_at, status, points_awarded, origin, server_duplicate
      FROM civiclens_demo_reward_reports WHERE account_id = ${accountId} AND status <> 'reset' ORDER BY submitted_at DESC LIMIT 50`,
    sql`SELECT claim_id, reward_id, coupon_code, points_cost, claimed_at, expires_at, status, redeemed_at
      FROM civiclens_demo_reward_claims WHERE account_id = ${accountId} AND status <> 'void' ORDER BY claimed_at DESC LIMIT 50`,
    sql`SELECT id, created_at, event_type, title, details, points_delta, reference
      FROM civiclens_demo_reward_ledger WHERE account_id = ${accountId} ORDER BY created_at DESC LIMIT ${MAX_LEDGER_ROWS}`,
  ]);

  const account = (accountRows as QueryRow[])[0];
  const reports = (reportRows as QueryRow[]).map((row) => ({
    id: String(row.report_id), title: String(row.title), category: String(row.category), createdAt: toIso(row.submitted_at),
    status: String(row.status) as "pending" | "verified" | "duplicate", pointsAwarded: Number(row.points_awarded),
    origin: String(row.origin) as "submitted-report" | "sample", serverDuplicate: Boolean(row.server_duplicate),
  }));
  const claims = (claimRows as QueryRow[]).map((row) => ({
    claimId: String(row.claim_id), rewardId: String(row.reward_id), code: String(row.coupon_code), pointsCost: Number(row.points_cost),
    claimedAt: toIso(row.claimed_at), expiresAt: toIso(row.expires_at), status: String(row.status) as "claimed" | "redeemed" | "expired" | "void",
    ...(row.redeemed_at ? { redeemedAt: toIso(row.redeemed_at) } : {}),
  }));
  const ledger = (ledgerRows as QueryRow[]).map((row) => ({
    id: String(row.id), createdAt: toIso(row.created_at), type: String(row.event_type) as DemoRewardState["ledger"][number]["type"],
    title: String(row.title), details: String(row.details), pointsDelta: Number(row.points_delta),
    ...(row.reference ? { reference: String(row.reference) } : {}),
  }));
  return { balance: Number(account?.balance ?? DEMO_STARTING_POINTS), reports, claims, ledger };
}

function responseJson(payload: unknown, account: AccountContext, status = 200) {
  return withCookie(NextResponse.json(payload, { status }), account);
}

async function getAccountState(request: NextRequest) {
  await ensureSchema();
  const account = accountFromRequest(request);
  await ensureAccount(account.accountId);
  return { account, state: await readState(account.accountId) };
}

export async function GET(request: NextRequest) {
  try {
    const { account, state } = await getAccountState(request);
    return responseJson({ success: true, state, offers: DEMO_REWARD_CATALOG, mode: "server-backed-demo" }, account);
  } catch (error) {
    console.error("Demo rewards GET failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load demo rewards." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let account: AccountContext | null = null;
  try {
    const context = await getAccountState(request);
    const sql = getSql();
    account = context.account;
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    let outcome = "ok";
    let message = "Demo action completed.";
    let issuedProof: string | undefined;

    if (action === "issue-report-token") {
      const reportId = String(body.reportId ?? "").trim();
      if (!/^[A-Za-z0-9_-]{3,120}$/.test(reportId)) return responseJson({ error: "Invalid report ID." }, account, 400);
      issuedProof = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(issuedProof).digest("hex");
      await sql`INSERT INTO civiclens_demo_reward_report_tokens (token_hash, account_id, report_id, expires_at)
        VALUES (${tokenHash}, ${account.accountId}, ${reportId}, now() + interval '30 minutes')`;
      outcome = "proof-issued";
      message = "Short-lived submission proof issued. It must be consumed by the complaint API before the report can enter the rewards queue.";
    } else if (action === "register-report") {
      const reportId = String(body.reportId ?? "").trim();
      const proof = String(body.proof ?? "").trim();
      if (!/^[A-Za-z0-9_-]{3,120}$/.test(reportId)) return responseJson({ error: "Invalid report ID." }, account, 400);
      if (!/^[a-f0-9]{64}$/i.test(proof)) return responseJson({ error: "A valid submission proof is required to link a report to demo rewards." }, account, 403);
      const proofHash = createHash("sha256").update(proof).digest("hex");
      const proofRows = await sql`SELECT token_hash FROM civiclens_demo_reward_report_tokens
        WHERE token_hash = ${proofHash} AND account_id = ${account.accountId} AND report_id = ${reportId}
          AND consumed_at IS NOT NULL AND consumed_at <= expires_at LIMIT 1` as QueryRow[];
      if (!proofRows.length) return responseJson({ error: "This report was not created with a valid, single-use submission proof for this wallet." }, account, 403);
      const existing = await sql`SELECT account_id, status FROM civiclens_demo_reward_reports WHERE report_id = ${reportId} LIMIT 1` as QueryRow[];
      if (existing.length) {
        outcome = String(existing[0].account_id) === account.accountId ? "already-registered" : "already-linked";
        message = outcome === "already-registered" ? "This complaint is already in your demo review queue." : "This complaint has already been linked to a demo wallet; no additional reward activity was created.";
      } else {
        const complaintRows = await sql`SELECT id, title, category, created_at, description, report, evidence, location FROM complaints WHERE id = ${reportId} LIMIT 1` as QueryRow[];
        if (!complaintRows.length) return responseJson({ error: "Complaint not found in the complaints database; it cannot earn demo points." }, account, 404);
        const complaint = complaintRows[0];
        const dailyCountRows = await sql`SELECT count(*)::int AS count FROM civiclens_demo_reward_reports
          WHERE account_id = ${account.accountId} AND origin = 'submitted-report' AND submitted_at >= now() - interval '24 hours' AND status <> 'reset'` as QueryRow[];
        if (Number(dailyCountRows[0]?.count ?? 0) >= 10) {
          return responseJson({ error: "Daily demo reward limit reached. Your civic complaint is saved, but this report will not enter the reward review queue." }, account, 429);
        }
        const title = String(complaint.title ?? "Untitled civic report").trim().slice(0, 240) || "Untitled civic report";
        const category = String(complaint.category ?? "Other").trim().slice(0, 100) || "Other";
        const fingerprint = `${normalize(category)}::${normalize(title)}`;
        const description = String(complaint.description ?? "").trim();
        const reportText = String(complaint.report ?? "").trim();
        const parsedEvidence = parseJsonValue(complaint.evidence);
        const evidence = Array.isArray(parsedEvidence) ? parsedEvidence : [];
        const parsedLocation = parseJsonValue(complaint.location);
        const location = parsedLocation && typeof parsedLocation === "object" ? parsedLocation as Record<string, unknown> : null;
        const lat = Number(location?.latitude);
        const lon = Number(location?.longitude);
        const locationValid = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;
        const qualityProblems: string[] = [];
        if (normalize(title).length < 8) qualityProblems.push("Report title is too short.");
        if (normalize(category).length < 2) qualityProblems.push("Issue category is missing.");
        if (normalize(description).length + normalize(reportText).length < 30) qualityProblems.push("Report details are incomplete.");
        if (!evidence.length) qualityProblems.push("No supporting analysis evidence was attached.");
        if (!locationValid) qualityProblems.push("Incident location is missing or invalid.");
        const qualityOk = qualityProblems.length === 0;
        const matches = await sql`SELECT report_id FROM civiclens_demo_reward_reports
          WHERE fingerprint = ${fingerprint} AND status IN ('pending','verified') ORDER BY CASE WHEN status = 'verified' THEN 0 ELSE 1 END, submitted_at ASC LIMIT 1` as QueryRow[];
        const duplicateOf = matches[0] ? String(matches[0].report_id) : null;
        const initialStatus = duplicateOf ? "duplicate" : "pending";
        const createdAt = complaint.created_at ? toIso(complaint.created_at) : new Date().toISOString();
        const inserted = await sql`INSERT INTO civiclens_demo_reward_reports
          (report_id, account_id, title, category, fingerprint, status, quality_ok, quality_reason, points_awarded, origin, server_duplicate, duplicate_of, submitted_at)
          VALUES (${reportId}, ${account.accountId}, ${title}, ${category}, ${fingerprint}, ${initialStatus}, ${qualityOk}, ${qualityProblems.join(" ") || null}, 0, 'submitted-report', ${Boolean(duplicateOf)}, ${duplicateOf}, ${createdAt})
          ON CONFLICT (report_id) DO NOTHING RETURNING report_id` as QueryRow[];
        if (!inserted.length) {
          outcome = "already-linked";
          message = "This complaint was linked concurrently; no duplicate reward was created.";
        } else if (duplicateOf) {
          outcome = "duplicate";
          message = "Potential duplicate found by server-side title/category matching. No demo points were awarded.";
          await sql`INSERT INTO civiclens_demo_reward_ledger
            (id, idempotency_key, account_id, event_type, title, details, points_delta, reference)
            VALUES (${`duplicate:${reportId}`}, ${`duplicate:${reportId}`}, ${account.accountId}, 'duplicate_blocked', 'Potential duplicate blocked', ${`Report ${reportId} matched existing report ${duplicateOf}; no demo points awarded.`}, 0, ${reportId})
            ON CONFLICT (idempotency_key) DO NOTHING`;
        } else {
          outcome = "pending";
          message = "Report linked. It is pending the simulated quality review; points are not awarded just for uploading.";
          await sql`INSERT INTO civiclens_demo_reward_ledger
            (id, idempotency_key, account_id, event_type, title, details, points_delta, reference)
            VALUES (${`submitted:${reportId}`}, ${`submitted:${reportId}`}, ${account.accountId}, 'report_submitted', 'Civic report submitted', ${`${reportId} is pending simulated quality review.`}, 0, ${reportId})
            ON CONFLICT (idempotency_key) DO NOTHING`;
        }
      }
    } else if (action === "sample-report") {
      const priorSamples = await sql`SELECT count(*)::int AS count FROM civiclens_demo_reward_reports WHERE account_id = ${account.accountId} AND origin = 'sample' AND status <> 'reset'` as QueryRow[];
      if (Number(priorSamples[0]?.count ?? 0) >= 5) return responseJson({ error: "The demo allows up to five sample reports per wallet." }, account, 429);
      const reportId = `DEMO-REPORT-${randomBytes(5).toString("hex").toUpperCase()}`;
      const title = String(body.title ?? "Overflowing public waste bin").trim().slice(0, 240) || "Overflowing public waste bin";
      const category = String(body.category ?? "Garbage").trim().slice(0, 100) || "Garbage";
      const fingerprint = `${normalize(category)}::${normalize(title)}`;
      const matches = await sql`SELECT report_id FROM civiclens_demo_reward_reports WHERE fingerprint = ${fingerprint} AND status IN ('pending','verified') ORDER BY submitted_at ASC LIMIT 1` as QueryRow[];
      const duplicateOf = matches[0] ? String(matches[0].report_id) : null;
      await sql`INSERT INTO civiclens_demo_reward_reports
        (report_id, account_id, title, category, fingerprint, status, quality_ok, quality_reason, points_awarded, origin, server_duplicate, duplicate_of)
        VALUES (${reportId}, ${account.accountId}, ${title}, ${category}, ${fingerprint}, ${duplicateOf ? "duplicate" : "pending"}, true, null, 0, 'sample', ${Boolean(duplicateOf)}, ${duplicateOf})`;
      if (duplicateOf) {
        outcome = "duplicate";
        message = "Sample report added but flagged as a duplicate; no demo points were awarded.";
        await sql`INSERT INTO civiclens_demo_reward_ledger
          (id, idempotency_key, account_id, event_type, title, details, points_delta, reference)
          VALUES (${`duplicate:${reportId}`}, ${`duplicate:${reportId}`}, ${account.accountId}, 'duplicate_blocked', 'Sample duplicate blocked', ${`Sample ${reportId} matched ${duplicateOf}.`}, 0, ${reportId}) ON CONFLICT (idempotency_key) DO NOTHING`;
      } else {
        outcome = "pending";
        message = "Fictional sample report added to the review queue.";
        await sql`INSERT INTO civiclens_demo_reward_ledger
          (id, idempotency_key, account_id, event_type, title, details, points_delta, reference)
          VALUES (${`submitted:${reportId}`}, ${`submitted:${reportId}`}, ${account.accountId}, 'report_submitted', 'Sample civic report added', ${`${reportId} is fictional and pending simulated review.`}, 0, ${reportId}) ON CONFLICT (idempotency_key) DO NOTHING`;
      }
    } else if (action === "verify-report") {
      const reportId = String(body.reportId ?? "").trim();
      if (!/^[A-Za-z0-9_-]{3,120}$/.test(reportId)) return responseJson({ error: "Invalid report ID." }, account, 400);
      const result = await sql`
        WITH target AS (
          UPDATE civiclens_demo_reward_reports AS r
          SET status = CASE WHEN r.quality_ok = false THEN 'rejected' WHEN EXISTS (
                SELECT 1 FROM civiclens_demo_reward_reports AS other
                WHERE other.report_id <> r.report_id AND other.fingerprint = r.fingerprint AND other.status IN ('pending','verified')
              ) THEN 'duplicate' ELSE 'verified' END,
              duplicate_of = (SELECT other.report_id FROM civiclens_demo_reward_reports AS other
                WHERE other.report_id <> r.report_id AND other.fingerprint = r.fingerprint AND other.status IN ('pending','verified')
                ORDER BY CASE WHEN other.status = 'verified' THEN 0 ELSE 1 END, other.submitted_at ASC LIMIT 1),
              points_awarded = CASE WHEN r.quality_ok = false OR EXISTS (
                SELECT 1 FROM civiclens_demo_reward_reports AS other
                WHERE other.report_id <> r.report_id AND other.fingerprint = r.fingerprint AND other.status IN ('pending','verified')
              ) THEN 0 ELSE ${DEMO_REPORT_REWARD} END,
              reviewed_at = now()
          WHERE r.report_id = ${reportId} AND r.account_id = ${account.accountId} AND r.status = 'pending'
          RETURNING r.report_id, r.account_id, r.title, r.status, r.points_awarded, r.quality_reason
        ), credited AS (
          UPDATE civiclens_demo_reward_accounts AS a SET balance = a.balance + ${DEMO_REPORT_REWARD}, updated_at = now()
          FROM target AS t WHERE a.account_id = t.account_id AND t.status = 'verified' RETURNING a.account_id, a.balance
        ), logged AS (
          INSERT INTO civiclens_demo_reward_ledger (id, idempotency_key, account_id, event_type, title, details, points_delta, reference)
          SELECT 'review:' || t.report_id, 'review:' || t.report_id, t.account_id,
            CASE WHEN t.status = 'verified' THEN 'report_verified' WHEN t.status = 'rejected' THEN 'report_rejected' ELSE 'duplicate_blocked' END,
            CASE WHEN t.status = 'verified' THEN 'Demo quality check passed' WHEN t.status = 'rejected' THEN 'Demo quality check rejected report' ELSE 'Potential duplicate blocked' END,
            CASE WHEN t.status = 'verified' THEN t.report_id || ' passed simulated review; points awarded once.' WHEN t.status = 'rejected' THEN t.report_id || ' did not pass: ' || COALESCE(t.quality_reason, 'required report details were missing') ELSE t.report_id || ' matched another report; no points awarded.' END,
            CASE WHEN t.status = 'verified' THEN ${DEMO_REPORT_REWARD} ELSE 0 END, t.report_id
          FROM target AS t ON CONFLICT (idempotency_key) DO NOTHING RETURNING id
        )
        SELECT t.status, t.report_id, COALESCE(c.balance, (SELECT balance FROM civiclens_demo_reward_accounts WHERE account_id = ${account.accountId})) AS balance
        FROM target AS t LEFT JOIN credited AS c ON c.account_id = t.account_id` as QueryRow[];
      if (result.length) {
        outcome = String(result[0].status);
        message = outcome === "verified" ? `${DEMO_REPORT_REWARD} demo points awarded once after the simulated quality check.` : outcome === "rejected" ? `Report quality checks did not pass. No demo points were awarded. ${String(result[0].quality_reason ?? "")}` : "Potential duplicate flagged by the server-side demo check. No points were awarded.";
      } else {
        const existing = await sql`SELECT status FROM civiclens_demo_reward_reports WHERE report_id = ${reportId} AND account_id = ${account.accountId} LIMIT 1` as QueryRow[];
        outcome = existing.length ? "already-reviewed" : "missing";
        message = outcome === "already-reviewed" ? "This report has already been reviewed; points cannot be awarded again." : "This report is not in your demo wallet.";
      }
    } else if (action === "claim") {
      const rewardId = String(body.rewardId ?? "");
      const offer = DEMO_REWARD_CATALOG.find((item) => item.id === rewardId);
      if (!offer) return responseJson({ error: "Unknown demo reward offer." }, account, 400);
      const claimId = randomUUID();
      const code = `DEMO-${randomBytes(5).toString("hex").toUpperCase()}`;
      const created = await sql`
        WITH debited AS (
          UPDATE civiclens_demo_reward_accounts AS a
          SET balance = a.balance - ${offer.points}, updated_at = now()
          WHERE a.account_id = ${account.accountId} AND a.balance >= ${offer.points}
            AND NOT EXISTS (SELECT 1 FROM civiclens_demo_reward_claims c WHERE c.account_id = a.account_id AND c.reward_id = ${offer.id} AND c.status <> 'void')
          RETURNING a.account_id
        ), created AS (
          INSERT INTO civiclens_demo_reward_claims
            (claim_id, account_id, reward_id, reward_title, coupon_code, points_cost, status, expires_at)
          SELECT ${claimId}, debited.account_id, ${offer.id}, ${offer.title}, ${code}, ${offer.points}, 'claimed', now() + (${offer.expiryDays} * interval '1 day')
          FROM debited RETURNING claim_id, account_id, reward_title, points_cost, coupon_code
        ), logged AS (
          INSERT INTO civiclens_demo_reward_ledger (id, idempotency_key, account_id, event_type, title, details, points_delta, reference)
          SELECT 'claim:' || c.claim_id, 'claim:' || c.claim_id, c.account_id, 'reward_claimed', 'Demo reward claimed', c.reward_title || ' claimed using demo points.', -c.points_cost, c.coupon_code
          FROM created c ON CONFLICT (idempotency_key) DO NOTHING RETURNING id
        ) SELECT claim_id FROM created` as QueryRow[];
      if (created.length) {
        outcome = "claimed";
        message = `${offer.title} claimed. The unique code is a demo only and cannot be used with a merchant.`;
      } else {
        const claimed = await sql`SELECT claim_id FROM civiclens_demo_reward_claims WHERE account_id = ${account.accountId} AND reward_id = ${offer.id} AND status <> 'void' LIMIT 1` as QueryRow[];
        if (claimed.length) {
          outcome = "already-claimed";
          message = "This sample offer has already been claimed in this demo wallet.";
        } else {
          outcome = "insufficient-points";
          message = `You need ${offer.points} demo points to claim this reward.`;
        }
      }
    } else if (action === "redeem") {
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!/^DEMO-[A-F0-9]{10}$/.test(code)) return responseJson({ error: "Enter a valid demo coupon code." }, account, 400);
      const changed = await sql`
        WITH changed AS (
          UPDATE civiclens_demo_reward_claims
          SET status = CASE WHEN expires_at <= now() THEN 'expired' ELSE 'redeemed' END,
              redeemed_at = CASE WHEN expires_at <= now() THEN NULL ELSE now() END
          WHERE account_id = ${account.accountId} AND coupon_code = ${code} AND status = 'claimed'
          RETURNING claim_id, account_id, reward_title, coupon_code, status
        ), logged AS (
          INSERT INTO civiclens_demo_reward_ledger (id, idempotency_key, account_id, event_type, title, details, points_delta, reference)
          SELECT CASE WHEN c.status = 'redeemed' THEN 'redeem:' || c.claim_id ELSE 'expired:' || c.coupon_code END,
            CASE WHEN c.status = 'redeemed' THEN 'redeem:' || c.claim_id ELSE 'expired:' || c.coupon_code END,
            c.account_id, CASE WHEN c.status = 'redeemed' THEN 'reward_redeemed' ELSE 'reward_expired' END,
            CASE WHEN c.status = 'redeemed' THEN 'Demo redemption recorded' ELSE 'Demo coupon expired' END,
            CASE WHEN c.status = 'redeemed' THEN c.coupon_code || ' was simulated as redeemed. No merchant transaction occurred.' ELSE c.coupon_code || ' expired before demo redemption.' END,
            0, c.coupon_code FROM changed c ON CONFLICT (idempotency_key) DO NOTHING RETURNING id
        ) SELECT status FROM changed` as QueryRow[];
      if (changed.length) {
        outcome = String(changed[0].status);
        message = outcome === "redeemed" ? "Demo redemption recorded. No purchase or merchant transaction occurred." : "This demo code has expired and cannot be redeemed.";
      } else {
        const existing = await sql`SELECT status, expires_at FROM civiclens_demo_reward_claims WHERE account_id = ${account.accountId} AND coupon_code = ${code} LIMIT 1` as QueryRow[];
        if (!existing.length) { outcome = "missing"; message = "That demo code could not be found in this wallet."; }
        else if (String(existing[0].status) === "redeemed") { outcome = "already-redeemed"; message = "This code was already redeemed. Repeated redemption is blocked."; }
        else if (String(existing[0].status) === "expired" || new Date(String(existing[0].expires_at)).getTime() <= Date.now()) { outcome = "expired"; message = "This demo code has expired and cannot be redeemed."; }
        else { outcome = "unavailable"; message = "This code is no longer available to redeem."; }
      }
    } else if (action === "reset") {
      const resetId = randomUUID();
      await sql`
        WITH old_account AS MATERIALIZED (
          SELECT account_id, balance FROM civiclens_demo_reward_accounts WHERE account_id = ${account.accountId} FOR UPDATE
        ), reset_account AS (
          UPDATE civiclens_demo_reward_accounts a SET balance = ${DEMO_STARTING_POINTS}, updated_at = now()
          FROM old_account o WHERE a.account_id = o.account_id RETURNING a.account_id
        ), invalidated_claims AS (
          UPDATE civiclens_demo_reward_claims c SET status = 'void'
          FROM reset_account r WHERE c.account_id = r.account_id AND c.status <> 'void' RETURNING c.claim_id
        ), reset_reports AS (
          UPDATE civiclens_demo_reward_reports r SET status = 'reset', reviewed_at = now()
          FROM reset_account a WHERE r.account_id = a.account_id AND r.status <> 'reset' RETURNING r.report_id
        )
        INSERT INTO civiclens_demo_reward_ledger (id, idempotency_key, account_id, event_type, title, details, points_delta, reference)
        SELECT ${`reset:${resetId}`}, ${`reset:${resetId}`}, r.account_id, 'demo_reset', 'Demo wallet reset', 'Demo balance reset to starter points; old claims voided and reports hidden from the current session.', ${DEMO_STARTING_POINTS} - o.balance, 'reset'
        FROM reset_account r JOIN old_account o ON o.account_id = r.account_id
        ON CONFLICT (idempotency_key) DO NOTHING`;
      outcome = "reset";
      message = "Demo wallet reset. Starter credit restored; previous coupons voided and report activity cleared from this wallet view.";
    } else {
      return responseJson({ error: "Unknown demo rewards action." }, account, 400);
    }

    const state = await readState(account.accountId);
    return responseJson({ success: true, state, outcome, message, mode: "server-backed-demo", ...(issuedProof ? { proof: issuedProof } : {}) }, account);
  } catch (error) {
    console.error("Demo rewards POST failed", error);
    const message = error instanceof Error ? error.message : "Unable to update the demo rewards wallet.";
    const status = message.includes("DATABASE_URL") || message.includes("DEMO_REWARD_SECRET") ? 503 : 500;
    return account
      ? responseJson({ error: message }, account, status)
      : NextResponse.json({ error: message }, { status });
  }
}
