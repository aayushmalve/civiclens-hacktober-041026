import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getComplaints, updateComplaint } from "@/lib/complaints";

const MODEL = "gemma-4-26b-a4b-it";

type VerificationResult = {
  verdict: "RESOLVED" | "PARTIALLY RESOLVED" | "NOT RESOLVED";
  confidence: number;
  summary: string;
  beforeEvidence: string[];
  afterEvidence: string[];
  comparison: string;
  remainingIssue: string;
  recommendation: string;
};

function cleanJson(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const formData = await request.formData();

    const complaintId = String(
      formData.get("complaintId") ?? ""
    ).trim();

    const beforeImage = formData.get("before");
    const afterImage = formData.get("after");

    if (!complaintId) {
      return NextResponse.json(
        { error: "Complaint ID is required" },
        { status: 400 }
      );
    }

    if (!(beforeImage instanceof File)) {
      return NextResponse.json(
        { error: "Before image is required" },
        { status: 400 }
      );
    }

    if (!(afterImage instanceof File)) {
      return NextResponse.json(
        { error: "After image is required" },
        { status: 400 }
      );
    }

    if (!beforeImage.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Before file must be an image" },
        { status: 400 }
      );
    }

    if (!afterImage.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "After file must be an image" },
        { status: 400 }
      );
    }

    const complaints = await getComplaints();

    const complaint = complaints.find(
      (item) => item.id === complaintId
    );

    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    const beforeBuffer = Buffer.from(
      await beforeImage.arrayBuffer()
    );

    const afterBuffer = Buffer.from(
      await afterImage.arrayBuffer()
    );

    const beforeBase64 = beforeBuffer.toString("base64");
    const afterBase64 = afterBuffer.toString("base64");

    const ai = new GoogleGenAI({
      apiKey,
    });

    const prompt = `
You are an evidence-based civic infrastructure resolution verifier.

You are given:
1. A BEFORE photo of a civic issue.
2. An AFTER photo supposedly showing the same location after repair.
3. The original complaint information.

Your job is to determine whether the visible civic issue was actually resolved.

ORIGINAL COMPLAINT:
Category: ${complaint.category}
Title: ${complaint.title}
Description: ${complaint.description}
Reported severity: ${complaint.severity}/10
Evidence:
${complaint.evidence.map((item) => `- ${item}`).join("\n")}

STRICT RULES:

- Compare only what is visibly shown.
- Do not assume hidden repairs.
- Do not claim underground infrastructure was repaired.
- Do not invent measurements.
- Do not invent materials.
- Do not claim legal compliance unless visibly demonstrated.
- Do not assume the two images are the same physical location unless visual evidence supports the comparison.
- If the images do not provide enough evidence, say so.
- Do not treat a different camera angle alone as proof of a different location.
- Look for visible changes to the reported problem.
- Identify whether the original visible problem remains.
- Distinguish genuine repair from cosmetic changes.
- Be conservative.
- Do not mark RESOLVED simply because the after image looks cleaner.
- If the issue is visibly improved but still present, use PARTIALLY RESOLVED.
- If the issue remains substantially unchanged, use NOT RESOLVED.
- Use RESOLVED only when the visible evidence strongly supports that the reported issue has been fixed.

Return ONLY valid JSON.

Required format:

{
  "verdict": "RESOLVED",
  "confidence": 0.0,
  "summary": "short explanation",
  "beforeEvidence": [
    "visible observation",
    "visible observation"
  ],
  "afterEvidence": [
    "visible observation",
    "visible observation"
  ],
  "comparison": "direct comparison of the before and after condition",
  "remainingIssue": "what remains, or 'No obvious visible issue remains.'",
  "recommendation": "what the authority should do next"
}

VERDICT MUST BE EXACTLY ONE OF:
- RESOLVED
- PARTIALLY RESOLVED
- NOT RESOLVED

CONFIDENCE MUST BE BETWEEN 0 AND 1.
`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                mimeType: beforeImage.type,
                data: beforeBase64,
              },
            },
            {
              inlineData: {
                mimeType: afterImage.type,
                data: afterBase64,
              },
            },
          ],
        },
      ],
    });

    const rawText = response.text ?? "";
    const parsed = JSON.parse(
      cleanJson(rawText)
    ) as VerificationResult;

    if (
      ![
        "RESOLVED",
        "PARTIALLY RESOLVED",
        "NOT RESOLVED",
      ].includes(parsed.verdict)
    ) {
      throw new Error("Invalid verification verdict");
    }

    const confidence = Math.min(
      1,
      Math.max(0, Number(parsed.confidence ?? 0))
    );

    const verification = {
      verdict: parsed.verdict,
      confidence,
      summary: parsed.summary ?? "",
      beforeEvidence: Array.isArray(parsed.beforeEvidence)
        ? parsed.beforeEvidence
        : [],
      afterEvidence: Array.isArray(parsed.afterEvidence)
        ? parsed.afterEvidence
        : [],
      comparison: parsed.comparison ?? "",
      remainingIssue: parsed.remainingIssue ?? "",
      recommendation: parsed.recommendation ?? "",
      verifiedAt: new Date().toISOString(),
    };

    const updatedComplaint = await updateComplaint(
      complaintId,
      {
        verification,
        status:
          parsed.verdict === "RESOLVED"
            ? "Resolved"
            : complaint.status,
      }
    );

    return NextResponse.json({
      success: true,
      complaint: updatedComplaint,
      verification,
    });
  } catch (error) {
    console.error("Resolution verification error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Resolution verification failed",
      },
      { status: 500 }
    );
  }
}
