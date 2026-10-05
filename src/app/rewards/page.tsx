"use client";

import { useEffect, useState } from "react";

type RewardLevel = {
  name: string;
  next: number | null;
  start: number;
};

function getLevel(points: number): RewardLevel {
  if (points >= 2500) {
    return {
      name: "CIVIC CHAMPION",
      next: null,
      start: 2500,
    };
  }

  if (points >= 1000) {
    return {
      name: "COMMUNITY GUARDIAN",
      next: 2500,
      start: 1000,
    };
  }

  if (points >= 500) {
    return {
      name: "CIVIC CONTRIBUTOR",
      next: 1000,
      start: 500,
    };
  }

  if (points >= 100) {
    return {
      name: "CIVIC SCOUT",
      next: 500,
      start: 100,
    };
  }

  return {
    name: "NEW CITIZEN",
    next: 100,
    start: 0,
  };
}

const rewards = [
  {
    points: 500,
    title: "₹50 LOCAL PARTNER VOUCHER",
    description:
      "A small everyday reward sponsored by a participating local café, store or service.",
    status: "PARTNER REWARD",
  },
  {
    points: 1000,
    title: "₹100 LOCAL PARTNER VOUCHER",
    description:
      "A higher-value discount or voucher from a participating community partner.",
    status: "PARTNER REWARD",
  },
  {
    points: 2500,
    title: "CIVIC CHAMPION CERTIFICATE",
    description:
      "Recognition for sustained, high-quality civic participation and verified impact.",
    status: "CITY RECOGNITION",
  },
  {
    points: 5000,
    title: "PREMIUM CIVIC REWARD",
    description:
      "Future city campaigns can offer larger sponsored rewards to top contributors.",
    status: "SPONSORED REWARD",
  },
];

