"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

type LocationSource = "photo" | "device" | "user";

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: LocationSource;
  displayName?: string;
};

type ComplaintStatus =
  | "Submitted"
  | "Assigned"
  | "In Progress"
  | "Resolved";

type Complaint = {
  id: string;
  category: string;
  title: string;
  description: string;
  report?: string;
  severity: number;
  confidence: number;
  evidence?: string[];
  risk?: string;
  recommendedAction?: string;
  department: string;
  status: ComplaintStatus;
  createdAt: string;
  updatedAt: string;
  location: LocationData | null;
  verification?: {
    verdict: "RESOLVED" | "PARTIALLY RESOLVED" | "NOT RESOLVED";
    confidence: number;
    summary: string;
    verifiedAt: string;
  };
};

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#080b10] text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">
      Loading incident map...
    </div>
  ),
});

function severityLabel(value: number) {
  if (value >= 9) return "CRITICAL";
  if (value >= 7) return "SERIOUS";
  if (value >= 5) return "MODERATE";
  if (value >= 3) return "LOW";
  return "MINOR";
}

function severityTone(value: number) {
  if (value >= 9) return "border-red-400/30 bg-red-400/10 text-red-300";
  if (value >= 7) return "border-orange-400/30 bg-orange-400/10 text-orange-300";
  if (value >= 5) return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
}

