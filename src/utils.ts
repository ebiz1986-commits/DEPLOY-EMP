import { Candidate } from "./types";

export function migrateCandidateToHundredScale(c: any): Candidate {
  if (c.isHundredScale) {
    return c as Candidate;
  }
  
  const isRawScale = 
    c.s1_siteExperience > 25 || 
    c.s1_nvqQualification > 15 || 
    c.s1_recommendation > 10;
    
  if (isRawScale) {
    return {
      ...c,
      isHundredScale: true,
      s1_siteExperience: Math.min(100, Math.round((c.s1_siteExperience / 50) * 100)),
      s1_nvqQualification: Math.min(100, Math.round((c.s1_nvqQualification / 30) * 100)),
      s1_recommendation: Math.min(100, Math.round((c.s1_recommendation / 20) * 100)),
      s2_measurementReading: Math.min(100, Math.round((c.s2_measurementReading / 20) * 100)),
      s2_machineKnowledge: Math.min(100, Math.round((c.s2_machineKnowledge / 20) * 100)),
      s2_methodology: Math.min(100, Math.round((c.s2_methodology / 50) * 100)),
      s2_hseEquipment: Math.min(100, Math.round((c.s2_hseEquipment / 10) * 100)),
      s3_physicalAppearance: Math.min(100, Math.round((c.s3_physicalAppearance / 25) * 100)),
      s3_healthCondition: Math.min(100, Math.round((c.s3_healthCondition / 25) * 100)),
      s3_characterAttitude: Math.min(100, Math.round((c.s3_characterAttitude / 30) * 100)),
      s3_extendedHours: Math.min(100, Math.round((c.s3_extendedHours / 20) * 100)),
    };
  } else {
    return {
      ...c,
      isHundredScale: true,
      s1_siteExperience: Math.min(100, Math.round((c.s1_siteExperience / 25) * 100)),
      s1_nvqQualification: Math.min(100, Math.round((c.s1_nvqQualification / 15) * 100)),
      s1_recommendation: Math.min(100, Math.round((c.s1_recommendation / 10) * 100)),
      s2_measurementReading: Math.min(100, Math.round((c.s2_measurementReading / 8) * 100)),
      s2_machineKnowledge: Math.min(100, Math.round((c.s2_machineKnowledge / 8) * 100)),
      s2_methodology: Math.min(100, Math.round((c.s2_methodology / 20) * 100)),
      s2_hseEquipment: Math.min(100, Math.round((c.s2_hseEquipment / 4) * 100)),
      s3_physicalAppearance: Math.min(100, Math.round((c.s3_physicalAppearance / 2.5) * 100)),
      s3_healthCondition: Math.min(100, Math.round((c.s3_healthCondition / 2.5) * 100)),
      s3_characterAttitude: Math.min(100, Math.round((c.s3_characterAttitude / 3) * 100)),
      s3_extendedHours: Math.min(100, Math.round((c.s3_extendedHours / 2) * 100)),
    };
  }
}

export function ensureWeightedCandidate(c: Candidate): Candidate {
  return migrateCandidateToHundredScale(c);
}

export function calculateS1Score(candidate: Candidate): { raw: number; weighted: number } {
  const c = migrateCandidateToHundredScale(candidate);
  
  const wExperience = (c.s1_siteExperience / 100) * 50; // max 50
  const wNvq = (c.s1_nvqQualification / 100) * 30; // max 30
  const wRecommendation = (c.s1_recommendation / 100) * 20; // max 20
  
  const raw = Math.round((wExperience + wNvq + wRecommendation) * 10) / 10;
  const weighted = Math.round((raw * 0.5) * 10) / 10;
  
  return { raw, weighted };
}

export function calculateS2Score(candidate: Candidate): { raw: number; weighted: number } {
  const c = migrateCandidateToHundredScale(candidate);
  
  const wMeasurement = (c.s2_measurementReading / 100) * 20; // max 20
  const wMachine = (c.s2_machineKnowledge / 100) * 20; // max 20
  const wMethodology = (c.s2_methodology / 100) * 50; // max 50
  const wHse = (c.s2_hseEquipment / 100) * 10; // max 10
  
  const raw = Math.round((wMeasurement + wMachine + wMethodology + wHse) * 10) / 10;
  const weighted = Math.round((raw * 0.4) * 10) / 10;
  
  return { raw, weighted };
}

