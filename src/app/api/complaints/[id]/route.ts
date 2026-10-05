import { NextResponse } from "next/server";
import { updateComplaint } from "@/lib/complaints";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const allowedStatuses = [
      "Submitted",
      "Assigned",
      "In Progress",
      "Resolved",
    ];

    if (
      body.status &&
      !allowedStatuses.includes(body.status)
    ) {
      return NextResponse.json(
        { error: "Invalid complaint status" },
        { status: 400 }
      );
    }

    const complaint = await updateComplaint(id, {
      ...(body.status ? { status: body.status } : {}),
    });

    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      complaint,
    });
  } catch (error) {
    console.error("Complaint PATCH error:", error);

    return NextResponse.json(
      { error: "Failed to update complaint" },
      { status: 500 }
    );
  }
}
