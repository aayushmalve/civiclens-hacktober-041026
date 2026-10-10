"use client";

import CivicLensHeader from "@/components/CivicLensHeader";

import { useEffect, useMemo, useState } from "react";
import {
  DEMO_REWARD_CATALOG,
  DEMO_REWARDS_UPDATED_EVENT,
  DEMO_REPORT_REWARD,
  type DemoRewardOffer,
  type DemoRewardState,
} from "@/lib/demo-rewards";

type Reward = DemoRewardOffer;

const rewards = DEMO_REWARD_CATALOG;

type WalletLoadResponse = { ok: boolean; data: { state?: DemoRewardState; error?: string } };

// React Strict Mode can run mount effects twice in development. Share a single
// bootstrap GET so simultaneous first requests do not mint multiple anonymous wallets.
let walletBootstrapRequest: Promise<WalletLoadResponse> | null = null;

function loadWalletBootstrap(): Promise<WalletLoadResponse> {
  if (!walletBootstrapRequest) {
    walletBootstrapRequest = fetch("/api/demo-rewards", { cache: "no-store" }).then(async (response) => ({
      ok: response.ok,
      data: await response.json() as { state?: DemoRewardState; error?: string },
    }));
  }
  const request = walletBootstrapRequest;
  return request.finally(() => {
    if (walletBootstrapRequest === request) walletBootstrapRequest = null;
  });
}

const categories = ["All rewards", "Food & drink", "Shopping", "Everyday", "Community"] as const;
type Category = (typeof categories)[number];