export function calculateS3Score(candidate: Candidate): { raw: number; weighted: number } {
  const c = migrateCandidateToHundredScale(candidate);
  
  const wPhysical = (c.s3_physicalAppearance / 100) * 25; // max 25
  const wHealth = (c.s3_healthCondition / 100) * 25; // max 25
  const wCharacter = (c.s3_characterAttitude / 100) * 30; // max 30
  const wExtended = (c.s3_extendedHours / 100) * 20; // max 20
  
  const raw = Math.round((wPhysical + wHealth + wCharacter + wExtended) * 10) / 10;
  const weighted = Math.round((raw * 0.1) * 10) / 10;
  
  return { raw, weighted };
}

export function calculateOverallScore(candidate: Candidate): number {
  const s1 = calculateS1Score(candidate).weighted;
  const s2 = calculateS2Score(candidate).weighted;
  const s3 = calculateS3Score(candidate).weighted;
  return Math.round((s1 + s2 + s3) * 10) / 10;
}

export function getStatusColor(status: Candidate["status"]) {
  switch (status) {
    case "Selected":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "On Hold":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Rejected":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "Pending Practical":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Draft":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export function getStatusBadgeClass(status: Candidate["status"]) {
  switch (status) {
    case "Selected":
      return "bg-emerald-500 text-white";
    case "On Hold":
      return "bg-amber-500 text-white";
    case "Rejected":
      return "bg-rose-500 text-white";
    case "Pending Practical":
      return "bg-blue-500 text-white";
    case "Draft":
      return "bg-slate-400 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

export function exportToExcel(candidates: Candidate[], titleFilename: string = "Trades_Assessment_Database") {
  // Column Headers
  const headers = [
    "Reference ID",
    "Candidate Name",
    "NIC Number",
    "Passport Number",
    "Contact Number",
    "Assessment Date",
    "Assessor",
    "Trade / Position",
    "Project Name",
    "Requirement Company Name",
    "Section 1: Experience & Qual (Max 100)",
    "Section 1: Weighted Score (50%)",
    "Section 2: Knowledge & Practice (Max 100)",
    "Section 2: Weighted Score (40%)",
    "Section 3: Appearance & Attitude (Max 100)",
    "Section 3: Weighted Score (10%)",
    "Overall Competency Score (%)",
    "Pass/Fail",
    "Practical Test Required",
    "Status",
    "Notes / Remarks"
  ];

  // Helper to escape CSV values correctly
  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return "";
    let str = String(val);
    // Escape double quotes by doubling them
    str = str.replace(/"/g, '""');
    // If it contains double quotes, commas, or newlines, wrap in quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str}"`;
    }
    return str;
  };

  const rows = candidates.map(c => {
    // Determine Position Label
    let positionLabel: string = c.positionId;
    if (c.positionId === "bar_bender") positionLabel = "Bar Bender";
    else if (c.positionId === "finishing_carpenter") positionLabel = "Finishing Carpenter";
    else if (c.positionId === "labour") positionLabel = "Labour";
    else if (c.positionId === "mason") positionLabel = "Mason";

    const s1 = calculateS1Score(c);
    const s2 = calculateS2Score(c);
    const s3 = calculateS3Score(c);
    const overall = calculateOverallScore(c);
    const passStatus = overall > 59 ? "Pass" : "Fail";

    return [
      escapeCSV(c.referenceId),
      escapeCSV(c.name),
      escapeCSV(c.nicNumber || "N/A"),
      escapeCSV(c.passportNumber || "N/A"),
      escapeCSV(c.contact || "N/A"),
      escapeCSV(c.date),
      escapeCSV(c.assessor || "N/A"),
      escapeCSV(positionLabel),
      escapeCSV(c.projectName || "Default Project"),
      escapeCSV(c.requirementCompany || "N/A"),
      s1.raw,
      s1.weighted,
      s2.raw,
      s2.weighted,
      s3.raw,
      s3.weighted,
      overall,
      passStatus,
      c.practicalTestRequired ? "Yes" : "No",
      escapeCSV(c.status),
      escapeCSV(c.notes || "")
    ].join(",");
  });

  // Combine headers and rows with a UTF-8 BOM so Excel opens it correctly with unicode characters
  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");

  // Trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${titleFilename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

