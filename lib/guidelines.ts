export type Guideline = {
  id: string;
  name: string;
  standard: string;
  clause: string;
};

/**
 * Applicable ISO standards per department.
 * The AI Auditor audits ONLY against these standards for the selected department.
 */
export const STANDARDS_BY_DEPARTMENT: Record<string, string[]> = {
  Housekeeping: [
    "ISO 9001:2015",
    "ISO 22483:2020",
    "ISO 45001:2018",
    "ISO 14001:2015",
    "ISO 31000:2018",
    "ISO 10002:2018",
    "ISO 19011:2018",
  ],
  Kitchen: [
    "ISO 22000:2018",
    "ISO 9001:2015",
    "ISO 45001:2018",
    "ISO 14001:2015",
    "ISO/TS 22002-1:2009",
    "ISO 31000:2018",
    "ISO 19011:2018",
  ],
  "Front Desk": [
    "ISO 22483:2020",
    "ISO 9001:2015",
    "ISO 10002:2018",
    "ISO/IEC 27001:2022",
    "ISO 31000:2018",
    "ISO 45001:2018",
    "ISO 19011:2018",
  ],
  Compliance: [
    "ISO 9001:2015",
    "ISO 22000:2018",
    "ISO 45001:2018",
    "ISO 14001:2015",
    "ISO 22483:2020",
    "ISO 31000:2018",
    "ISO 19011:2018",
    "ISO 10002:2018",
    "ISO/IEC 27001:2022",
  ],
  Warehousing: [
    "ISO 9001:2015",
    "ISO 22000:2018",
    "ISO 45001:2018",
    "ISO 14001:2015",
    "ISO/TS 22002-1:2009",
    "ISO 31000:2018",
    "ISO 19011:2018",
  ],
};

export function standardsForDepartment(name: string): string[] {
  return STANDARDS_BY_DEPARTMENT[name] ?? [];
}

/** Friendly full name for each standard code, e.g. "ISO 22000:2018 – Food Safety Management". */
export const STANDARD_LABELS: Record<string, string> = {
  "ISO 9001:2015": "Quality Management System",
  "ISO 22000:2018": "Food Safety and Management System",
  "ISO 45001:2018": "Occupational Health and Safety Management",
  "ISO 14001:2015": "Environmental Management System",
  "ISO 22483:2020": "Tourism & Hotels Service Requirements",
  "ISO 31000:2018": "Risk Management",
  "ISO 10002:2018": "Customer Satisfaction – Complaints Handling",
  "ISO 19011:2018": "Auditing Management Systems",
  "ISO/IEC 27001:2022": "Information Security Management System",
  "ISO/TS 22002-1:2009": "Food Safety Prerequisite Programmes",
};

export function standardLabel(code: string): string {
  return STANDARD_LABELS[code] ?? code;
}

export function guidelinesForDepartment(name: string): Guideline[] {
  const all = GUIDELINES_BY_DEPARTMENT[name] ?? [];
  const allowed = standardsForDepartment(name);
  if (allowed.length === 0) return all;
  return all.filter((g) => allowed.includes(g.standard));
}

