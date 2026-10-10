"use client";

import CivicLensHeader from "@/components/CivicLensHeader";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";

type Complaint = {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: number;
  department: string;
  status:
    | "Submitted"
    | "Assigned"
    | "In Progress"
    | "Resolved";
  verification?: Verification;
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

const verdictStyles = {
  RESOLVED:
    "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  "PARTIALLY RESOLVED":
    "border-amber-400/30 bg-amber-400/10 text-amber-300",
  "NOT RESOLVED":
    "border-red-400/30 bg-red-400/10 text-red-300",
};

export default function VerifyPage() {
  const [complaints, setComplaints] = useState<Complaint[]>(
    []
  );

  const [selectedId, setSelectedId] =
    useState("");

  const [before, setBefore] =
    useState<File | null>(null);

  const [after, setAfter] =
    useState<File | null>(null);

  const [beforePreview, setBeforePreview] =
    useState("");

  const [afterPreview, setAfterPreview] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] =
    useState<Verification | null>(null);

  useEffect(() => {
    async function loadComplaints() {
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
            data.error ?? "Failed to load complaints"
          );
        }

        setComplaints(data.complaints ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load complaints"
        );
      } finally {
        setLoading(false);
      }
    }

    loadComplaints();
  }, []);

  function handleImage(
    file: File | null,
    type: "before" | "after"
  ) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    setError("");

    const preview = URL.createObjectURL(file);

    if (type === "before") {
      setBefore(file);
      setBeforePreview(preview);
    } else {
      setAfter(file);
      setAfterPreview(preview);
    }
  }

  function handleBefore(
    event: ChangeEvent<HTMLInputElement>
  ) {
    handleImage(
      event.target.files?.[0] ?? null,
      "before"
    );
  }

  function handleAfter(
    event: ChangeEvent<HTMLInputElement>
  ) {
    handleImage(
      event.target.files?.[0] ?? null,
      "after"
    );
  }

  async function verifyResolution(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!selectedId) {
      setError("Select a complaint first.");
      return;
    }

    if (!before) {
      setError("Upload the before photo.");
      return;
    }

    if (!after) {
      setError("Upload the after photo.");
      return;
    }

    setError("");
    setResult(null);
    setVerifying(true);

    try {
      const formData = new FormData();

      formData.append(
        "complaintId",
        selectedId
      );

      formData.append("before", before);
      formData.append("after", after);

      const response = await fetch(
        "/api/verify",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Resolution verification failed"
        );
      }

      setResult(data.verification);

      setComplaints((current) =>
        current.map((complaint) =>
          complaint.id === selectedId
            ? {
                ...complaint,
                status:
                  data.verification.verdict ===
                  "RESOLVED"
                    ? "Resolved"
                    : complaint.status,
                verification:
                  data.verification,
              }
            : complaint
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Resolution verification failed"
      );
    } finally {
      setVerifying(false);
    }
  }

  const selectedComplaint =
    complaints.find(
      (complaint) =>
        complaint.id === selectedId
    ) ?? null;

  const unresolvedComplaints =
    complaints.filter(
      (complaint) =>
        complaint.status !== "Resolved"
    );

  return (
    <main className="cl-interior cl-interior-verify">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <CivicLensHeader active="authority" />

        {error && (
          <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                01
              </div>

              <h2 className="mt-1 text-xl font-bold">
                Select complaint
              </h2>
            </div>

            {loading ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/40">
                Loading complaints...
              </div>
            ) : (
              <select
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(
                    event.target.value
                  );
                  setResult(null);
                  setError("");
                }}
                className="w-full rounded-xl border border-white/10 bg-[#101218] px-4 py-3 text-sm outline-none focus:border-white/30"
              >
                <option value="">
                  Select an unresolved complaint
                </option>

                {unresolvedComplaints.map(
                  (complaint) => (
                    <option
                      key={complaint.id}
                      value={complaint.id}
                    >
                      {complaint.id} —{" "}
                      {complaint.title}
                    </option>
                  )
                )}
              </select>
            )}

            {selectedComplaint && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-white/35">
                      {selectedComplaint.category}
                    </div>

                    <div className="mt-1 font-bold">
                      {selectedComplaint.title}
                    </div>

                    <div className="mt-2 text-sm leading-6 text-white/50">
                      {selectedComplaint.description}
                    </div>
                  </div>

                  <div className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-center">
                    <div className="text-[10px] uppercase text-white/30">
                      Severity
                    </div>

                    <div className="font-black">
                      {selectedComplaint.severity}/10
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-white/50">
                    {selectedComplaint.department}
                  </span>

                  <span className="rounded-full border border-white/10 px-3 py-1 text-white/50">
                    {selectedComplaint.status}
                  </span>
                </div>
              </div>
            )}

            <div className="mb-5 mt-8">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                02
              </div>

              <h2 className="mt-1 text-xl font-bold">
                Evidence
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="group cursor-pointer">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">
                  Before repair
                </div>

                <div className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/20 transition group-hover:border-white/40">
                  {beforePreview ? (
                    <img
                      src={beforePreview}
                      alt="Before repair"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-white/30">
                      <span className="text-3xl">
                        +
                      </span>

                      <span className="text-xs">
                        Upload photo
                      </span>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBefore}
                    className="hidden"
                  />
                </div>
              </label>

              <label className="group cursor-pointer">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">
                  After repair
                </div>

                <div className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/20 transition group-hover:border-white/40">
                  {afterPreview ? (
                    <img
                      src={afterPreview}
                      alt="After repair"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-white/30">
                      <span className="text-3xl">
                        +
                      </span>

                      <span className="text-xs">
                        Upload photo
                      </span>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAfter}
                    className="hidden"
                  />
                </div>
              </label>
            </div>

            <button
              type="button"
              disabled={
                verifying ||
                !selectedId ||
                !before ||
                !after
              }
              onClick={verifyResolution}
              className="mt-6 w-full rounded-xl bg-white px-5 py-4 text-sm font-black uppercase tracking-wider text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {verifying
                ? "Gemma is comparing evidence..."
                : "Verify Resolution"}
            </button>

            <div className="mt-3 text-center text-[11px] text-white/30">
              AI verification uses visible evidence only.
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                03
              </div>

              <h2 className="mt-1 text-xl font-bold">
                AI verification result
              </h2>
            </div>

            {!result ? (
              <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10">
                <div className="max-w-sm text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl">
                    AI
                  </div>

                  <h3 className="font-bold text-white/70">
                    Awaiting evidence
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-white/35">
                    Select a complaint and upload both
                    before and after photos to generate
                    an evidence-based resolution assessment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div
                  className={`rounded-2xl border p-6 ${
                    verdictStyles[
                      result.verdict
                    ]
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">
                    Gemma verdict
                  </div>

                  <div className="mt-2 text-4xl font-black tracking-tight">
                    {result.verdict}
                  </div>

                  <div className="mt-3 text-sm leading-6 opacity-80">
                    {result.summary}
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-xs opacity-60">
                      <span>AI confidence</span>
                      <span>
                        {Math.round(
                          result.confidence * 100
                        )}
                        %
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-black/30">
                      <div
                        className="h-full rounded-full bg-current"
                        style={{
                          width: `${Math.round(
                            result.confidence *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <EvidenceCard
                    title="Before"
                    items={result.beforeEvidence}
                  />

                  <EvidenceCard
                    title="After"
                    items={result.afterEvidence}
                  />
                </div>

                <InfoCard
                  title="Before vs After"
                  text={result.comparison}
                />

                <InfoCard
                  title="Remaining issue"
                  text={result.remainingIssue}
                />

                <InfoCard
                  title="Recommended action"
                  text={result.recommendation}
                />

                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-white/30">
                  Verified{" "}
                  {new Date(
                    result.verifiedAt
                  ).toLocaleString()}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function EvidenceCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-5">
      <h3 className="mb-4 font-bold">
        {title} evidence
      </h3>

      <ul className="space-y-3">
        {items.length === 0 ? (
          <li className="text-sm text-white/35">
            No specific evidence returned.
          </li>
        ) : (
          items.map((item, index) => (
            <li
              key={index}
              className="flex gap-3 text-sm leading-6 text-white/55"
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
              {item}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function InfoCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-5">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/35">
        {title}
      </div>

      <p className="text-sm leading-7 text-white/60">
        {text}
      </p>
    </div>
  );
}
