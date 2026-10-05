            
"use client";

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import * as exifr from "exifr";

type LocationSource = "photo" | "device" | "user";

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: LocationSource;
  displayName?: string;
};

type GeocodeResult = {
  latitude: number;
  longitude: number;
  displayName: string;
  type: string;
};

type AnalysisResult = {
  category: string;
  title: string;
  severity: number;
  confidence: number;
  description: string;
  evidence: string[];
  risk: string;
  recommendedAction: string;
  report: string;
  location: LocationData | null;
};

type Complaint = {
  id: string;
  category: string;
  title: string;
  severity: number;
  department: string;
  status: string;
  createdAt: string;
  location: LocationData | null;
};

type LocationStatus =
  | "idle"
  | "checking"
  | "success"
  | "approximate"
  | "error";

const departmentMap: Record<string, string> = {
  pothole: "Roads & Public Works Department",
  "damaged road": "Roads & Public Works Department",
  garbage: "Sanitation & Waste Management Department",
  waste: "Sanitation & Waste Management Department",
  "broken streetlight": "Electrical / Street Lighting Department",
  streetlight: "Electrical / Street Lighting Department",
  drain: "Drainage & Public Works Department",
  "overflowing drain": "Drainage & Public Works Department",
  "water leakage": "Water Supply Department",
  water: "Water Supply Department",
  signage: "Traffic & Road Safety Department",
  traffic: "Traffic & Road Safety Department",
  construction:
    "Public Works / Construction Safety Department",
  infrastructure: "Public Works Department",
};

function getDepartment(category: string): string {
  const normalized = category.toLowerCase();

  for (const [keyword, department] of Object.entries(
    departmentMap
  )) {
    if (normalized.includes(keyword)) {
      return department;
    }
  }

  return "Municipal Civic Services Department";
}

function generateComplaintId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase();

  return `CL-${timestamp}-${random}`;
}