export const GUIDELINES_BY_DEPARTMENT: Record<string, Guideline[]> = {
  Kitchen: [
    { id: "k1", name: "Food Safety & HACCP Hazard Analysis", standard: "ISO 22000:2018", clause: "8.5.1 – Validation of control measures" },
    { id: "k2", name: "Personal Hygiene of Food Handlers", standard: "ISO 22000:2018", clause: "8.2 – Prerequisite programmes (PRPs)" },
    { id: "k3", name: "Temperature Control of Food Storage", standard: "ISO 22000:2018", clause: "8.4 – Monitoring and measuring" },
    { id: "k4", name: "Cross-Contamination Prevention", standard: "ISO/TS 22002-1:2009", clause: "9 – Measures for prevention of cross contamination" },
    { id: "k5", name: "Critical Control Point (CCP) Monitoring", standard: "ISO 22000:2018", clause: "8.5.2 – Monitoring and measuring at control measures" },
    { id: "k6", name: "Cleaning & Sanitisation of Kitchen Surfaces", standard: "ISO 22000:2018", clause: "8.2 – PRPs / sanitation" },
    { id: "k7", name: "Pest Control Program", standard: "ISO 22000:2018", clause: "8.2 – PRP / pest control" },
    { id: "k8", name: "Waste Segregation & Disposal", standard: "ISO 14001:2015", clause: "8.1 – Operational planning and control" },
    { id: "k9", name: "Equipment Maintenance & Calibration", standard: "ISO 9001:2015", clause: "7.1.3 – Infrastructure" },
    { id: "k10", name: "Kitchen Staff Safety (Burns, Slips, Knives)", standard: "ISO 45001:2018", clause: "6.1.2 – Hazard identification" },
  ],
  Housekeeping: [
    { id: "h1", name: "Room Cleaning Standards", standard: "ISO 9001:2015", clause: "8.5.1 – Production/service provision" },
    { id: "h2", name: "Linen Handling & Laundry Hygiene", standard: "ISO 22000:2018", clause: "8.2 – PRPs" },
    { id: "h3", name: "Chemical Storage & Safe Usage", standard: "ISO 45001:2018", clause: "8.1.2 – Eliminating hazards" },
    { id: "h4", name: "Public Area Sanitation", standard: "ISO 9001:2015", clause: "8.5.1 – Control of service provision" },
    { id: "h5", name: "Waste Segregation & Recycling", standard: "ISO 14001:2015", clause: "8.1 – Operational control" },
    { id: "h6", name: "Guest Complaint Handling", standard: "ISO 9001:2015", clause: "8.2.1 – Customer communication" },
    { id: "h7", name: "Staff Grooming & Uniform", standard: "ISO 9001:2015", clause: "7.2 – Competence" },
    { id: "h8", name: "Housekeeping Equipment Care", standard: "ISO 9001:2015", clause: "7.1.3 – Infrastructure" },
    { id: "h9", name: "Pest Control in Guest Areas", standard: "ISO 22000:2018", clause: "8.2 – PRPs / pest control" },
    { id: "h10", name: "Lost & Found Management", standard: "ISO 9001:2015", clause: "8.5.4 – Preservation" },
    { id: "h11", name: "Housekeeping Service Requirements", standard: "ISO 22483:2020", clause: "5.3 – Housekeeping services" },
  ],
  "Front Desk": [
    { id: "f1", name: "Guest Check-in / Check-out Accuracy", standard: "ISO 9001:2015", clause: "8.2.3 – Review of requirements" },
    { id: "f2", name: "Guest Data Privacy", standard: "ISO/IEC 27001:2022", clause: "5.1 – Policies for information security" },
    { id: "f3", name: "Complaint & Feedback Handling", standard: "ISO 9001:2015", clause: "8.2.1 – Customer communication" },
    { id: "f4", name: "Cash Handling & Billing Accuracy", standard: "ISO 9001:2015", clause: "8.5.1 – Service provision" },
    { id: "f5", name: "Emergency Procedures & Guest Safety", standard: "ISO 45001:2018", clause: "8.2 – Emergency preparedness" },
    { id: "f6", name: "Reservation & Booking Records", standard: "ISO 9001:2015", clause: "7.5.3 – Control of documented information" },
    { id: "f7", name: "Front Desk Hygiene & Grooming", standard: "ISO 9001:2015", clause: "7.2 – Competence" },
    { id: "f8", name: "Key & Access Control", standard: "ISO/IEC 27001:2022", clause: "A.8 – Asset management" },
    { id: "f9", name: "Guest Information Accuracy", standard: "ISO 9001:2015", clause: "8.2.4 – Changes to requirements" },
    { id: "f10", name: "Response Time to Guest Requests", standard: "ISO 9001:2015", clause: "8.2.1 – Customer communication" },
    { id: "f11", name: "Front Desk / Reception Service Requirements", standard: "ISO 22483:2020", clause: "5.2 – Reception and check-in services" },
  ],
  Warehousing: [
    { id: "w1", name: "Goods Receiving & Inspection", standard: "ISO 9001:2015", clause: "8.4.1 – Control of externally provided processes" },
    { id: "w2", name: "Stock Storage & FIFO Rotation", standard: "ISO 22000:2018", clause: "8.2 – PRPs" },
    { id: "w3", name: "Temperature & Humidity Monitoring", standard: "ISO 22000:2018", clause: "8.4 – Monitoring and measuring" },
    { id: "w4", name: "Forklift & Material Handling Safety", standard: "ISO 45001:2018", clause: "8.1.2 – Eliminating hazards" },
    { id: "w5", name: "Stock Count & Record Accuracy", standard: "ISO 9001:2015", clause: "8.5.4 – Preservation" },
    { id: "w6", name: "Pest Control in Warehouse", standard: "ISO 22000:2018", clause: "8.2 – PRPs / pest control" },
    { id: "w7", name: "Fire Safety & Exit Access", standard: "ISO 45001:2018", clause: "8.2 – Emergency preparedness" },
    { id: "w8", name: "Hazardous Material Storage", standard: "ISO 14001:2015", clause: "8.1 – Operational control" },
    { id: "w9", name: "Shelf Labelling & Identification", standard: "ISO 9001:2015", clause: "8.5.2 – Identification and traceability" },
    { id: "w10", name: "Delivery Dispatch Accuracy", standard: "ISO 9001:2015", clause: "8.6 – Release of products and services" },
  ],
  Compliance: [
    { id: "c1", name: "Internal Audit Program", standard: "ISO 9001:2015", clause: "9.2 – Internal audit" },
    { id: "c2", name: "Nonconformity & Corrective Action", standard: "ISO 9001:2015", clause: "10.2 – Nonconformity and corrective action" },
    { id: "c3", name: "Management Review", standard: "ISO 9001:2015", clause: "9.3 – Management review" },
    { id: "c4", name: "Document & Record Control", standard: "ISO 9001:2015", clause: "7.5 – Documented information" },
    { id: "c5", name: "Risk-Based Thinking", standard: "ISO 9001:2015", clause: "6.1 – Actions to address risks" },
    { id: "c6", name: "Food Safety Policy & Objectives", standard: "ISO 22000:2018", clause: "5.1 – Leadership and commitment" },
    { id: "c7", name: "Supplier & Contractor Evaluation", standard: "ISO 9001:2015", clause: "8.4.1 – External providers" },
    { id: "c8", name: "Legal & Regulatory Compliance", standard: "ISO 14001:2015", clause: "6.1.3 – Compliance obligations" },
    { id: "c9", name: "Training & Competence Records", standard: "ISO 9001:2015", clause: "7.2 – Competence" },
    { id: "c10", name: "Data & Information Security", standard: "ISO/IEC 27001:2022", clause: "6.2 – InfoSec objectives" },
  ],
};

export const DEFAULT_GUIDELINES = GUIDELINES_BY_DEPARTMENT["Compliance"];
