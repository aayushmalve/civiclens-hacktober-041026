import { neon } from "@neondatabase/serverless";

export type ComplaintLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: "photo" | "device" | "user";
  displayName?: string;
};

export type ComplaintVerification = {
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

export type Complaint = {
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
  location: ComplaintLocation | null;
  verification?: ComplaintVerification;
};

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(databaseUrl);
}

function mapComplaint(row: Record<string, unknown>): Complaint {
  return {
    id: String(row.id),
    category: String(row.category),
    title: String(row.title),
    description: String(row.description ?? ""),
    report: String(row.report ?? ""),
    severity: Number(row.severity ?? 1),
    confidence: Number(row.confidence ?? 0),
    evidence: Array.isArray(row.evidence)
      ? (row.evidence as string[])
      : [],
    risk: String(row.risk ?? ""),
    recommendedAction: String(
      row.recommended_action ?? ""
    ),
    department: String(
      row.department ??
        "Municipal Civic Services Department"
    ),
    status: String(
      row.status ?? "Submitted"
    ) as Complaint["status"],
    createdAt: new Date(
      String(row.created_at)
    ).toISOString(),
    updatedAt: new Date(
      String(row.updated_at)
    ).toISOString(),
    location:
      row.location &&
      typeof row.location === "object"
        ? (row.location as ComplaintLocation)
        : null,
    verification:
      row.verification &&
      typeof row.verification === "object"
        ? (row.verification as ComplaintVerification)
        : undefined,
  };
}

export async function getComplaints(): Promise<Complaint[]> {
  const sql = getDatabase();

  const rows = await sql`
    SELECT
      id,
      category,
      title,
      description,
      report,
      severity,
      confidence,
      evidence,
      risk,
      recommended_action,
      department,
      status,
      created_at,
      updated_at,
      location,
      verification
    FROM complaints
    ORDER BY created_at DESC
  `;

  return rows.map((row) =>
    mapComplaint(row as Record<string, unknown>)
  );
}

export async function saveComplaints(
  complaints: Complaint[]
): Promise<void> {
  const sql = getDatabase();

  await sql`DELETE FROM complaints`;

  for (const complaint of complaints) {
    await sql`
      INSERT INTO complaints (
        id,
        category,
        title,
        description,
        report,
        severity,
        confidence,
        evidence,
        risk,
        recommended_action,
        department,
        status,
        created_at,
        updated_at,
        location,
        verification
      )
      VALUES (
        ${complaint.id},
        ${complaint.category},
        ${complaint.title},
        ${complaint.description},
        ${complaint.report},
        ${complaint.severity},
        ${complaint.confidence},
        ${JSON.stringify(complaint.evidence)}::jsonb,
        ${complaint.risk},
        ${complaint.recommendedAction},
        ${complaint.department},
        ${complaint.status},
        ${complaint.createdAt},
        ${complaint.updatedAt},
        ${
          complaint.location
            ? JSON.stringify(complaint.location)
            : null
        }::jsonb,
        ${
          complaint.verification
            ? JSON.stringify(complaint.verification)
            : null
        }::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        category = EXCLUDED.category,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        report = EXCLUDED.report,
        severity = EXCLUDED.severity,
        confidence = EXCLUDED.confidence,
        evidence = EXCLUDED.evidence,
        risk = EXCLUDED.risk,
        recommended_action = EXCLUDED.recommended_action,
        department = EXCLUDED.department,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        location = EXCLUDED.location,
        verification = EXCLUDED.verification
    `;
  }
}

export async function addComplaint(
  complaint: Complaint
): Promise<Complaint> {
  const sql = getDatabase();

  await sql`
    INSERT INTO complaints (
      id,
      category,
      title,
      description,
      report,
      severity,
      confidence,
      evidence,
      risk,
      recommended_action,
      department,
      status,
      created_at,
      updated_at,
      location,
      verification
    )
    VALUES (
      ${complaint.id},
      ${complaint.category},
      ${complaint.title},
      ${complaint.description},
      ${complaint.report},
      ${complaint.severity},
      ${complaint.confidence},
      ${JSON.stringify(complaint.evidence)}::jsonb,
      ${complaint.risk},
      ${complaint.recommendedAction},
      ${complaint.department},
      ${complaint.status},
      ${complaint.createdAt},
      ${complaint.updatedAt},
      ${
        complaint.location
          ? JSON.stringify(complaint.location)
          : null
      }::jsonb,
      ${
        complaint.verification
          ? JSON.stringify(complaint.verification)
          : null
      }::jsonb
    )
  `;

  return complaint;
}

export async function updateComplaint(
  id: string,
  updates: Partial<Complaint>
): Promise<Complaint | null> {
  const sql = getDatabase();

  const existingRows = await sql`
    SELECT
      id,
      category,
      title,
      description,
      report,
      severity,
      confidence,
      evidence,
      risk,
      recommended_action,
      department,
      status,
      created_at,
      updated_at,
      location,
      verification
    FROM complaints
    WHERE id = ${id}
    LIMIT 1
  `;

  if (existingRows.length === 0) {
    return null;
  }

  const existing = mapComplaint(
    existingRows[0] as Record<string, unknown>
  );

  const updated: Complaint = {
    ...existing,
    ...updates,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  await sql`
    UPDATE complaints
    SET
      category = ${updated.category},
      title = ${updated.title},
      description = ${updated.description},
      report = ${updated.report},
      severity = ${updated.severity},
      confidence = ${updated.confidence},
      evidence = ${JSON.stringify(updated.evidence)}::jsonb,
      risk = ${updated.risk},
      recommended_action = ${updated.recommendedAction},
      department = ${updated.department},
      status = ${updated.status},
      updated_at = ${updated.updatedAt},
      location = ${
        updated.location
          ? JSON.stringify(updated.location)
          : null
      }::jsonb,
      verification = ${
        updated.verification
          ? JSON.stringify(updated.verification)
          : null
      }::jsonb
    WHERE id = ${id}
  `;

  return updated;
}