function MiniIllustration({ kind }: { kind: "city" | "ticket" }) {
  if (kind === "city") {
    return <svg viewBox="0 0 340 170" aria-hidden="true" className="rw-city-art"><circle cx="274" cy="43" r="28" fill="#FFD28B"/><path d="M0 145 Q50 120 95 143 T190 140 T340 132 V170 H0Z" fill="#CDEDE5"/><path d="M28 145V82H70V145M80 145V55H125V145M138 145V95H174V145M187 145V68H233V145M245 145V100H285V145M293 145V75H324V145" fill="#9EC9F5" stroke="#fff" strokeWidth="4"/><path d="M37 95h9m-9 15h9m-9 15h9M91 72h9m-9 15h9m-9 15h9m-9 15h9M199 83h9m-9 15h9m-9 15h9m-9 15h9M255 113h9m-9 13h9m-9 13h9" stroke="#fff" strokeWidth="4" strokeLinecap="round"/><path d="M0 151 Q35 132 72 150 T155 150 T240 146 T340 148" fill="none" stroke="#168C80" strokeWidth="3"/></svg>;
  }
  return <svg viewBox="0 0 120 90" aria-hidden="true" className="rw-ticket-art"><path d="M10 17Q10 10 18 10H102Q110 10 110 18V30A10 10 0 0 0 110 50V72Q110 80 102 80H18Q10 80 10 72V50A10 10 0 0 0 10 30Z" fill="currentColor" opacity=".13"/><path d="M60 20V70" stroke="currentColor" strokeDasharray="4 5" strokeWidth="2" opacity=".5"/><circle cx="36" cy="44" r="10" fill="currentColor" opacity=".35"/><path d="m32 44 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function moneyDelta(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export default function RewardsPage() {
  const [state, setState] = useState<DemoRewardState>({ balance: 0, reports: [], claims: [], ledger: [] });
  const [category, setCategory] = useState<Category>("All rewards");
  const [notice, setNotice] = useState("");
  const [showWallet, setShowWallet] = useState(true);
  const [showLedger, setShowLedger] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Render a deterministic shell during SSR and the first client render.
  // Wallet state and disabled attributes are only rendered after hydration.
  const [mounted, setMounted] = useState(false);

  async function syncState(quiet = false) {
    try {
      const result = await loadWalletBootstrap();
      if (!result.ok) throw new Error(result.data.error ?? "Could not load the demo wallet.");
      if (!result.data.state) throw new Error("The demo wallet response was incomplete.");
      setState(result.data.state);
    } catch (error) {
      if (!quiet) setNotice(error instanceof Error ? error.message : "Could not load the server-backed demo wallet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    const sync = () => { void syncState(true); };
    void syncState();
    window.addEventListener(DEMO_REWARDS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(DEMO_REWARDS_UPDATED_EVENT, sync);
  }, []);

  async function runAction(payload: Record<string, string>): Promise<{ outcome: string; message: string } | null> {
    setBusy(true);
    try {
      const response = await fetch("/api/demo-rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The demo action could not be completed.");
      setState(data.state as DemoRewardState);
      setNotice(String(data.message ?? "Demo action completed."));
      window.dispatchEvent(new Event(DEMO_REWARDS_UPDATED_EVENT));
      return { outcome: String(data.outcome ?? "ok"), message: String(data.message ?? "Demo action completed.") };
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The demo action could not be completed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => category === "All rewards" ? rewards : rewards.filter((reward) => reward.category === category), [category]);
  const claimedIds = useMemo(() => new Set(state.claims.map((claim) => claim.rewardId)), [state.claims]);

  async function handleClaim(reward: Reward) {
    const result = await runAction({ action: "claim", rewardId: reward.id });
    if (result?.outcome === "claimed") setShowWallet(true);
  }

  async function handleVerify(reportId: string) {
    await runAction({ action: "verify-report", reportId });
  }

  async function handleRedeem(code: string) {
    await runAction({ action: "redeem", code });
  }

  async function addSampleReport() {
    await runAction({ action: "sample-report", title: "Overflowing public waste bin", category: "Garbage" });
  }

  async function resetDemo() {
    const result = await runAction({ action: "reset" });
    if (result?.outcome === "reset") setShowWallet(true);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`${code} copied. Reminder: this code is demonstration-only.`);
    } catch {
      setNotice(`Demo code: ${code}. Copy it manually; it is not redeemable with a real merchant.`);
    }
  }

  // Avoid SSR/client mismatches from async state, disabled props and locale dates.
  // The server and first client render use this same deterministic placeholder.
  if (!mounted) {
    return (
      <main className="rw-page" aria-busy="true">
        <div className="rw-shell">
          <CivicLensHeader active="rewards" />
          <div className="rw-demo-banner"><span className="rw-pulse" /> INTERACTIVE PROTOTYPE <span className="rw-banner-sep">/</span> LOADING DEMO WALLET</div>
          <section className="rw-hero">
            <div className="rw-hero-copy"><div className="rw-eyebrow"><span /> GOOD CITIZENSHIP, LITTLE PERKS</div><h1>Good for your city.<br /><em>A little good for you.</em></h1><p>Connecting to the server-backed demonstration wallet…</p></div>
            <div className="rw-hero-visual"><div className="rw-visual-label">SMALL ACTIONS. BETTER STREETS.</div><MiniIllustration kind="city" /></div>
          </section>
          <div className="rw-notice" role="status"><span>…</span><p>Loading your demo wallet…</p></div>
        </div>
      </main>
    );
  }

  return (
    <main className="rw-page">
      <div className="rw-shell">
        <CivicLensHeader active="rewards" />

        <div className="rw-demo-banner"><span className="rw-pulse"/> INTERACTIVE PROTOTYPE <span className="rw-banner-sep">/</span> ALL OFFERS & CODES ARE DEMONSTRATIONS ONLY</div>

        <section className="rw-hero">
          <div className="rw-hero-copy"><div className="rw-eyebrow"><span/> GOOD CITIZENSHIP, LITTLE PERKS</div><h1>Good for your city.<br/><em>A little good for you.</em></h1><p>Submit a useful civic report, run the simulated quality check, then use demo points to try a coupon-style reward. This shows the proposed experience; it does not issue real benefits.</p><div className="rw-hero-actions"><a href="/#report-workspace" className="rw-button rw-button-primary">Report a civic issue <span>↗</span></a><button className="rw-button rw-button-secondary" onClick={() => setShowWallet((visible) => !visible)}>{showWallet ? "Hide my wallet" : "View my demo wallet"} <span>↓</span></button></div><div className="rw-trust-note"><span>✓</span> Quality over quantity · points are only added after the demo review step</div></div>
          <div className="rw-hero-visual"><div className="rw-visual-label">SMALL ACTIONS. BETTER STREETS.</div><MiniIllustration kind="city"/><div className="rw-sticker rw-sticker-blue"><b>+25</b><small>ON REVIEW</small></div><div className="rw-sticker rw-sticker-orange"><span>✳</span><small>LOCAL GOOD</small></div><div className="rw-visual-foot"><span className="rw-visual-dot"/> One useful report can start a chain reaction.</div></div>
        </section>

        {loading && <div className="rw-notice" role="status"><span>…</span><p>Connecting to your server-backed demo wallet…</p></div>}{notice && <div className="rw-notice" role="status"><span>ⓘ</span><p>{notice}</p><button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}

        <section className="rw-wallet-strip" aria-label="Demo wallet summary"><div className="rw-wallet-icon">✦</div><div className="rw-wallet-label"><small>YOUR DEMO WALLET</small><strong>{state.balance} <span>points</span></strong><p>Sample starter credit · anonymous demo wallet</p></div><div className="rw-wallet-divider"/><div className="rw-wallet-stat"><small>COUPONS CLAIMED</small><strong>{state.claims.length.toString().padStart(2, "0")}</strong></div><div className="rw-wallet-stat"><small>REDEMPTIONS TESTED</small><strong>{state.claims.filter((claim) => claim.status === "redeemed").length.toString().padStart(2, "0")}</strong></div><button className="rw-wallet-link" onClick={() => setShowWallet((visible) => !visible)}>{showWallet ? "Hide wallet ↑" : "Open wallet →"}</button></section>

        {showWallet && <section className="rw-my-wallet" id="my-wallet"><div className="rw-section-heading"><div><div className="rw-kicker">YOUR POCKET OF PERKS</div><h2>My demo wallet</h2></div><button className="rw-reset" disabled={busy || loading} onClick={() => { void resetDemo(); }}>Reset demo</button></div>{state.claims.length === 0 ? <div className="rw-empty-wallet"><span>✦</span><div><strong>Your wallet is waiting for its first perk.</strong><p>Claim an eligible sample offer below. Each claim gets a unique server-generated demo code with an enforced expiry and one-time simulated redemption.</p></div></div> : <div className="rw-claim-list">{state.claims.map((claim) => { const reward = rewards.find((item) => item.id === claim.rewardId); if (!reward) return null; const expiry = new Date(claim.expiresAt); return <article className="rw-claim" key={claim.claimId}><div className={`rw-claim-icon ${reward.color}`}>{reward.icon}</div><div className="rw-claim-main"><small>{reward.brand} · DEMO OFFER</small><strong>{reward.title}</strong><code>{claim.code}</code><p>{claim.status === "redeemed" ? `Tested on ${new Date(claim.redeemedAt ?? claim.claimedAt).toLocaleDateString("en-IN")}` : claim.status === "expired" ? `Expired on ${expiry.toLocaleDateString("en-IN")}` : `Expires ${expiry.toLocaleDateString("en-IN")}`}</p><button className="rw-copy-code" onClick={() => copyCode(claim.code)}>Copy code</button></div><div className="rw-claim-actions"><span className={`rw-status ${claim.status === "redeemed" ? "used" : claim.status === "expired" ? "expired" : ""}`}>{claim.status === "claimed" ? "Ready to try" : claim.status === "redeemed" ? "Redeemed" : "Expired"}</span>{claim.status === "claimed" && <button disabled={busy} onClick={() => { void handleRedeem(claim.code); }}>Test redeem</button>}</div></article>; })}</div>}<p className="rw-wallet-disclaimer">Codes are generated and stored by the demo server. They are not accepted by real merchants and do not represent an actual reward.</p></section>}

        <section className="rw-report-review"><div className="rw-section-heading"><div><div className="rw-kicker">FROM REPORT TO REWARD</div><h2>Demo report review<span>.</span></h2><p>New reports stay pending. Run the server-side prototype check to simulate verification; accepted unique reports earn {DEMO_REPORT_REWARD} points once. Server-marked duplicates earn none.</p></div><button className="rw-sample-report" disabled={busy || loading} onClick={() => { void addSampleReport(); }}>+ Add sample report</button></div>{state.reports.length === 0 ? <div className="rw-empty-wallet"><span>◎</span><div><strong>No report activity in this demo yet.</strong><p>Submit a report on the homepage or add a fictional sample to test the verification-to-points flow.</p></div></div> : <div className="rw-report-grid">{state.reports.slice(0, 6).map((report) => <article className="rw-report-card" key={report.id}><div className="rw-report-card-top"><span className={`rw-report-status ${report.status}`}>{report.status === "pending" ? "Pending review" : report.status === "verified" ? "Verified · points awarded" : report.status === "rejected" ? "Quality check failed · no points" : "Duplicate · no points"}</span><span>{report.origin === "sample" ? "SAMPLE" : "CITIZEN REPORT"}</span></div><h3>{report.title}</h3><p>{report.category} · {new Date(report.createdAt).toLocaleDateString("en-IN")}</p><code>{report.id}</code><div className="rw-report-card-bottom"><strong>{report.status === "verified" ? `+${report.pointsAwarded} pts` : report.status === "pending" ? `+${DEMO_REPORT_REWARD} pts if approved` : "0 pts"}</strong>{report.status === "pending" ? <button disabled={busy} onClick={() => { void handleVerify(report.id); }}>Run demo quality check ↗</button> : <span>{report.status === "verified" ? "Awarded once ✓" : report.status === "rejected" ? "Quality failed ✓" : "Blocked ✓"}</span>}</div></article>)}</div>}<small className="rw-demo-caveat">The demo server checks title/category duplicates and review state. This is a simulated review, not an authority decision or production anti-fraud service.</small></section>

        <section className="rw-catalogue"><div className="rw-section-heading"><div><div className="rw-kicker">THE GOOD STUFF</div><h2>Perks people would actually use<span>.</span></h2><p>Sample offers designed around everyday needs. Illustrative only, not sponsored or redeemable.</p></div><div className="rw-catalogue-count"><b>{filtered.length.toString().padStart(2, "0")}</b><span>DEMO OFFERS</span></div></div><div className="rw-filter-row" role="group" aria-label="Filter rewards">{categories.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="rw-reward-grid">{filtered.map((reward, index) => { const owned = claimedIds.has(reward.id); const eligible = state.balance >= reward.points; return <article className={`rw-reward-card rw-${reward.color}`} key={reward.id}><div className="rw-card-top"><span className="rw-partner-tag">SAMPLE PARTNER</span><span className="rw-card-number">0{index + 1}</span></div><div className="rw-reward-art"><span className="rw-reward-icon">{reward.icon}</span><MiniIllustration kind="ticket"/><span className="rw-reward-value">{reward.value}</span></div><div className="rw-card-copy"><small>{reward.brand}</small><h3>{reward.title}</h3><p>{reward.terms}</p></div><div className="rw-card-bottom"><div className="rw-cost"><b>✦ {reward.points}</b><span>demo points</span></div><button disabled={busy || loading || owned || !eligible} onClick={() => { void handleClaim(reward); }}>{owned ? "Already claimed ✓" : eligible ? "Try this reward ↗" : `Need ${reward.points - state.balance} more`}</button></div><div className="rw-card-availability"><span/><span>Illustrative offer · not live</span></div></article>; })}</div></section>

        <section className="rw-how"><div className="rw-how-intro"><div className="rw-kicker">BUILT AROUND REAL IMPACT</div><h2>Not more reports.<br/><em>Better reports.</em></h2><p>Rewards should encourage thoughtful civic participation—not spam, staged photos, or duplicate complaints.</p><div className="rw-how-illustration"><div className="rw-road"/><div className="rw-road-pin">✓</div><div className="rw-road-spark">✳</div></div></div><div className="rw-steps">{[{ n: "01", title: "Spot something that needs fixing", body: "Photograph a public issue and confirm where it happened." }, { n: "02", title: "Help verify the details", body: "This prototype checks report state and duplicate title/category matches before a demo credit is awarded." }, { n: "03", title: "Unlock a useful perk", body: "In a real launch, eligible offers would be supplied by verified partners." }].map((step) => <article className="rw-step" key={step.n}><span>{step.n}</span><div><h3>{step.title}</h3><p>{step.body}</p></div><b>↗</b></article>)}</div></section>

        <section className="rw-ledger"><div className="rw-section-heading"><div><div className="rw-kicker">FOLLOW THE POINTS</div><h2>Demo activity ledger<span>.</span></h2><p>Every prototype points change or claim is listed here for visibility.</p></div><button className="rw-reset" onClick={() => setShowLedger((visible) => !visible)}>{showLedger ? "Hide activity" : "View activity"}</button></div>{showLedger && <div className="rw-ledger-list">{state.ledger.slice(0, 12).map((entry) => <article key={entry.id} className="rw-ledger-row"><span className="rw-ledger-mark">{entry.pointsDelta > 0 ? "+" : entry.pointsDelta < 0 ? "−" : "·"}</span><div><strong>{entry.title}</strong><p>{entry.details}</p><small>{new Date(entry.createdAt).toLocaleString("en-IN")}{entry.reference ? ` · ${entry.reference}` : ""}</small></div><b className={entry.pointsDelta > 0 ? "positive" : entry.pointsDelta < 0 ? "negative" : ""}>{entry.pointsDelta === 0 ? "—" : moneyDelta(entry.pointsDelta)}</b></article>)}</div>}</section>

        <section className="rw-integrity"><div className="rw-integrity-icon">✓</div><div><small>OUR PROMISE</small><h2>Useful incentives. Honest rules.</h2><p>This prototype stores demo balances and an auditable activity ledger in the database, signs an anonymous demo-wallet cookie, and enforces claim, expiry, report completeness, duplicate-review, daily report limits, and one-time redemption transitions on the server. Review is simulated; offers and codes are not real merchant benefits. Authentication and production-grade anti-abuse monitoring are still required before a public launch.</p></div><div className="rw-integrity-stamp">DEMO<br/>MODE</div></section>

        <footer className="rw-footer"><a href="/" className="rw-footer-brand">CivicLens <span>✳</span></a><p>See the issue. Spark action.</p><div><a href="/track">Track reports</a><a href="/dashboard">Authority dashboard</a><a href="/verify">Verify a report</a></div><small>REWARDS CONCEPT PROTOTYPE · NO LIVE SPONSORS OR REDEEMABLE COUPONS</small></footer>
      </div>
    </main>
  );
}
