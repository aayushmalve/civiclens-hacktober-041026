"use client";

import {
  FormEvent,
  useState,
} from "react";

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: "photo" | "device" | "user";
  displayName?: string;
};

type Verification = {
  verdict:
    | "RESOLVED"
    | "PARTIALLY RESOLVED"
    | "NOT RESOLVED";
  confidence: number;
  summary: string;
  beforeEvidence: string[];
  afterEvidence: string[];
  comparison: string;
  remainingIssue: string;
  recommendation: string;
  verifiedAt: string;
};

type Complaint = {
  id: string;
  category: string;
  title: string;
  description: string;
  report: string;
  severity: number;
  confidence: number;
  evidence: string[];
  risk: string;
  recommendedAction: string;
  department: string;
  status:
    | "Submitted"
    | "Assigned"
    | "In Progress"
    | "Resolved";
  createdAt: string;
  updatedAt: string;
  location: LocationData | null;
  verification?: Verification;
};

const statusSteps = [
  "Submitted",
  "Assigned",
  "In Progress",
  "Resolved",
] as const;

function getMapsUrl(
  location: LocationData | null
) {
  if (!location) return null;

  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

function getStatusIndex(
  status: Complaint["status"]
) {
  return statusSteps.indexOf(status);
}

export default function TrackPage() {
  const [complaintId, setComplaintId] =
    useState("");

  const [complaint, setComplaint] =
    useState<Complaint | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function trackComplaint(
    event?: FormEvent
  ) {
    event?.preventDefault();

    const id = complaintId.trim().toUpperCase();

    if (!id) {
      setError("Enter your complaint ID.");
      return;
    }

    setLoading(true);
    setError("");
    setComplaint(null);

    try {
      const response = await fetch(
        "/api/complaints",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to load complaints."
        );
      }

      const complaints: Complaint[] =
        Array.isArray(data.complaints)
          ? data.complaints
          : [];

      const found = complaints.find(
        (item) =>
          item.id.toUpperCase() === id
      );

      if (!found) {
        setError(
          "Complaint not found. Check the complaint ID and try again."
        );
        return;
      }

      setComplaint(found);
      setComplaintId(found.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to track complaint."
      );
    } finally {
      setLoading(false);
    }
  }

  const currentIndex = complaint
    ? getStatusIndex(complaint.status)
    : -1;

  const mapsUrl = complaint
    ? getMapsUrl(complaint.location)
    : null;

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
        <header className="mb-16 flex items-center justify-between">
          <a href="/" className="block">
            <div className="text-xl font-black tracking-[0.22em]">
              CIVICLENS
            </div>

            <div className="mt-1 text-[10px] font-bold tracking-[0.2em] text-zinc-500">
              CIVIC INTELLIGENCE
            </div>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold tracking-widest text-zinc-400 hover:bg-white/[0.08]"
            >
              AUTHORITY
            </a>

            <a
              href="/"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold tracking-widest text-zinc-400 hover:bg-white/[0.08]"
            >
              REPORT ISSUE
            </a>
          </div>
        </header>

        <section className="mb-10 max-w-3xl">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
            Citizen Portal
          </div>

          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Track your
            <br />
            civic complaint.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
            Enter your CivicLens complaint ID to see
            its current status, assigned department,
            incident location, and resolution progress.
          </p>
        </section>

        <form
          onSubmit={trackComplaint}
          className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-7"
        >
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
            Complaint ID
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={complaintId}
              onChange={(event) =>
                setComplaintId(
                  event.target.value
                )
              }
              placeholder="e.g. CL-MF8K3Z-AB12"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-4 font-mono text-sm text-white outline-none placeholder:text-zinc-700 focus:border-emerald-400/40"
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-white px-7 py-4 text-xs font-black tracking-wider text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "SEARCHING..."
                : "TRACK COMPLAINT"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {complaint && (
          <section className="mt-8 space-y-5">
            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.035] p-6 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                    Complaint Found
                  </div>

                  <h2 className="mt-2 text-2xl font-black md:text-3xl">
                    {complaint.title}
                  </h2>

                  <div className="mt-3 font-mono text-xs text-zinc-500">
                    {complaint.id}
                  </div>
                </div>

                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[10px] font-black tracking-widest text-emerald-400">
                  {complaint.status.toUpperCase()}
                </div>
              </div>

              <div className="mt-8">
                <div className="relative">
                  <div className="absolute left-5 right-5 top-5 h-px bg-white/10" />

                  <div className="relative grid grid-cols-4">
                    {statusSteps.map(
                      (status, index) => {
                        const completed =
                          index <= currentIndex;

                        const active =
                          index === currentIndex;

                        return (
                          <div
                            key={status}
                            className="flex flex-col items-center text-center"
                          >
                            <div
                              className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border text-xs font-black ${
                                completed
                                  ? "border-emerald-400 bg-emerald-400 text-black"
                                  : "border-white/10 bg-[#0b0d12] text-zinc-600"
                              } ${
                                active
                                  ? "ring-4 ring-emerald-400/10"
                                  : ""
                              }`}
                            >
                              {completed
                                ? "✓"
                                : index + 1}
                            </div>

                            <div
                              className={`mt-3 text-[9px] font-bold uppercase tracking-wider ${
                                active
                                  ? "text-emerald-400"
                                  : completed
                                    ? "text-zinc-300"
                                    : "text-zinc-700"
                              }`}
                            >
                              {status}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <InfoCard
                label="Department"
                value={complaint.department}
              />

              <InfoCard
                label="Severity"
                value={`${complaint.severity}/10`}
              />

              <InfoCard
                label="AI Confidence"
                value={`${Math.round(
                  complaint.confidence * 100
                )}%`}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <div className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  Incident
                </div>

                <div className="text-sm font-bold text-zinc-200">
                  {complaint.category}
                </div>

                <p className="mt-3 text-sm leading-7 text-zinc-500">
                  {complaint.description}
                </p>

                <div className="mt-5 border-t border-white/5 pt-4 text-xs text-zinc-600">
                  Reported{" "}
                  {formatDate(
                    complaint.createdAt
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <div className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  Incident Location
                </div>

                {complaint.location ? (
                  <>
                    {complaint.location
                      .displayName && (
                      <div className="text-sm font-bold leading-6 text-zinc-300">
                        {
                          complaint.location
                            .displayName
                        }
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-[9px] uppercase tracking-widest text-zinc-700">
                          Latitude
                        </div>

                        <div className="mt-1 font-mono text-xs text-zinc-400">
                          {complaint.location.latitude.toFixed(
                            6
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-[9px] uppercase tracking-widest text-zinc-700">
                          Longitude
                        </div>

                        <div className="mt-1 font-mono text-xs text-zinc-400">
                          {complaint.location.longitude.toFixed(
                            6
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-zinc-600">
                      Location source:{" "}
                      <span className="text-zinc-400">
                        {complaint.location
                          .source === "user"
                          ? "Citizen confirmed"
                          : complaint.location
                                .source === "photo"
                            ? "Photo GPS"
                            : "Device GPS"}
                      </span>
                    </div>

                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-5 block rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-center text-xs font-bold text-emerald-400 hover:bg-emerald-400/10"
                      >
                        OPEN INCIDENT IN GOOGLE MAPS
                      </a>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-zinc-600">
                    No location attached.
                  </div>
                )}
              </div>
            </div>

            {complaint.verification && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                      Resolution Verification
                    </div>

                    <h3 className="mt-2 text-2xl font-black">
                      {complaint.verification.verdict}
                    </h3>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-zinc-600">
                      AI Confidence
                    </div>

                    <div className="mt-1 font-black text-emerald-400">
                      {Math.round(
                        complaint.verification
                          .confidence * 100
                      )}
                      %
                    </div>
                  </div>
                </div>

                <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-400">
                  {complaint.verification.summary}
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                      Comparison
                    </div>

                    <p className="mt-3 text-sm leading-7 text-zinc-500">
                      {
                        complaint.verification
                          .comparison
                      }
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                      Remaining Issue
                    </div>

                    <p className="mt-3 text-sm leading-7 text-zinc-500">
                      {
                        complaint.verification
                          .remainingIssue
                      }
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.03] p-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/60">
                    Recommended Action
                  </div>

                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    {
                      complaint.verification
                        .recommendation
                    }
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <div className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                AI Evidence
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {complaint.evidence.map(
                  (item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-500"
                    >
                      <span className="mr-2 font-mono text-emerald-400">
                        0{index + 1}
                      </span>

                      {item}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/"
                className="rounded-xl bg-emerald-400 px-5 py-3 text-xs font-black tracking-wide text-black hover:bg-emerald-300"
              >
                REPORT ANOTHER ISSUE
              </a>

              <a
                href="/dashboard"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold text-zinc-300 hover:bg-white/[0.08]"
              >
                AUTHORITY DASHBOARD
              </a>
            </div>
          </section>
        )}

        <footer className="mt-16 border-t border-white/5 pt-6 text-xs text-zinc-700">
          CivicLens · Transparent civic reporting · Evidence first
        </footer>
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
        {label}
      </div>

      <div className="mt-3 text-xl font-black text-zinc-200">
        {value}
      </div>
    </div>
  );
}