function getMapsUrl(
  location: LocationData | null
): string | null {
  if (!location) return null;

  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function isPreciseLocation(
  location: LocationData | null
): boolean {
  if (!location) return false;

  if (
    location.source === "photo" ||
    location.source === "user"
  ) {
    return true;
  }

  return (
    location.accuracy !== null &&
    location.accuracy <= 150
  );
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

async function extractPhotoGps(
  file: File
): Promise<LocationData | null> {
  try {
    const gps = await exifr.gps(file);

    if (!gps) return null;

    const latitude = Number(gps.latitude);
    const longitude = Number(gps.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }

    return {
      latitude,
      longitude,
      accuracy: null,
      source: "photo",
    };
  } catch {
    return null;
  }
}

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);

  const [location, setLocation] =
    useState<LocationData | null>(null);

  const [detectedLocation, setDetectedLocation] =
    useState<LocationData | null>(null);

  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("idle");

  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<
    GeocodeResult[]
  >([]);

  const [searchingLocation, setSearchingLocation] =
    useState(false);

  const [analysis, setAnalysis] =
    useState<AnalysisResult | null>(null);

  const [complaint, setComplaint] =
    useState<Complaint | null>(null);

  const [civicPoints, setCivicPoints] =
    useState(0);

  const [pointsEarned, setPointsEarned] =
    useState(0);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] =
    useState(false);

  const [copied, setCopied] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const watchId = useRef<number | null>(null);
  const bestDeviceLocation =
    useRef<LocationData | null>(null);

  const photoLocationFound =
    useRef(false);

  useEffect(() => {
    const storedPoints = Number(
      window.localStorage.getItem(
        "civiclens_civic_points"
      ) ?? "0"
    );

    if (Number.isFinite(storedPoints)) {
      setCivicPoints(Math.max(0, storedPoints));
    }
  }, []);

  function awardCivicPoints(amount: number) {
    const safeAmount = Math.max(
      0,
      Math.round(amount)
    );

    const current = Number(
      window.localStorage.getItem(
        "civiclens_civic_points"
      ) ?? "0"
    );

    const next = Math.max(
      0,
      Number.isFinite(current)
        ? current + safeAmount
        : safeAmount
    );

    window.localStorage.setItem(
      "civiclens_civic_points",
      String(next)
    );

    setCivicPoints(next);
    setPointsEarned(safeAmount);
  }

  function getRewardLevel(points: number) {
    if (points >= 2500) {
      return {
        name: "CIVIC CHAMPION",
        next: null,
        progress: 100,
      };
    }

    if (points >= 1000) {
      return {
        name: "COMMUNITY GUARDIAN",
        next: 2500,
        progress: Math.round(
          ((points - 1000) / 1500) * 100
        ),
      };
    }

    if (points >= 500) {
      return {
        name: "CIVIC CONTRIBUTOR",
        next: 1000,
        progress: Math.round(
          ((points - 500) / 500) * 100
        ),
      };
    }

    if (points >= 100) {
      return {
        name: "CIVIC SCOUT",
        next: 500,
        progress: Math.round(
          ((points - 100) / 400) * 100
        ),
      };
    }

    return {
      name: "NEW CITIZEN",
      next: 100,
      progress: Math.round(
        (points / 100) * 100
      ),
    };
  }

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(
          watchId.current
        );
      }

      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  function stopLocationWatch() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(
        watchId.current
      );

      watchId.current = null;
    }
  }

  function startDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }

    setLocationStatus("checking");

    bestDeviceLocation.current = null;

    watchId.current =
      navigator.geolocation.watchPosition(
        (position) => {
          if (photoLocationFound.current) return;

          const nextLocation: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "device",
          };

          const previous =
            bestDeviceLocation.current;

          if (
            !previous ||
            previous.accuracy === null ||
            position.coords.accuracy <
              previous.accuracy
          ) {
            bestDeviceLocation.current =
              nextLocation;

            setDetectedLocation(nextLocation);
            setLocation(nextLocation);

            if (
              position.coords.accuracy <= 150
            ) {
              setLocationStatus("success");
              stopLocationWatch();
            } else {
              setLocationStatus("approximate");
            }
          }
        },
        () => {
          if (!photoLocationFound.current) {
            setLocationStatus("error");
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );

    window.setTimeout(() => {
      if (
        watchId.current !== null &&
        !photoLocationFound.current
      ) {
        stopLocationWatch();

        if (bestDeviceLocation.current) {
          setDetectedLocation(
            bestDeviceLocation.current
          );

          setLocation(
            bestDeviceLocation.current
          );

          if (
            bestDeviceLocation.current
              .accuracy !== null &&
            bestDeviceLocation.current
              .accuracy <= 150
          ) {
            setLocationStatus("success");
          } else {
            setLocationStatus("approximate");
          }
        }
      }
    }, 30000);
  }

  function isImageFile(file: File): boolean {
    if (file.type.startsWith("image/")) return true;

    const extension = file.name
      .split(".")
      .pop()
      ?.toLowerCase();

    return [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
      "bmp",
      "tif",
      "tiff",
      "avif",
      "heic",
      "heif",
      "svg",
    ].includes(extension ?? "");
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) return;

    if (!isImageFile(file)) {
      setError("Please drop a supported image file.");
      return;
    }

    await handleImage(file);
  }

  async function handleImage(file: File) {
    setImage(file);
    setAnalysis(null);
    setComplaint(null);
    setError(null);
    setCopied(false);

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPreview(URL.createObjectURL(file));

    photoLocationFound.current = false;

    stopLocationWatch();

    setLocation(null);
    setDetectedLocation(null);

    setLocationQuery("");
    setLocationResults([]);

    setLocationStatus("checking");

    const photoGps =
      await extractPhotoGps(file);

    if (photoGps) {
      photoLocationFound.current = true;

      setDetectedLocation(photoGps);
      setLocation(photoGps);

      setLocationStatus("success");

      return;
    }

    startDeviceLocation();
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    await handleImage(file);
  }

  async function searchLocation() {
  const query = locationQuery.trim();

  if (!query) {
    setError("Enter an address or landmark first.");
    return;
  }

  setSearchingLocation(true);
  setError("");

  try {
    const response = await fetch(
      `/api/geocode?q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ?? "Unable to find that location"
      );
    }

    setLocationResults(data.results ?? []);
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Unable to find that location"
    );
  } finally {
    setSearchingLocation(false);
  }
}
  function confirmLocation(
    result: GeocodeResult
  ) {
    stopLocationWatch();

    const confirmedLocation: LocationData = {
      latitude: result.latitude,
      longitude: result.longitude,
      accuracy: null,
      source: "user",
      displayName: result.displayName,
    };

    setLocation(confirmedLocation);
    setLocationStatus("success");
    setLocationResults([]);
    setLocationQuery(result.displayName);
  }

  function useDetectedLocation() {
    if (!detectedLocation) return;

    setLocation(detectedLocation);
    setLocationQuery("");
    setLocationResults([]);

    if (
      detectedLocation.source === "photo"
    ) {
      setLocationStatus("success");
      return;
    }

    if (
      detectedLocation.accuracy !== null &&
      detectedLocation.accuracy <= 150
    ) {
      setLocationStatus("success");
    } else {
      setLocationStatus("approximate");
    }
  }

  async function analyzeImage() {
    if (!image) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setComplaint(null);

    try {
      const formData = new FormData();

      formData.append("image", image);

      const response = await fetch(
        "/api/analyze",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to analyze image"
        );
      }

      /*
       * Only replace the current location with
       * server EXIF GPS if the user has NOT
       * manually confirmed a location.
       */
      if (
        data.location &&
        location?.source !== "user"
      ) {
        const serverLocation: LocationData =
          data.location;

        setDetectedLocation(
          serverLocation
        );

        setLocation(serverLocation);

        setLocationStatus("success");

        if (
          serverLocation.source === "photo"
        ) {
          photoLocationFound.current =
            true;

          stopLocationWatch();
        }
      }

      setAnalysis(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the image."
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyReport() {
    if (!analysis) return;

    try {
      await navigator.clipboard.writeText(
        analysis.report
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError("Unable to copy the report.");
    }
  }

  async function submitComplaint() {
    if (!analysis) return;

    if (!isPreciseLocation(location)) {
      setError(
        "Please confirm the incident location before submitting the complaint."
      );

      return;
    }

    setSubmitting(true);
    setError(null);

    const complaintId =
      generateComplaintId();

    const department =
      getDepartment(analysis.category);

    try {
      const response = await fetch(
        "/api/complaints",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: complaintId,
            category: analysis.category,
            title: analysis.title,
            description:
              analysis.description,
            report: analysis.report,
            severity: analysis.severity,
            confidence:
              analysis.confidence,
            evidence:
              analysis.evidence,
            risk: analysis.risk,
            recommendedAction:
              analysis.recommendedAction,
            department,
            location,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to submit complaint."
        );
      }

      const savedComplaint =
        data.complaint;

      setComplaint({
        id: savedComplaint.id,
        category:
          savedComplaint.category,
        title: savedComplaint.title,
        severity:
          savedComplaint.severity,
        department:
          savedComplaint.department,
        status:
          savedComplaint.status,
        createdAt:
          savedComplaint.createdAt,
        location:
          savedComplaint.location,
      });

      // Reward verified civic impact, not volume:
      // 5 points for a new accepted report,
      // 2 points when the system links it to
      // an existing nearby issue.
      awardCivicPoints(
        data.duplicate ? 2 : 5
      );

      if (data.duplicate) {
        setError(
          "A similar unresolved civic issue already exists nearby. Your report was linked to the existing complaint."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit civic complaint."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const preciseLocation =
    isPreciseLocation(location);

  const googleMapsLink =
    getMapsUrl(location);

  const rewardLevel =
    getRewardLevel(civicPoints);

  const severityLabel =
    analysis?.severity !== undefined
      ? analysis.severity >= 9
        ? "CRITICAL"
        : analysis.severity >= 7
          ? "SERIOUS"
          : analysis.severity >= 5
            ? "MODERATE"
            : analysis.severity >= 3
              ? "LOW"
              : "MINOR"
      : "";

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        <header className="mb-14 flex items-center justify-between">
          <div>
            <div className="text-xl font-black tracking-[0.22em]">
              CIVICLENS
            </div>

            <div className="mt-1 text-[10px] font-bold tracking-[0.2em] text-zinc-500">
              CIVIC INTELLIGENCE
            </div>
          </div>

          <div className="flex items-center gap-3">
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

            <a
              href="/rewards"
              className="rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 text-[10px] font-black tracking-widest text-amber-300 hover:bg-amber-400/10"
            >
              {civicPoints} POINTS
            </a>

            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold tracking-widest text-zinc-400">
              GEMMA 4
            </div>
          </div>
        </header>

        <section className="mb-12 max-w-3xl">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
            Photograph → Intelligence → Action
          </div>

          <h1 className="text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
            Turn civic problems
            <br />
            into action.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 md:text-lg">
            Upload a photograph of a public problem.
            CivicLens identifies the issue, assesses
            visible severity, confirms the location,
            routes it to the right civic department,
            and prepares a submission-ready complaint.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-7">
            {!preview ? (
              <label
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex min-h-[420px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed text-center transition ${
                  isDragging
                    ? "border-emerald-400 bg-emerald-400/[0.06]"
                    : "border-white/15 bg-black/20 hover:border-emerald-400/50 hover:bg-white/[0.025]"
                }`}
              >
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-2xl">
                  +
                </div>

                <div className="text-lg font-bold">
                  Upload civic issue
                </div>

                <div className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  Take a photo or choose an
                  existing image. CivicLens will
                  automatically detect its location
                  when possible.
                </div>

                <div className="mt-6 rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-zinc-400">
                  {isDragging ? "DROP IMAGE HERE" : "SELECT IMAGE"}
                </div>

                <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-700">
                  or drag & drop · JPG · PNG · WEBP · AVIF · HEIC · GIF
                </div>

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div>
                <div className="relative overflow-hidden rounded-2xl bg-black">
                  <img
                    src={preview}
                    alt="Selected civic issue"
                    className="max-h-[520px] w-full object-contain"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <label className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold tracking-wide text-zinc-300 hover:bg-white/[0.08]">
                    CHANGE PHOTO

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={analyzeImage}
                    disabled={loading}
                    className="rounded-xl bg-white px-5 py-3 text-xs font-black tracking-wide text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading
                      ? "ANALYZING..."
                      : "ANALYZE WITH AI"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Location
                </span>

                <span
                  className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-widest ${
                    location?.source === "user"
                      ? "bg-sky-400/10 text-sky-400"
                      : preciseLocation
                        ? "bg-emerald-400/10 text-emerald-400"
                        : location
                          ? "bg-yellow-400/10 text-yellow-400"
                          : "bg-white/5 text-zinc-500"
                  }`}
                >
                  {location?.source === "user"
                    ? "USER CONFIRMED"
                    : preciseLocation
                      ? "PRECISE"
                      : location
                        ? "APPROXIMATE"
                        : "NOT FOUND"}
                </span>
              </div>

              {locationStatus ===
                "checking" && (
                <div className="text-sm text-zinc-400">
                  Automatically detecting
                  location...
                </div>
              )}

              {location && (
                <div>
                  {location.displayName && (
                    <div className="mb-4 rounded-xl border border-sky-400/10 bg-sky-400/5 p-3">
                      <div className="text-[9px] uppercase tracking-widest text-zinc-600">
                        Confirmed Place
                      </div>

                      <div className="mt-1 text-sm leading-5 text-zinc-300">
                        {location.displayName}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[9px] uppercase tracking-widest text-zinc-600">
                        Latitude
                      </div>

                      <div className="mt-1 font-mono text-sm">
                        {formatCoordinate(
                          location.latitude
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[9px] uppercase tracking-widest text-zinc-600">
                        Longitude
                      </div>

                      <div className="mt-1 font-mono text-sm">
                        {formatCoordinate(
                          location.longitude
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-zinc-500">
                    Source:{" "}
                    <span className="font-semibold text-zinc-300">
                      {location.source ===
                      "photo"
                        ? "Camera GPS / EXIF"
                        : location.source ===
                            "device"
                          ? "Device GPS"
                          : "User Confirmed"}
                    </span>
                  </div>

                  {location.accuracy !==
                    null &&
                    location.source ===
                      "device" && (
                      <div className="mt-1 text-xs text-zinc-500">
                        Accuracy:{" "}
                        <span className="font-mono text-zinc-300">
                          ±
                          {Math.round(
                            location.accuracy
                          )}{" "}
                          m
                        </span>
                      </div>
                    )}

                  {googleMapsLink && (
                    <a
                      href={googleMapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 block rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-center text-xs font-bold text-emerald-400 transition hover:bg-emerald-400/10"
                    >
                      OPEN LOCATION IN GOOGLE MAPS
                    </a>
                  )}
                </div>
              )}

              <div className="mt-6 border-t border-white/5 pt-5">
                <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  Confirm Location
                </div>

                <p className="mb-3 text-xs leading-5 text-zinc-600">
                  If automatic location is incorrect,
                  search for the exact address, road,
                  landmark, or place where the issue
                  occurred.
                </p>

                <div className="flex gap-2">
                  <input
                    value={locationQuery}
                    onChange={(event) =>
                      setLocationQuery(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter"
                      ) {
                        searchLocation();
                      }
                    }}
                    placeholder="Search exact address or landmark..."
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white outline-none placeholder:text-zinc-700 focus:border-sky-400/40"
                  />

                  <button
                      type="button"
                      onClick={searchLocation}
                    className="rounded-xl bg-white px-4 py-3 text-[10px] font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {searchingLocation
                      ? "..."
                      : "SEARCH"}
                  </button>
                </div>

                {locationResults.length >
                  0 && (
                  <div className="mt-3 space-y-2">
                    {locationResults.map(
                      (result, index) => (
                        <button
                          key={`${result.latitude}-${result.longitude}-${index}`}
                          onClick={() =>
                            confirmLocation(
                              result
                            )
                          }
                          className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-left transition hover:border-sky-400/30 hover:bg-sky-400/5"
                        >
                          <div className="text-xs font-semibold leading-5 text-zinc-300">
                            {result.displayName}
                          </div>

                          <div className="mt-1 font-mono text-[9px] text-zinc-700">
                            {formatCoordinate(
                              result.latitude
                            )}
                            {" · "}
                            {formatCoordinate(
                              result.longitude
                            )}
                          </div>
                        </button>
                      )
                    )}
                  </div>
                )}

                {detectedLocation &&
                  location?.source ===
                    "user" && (
                    <button
                      onClick={
                        useDetectedLocation
                      }
                      className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] font-bold tracking-wide text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
                    >
                      USE AUTOMATICALLY DETECTED
                      LOCATION
                    </button>
                  )}
              </div>

              {!location &&
                locationStatus ===
                  "error" && (
                  <div className="mt-4 rounded-xl border border-yellow-400/10 bg-yellow-400/5 p-3 text-xs leading-5 text-yellow-300/80">
                    Automatic location was
                    unavailable. Use the Confirm
                    Location search above to select
                    the exact incident location.
                  </div>
                )}

              {location &&
                !preciseLocation && (
                  <div className="mt-4 rounded-xl border border-yellow-400/10 bg-yellow-400/5 p-3 text-xs leading-5 text-yellow-300/80">
                    Automatic GPS is not accurate
                    enough. Please confirm the exact
                    location above before submitting.
                  </div>
                )}

              {location?.source === "user" && (
                <div className="mt-4 rounded-xl border border-sky-400/15 bg-sky-400/5 p-3 text-xs leading-5 text-sky-300/80">
                  This location was explicitly
                  confirmed by the citizen and will
                  be used for the civic complaint.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                Pipeline
              </div>

              <div className="space-y-3 text-sm">
                {[
                  ["01", "Photo evidence"],
                  ["02", "Gemma 4 analysis"],
                  ["03", "Location detection"],
                  ["04", "Citizen confirmation"],
                  ["05", "Department routing"],
                  ["06", "Civic complaint"],
                ].map(
                  ([number, label]) => (
                    <div
                      key={number}
                      className="flex items-center gap-3"
                    >
                      <span className="font-mono text-[10px] text-zinc-700">
                        {number}
                      </span>

                      <span className="text-zinc-400">
                        {label}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {analysis && (
          <section className="mt-10">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
                  AI Assessment
                </div>

                <h2 className="mt-2 text-2xl font-black">
                  {analysis.title}
                </h2>
              </div>

              <div className="text-right">
                <div className="text-3xl font-black">
                  {analysis.severity}
                  <span className="text-sm text-zinc-600">
                    /10
                  </span>
                </div>

                <div className="text-[9px] font-black tracking-widest text-zinc-500">
                  {severityLabel}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  Issue
                </div>

                <div className="text-lg font-bold">
                  {analysis.category}
                </div>

                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  {analysis.description}
                </p>

                <div className="mt-5">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                    Confidence
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            analysis.confidence *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 text-xs text-zinc-500">
                    {Math.round(
                      analysis.confidence *
                        100
                    )}
                    % visual classification
                    confidence
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  Visual Evidence
                </div>

                <div className="space-y-3">
                  {analysis.evidence.map(
                    (item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="flex gap-3 text-sm leading-6 text-zinc-400"
                      >
                        <span className="font-mono text-emerald-400">
                          0{index + 1}
                        </span>

                        <span>{item}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  Public Risk
                </div>

                <p className="text-sm leading-6 text-zinc-400">
                  {analysis.risk}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  Recommended Action
                </div>

                <p className="text-sm leading-6 text-zinc-400">
                  {analysis.recommendedAction}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                    Ready-to-submit complaint
                  </div>

                  <div className="mt-1 text-lg font-bold">
                    Civic Report
                  </div>
                </div>

                <button
                  onClick={copyReport}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5"
                >
                  {copied
                    ? "COPIED"
                    : "COPY"}
                </button>
              </div>

              <div className="rounded-2xl bg-black/30 p-5 text-sm leading-7 text-zinc-400">
                {analysis.report}
              </div>
            </div>

            {!complaint && (
              <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.035] p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                      Next step
                    </div>

                    <div className="mt-2 text-xl font-black">
                      Submit this civic issue
                    </div>

                    <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                      The confirmed location,
                      evidence, severity and AI report
                      will be attached to the civic
                      complaint.
                    </p>
                  </div>

                  <button
                    onClick={
                      submitComplaint
                    }
                    disabled={
                      !preciseLocation ||
                      submitting
                    }
                    className="shrink-0 rounded-xl bg-emerald-400 px-6 py-3 text-xs font-black tracking-wide text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                  >
                    {submitting
                      ? "SUBMITTING..."
                      : preciseLocation
                        ? "SUBMIT CIVIC COMPLAINT"
                        : "CONFIRM LOCATION FIRST"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {complaint && (
          <section className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.035] p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                  Complaint Submitted
                </div>

                <h2 className="mt-2 text-2xl font-black">
                  Your civic issue is registered.
                </h2>
              </div>

              <div className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-[9px] font-black tracking-widest text-emerald-400">
                {complaint.status.toUpperCase()}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[9px] uppercase tracking-widest text-zinc-600">
                  Complaint ID
                </div>

                <div className="mt-2 font-mono text-sm font-bold text-emerald-400">
                  {complaint.id}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[9px] uppercase tracking-widest text-zinc-600">
                  Department
                </div>

                <div className="mt-2 text-sm font-bold">
                  {complaint.department}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[9px] uppercase tracking-widest text-zinc-600">
                  Severity
                </div>

                <div className="mt-2 text-sm font-bold">
                  {complaint.severity}/10
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[9px] uppercase tracking-widest text-zinc-600">
                  Location
                </div>

                <div className="mt-2 text-sm font-bold">
                  {complaint.location
                    ?.source === "user"
                    ? "User Confirmed"
                    : "Automatically Detected"}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                    Civic Rewards
                  </div>

                  <div className="mt-2 text-2xl font-black text-white">
                    +{pointsEarned} Civic Points
                  </div>

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {pointsEarned >= 5
                      ? "You earned Civic Points for making a meaningful report. Verified impact can unlock higher rewards."
                      : "This report matched an existing issue, so you received a smaller participation reward."}
                  </p>
                </div>

                <div className="min-w-[220px]">
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.16em]">
                    <span className="text-zinc-600">
                      {rewardLevel.name}
                    </span>
                    <span className="text-amber-300">
                      {civicPoints} pts
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-amber-300 transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            rewardLevel.progress
                          )
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 text-[9px] uppercase tracking-[0.12em] text-zinc-600">
                    {rewardLevel.next
                      ? `${rewardLevel.next - civicPoints} points to next badge`
                      : "Highest CivicLens badge unlocked"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.035] p-4">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">
                What your points can become
              </div>
              <div className="mt-2 text-xs leading-5 text-zinc-400">
                Civic Points are designed to unlock partner discounts,
                civic badges and community recognition. Example launch
                rewards: 500 pts → ₹50 partner voucher · 1,000 pts →
                ₹100 voucher · 2,500 pts → Civic Champion certificate.
              </div>
              <a
                href="/rewards"
                className="mt-3 inline-block text-[10px] font-black uppercase tracking-[0.14em] text-amber-300 hover:text-amber-200"
              >
                VIEW REWARD CATALOGUE →
              </a>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {getMapsUrl(
                complaint.location
              ) && (
                <a
                  href={getMapsUrl(
                    complaint.location
                  )!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-white/[0.08]"
                >
                  VIEW INCIDENT LOCATION
                </a>
              )}

              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    complaint.id
                  );
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-white/[0.08]"
              >
                COPY COMPLAINT ID
              </button>

              <a
                href="/dashboard"
                className="rounded-xl bg-emerald-400 px-4 py-3 text-xs font-black text-black hover:bg-emerald-300"
              >
                OPEN AUTHORITY DASHBOARD
              </a>

              <a
                href="/rewards"
                className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs font-black text-amber-300 hover:bg-amber-400/10"
              >
                VIEW CIVIC REWARDS
              </a>
            </div>
          </section>
        )}

        <footer className="mt-16 border-t border-white/5 pt-6 text-xs text-zinc-700">
          CivicLens · AI-assisted civic reporting · Evidence first
        </footer>
      </div>
    </main>
  );
}