function statusTone(status: ComplaintStatus) {
  if (status === "Resolved") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (status === "In Progress") return "border-sky-400/20 bg-sky-400/10 text-sky-300";
  if (status === "Assigned") return "border-violet-400/20 bg-violet-400/10 text-violet-300";
  return "border-white/10 bg-white/[0.04] text-zinc-400";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getMapsUrl(location: LocationData | null) {
  if (!location) return null;
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function getLocationSourceLabel(source: LocationSource) {
  if (source === "photo") return "PHOTO GPS";
  if (source === "user") return "USER CONFIRMED";
  return "DEVICE GPS";
}

export default function DashboardPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | ComplaintStatus>("All");
  const [severityFilter, setSeverityFilter] = useState<"All" | "High" | "Medium" | "Low">("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadComplaints() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/complaints", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load complaints.");
      }

      setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load complaints."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComplaints();
  }, []);

  async function updateStatus(id: string, status: ComplaintStatus) {
    setUpdatingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/complaints/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update complaint.");
      }

      setComplaints((current) =>
        current.map((complaint) =>
          complaint.id === id ? data.complaint : complaint
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update complaint."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          complaints
            .map((complaint) => complaint.department)
            .filter(Boolean)
        )
      ).sort(),
    [complaints]
  );

  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const statusMatch = filter === "All" || complaint.status === filter;
      const departmentMatch =
        departmentFilter === "All" ||
        complaint.department === departmentFilter;

      let severityMatch = true;

      if (severityFilter === "High") severityMatch = complaint.severity >= 7;
      if (severityFilter === "Medium")
        severityMatch = complaint.severity >= 4 && complaint.severity <= 6;
      if (severityFilter === "Low") severityMatch = complaint.severity <= 3;

      return statusMatch && departmentMatch && severityMatch;
    });
  }, [complaints, filter, severityFilter, departmentFilter]);

  const stats = useMemo(() => {
    const open = complaints.filter((c) => c.status !== "Resolved").length;
    const resolved = complaints.filter((c) => c.status === "Resolved").length;
    const urgent = complaints.filter((c) => c.severity >= 7).length;
    const averageConfidence = complaints.length
      ? complaints.reduce((sum, c) => sum + c.confidence, 0) / complaints.length
      : 0;

    return {
      total: complaints.length,
      open,
      resolved,
      urgent,
      averageConfidence,
    };
  }, [complaints]);

  const issueDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    for (const complaint of complaints) {
      counts.set(
        complaint.category,
        (counts.get(complaint.category) ?? 0) + 1
      );
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [complaints]);

  const departmentLoad = useMemo(() => {
    const counts = new Map<string, number>();

    for (const complaint of complaints) {
      if (complaint.status !== "Resolved") {
        counts.set(
          complaint.department,
          (counts.get(complaint.department) ?? 0) + 1
        );
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [complaints]);

  const hotspots = useMemo(() => {
    const withLocation = complaints.filter((c) => c.location);
    const groups: {
      latitude: number;
      longitude: number;
      complaints: Complaint[];
    }[] = [];

    for (const complaint of withLocation) {
      const location = complaint.location!;
      let group = groups.find((candidate) => {
        const dLat = (candidate.latitude - location.latitude) * 111;
        const dLon =
          (candidate.longitude - location.longitude) *
          111 *
          Math.cos((location.latitude * Math.PI) / 180);
        return Math.sqrt(dLat * dLat + dLon * dLon) <= 0.65;
      });

      if (!group) {
        group = {
          latitude: location.latitude,
          longitude: location.longitude,
          complaints: [],
        };
        groups.push(group);
      }

      group.complaints.push(complaint);
    }

    return groups
      .filter((group) => group.complaints.length >= 2)
      .sort((a, b) => b.complaints.length - a.complaints.length)
      .slice(0, 4);
  }, [complaints]);

  const selectedComplaint =
    complaints.find((complaint) => complaint.id === selectedId) ?? null;

  return (
    <main className="min-h-screen bg-[#06080c] text-white">
      <div className="mx-auto max-w-[1500px] px-5 py-6 md:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xl font-black tracking-[0.22em]">
              CIVICLENS
            </div>
            <div className="mt-1 text-[10px] font-bold tracking-[0.2em] text-zinc-600">
              AUTHORITY CONTROL CENTER
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/"
              className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-bold tracking-widest text-zinc-400 transition hover:bg-white/[0.08]"
            >
              CITIZEN
            </a>
            <a
              href="/track"
              className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-bold tracking-widest text-zinc-400 transition hover:bg-white/[0.08]"
            >
              TRACK
            </a>
            <a
              href="/verify"
              className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-bold tracking-widest text-zinc-400 transition hover:bg-white/[0.08]"
            >
              VERIFY
            </a>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-black tracking-widest text-emerald-400">
              GEMMA 4
            </div>
          </div>
        </header>

        <section className="mb-7">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
            Live civic intelligence
          </div>
          <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                City incident command.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                Monitor reported civic issues, prioritize urgent incidents,
                route departments, and verify resolution with AI.
              </p>
            </div>

            <button
              onClick={loadComplaints}
              className="w-fit rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[10px] font-black tracking-widest text-zinc-300 transition hover:bg-white/[0.08]"
            >
              REFRESH DATA
            </button>
          </div>
        </section>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["TOTAL REPORTS", stats.total, "All registered incidents"],
            ["OPEN CASES", stats.open, "Require civic action"],
            ["HIGH PRIORITY", stats.urgent, "Severity 7 or above"],
            [
              "AI CONFIDENCE",
              `${Math.round(stats.averageConfidence * 100)}%`,
              "Average visual classification",
            ],
          ].map(([label, value, note]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
            >
              <div className="text-[9px] font-black tracking-[0.2em] text-zinc-600">
                {label}
              </div>
              <div className="mt-3 text-3xl font-black">{value}</div>
              <div className="mt-1 text-xs text-zinc-600">{note}</div>
            </div>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_0.45fr]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                  Incident map
                </div>
                <div className="mt-1 text-[10px] text-zinc-600">
                  {filteredComplaints.length} incidents visible
                </div>
              </div>

              <div className="flex items-center gap-3 text-[9px] font-bold tracking-widest text-zinc-600">
                <span>● 1–3</span>
                <span>● 4–6</span>
                <span>● 7–8</span>
                <span>● 9–10</span>
              </div>
            </div>

            <div className="h-[520px]">
              <MapView
                complaints={filteredComplaints}
                selectedId={selectedId}
                onSelect={(id: string) => setSelectedId(id)}
              />
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                Operations
              </div>

              <div className="mt-4 space-y-3">
                {[
                  ["Submitted", complaints.filter((c) => c.status === "Submitted").length],
                  ["Assigned", complaints.filter((c) => c.status === "Assigned").length],
                  ["In Progress", complaints.filter((c) => c.status === "In Progress").length],
                  ["Resolved", stats.resolved],
                ].map(([label, count]) => (
                  <button
                    key={label}
                    onClick={() =>
                      setFilter(label as "All" | ComplaintStatus)
                    }
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                      filter === label
                        ? "border-emerald-400/20 bg-emerald-400/5"
                        : "border-white/5 bg-black/10 hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className="text-xs text-zinc-400">{label}</span>
                    <span className="font-mono text-sm font-bold">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-orange-400/10 bg-orange-400/[0.025] p-5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300/70">
                  Hotspots
                </div>
                <div className="text-[9px] text-zinc-600">
                  clustered incidents
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {hotspots.length ? (
                  hotspots.map((hotspot, index) => (
                    <div
                      key={`${hotspot.latitude}-${hotspot.longitude}`}
                      className="rounded-xl border border-white/5 bg-black/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold">
                            Hotspot {String(index + 1).padStart(2, "0")}
                          </div>
                          <div className="mt-1 text-[10px] leading-4 text-zinc-600">
                            {hotspot.complaints[0].location?.displayName ??
                              "Incident cluster"}
                          </div>
                        </div>
                        <div className="rounded-full bg-orange-400/10 px-2 py-1 text-[9px] font-black text-orange-300">
                          {hotspot.complaints.length} CASES
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-3 text-xs text-zinc-600">
                    No multi-incident hotspots yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
              Issue distribution
            </div>

            <div className="mt-5 space-y-4">
              {issueDistribution.length ? (
                issueDistribution.map(([category, count]) => {
                  const width = Math.max(
                    10,
                    (count / Math.max(1, complaints.length)) * 100
                  );

                  return (
                    <div key={category}>
                      <div className="mb-1.5 flex justify-between gap-3 text-xs">
                        <span className="capitalize text-zinc-400">
                          {category}
                        </span>
                        <span className="font-mono text-zinc-600">
                          {count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-zinc-600">No data yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
              Department workload
            </div>

            <div className="mt-5 space-y-3">
              {departmentLoad.length ? (
                departmentLoad.map(([department, count]) => (
                  <div
                    key={department}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-black/10 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-zinc-300">
                        {department}
                      </div>
                      <div className="mt-1 text-[9px] uppercase tracking-widest text-zinc-700">
                        Active workload
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full bg-white/[0.05] px-2.5 py-1 font-mono text-xs font-bold">
                      {count}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-zinc-600">
                  No active department workload.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.035]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 p-5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                Incident queue
              </div>
              <div className="mt-1 text-sm font-bold">
                {filteredComplaints.length} visible complaints
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(
                    event.target.value as "All" | "High" | "Medium" | "Low"
                  )
                }
                className="rounded-xl border border-white/10 bg-[#0a0d12] px-3 py-2 text-[10px] font-bold text-zinc-400 outline-none"
              >
                <option value="All">ALL SEVERITIES</option>
                <option value="High">HIGH 7–10</option>
                <option value="Medium">MEDIUM 4–6</option>
                <option value="Low">LOW 1–3</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="max-w-[240px] rounded-xl border border-white/10 bg-[#0a0d12] px-3 py-2 text-[10px] font-bold text-zinc-400 outline-none"
              >
                <option value="All">ALL DEPARTMENTS</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  setFilter("All");
                  setSeverityFilter("All");
                  setDepartmentFilter("All");
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold text-zinc-500 hover:bg-white/[0.04]"
              >
                RESET
              </button>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="p-10 text-center text-xs uppercase tracking-widest text-zinc-600">
                Loading civic intelligence...
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-sm font-bold text-zinc-400">
                  No complaints match these filters.
                </div>
                <div className="mt-1 text-xs text-zinc-700">
                  Reset the filters to view the complete incident queue.
                </div>
              </div>
            ) : (
              filteredComplaints.map((complaint) => {
                const selected = complaint.id === selectedId;

                return (
                  <div
                    key={complaint.id}
                    className={`p-5 transition ${
                      selected ? "bg-emerald-400/[0.025]" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <button
                        onClick={() =>
                          setSelectedId(selected ? null : complaint.id)
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-1 text-[9px] font-black tracking-widest ${severityTone(
                              complaint.severity
                            )}`}
                          >
                            {severityLabel(complaint.severity)}{" "}
                            {complaint.severity}/10
                          </span>
                          <span
                            className={`rounded-full border px-2 py-1 text-[9px] font-black tracking-widest ${statusTone(
                              complaint.status
                            )}`}
                          >
                            {complaint.status.toUpperCase()}
                          </span>
                          {complaint.location && (
                            <span className="rounded-full border border-white/5 bg-white/[0.025] px-2 py-1 text-[8px] font-bold tracking-widest text-zinc-600">
                              {getLocationSourceLabel(
                                complaint.location.source
                              )}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 text-base font-bold text-zinc-200">
                          {complaint.title}
                        </div>

                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-600">
                          <span className="font-mono">{complaint.id}</span>
                          <span>{complaint.department}</span>
                          <span>{formatDate(complaint.createdAt)}</span>
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        {complaint.status === "Submitted" && (
                          <button
                            disabled={updatingId === complaint.id}
                            onClick={() =>
                              updateStatus(complaint.id, "Assigned")
                            }
                            className="rounded-xl border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-[9px] font-black tracking-widest text-violet-300 hover:bg-violet-400/10 disabled:opacity-40"
                          >
                            ASSIGN
                          </button>
                        )}

                        {complaint.status === "Assigned" && (
                          <button
                            disabled={updatingId === complaint.id}
                            onClick={() =>
                              updateStatus(complaint.id, "In Progress")
                            }
                            className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-3 py-2 text-[9px] font-black tracking-widest text-sky-300 hover:bg-sky-400/10 disabled:opacity-40"
                          >
                            START WORK
                          </button>
                        )}

                        {complaint.status === "In Progress" && (
                          <a
                            href="/verify"
                            className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-[9px] font-black tracking-widest text-emerald-300 hover:bg-emerald-400/10"
                          >
                            VERIFY RESOLUTION
                          </a>
                        )}

                        {complaint.location &&
                          getMapsUrl(complaint.location) && (
                            <a
                              href={getMapsUrl(complaint.location)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-white/10 px-3 py-2 text-[9px] font-black tracking-widest text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                            >
                              MAP
                            </a>
                          )}
                      </div>
                    </div>

                    {selected && (
                      <div className="mt-5 grid gap-4 border-t border-white/5 pt-5 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-700">
                            AI confidence
                          </div>
                          <div className="mt-2 text-2xl font-black">
                            {Math.round(complaint.confidence * 100)}%
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-emerald-400"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, complaint.confidence * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-700">
                            Location
                          </div>
                          <div className="mt-2 text-sm font-bold text-zinc-300">
                            {complaint.location?.displayName ??
                              "Location unavailable"}
                          </div>
                          {complaint.location && (
                            <div className="mt-2 font-mono text-[9px] text-zinc-700">
                              {complaint.location.latitude.toFixed(6)} ·{" "}
                              {complaint.location.longitude.toFixed(6)}
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-700">
                            Verification
                          </div>
                          <div className="mt-2 text-sm font-bold text-zinc-300">
                            {complaint.verification?.verdict ??
                              "Pending resolution verification"}
                          </div>
                          {complaint.verification && (
                            <div className="mt-1 text-[10px] text-zinc-600">
                              {Math.round(
                                complaint.verification.confidence * 100
                              )}
                              % verification confidence
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-white/5 bg-black/20 p-4 md:col-span-3">
                          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-700">
                            Visible issue
                          </div>
                          <p className="mt-2 text-sm leading-6 text-zinc-400">
                            {complaint.description}
                          </p>
                        </div>

                        {complaint.evidence?.length ? (
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 md:col-span-3">
                            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-700">
                              Evidence
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-3">
                              {complaint.evidence.map((item, index) => (
                                <div
                                  key={`${item}-${index}`}
                                  className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs leading-5 text-zinc-500"
                                >
                                  <span className="mr-2 font-mono text-emerald-400">
                                    0{index + 1}
                                  </span>
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <footer className="mt-8 border-t border-white/5 pt-5 text-[10px] uppercase tracking-[0.15em] text-zinc-700">
          CivicLens · Authority intelligence · Evidence first
        </footer>
      </div>
    </main>
  );
}
