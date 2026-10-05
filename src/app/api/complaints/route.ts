import { NextResponse } from "next/server";
import {
  addComplaint,
  getComplaints,
} from "@/lib/complaints";

export async function GET() {
  try {
    const complaints = await getComplaints();

    return NextResponse.json({
      complaints,
    });
  } catch (error) {
    console.error("Complaint GET error:", error);

    return NextResponse.json(
      { error: "Failed to load complaints" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.title || !body.category) {
      return NextResponse.json(
        { error: "Missing complaint information" },
        { status: 400 }
      );
    }

    const complaint = await addComplaint({
      id: body.id,
      category: body.category,
      title: body.title,
      description: body.description ?? "",
      report: body.report ?? "",
      severity: Number(body.severity ?? 1),
      confidence: Number(body.confidence ?? 0),
      evidence: Array.isArray(body.evidence)
        ? body.evidence
        : [],
      risk: body.risk ?? "",
      recommendedAction: body.recommendedAction ?? "",
      department:
        body.department ?? "Municipal Civic Services Department",
      status: "Submitted",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      location: body.location ?? null,
    });

    return NextResponse.json({
      success: true,
      complaint,
    });
  } catch (error) {
    console.error("Complaint POST error:", error);

    return NextResponse.json(
      { error: "Failed to create complaint" },
      { status: 500 }
    );
  }
}
