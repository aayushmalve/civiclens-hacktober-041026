import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import {
  addComplaint,
  getComplaints,
} from "@/lib/complaints";

export const runtime = "nodejs";

function hashProof(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function GET() {
  try {
    const complaints = await getComplaints();
    return NextResponse.json({ complaints });
  } catch (error) {
    console.error("Complaint GET error:", error);
    return NextResponse.json({ error: "Failed to load complaints" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.title || !body.category || !body.id) {
      return NextResponse.json({ error: "Missing complaint information" }, { status: 400 });
    }

    // Complaint IDs are public, so never let a second submission update/claim an existing ID.
    const existing = (await getComplaints()).some((item) => item.id === String(body.id));
    if (existing) {
      return NextResponse.json({ error: "This complaint ID already exists. Create a new report instead." }, { status: 409 });
    }

    const rewardProof = typeof body.rewardProof === "string" ? body.rewardProof.trim() : "";
    let proofHash: string | null = null;
    let rewardSql: ReturnType<typeof neon> | null = null;
    if (rewardProof) {
      if (!/^[a-f0-9]{64}$/i.test(rewardProof)) {
        return NextResponse.json({ error: "Invalid demo rewards submission proof." }, { status: 400 });
      }
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
      }
      rewardSql = neon(databaseUrl);
      proofHash = hashProof(rewardProof);
      const matches = await rewardSql`SELECT token_hash FROM civiclens_demo_reward_report_tokens
        WHERE token_hash = ${proofHash} AND report_id = ${String(body.id)}
          AND consumed_at IS NULL AND expires_at > now() LIMIT 1` as Array<Record<string, unknown>>;
      if (!matches.length) {
        return NextResponse.json({ error: "The demo rewards submission proof is invalid, expired, or already used." }, { status: 403 });
      }
    }

    const complaint = await addComplaint({
      id: String(body.id),
      category: String(body.category),
      title: String(body.title),
      description: body.description ?? "",
      report: body.report ?? "",
      severity: Number(body.severity ?? 1),
      confidence: Number(body.confidence ?? 0),
      evidence: Array.isArray(body.evidence) ? body.evidence : [],
      risk: body.risk ?? "",
      recommendedAction: body.recommendedAction ?? "",
      department: body.department ?? "Municipal Civic Services Department",
      status: "Submitted",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      location: body.location ?? null,
    });

    let rewardProofAccepted = false;
    if (rewardSql && proofHash) {
      const consumed = await rewardSql`UPDATE civiclens_demo_reward_report_tokens
        SET consumed_at = now()
        WHERE token_hash = ${proofHash} AND report_id = ${String(body.id)}
          AND consumed_at IS NULL AND expires_at > now()
        RETURNING account_id` as Array<Record<string, unknown>>;
      rewardProofAccepted = consumed.length > 0;
    }

    return NextResponse.json({ success: true, complaint, rewardProofAccepted });
  } catch (error) {
    console.error("Complaint POST error:", error);
    return NextResponse.json({ error: "Failed to create complaint" }, { status: 500 });
  }
}
