import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import * as exifr from "exifr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: "photo";
};

function isValidCoordinate(
  latitude: number,
  longitude: number
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

async function extractPhotoLocation(
  buffer: Buffer
): Promise<LocationData | null> {
  try {
    const gps = await exifr.gps(buffer);

    if (!gps) {
      return null;
    }

    const latitude = Number(gps.latitude);
    const longitude = Number(gps.longitude);

    if (!isValidCoordinate(latitude, longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
      accuracy: null,
      source: "photo",
    };
  } catch (error) {
    console.warn("EXIF GPS extraction failed:", error);
    return null;
  }
}

function cleanJsonResponse(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(text: string): string {
  const cleaned = cleanJsonResponse(text);

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("AI returned no valid JSON object.");
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function normaliseResult(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("AI returned an invalid result.");
  }

  const result = value as Record<string, unknown>;

  const category =
    typeof result.category === "string"
      ? result.category.trim()
      : "Unclear / No Civic Issue";

  const title =
    typeof result.title === "string"
      ? result.title.trim()
      : "Civic issue detected";

  const description =
    typeof result.description === "string"
      ? result.description.trim()
      : "Cannot be determined from the image.";

  const risk =
    typeof result.risk === "string"
      ? result.risk.trim()
      : "Cannot be determined from the image.";

  const recommendedAction =
    typeof result.recommendedAction === "string"
      ? result.recommendedAction.trim()
      : "Inspect the reported location.";

  const report =
    typeof result.report === "string"
      ? result.report.trim()
      : description;

  const severityNumber = Number(result.severity);
  const confidenceNumber = Number(result.confidence);

  const evidence = Array.isArray(result.evidence)
    ? result.evidence
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  while (evidence.length < 3) {
    evidence.push("Cannot be determined from the image.");
  }

  return {
    category,
    title,
    severity: Math.min(
      10,
      Math.max(
        1,
        Number.isFinite(severityNumber)
          ? Math.round(severityNumber)
          : 1
      )
    ),
    confidence: Math.min(
      1,
      Math.max(
        0,
        Number.isFinite(confidenceNumber)
          ? confidenceNumber
          : 0
      )
    ),
    description,
    evidence,
    risk,
    recommendedAction,
    report,
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing.");

      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured on the server.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          error: "No image file was provided.",
        },
        { status: 400 }
      );
    }

    if (image.size === 0) {
      return NextResponse.json(
        {
          error: "The uploaded image is empty.",
        },
        { status: 400 }
      );
    }

    /*
     * Browsers normally provide image/* MIME types.
     * Some formats such as HEIC/HEIF can arrive with unusual
     * or empty MIME metadata, so do not reject solely on MIME.
     */
    const filename = image.name.toLowerCase();

    const supportedExtension = /\.(jpg|jpeg|jpe|jfif|png|apng|gif|webp|avif|heic|heif|bmp|tif|tiff|svg|ico|jxl)$/i.test(
      filename
    );

    const isImage =
      image.type.startsWith("image/") ||
      supportedExtension;

    if (!isImage) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Please upload an image.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());

    if (buffer.length === 0) {
      return NextResponse.json(
        {
          error: "Unable to read the uploaded image.",
        },
        { status: 400 }
      );
    }

    /*
     * Some browsers do not provide a useful MIME type for
     * less common image formats. Give the model a sensible
     * MIME type rather than sending an empty value.
     */
    const mimeType =
      image.type && image.type.startsWith("image/")
        ? image.type
        : (() => {
            if (filename.endsWith(".jpg") ||
                filename.endsWith(".jpeg") ||
                filename.endsWith(".jpe") ||
                filename.endsWith(".jfif")) {
              return "image/jpeg";
            }

            if (
              filename.endsWith(".png") ||
              filename.endsWith(".apng")
            ) {
              return "image/png";
            }

            if (filename.endsWith(".webp")) {
              return "image/webp";
            }

            if (filename.endsWith(".gif")) {
              return "image/gif";
            }

            if (
              filename.endsWith(".heic")
            ) {
              return "image/heic";
            }

            if (
              filename.endsWith(".heif")
            ) {
              return "image/heif";
            }

            if (filename.endsWith(".avif")) {
              return "image/avif";
            }

            if (
              filename.endsWith(".bmp")
            ) {
              return "image/bmp";
            }

            if (
              filename.endsWith(".tif") ||
              filename.endsWith(".tiff")
            ) {
              return "image/tiff";
            }

            if (filename.endsWith(".svg")) {
              return "image/svg+xml";
            }

            return "image/png";
          })();

    const base64 = buffer.toString("base64");

    /*
     * EXIF GPS is extracted independently from AI.
     * The model never determines exact coordinates visually.
     */
    const photoLocation =
      await extractPhotoLocation(buffer);

    const prompt = `
You are CivicLens, an AI system for identifying civic infrastructure
and public-environment problems from photographs.

Analyze the provided image carefully and objectively.

Identify visible civic issues such as:
- pothole
- garbage/waste accumulation
- broken streetlight
- damaged road
- overflowing drain
- damaged public infrastructure
- water leakage
- traffic/signage problem
- construction hazard
- other visible public issue

IMPORTANT EVIDENCE RULES:

1. ONLY describe things that are directly visible or reasonably observable
   in the image.

2. DO NOT invent or assume:
   - underground utilities
   - exact structural causes
   - injuries
   - fatalities
   - legal violations
   - ownership
   - financial damage
   - hidden infrastructure
   - exact measurements
   - information outside the image

3. If something cannot be determined from the image, say:
   "Cannot be determined from the image."

4. Risk must be based only on visible conditions.

5. Do not exaggerate severity.

6. If the image contains a before/after comparison, explicitly recognize
   that it is a comparison and describe only what is visually apparent.

7. Evidence must contain concrete visual observations rather than assumptions.

8. Severity scale:
   - 1-2: Minor issue
   - 3-4: Low public impact
   - 5-6: Moderate civic issue
   - 7-8: Serious visible public hazard
   - 9-10: Critical visible hazard

9. NEVER assign severity 9 or 10 solely because harm is theoretically
   possible. A 9 or 10 requires clear visual evidence of a critical hazard.

10. Confidence represents confidence in the visible classification,
    NOT confidence about hidden consequences.

11. Never claim an exact location from visual appearance alone.
    Exact location is handled separately by CivicLens.

Return ONLY valid JSON.
Do not use markdown.
Do not use code fences.

Use exactly this structure:

{
  "category": "string",
  "title": "string",
  "severity": 1,
  "confidence": 0.0,
  "description": "string",
  "evidence": [
    "visible observation",
    "visible observation",
    "visible observation"
  ],
  "risk": "string",
  "recommendedAction": "string",
  "report": "string"
}

Rules:

- category: short issue category.
- title: concise description of the detected issue.
- severity: integer from 1 to 10.
- confidence: number from 0 to 1.
- description: concise factual explanation.
- evidence: exactly 3 concrete visual observations.
- risk: potential public risk based ONLY on visible conditions.
- recommendedAction: practical civic-authority action.
- report: professional civic complaint based only on visible evidence.

If there is no clear civic issue, classify it as:
"Unclear / No Civic Issue"
and explain why.
`;

    const ai = new GoogleGenAI({
      apiKey,
    });

    /*
     * IMPORTANT:
     * Image + prompt must be sent as PARTS of the SAME USER CONTENT.
     * The previous implementation sent them as separate content objects.
     */
    const response = await ai.models.generateContent({
      model: "gemma-4-26b-a4b-it",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    const responseText =
      typeof response.text === "string"
        ? response.text
        : "";

    if (!responseText.trim()) {
      console.error(
        "Gemma returned an empty response:",
        response
      );

      return NextResponse.json(
        {
          error:
            "Gemma returned an empty response. Please try another image.",
        },
        { status: 502 }
      );
    }

    console.log(
      "CivicLens Gemma response:",
      responseText.slice(0, 2000)
    );

    let parsed: unknown;

    try {
      const jsonText =
        extractJsonObject(responseText);

      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error(
        "Gemma JSON parsing failed:",
        parseError
      );
      console.error(
        "Raw Gemma response:",
        responseText
      );

      return NextResponse.json(
        {
          error:
            "Gemma analyzed the image but returned an invalid result. Please try again.",
          details:
            process.env.NODE_ENV === "development"
              ? responseText.slice(0, 1000)
              : undefined,
        },
        { status: 502 }
      );
    }

    const result = normaliseResult(parsed);

    return NextResponse.json({
      ...result,
      location: photoLocation,
    });
  } catch (error) {
    console.error(
      "CivicLens analysis error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    /*
     * Return the actual provider error during development
     * so failures are diagnosable instead of becoming the
     * useless generic "Failed to analyze image".
     */
    return NextResponse.json(
      {
        error: "AI image analysis failed.",
        details:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
      },
      { status: 500 }
    );
  }
}
