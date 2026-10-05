import { promises as fs } from "fs";
import path from "path";

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

const dataDirectory = path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "complaints.json");

async function ensureDatabase() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, "[]", "utf8");
  }
}

export async function getComplaints(): Promise<Complaint[]> {
  await ensureDatabase();

  const content = await fs.readFile(dataFile, "utf8");

  try {
    return JSON.parse(content) as Complaint[];
  } catch {
    return [];
  }
}

export async function saveComplaints(
  complaints: Complaint[]
): Promise<void> {
  await ensureDatabase();

  await fs.writeFile(
    dataFile,
    JSON.stringify(complaints, null, 2),
    "utf8"
  );
}

export async function addComplaint(
  complaint: Complaint
): Promise<Complaint> {
  const complaints = await getComplaints();

  complaints.unshift(complaint);

  await saveComplaints(complaints);

  return complaint;
}

export async function updateComplaint(
  id: string,
  updates: Partial<Complaint>
): Promise<Complaint | null> {
  const complaints = await getComplaints();

  const index = complaints.findIndex(
    (complaint) => complaint.id === id
  );

  if (index === -1) {
    return null;
  }

  complaints[index] = {
    ...complaints[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveComplaints(complaints);

  return complaints[index];
}