export default function RewardsPage() {
  const [points, setPoints] = useState(0);

  useEffect(() => {
    const loadPoints = () => {
      const stored = Number(
        window.localStorage.getItem(
          "civiclens_civic_points"
        ) ?? "0"
      );

      if (Number.isFinite(stored)) {
        setPoints(Math.max(0, stored));
      }
    };

    loadPoints();

    window.addEventListener("storage", loadPoints);

    return () => {
      window.removeEventListener(
        "storage",
        loadPoints
      );
    };
  }, []);

  const level = getLevel(points);

  const progress = level.next
    ? Math.min(
        100,
        Math.max(
          0,
          ((points - level.start) /
            (level.next - level.start)) *
            100
        )
      )
    : 100;

  const nextReward =
    rewards.find((reward) => reward.points > points) ??
    rewards[rewards.length - 1];

  const pointsToReward = Math.max(
    0,
    nextReward.points - points
  );

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        <header className="flex items-center justify-between">
          <a
            href="/"
            className="text-xl font-black tracking-[0.22em]"
          >
            CIVICLENS
          </a>

          <div className="flex flex-wrap gap-3">
            <a
              href="/track"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold tracking-widest text-zinc-400 hover:bg-white/[0.08]"
            >
              TRACK
            </a>

            <a
              href="/dashboard"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold tracking-widest text-zinc-400 hover:bg-white/[0.08]"
            >
              AUTHORITY
            </a>
          </div>
        </header>

        <section className="mt-16 max-w-4xl">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
            Citizen participation
          </div>

          <h1 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">
            CIVIC REWARDS
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-500">
            CivicLens does not reward people for spamming
            complaints. It rewards meaningful civic
            participation, with points designed to become
            real partner discounts, recognition and
            community benefits.
          </p>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-7">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  Current civic balance
                </div>

                <div className="mt-3 text-6xl font-black text-amber-300">
                  {points}
                </div>

                <div className="mt-1 text-sm font-bold text-zinc-400">
                  Civic Points
                </div>
              </div>

              <div className="rounded-2xl border border-amber-400/15 bg-black/20 px-4 py-3 text-right">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
                  Current level
                </div>
                <div className="mt-1 text-xs font-black text-white">
                  {level.name}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em]">
              <span className="text-zinc-500">
                Progress
              </span>

              <span className="text-amber-300">
                {level.next
                  ? `${level.next - points} to next badge`
                  : "MAX LEVEL"}
              </span>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-300 transition-all"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/5 bg-black/20 p-4">
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
                Next real-world benefit
              </div>
              <div className="mt-2 text-sm font-black text-white">
                {nextReward.title}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {pointsToReward === 0
                  ? "Unlocked"
                  : `${pointsToReward} more points needed`}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-7">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
              How civic impact earns points
            </div>

            <div className="mt-5 space-y-4">
              {[
                [
                  "Valid new civic report",
                  "+5",
                ],
                [
                  "Existing nearby issue / duplicate",
                  "+2",
                ],
                [
                  "Authority accepts report",
                  "+10",
                ],
                [
                  "Issue is successfully resolved",
                  "+25",
                ],
                [
                  "Citizen helps verify resolution",
                  "+10",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-zinc-300">
                    {label}
                  </span>
                  <span className="shrink-0 font-mono font-bold text-amber-300">
                    {value}
                  </span>
                </div>
              ))}

              <div className="border-t border-white/5 pt-4 text-xs leading-5 text-zinc-600">
                The MVP awards points immediately for a
                submitted report. Additional lifecycle
                rewards are designed for the production
                authority workflow.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.025] p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                Reward catalogue
              </div>

              <h2 className="mt-2 text-2xl font-black">
                Points → tangible benefits
              </h2>
            </div>

            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">
              Partner rewards shown as MVP examples
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {rewards.map((reward) => {
              const unlocked =
                points >= reward.points;

              return (
                <div
                  key={reward.points}
                  className={`rounded-2xl border p-5 ${
                    unlocked
                      ? "border-amber-400/30 bg-amber-400/[0.06]"
                      : "border-white/5 bg-black/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-mono text-xs font-bold text-amber-300">
                        {reward.points.toLocaleString()} PTS
                      </div>

                      <div className="mt-2 text-sm font-black text-white">
                        {reward.title}
                      </div>
                    </div>

                    <div
                      className={`rounded-full px-2 py-1 text-[8px] font-black tracking-widest ${
                        unlocked
                          ? "bg-amber-300 text-black"
                          : "bg-white/5 text-zinc-600"
                      }`}
                    >
                      {unlocked
                        ? "UNLOCKED"
                        : reward.status}
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    {reward.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.025] p-7">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
            Civic badge ladder
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {[
              ["NEW CITIZEN", "0"],
              ["CIVIC SCOUT", "100"],
              ["CIVIC CONTRIBUTOR", "500"],
              ["COMMUNITY GUARDIAN", "1000"],
              ["CIVIC CHAMPION", "2500"],
            ].map(([name, threshold], index) => (
              <div
                key={name}
                className={`rounded-2xl border p-4 ${
                  points >= Number(threshold)
                    ? "border-amber-400/30 bg-amber-400/[0.06]"
                    : "border-white/5 bg-black/20"
                }`}
              >
                <div className="text-[9px] font-black tracking-[0.14em] text-zinc-500">
                  0{index + 1}
                </div>

                <div className="mt-3 text-xs font-black">
                  {name}
                </div>

                <div className="mt-1 font-mono text-[10px] text-amber-300">
                  {Number(threshold).toLocaleString()} PTS
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-emerald-400/10 bg-emerald-400/[0.025] p-7">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
            Why rewards work
          </div>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-400">
            CivicLens is designed around quality over quantity:
            a citizen is rewarded for useful evidence, accurate
            participation and real-world resolution. In a city
            deployment, local businesses can sponsor the reward
            catalogue while the municipality benefits from higher
            quality civic participation.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/"
            className="rounded-xl bg-emerald-400 px-5 py-3 text-xs font-black text-black hover:bg-emerald-300"
          >
            REPORT A CIVIC ISSUE
          </a>

          <a
            href="/track"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold text-zinc-300 hover:bg-white/[0.08]"
          >
            TRACK A COMPLAINT
          </a>
        </div>

        <footer className="mt-16 border-t border-white/5 pt-6 text-[10px] uppercase tracking-[0.15em] text-zinc-700">
          CivicLens · Civic participation · Evidence first
        </footer>
      </div>
    </main>
  );
}
