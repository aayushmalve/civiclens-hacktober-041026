/** Shared, explicitly demo-only rewards data and types. */

export const DEMO_STARTING_POINTS = 120;
export const DEMO_REPORT_REWARD = 25;
export const DEMO_REWARDS_UPDATED_EVENT = "civiclens-demo-rewards-updated";

export type DemoReportStatus = "pending" | "verified" | "duplicate" | "rejected";
export type DemoClaimStatus = "claimed" | "redeemed" | "expired" | "void";
export type DemoLedgerType =
  | "starter_credit"
  | "report_submitted"
  | "report_verified"
  | "report_rejected"
  | "duplicate_blocked"
  | "reward_claimed"
  | "reward_redeemed"
  | "reward_expired"
  | "demo_reset";

export type DemoReport = {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  status: DemoReportStatus;
  pointsAwarded: number;
  origin: "submitted-report" | "sample";
  serverDuplicate: boolean;
};

export type DemoClaim = {
  claimId: string;
  rewardId: string;
  code: string;
  pointsCost: number;
  claimedAt: string;
  expiresAt: string;
  status: DemoClaimStatus;
  redeemedAt?: string;
};

export type DemoLedgerEntry = {
  id: string;
  createdAt: string;
  type: DemoLedgerType;
  title: string;
  details: string;
  pointsDelta: number;
  reference?: string;
};

export type DemoRewardState = {
  balance: number;
  reports: DemoReport[];
  claims: DemoClaim[];
  ledger: DemoLedgerEntry[];
};

export type DemoRewardOffer = {
  id: string;
  brand: string;
  title: string;
  value: string;
  points: number;
  category: "Food & drink" | "Shopping" | "Everyday" | "Community";
  color: "peach" | "mint" | "blue" | "lavender" | "yellow" | "sky";
  icon: string;
  terms: string;
  expiryDays: number;
};

export const DEMO_REWARD_CATALOG: DemoRewardOffer[] = [
  { id: "chai", brand: "CHAI STOP", title: "A little break on us", value: "₹30 OFF", points: 40, category: "Food & drink", color: "peach", icon: "☕", terms: "Illustrative café offer. A participating café would supply the real code and terms in a live programme.", expiryDays: 14 },
  { id: "fresh", brand: "FRESH CART", title: "Everyday essentials", value: "10% OFF", points: 60, category: "Shopping", color: "mint", icon: "✳", terms: "Illustrative grocery offer. A real partner would define eligible items and minimum spend.", expiryDays: 7 },
  { id: "stationery", brand: "PAPER & PEN", title: "Make room for ideas", value: "₹50 OFF", points: 80, category: "Everyday", color: "blue", icon: "✎", terms: "Illustrative stationery offer. Not valid at any real shop; sample redemption flow only.", expiryDays: 14 },
  { id: "snack", brand: "THE SNACK CLUB", title: "A snack for your next walk", value: "₹25 OFF", points: 35, category: "Food & drink", color: "lavender", icon: "✦", terms: "Illustrative food offer. No real merchant has committed to this promotion.", expiryDays: 7 },
  { id: "community", brand: "CIVICLENS COMMUNITY", title: "Community contributor badge", value: "DIGITAL GIFT", points: 50, category: "Community", color: "yellow", icon: "★", terms: "A sample digital recognition badge for this demo. No physical item will be delivered.", expiryDays: 30 },
  { id: "ride", brand: "CITY HOP", title: "A little help getting there", value: "₹20 CREDIT", points: 100, category: "Everyday", color: "sky", icon: "↗", terms: "Illustrative mobility reward only. No transport operator participates in this demo.", expiryDays: 7 },
];
