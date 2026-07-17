import React, { useState, useMemo, useRef } from "react";
import { Category, Company, Worker, ProjectDetail, User, DropdownOption } from "../types";
import { 
  UserPlus, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  FileCheck2, 
  Search,
  Building,
  Building2,
  UserCheck2,
  ListRestart,
  Upload,
  FileSpreadsheet,
  ClipboardList,
  Lock,
  Download,
  FolderOpen,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plane
} from "lucide-react";
import * as XLSX from "xlsx";
import { calculateOverallScore } from "../utils";

interface RecruiterIntakeViewProps {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  dropdownOptions: DropdownOption[];
  projectDetail?: ProjectDetail | null;
  projects?: ProjectDetail[];
  onRefresh: () => void;
  onBulkAdd: (newWorkers: { name: string; passport: string; category: string; supply_company: string; nationality?: string; doc_link?: string; bulk_doc_link?: string }[]) => Promise<{ success: boolean; message?: string }>;
  onUpdateWorker: (id: string, updates: Partial<Worker>) => Promise<boolean>;
  currentUser?: User | null;
  onDeleteWorker?: (id: string) => Promise<boolean>;

  // Firestore candidate properties
  candidates?: any[];
  onSaveCandidate?: (candidate: any) => Promise<boolean>;
  onDeleteCandidate?: (id: string) => Promise<boolean>;
  onSendCandidateToEngineer?: (candidate: any) => Promise<{ success: boolean; message?: string }>;
}

interface WorkerFormInput {
  name: string;
  passport: string;
  category: string;
  supply_company: string;
  doc_link?: string;
  nationality?: string;
}

export default function RecruiterIntakeView({
  workers,
  categories,
  companies,
  dropdownOptions,
  projectDetail,
  projects = [],
  onRefresh,
  onBulkAdd,
  onUpdateWorker,
  currentUser,
  onDeleteWorker,
  candidates = [],
  onSaveCandidate,
  onDeleteCandidate,
  onSendCandidateToEngineer
}: RecruiterIntakeViewProps) {
  
  // Bulk document link input state
  const [bulkDocLinkInput, setBulkDocLinkInput] = useState("");

  // Sub-tab selection state inside Recruiter View
  const [activeSubTab, setActiveSubTab] = useState<"bulk" | "interview">("bulk");

  // Interview Entry Form State
  const [interviewForm, setInterviewForm] = useState({
    sr_number: "",
    employee_number: "",
    name: "",
    nic_number: "",
    passport: "",
    category: "",
    project_id: "",
    remarks: "",
    interviewer_name: "",
    interview_status: "Pending" as "Pending" | "Pass" | "Fail",
    interview_marks: "",
    test_required: "No" as "Yes" | "No"
  });
  const [isInterviewSubmitting, setIsInterviewSubmitting] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);

  const handleEditInterviewClick = (w: any) => {
    setEditingWorkerId(w.id);

    // Resolve Category Name
    let catName = w.category || "";
    if (!catName && w.positionId) {
      const categoryMap: { [key: string]: string } = {
        bar_bender: "Bar Bender",
        finishing_carpenter: "Finishing Carpenter",
        labour: "Labur",
        mason: "Meson",
        rigger: "Rigger",
        shoutering_carpenter: "Shoutering Carpenter",
        spray_painter: "Spray Painter",
        survey_helper: "Survey Helper",
        tile_mason: "Tile Mason",
        wall_painter: "Wall Painter"
      };
      catName = categoryMap[w.positionId] || w.positionId;
    }

    // Resolve Project ID
    let projId = w.project_id || "";
    if (!projId && w.projectName && projects) {
      const foundProj = projects.find(p => p.name.trim().toLowerCase() === w.projectName.trim().toLowerCase());
      if (foundProj) {
        projId = foundProj.id;
      }
    }
    if (!projId && projects && projects.length > 0) {
      projId = projects[0].id;
    }

    // Resolve Interview Status
    let statusVal: "Pending" | "Pass" | "Fail" = "Pending";
    if (w.interview_status) {
      statusVal = w.interview_status;
    } else if (w.status === "Selected") {
      statusVal = "Pass";
    } else if (w.status === "Rejected") {
      statusVal = "Fail";
    }

    // Resolve Marks
    const marksVal = w.interview_marks !== undefined ? w.interview_marks : (w.s1_siteExperience !== undefined ? String(w.s1_siteExperience) : "");

    // Resolve Test Required
    let testReq: "Yes" | "No" = "No";
    if (w.test_required) {
      testReq = w.test_required;
    } else if (w.practicalTestRequired !== undefined) {
      testReq = w.practicalTestRequired ? "Yes" : "No";
    }

    setInterviewForm({
      sr_number: w.sr_number || w.referenceId || "",
      employee_number: w.employee_number || "",
      name: w.name || "",
      nic_number: w.nic_number || w.nicNumber || "",
      passport: w.passport || w.passportNumber || "",
      category: catName,
      project_id: projId,
      remarks: w.remarks || w.notes || "",
      interviewer_name: w.interviewer_name || w.assessor || "",
      interview_status: statusVal,
      interview_marks: marksVal,
      test_required: testReq
    });
  };

  // Bulk entry lines
  const [rows, setRows] = useState<WorkerFormInput[]>([
    { name: "", passport: "", category: "", supply_company: companies[0]?.name || "", doc_link: "", nationality: "" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // New links for resubmitting rejected workers
  const [resubmitLinks, setResubmitLinks] = useState<Record<string, string>>({});
  const [showLinkInput, setShowLinkInput] = useState<Record<string, boolean>>({});

  const handleCsvParse = (text: string) => {
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const lines = text.split(/\r?\n/).map(line => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      }).filter(cols => cols.length > 0 && cols.some(c => c !== ""));

      if (lines.length < 2) {
        setErrorMessage("CSV file must contain a header row and at least one worker details row.");
        return;
      }

      // Read headers and match them
      const headers = lines[0].map(h => h.toLowerCase().trim());
      
      const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("worker") || h.includes("full"));
      const passportIdx = headers.findIndex(h => h.includes("passport") || h.includes("pass") || h.includes("id") || h.includes("number"));
      const catIdx = headers.findIndex(h => h.includes("category") || h.includes("job") || h.includes("role"));
      const coIdx = headers.findIndex(h => h.includes("company") || h.includes("agency") || h.includes("recruiter") || h.includes("supply"));
      const natIdx = headers.findIndex(h => h.includes("nationality") || h.includes("nation") || h.includes("country"));

      const finalNameIdx = nameIdx !== -1 ? nameIdx : 0;
      const finalPassportIdx = passportIdx !== -1 ? passportIdx : 1;
      const finalCatIdx = catIdx !== -1 ? catIdx : (lines[0].length > 2 ? 2 : -1);
      const finalCoIdx = coIdx !== -1 ? coIdx : (lines[0].length > 3 ? 3 : -1);
      const finalNatIdx = natIdx !== -1 ? natIdx : -1;

      const parsedRows: WorkerFormInput[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i];
        if (cols.length < 2) continue;

        const name = cols[finalNameIdx] || "";
        const passport = (cols[finalPassportIdx] || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        
        let categoryInput = finalCatIdx !== -1 && cols[finalCatIdx] ? cols[finalCatIdx] : "";
        let matchedCat = categories.find(c => c.name.toLowerCase() === categoryInput.toLowerCase())?.name 
          || "";

        let companyInput = finalCoIdx !== -1 && cols[finalCoIdx] ? cols[finalCoIdx] : "";
        let matchedCo = companies.find(c => c.name.toLowerCase() === companyInput.toLowerCase())?.name 
          || companies[0]?.name 
          || "";

        let nationalityInput = finalNatIdx !== -1 && cols[finalNatIdx] ? cols[finalNatIdx].trim() : "";
        let matchedNat = dropdownOptions
          .filter(d => d.field === "nationality")
          .find(d => d.value.toLowerCase() === nationalityInput.toLowerCase())?.value 
          || dropdownOptions.filter(d => d.field === "nationality")[0]?.value
          || "";

        if (name && passport) {
          parsedRows.push({
            name: name.replace(/^["']|["']$/g, "").trim(),
            passport: passport.replace(/^["']|["']$/g, "").trim(),
            category: matchedCat,
            supply_company: currentUser?.role === "recruiter" ? defaultCompany : matchedCo,
            doc_link: "",
            nationality: matchedNat
          });
        }
      }

      if (parsedRows.length === 0) {
        setErrorMessage("No valid worker records recognized. Ensure columns contain 'Name' and 'Passport'.");
        return;
      }

      setRows(parsedRows);
      setSuccessMessage(`Extracted ${parsedRows.length} workers from CSV! Please review them in the grid table below, then click 'Register Cohort' to save.`);
    } catch (e) {
      setErrorMessage("Could not parse file. Verify it is a valid format .csv.");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            handleCsvParse(event.target.result as string);
          }
        };
        reader.readAsText(file);
      } else {
        setErrorMessage("Invalid file. Please load a structured .csv roster spreadsheet.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleCsvParse(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  // Search in Bureau queue
  const [bureauSearch, setBureauSearch] = useState("");
  const [expandedBureauWorkers, setExpandedBureauWorkers] = useState<{[key: string]: boolean}>({});
  const [bureauCompanyFilter, setBureauCompanyFilter] = useState<string>("");

  // States for Live Candidates Feed
  const [feedSearch, setFeedSearch] = useState("");
  const [feedCategoryFilter, setFeedCategoryFilter] = useState("All");
  const [feedStatusFilter, setFeedStatusFilter] = useState("All");

  // States for Combined Master Records Archive in Intake Portal
  const [masterSearch, setMasterSearch] = useState("");
  const [masterSortField, setMasterSortField] = useState<keyof Worker | "">("created_at");
  const [masterSortOrder, setMasterSortOrder] = useState<"asc" | "desc">("desc");
  const [masterCompanyFilter, setMasterCompanyFilter] = useState("All");
  const [masterCategoryFilter, setMasterCategoryFilter] = useState("All");

  // Auto-detect matching company based on user's name/username
  const defaultCompany = useMemo(() => {
    if (!currentUser) return companies[0]?.name || "";
    if (currentUser.recruiter_company) {
      return currentUser.recruiter_company;
    }
    const usernameLower = currentUser.username.toLowerCase();
    const nameLower = currentUser.name.toLowerCase();
    const match = companies.find(
      c => {
        const coLower = c.name.toLowerCase();
        return coLower === usernameLower || 
               usernameLower.includes(coLower) || 
               coLower.includes(usernameLower) ||
               nameLower.includes(coLower) ||
               coLower.includes(nameLower);
      }
    );
    return match ? match.name : (companies[0]?.name || "");
  }, [currentUser, companies]);

  const activeSupplyCompany = useMemo(() => {
    if (currentUser?.role === "recruiter") {
      return defaultCompany;
    }
    return bureauCompanyFilter || defaultCompany;
  }, [bureauCompanyFilter, defaultCompany, currentUser]);

  // Dynamically default the fast-intake form company once defaultCompany is resolved from currentUser
  React.useEffect(() => {
    if (defaultCompany && rows.length === 1 && rows[0].name === "" && rows[0].passport === "") {
      setRows([
        { name: "", passport: "", category: "", supply_company: defaultCompany }
      ]);
    }
  }, [defaultCompany, categories]);

  React.useEffect(() => {
    if (categories.length > 0 && !interviewForm.category) {
      setInterviewForm(prev => ({ ...prev, category: categories[0].name }));
    }
  }, [categories]);

  // Auto-generate the next unique SR Number based on existing workers
  const nextSRNumber = useMemo(() => {
    let maxNum = 1000; // default starting number, e.g. SR-1001
    workers.forEach(w => {
      if (w.sr_number) {
        const match = w.sr_number.match(/^SR-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
    return `SR-${maxNum + 1}`;
  }, [workers]);

  React.useEffect(() => {
    if (!editingWorkerId) {
      setInterviewForm(prev => {
        // Only update if currently empty or starts with SR- and is different from the newly calculated nextSRNumber
        if (!prev.sr_number || prev.sr_number.toUpperCase().startsWith("SR-")) {
          if (prev.sr_number !== nextSRNumber) {
            return { ...prev, sr_number: nextSRNumber };
          }
        }
        return prev;
      });
    }
  }, [nextSRNumber, editingWorkerId]);

  React.useEffect(() => {
    if (projects.length > 0 && !interviewForm.project_id) {
      setInterviewForm(prev => ({ ...prev, project_id: projects[0].id }));
    }
  }, [projects]);

  // Track passport validation errors
  const existingPassportSet = useMemo(() => {
    return new Set(workers.map(w => w.passport.trim().toUpperCase()));
  }, [workers]);

  const [interviewSearch, setInterviewSearch] = useState("");

  const interviewRecords = useMemo(() => {
    return (candidates || []).filter((c) => {
      const company = c.requirementCompany || "";
      if (currentUser?.role === "recruiter") {
        return company === defaultCompany;
      } else {
        return activeSupplyCompany === "All" ? true : company === activeSupplyCompany;
      }
    });
  }, [candidates, currentUser, defaultCompany, activeSupplyCompany]);

  const filteredInterviewRecords = useMemo(() => {
    const term = interviewSearch.trim().toLowerCase();
    if (!term) return interviewRecords;
    return interviewRecords.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.passportNumber && c.passportNumber.toLowerCase().includes(term)) ||
      (c.nicNumber && c.nicNumber.toLowerCase().includes(term)) ||
      (c.referenceId && c.referenceId.toLowerCase().includes(term))
    );
  }, [interviewRecords, interviewSearch]);

  // Calculations of duplicate passports within currently typed rows
  const rowDuplicates = useMemo(() => {
    const counts: { [key: string]: number } = {};
    rows.forEach(r => {
      const p = r.passport.trim().toUpperCase();
      if (p) {
        counts[p] = (counts[p] || 0) + 1;
      }
    });
    return counts;
  }, [rows]);

  // Find all active duplicates with location details
  const passportWarnings = useMemo(() => {
    const list: { passport: string; type: "db" | "batch"; rowIndices: number[] }[] = [];
    const seen: { [key: string]: number[] } = {};
    
    rows.forEach((r, idx) => {
      const p = r.passport.trim().toUpperCase();
      if (p) {
        if (!seen[p]) seen[p] = [];
        seen[p].push(idx);
      }
    });

    Object.entries(seen).forEach(([passport, idxs]) => {
      if (existingPassportSet.has(passport)) {
        list.push({ passport, type: "db", rowIndices: idxs });
      } else if (idxs.length > 1) {
        list.push({ passport, type: "batch", rowIndices: idxs });
      }
    });

    return list;
  }, [rows, existingPassportSet]);

  // Calculations of categorized workers in the current intake rows before submission
  const categoryCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    const activeRows = rows.filter(r => r.name.trim() !== "" || r.passport.trim() !== "");
    activeRows.forEach(row => {
      const cat = row.category || "Unassigned";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [rows]);

  const totalRosterCount = useMemo(() => {
    return rows.filter(r => r.name.trim() !== "" || r.passport.trim() !== "").length;
  }, [rows]);

  const handleAddRow = () => {
    const lastRow = rows[rows.length - 1];
    setRows([
      ...rows,
      { 
        name: "", 
        passport: "", 
        category: lastRow?.category || "", 
        supply_company: currentUser?.role === "recruiter" ? defaultCompany : (lastRow?.supply_company || companies[0]?.name || ""),
        doc_link: "",
        nationality: lastRow?.nationality || ""
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      setRows([{ name: "", passport: "", category: "", supply_company: currentUser?.role === "recruiter" ? defaultCompany : (companies[0]?.name || ""), doc_link: "", nationality: "" }]);
    } else {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const handleRowChange = (index: number, field: keyof WorkerFormInput, value: string) => {
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setRows(updated);
  };

  const handlePasteBlock = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    // Advanced feature: recruiter can paste tab-delimited name & passport to bulk fill!
    const text = e.clipboardData.getData("text");
    if (text && (text.includes("\t") || text.includes("\n"))) {
      e.preventDefault();
      const lines = text.split("\n").map(l => l.split("\t")).filter(vals => vals.length > 0 && vals[0].trim());
      if (lines.length > 0) {
        const newRows = [...rows];
        lines.forEach((lineVals, offset) => {
          const targetIndex = index + offset;
          const nameVal = lineVals[0] || "";
          const passportVal = lineVals[1] || "";
          
          if (targetIndex < newRows.length) {
            newRows[targetIndex] = {
              ...newRows[targetIndex],
              name: nameVal.trim(),
              passport: passportVal.trim().toUpperCase()
            };
          } else {
            newRows.push({
              name: nameVal.trim(),
              passport: passportVal.trim().toUpperCase(),
              category: rows[rows.length - 1]?.category || "",
              supply_company: currentUser?.role === "recruiter" ? defaultCompany : (rows[rows.length - 1]?.supply_company || companies[0]?.name || ""),
              doc_link: ""
            });
          }
        });
        setRows(newRows);
      }
    }
  };

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    
    // Validation
    const cleanRows = rows.filter(r => r.name.trim() !== "" || r.passport.trim() !== "");
    if (cleanRows.length === 0) {
      setErrorMessage("Please fill in at least one worker row.");
      return;
    }

    const incomplete = cleanRows.find(r => !r.name.trim() || !r.passport.trim() || !r.category || !r.supply_company);
    if (incomplete) {
      setErrorMessage("Every worker registered requires a Name, Passport, and a valid Actual Job Category.");
      return;
    }

    // Checking duplicates
    const passportsInBatch = cleanRows.map(r => r.passport.trim().toUpperCase());
    const duplicatesInDb = passportsInBatch.filter(p => existingPassportSet.has(p));
    if (duplicatesInDb.length > 0) {
      setErrorMessage(`Intake Blocked: passport ${duplicatesInDb.join(", ")} already registered in system masterfile.`);
      return;
    }

    const batchDuplicates = passportsInBatch.filter(p => rowDuplicates[p] > 1);
    if (batchDuplicates.length > 0) {
      setErrorMessage(`Deduplication failure: multiple listings for passport ${[...new Set(batchDuplicates)].join(", ")} in same batch.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = cleanRows.map(r => ({
        name: r.name.trim(),
        passport: r.passport.trim().toUpperCase(),
        category: r.category,
        supply_company: currentUser?.role === "recruiter" ? defaultCompany : r.supply_company,
        doc_link: r.doc_link?.trim() || "",
        bulk_doc_link: bulkDocLinkInput.trim(),
        nationality: r.nationality || ""
      }));

      const res = await onBulkAdd(payload);
      if (res.success) {
        setSuccessMessage(`Success: ${payload.length} workers registered under State: PENDING.`);
        setRows([{ name: "", passport: "", category: "", supply_company: currentUser?.role === "recruiter" ? defaultCompany : (companies[0]?.name || ""), doc_link: "", nationality: "" }]);
        setBulkDocLinkInput("");
      } else {
        setErrorMessage(res.message || "An error occurred with registration.");
      }
    } catch (err) {
      setErrorMessage("Database write timed out.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Validate mandatory NIC field
    if (!interviewForm.nic_number.trim()) {
      setErrorMessage("NIC Number is mandatory for Interview Entry.");
      return;
    }

    if (!interviewForm.name.trim()) {
      setErrorMessage("Full Name (as per passport) is required.");
      return;
    }

    if (!interviewForm.category) {
      setErrorMessage("Please select a Designation / Trade.");
      return;
    }

    if (!interviewForm.project_id) {
      setErrorMessage("Please select a Project (site).");
      return;
    }

    // Check duplicate passport or NIC in candidates registry
    const passportUpper = interviewForm.passport.trim().toUpperCase();
    const nicTrimmed = interviewForm.nic_number.trim();

    if (passportUpper && candidates.some(c => c.id !== editingWorkerId && c.passportNumber?.trim().toUpperCase() === passportUpper)) {
      setErrorMessage(`Validation Failure: Passport Number "${passportUpper}" already exists in the candidate registry.`);
      return;
    }

    if (candidates.some(c => c.id !== editingWorkerId && c.nicNumber && c.nicNumber.trim() === nicTrimmed)) {
      setErrorMessage(`Validation Failure: NIC Number "${nicTrimmed}" already exists in the candidate registry.`);
      return;
    }

    setIsInterviewSubmitting(true);
    try {
      let positionId: any = "labour";
      const catNameLower = interviewForm.category.toLowerCase();
      if (catNameLower.includes("bar bender")) positionId = "bar_bender";
      else if (catNameLower.includes("carpenter") && catNameLower.includes("finish")) positionId = "finishing_carpenter";
      else if (catNameLower.includes("carpenter") && catNameLower.includes("shout")) positionId = "shoutering_carpenter";
      else if (catNameLower.includes("labour") || catNameLower.includes("labur")) positionId = "labour";
      else if (catNameLower.includes("mason") && catNameLower.includes("tile")) positionId = "tile_mason";
      else if (catNameLower.includes("mason") || catNameLower.includes("meson")) positionId = "mason";
      else if (catNameLower.includes("rigger")) positionId = "rigger";
      else if (catNameLower.includes("paint") && catNameLower.includes("spray")) positionId = "spray_painter";
      else if (catNameLower.includes("paint") && catNameLower.includes("wall")) positionId = "wall_painter";
      else if (catNameLower.includes("survey")) positionId = "survey_helper";

      let candidateStatus: any = "On Hold";
      if (interviewForm.interview_status === "Pass") {
        candidateStatus = "Selected";
      } else if (interviewForm.interview_status === "Fail") {
        candidateStatus = "Rejected";
      }

      const marksValue = parseFloat(interviewForm.interview_marks) || 0;
      const targetProjectName = projects.find(p => p.id === interviewForm.project_id)?.name || "Default Project";
      const existingCandidate = candidates?.find(c => c.id === editingWorkerId);

      const candidateData = {
        id: editingWorkerId || `cand-${Date.now()}`,
        name: interviewForm.name.trim(),
        positionId: positionId,
        referenceId: interviewForm.sr_number.trim() || `REF-${Date.now().toString().slice(-4)}`,
        nicNumber: nicTrimmed,
        passportNumber: passportUpper,
        date: new Date().toISOString().split("T")[0],
        assessor: interviewForm.interviewer_name.trim() || currentUser?.name || "Recruiter",
        projectName: targetProjectName,
        requirementCompany: currentUser?.recruiter_company || activeSupplyCompany || "KSJ",
        contact: existingCandidate?.contact || "",
        notes: interviewForm.remarks.trim(),
        status: candidateStatus,
        practicalTestRequired: interviewForm.test_required === "Yes",
        isHundredScale: true,
        s1_siteExperience: marksValue,
        s1_nvqQualification: marksValue,
        s1_recommendation: marksValue,
        s2_measurementReading: marksValue,
        s2_machineKnowledge: marksValue,
        s2_methodology: marksValue,
        s2_hseEquipment: marksValue,
        s3_physicalAppearance: marksValue,
        s3_healthCondition: marksValue,
        s3_characterAttitude: marksValue,
        s3_extendedHours: marksValue,
        sentToEngineer: existingCandidate?.sentToEngineer || false
      };

      if (onSaveCandidate) {
        const success = await onSaveCandidate(candidateData);
        if (success) {
          setSuccessMessage(`Success: Interview Entry for "${interviewForm.name}" successfully stored in candidate database.`);
          setEditingWorkerId(null);
          setInterviewForm({
            sr_number: "",
            employee_number: "",
            name: "",
            nic_number: "",
            passport: "",
            category: categories[0]?.name || "",
            project_id: projects[0]?.id || "",
            remarks: "",
            interviewer_name: "",
            interview_status: "Pending",
            interview_marks: "",
            test_required: "No"
          });
          onRefresh();
        } else {
          setErrorMessage("Failed to save interview scorecard in database.");
        }
      } else {
        setErrorMessage("Save candidate hook is not defined.");
      }
    } catch (err) {
      setErrorMessage("Database write failed or timed out.");
    } finally {
      setIsInterviewSubmitting(false);
    }
  };

  // Recruiters Bureau Pending Queue filtering
  // "when a worker's status becomes 'Visa Approved (xpact)', that worker appears in the recruiter's 'Bureau Pending' queue"
  // Once the recruiter completes the bureau clearance, they remain in this list until the coordinator sets their final status to 'Arrived'
  const bureauQueue = useMemo(() => {
    return workers.filter((w) => {
      const matchesStatus = w.status === "Visa Approved (xpact)" && w.final_status !== "Arrived";
      
      if (!matchesStatus) return false;

      // Filter by the related recruited company (or show all if "All" is selected)
      if (activeSupplyCompany !== "All" && w.supply_company !== activeSupplyCompany) {
        return false;
      }

      // Filter by text search
      if (bureauSearch.trim() !== "") {
        const query = bureauSearch.trim().toLowerCase();
        const matchesName = w.name.toLowerCase().includes(query);
        const matchesPassport = w.passport.toLowerCase().includes(query);
        if (!matchesName && !matchesPassport) return false;
      }

      return true;
    });
  }, [workers, bureauSearch, activeSupplyCompany]);

  const pendingBureauWorkers = useMemo(() => {
    return bureauQueue.filter((w) => w.bureau !== "Complete");
  }, [bureauQueue]);

  const readyForDepartureWorkers = useMemo(() => {
    return bureauQueue.filter((w) => w.bureau === "Complete");
  }, [bureauQueue]);

  const pendingBureauCount = useMemo(() => {
    return bureauQueue.filter(w => w.bureau === "Pending").length;
  }, [bureauQueue]);

  const handleBureauAction = async (workerId: string, decision: "Complete" | "Reject") => {
    await onUpdateWorker(workerId, { bureau: decision });
    setSuccessMessage(`Updated Bureau Clearance to "${decision}" for worker.`);
  };

  // Workers registered under the recruiter's company
  const recruiterWorkers = useMemo(() => {
    return workers.filter((w) => {
      if (currentUser?.role === "recruiter") {
        return w.supply_company === defaultCompany;
      }
      return true; // fallback for admin
    });
  }, [workers, defaultCompany, currentUser]);

  // Filters computed on top of recruiterWorkers
  const filteredFeed = useMemo(() => {
    return recruiterWorkers.filter((w) => {
      if (feedSearch.trim() !== "") {
        const q = feedSearch.trim().toLowerCase();
        const matchesName = w.name.toLowerCase().includes(q);
        const matchesPassport = w.passport.toLowerCase().includes(q);
        if (!matchesName && !matchesPassport) return false;
      }
      if (feedCategoryFilter !== "All" && w.category !== feedCategoryFilter) {
        return false;
      }
      if (feedStatusFilter !== "All") {
        if (feedStatusFilter === "Engineer_Held") {
          if (w.state !== "held") return false;
        } else if (feedStatusFilter === "Engineer_Rejected") {
          if (w.state !== "rejected") return false;
        } else if (feedStatusFilter === "Engineer_Pending") {
          if (w.state !== "pending" && w.state !== undefined) return false;
        } else if (feedStatusFilter === "Engineer_Active") {
          if (w.state !== "active") return false;
        } else if (w.status !== feedStatusFilter) {
          return false;
        }
      }
      return true;
    });
  }, [recruiterWorkers, feedSearch, feedCategoryFilter, feedStatusFilter]);

  // Recruiter high-level diagnostic analytics metrics
  const feedStats = useMemo(() => {
    const total = recruiterWorkers.length;
    const pending = recruiterWorkers.filter(w => w.status === "Pending" || !w.status).length;
    const visaApproved = recruiterWorkers.filter(w => w.status === "Visa Approved (xpact)").length;
    const visaRejected = recruiterWorkers.filter(w => w.status === "Visa Reject (xpact)").length;
    const arrived = recruiterWorkers.filter(w => w.final_status === "Arrived").length;
    const engineerHeld = recruiterWorkers.filter(w => w.state === "held").length;
    const engineerRejected = recruiterWorkers.filter(w => w.state === "rejected").length;
    const adminRejected = recruiterWorkers.filter(w => w.doc_upload_wa === "Rejected").length;
    return { total, pending, visaApproved, visaRejected, arrived, engineerHeld, engineerRejected, adminRejected };
  }, [recruiterWorkers]);

  // Filter list of workers for the Combined Master Records Archive in Intake portal
  const filteredMasterWorkers = useMemo(() => {
    return recruiterWorkers.filter((w) => {
      // Company filter (if admin has selected a specific company)
      if (currentUser?.role !== "recruiter" && masterCompanyFilter !== "All" && w.supply_company !== masterCompanyFilter) {
        return false;
      }
      // Category filter
      if (masterCategoryFilter !== "All" && w.category !== masterCategoryFilter) {
        return false;
      }
      // Text search
      if (masterSearch.trim() !== "") {
        const query = masterSearch.trim().toLowerCase();
        const matchesName = w.name.toLowerCase().includes(query);
        const matchesPassport = w.passport.toLowerCase().includes(query);
        if (!matchesName && !matchesPassport) return false;
      }
      return true;
    });
  }, [recruiterWorkers, masterCompanyFilter, masterCategoryFilter, masterSearch, currentUser]);

  // Sort workers for Master Archive
  const sortedMasterWorkers = useMemo(() => {
    const list = [...filteredMasterWorkers];
    if (!masterSortField) return list;

    list.sort((a, b) => {
      let valA = a[masterSortField] || "";
      let valB = b[masterSortField] || "";

      if (masterSortField === "created_at") {
        return masterSortOrder === "asc"
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return masterSortOrder === "asc" ? -1 : 1;
      if (strA > strB) return masterSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredMasterWorkers, masterSortField, masterSortOrder]);

  const toggleMasterSort = (field: keyof Worker) => {
    if (masterSortField === field) {
      setMasterSortOrder(masterSortOrder === "asc" ? "desc" : "asc");
    } else {
      setMasterSortField(field);
      setMasterSortOrder("asc");
    }
  };

  // Export Combined Master Records Archive in Intake Portal via SheetJS
  const handleExportMasterExcel = () => {
    const excelData = sortedMasterWorkers.map((w, idx) => ({
      "No.": idx + 1,
      "Worker Name": w.name,
      "Passport Number": w.passport,
      "Actual Job Category": w.category,
      "Supply Company": w.supply_company,
      "Pipeline State": w.state.toUpperCase(),
      "Visa Approved Date": w.visa_doc_date || "Pending",
      "Sending Batch": w.sending_batch || "None",
      "WhatsApp Checker": w.doc_upload_wa,
      "WhatsApp Status Date": w.doc_upload_wa_date ? new Date(w.doc_upload_wa_date).toLocaleDateString() : "N/A",
      "Last Stage Transition": w.last_updated || "N/A",
      "Visa Status": w.status,
      "Visa Status Date": w.status_date ? new Date(w.status_date).toLocaleDateString() : "N/A",
      "Bureau Placement": w.bureau,
      "Bureau Date": w.bureau_date ? new Date(w.bureau_date).toLocaleDateString() : "N/A",
      "Final Placement": w.final_status,
      "Final Status Date": w.final_status_date ? new Date(w.final_status_date).toLocaleDateString() : "N/A",
      "Database Creation": new Date(w.created_at).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Masterfile Report");

    const coLabel = currentUser?.role === "recruiter" 
      ? defaultCompany 
      : masterCompanyFilter === "All" ? "ALL" : masterCompanyFilter;
    const companyLabel = coLabel.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Sanken_Overseas_Masterfile_${companyLabel}_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div id="recruiter-intake-viewport" className="flex-1 overflow-y-auto p-6 space-y-6 max-h-screen">
      
      {/* Tab bar to switch between Bulk fast-intake and Interview Entry */}
      <div className="flex border-b border-slate-200" id="recruiter-intake-tabs">
        <button
          type="button"
          onClick={() => { setActiveSubTab("bulk"); setErrorMessage(""); setSuccessMessage(""); }}
          className={`px-6 py-3 text-xs font-mono font-bold uppercase border-b-2 transition-all cursor-pointer ${
            activeSubTab === "bulk"
              ? "border-accent text-accent animate-fade-in"
              : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
          }`}
        >
          Roster Intake &amp; Pipeline
        </button>
        <button
          type="button"
          id="tab-interview-entry"
          onClick={() => { setActiveSubTab("interview"); setErrorMessage(""); setSuccessMessage(""); }}
          className={`px-6 py-3 text-xs font-mono font-bold uppercase border-b-2 transition-all cursor-pointer ${
            activeSubTab === "interview"
              ? "border-accent text-accent animate-fade-in"
              : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
          }`}
        >
          Interview Entry
        </button>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 bg-red-50 text-bad border border-red-200 rounded-xl text-xs flex gap-3 items-start animate-fade-in font-sans">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Validation Rejected</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 text-success-green border border-green-200 rounded-xl text-xs flex gap-3 items-start animate-fade-in font-sans">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Transaction Executed</p>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {activeSubTab === "bulk" ? (
        <>
          {/* Stacked Layout: Bulk Add Form (1st), followed by Bureau Pending Queue */}
          <div className="space-y-6">
        
        {/* Bulk Intake Form Column */}
        <div className="w-full bg-card border border-slate-300 rounded-xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-ink font-display flex items-center gap-2">
                <UserPlus className="w-4 text-accent" />
                <span>Bulk Fast-Intake Register</span>
              </h2>
              <p className="text-xs text-slate-500">Register workers fast under state=pending. (Allocation limit is NOT affected yet).</p>
            </div>
            
            <button
              onClick={() => onRefresh()}
              className="text-[10px] font-mono text-slate-700 hover:text-accent border border-slate-300 rounded px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 cursor-pointer font-semibold shadow-sm"
            >
              Sync DB
            </button>
          </div>

          {/* Project Destination Banner */}
          {projectDetail ? (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 text-xs flex items-center justify-between font-sans shadow-sm">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-700 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900">Intake Target Project: </span>
                  <span className="text-indigo-700 font-extrabold">{projectDetail.name}</span>
                </div>
              </div>
              <div className="text-[11px] font-mono text-slate-600 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                Contract: <span className="font-bold text-indigo-900">{projectDetail.contract_number}</span>
              </div>
            </div>
          ) : (
            <div className="bg-rose-50 text-rose-800 border-2 border-rose-200 p-3 rounded-lg text-xs font-sans font-semibold">
              Warning: No active project focused. Registering workers will assign them to the fallback default project profile.
            </div>
          )}



          {/* Interactive CSV drag & drop area */}
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-5 text-center transition-all flex flex-col items-center justify-center gap-2 ${
              dragActive 
                ? "border-accent bg-accent/10" 
                : "border-slate-300 bg-slate-50/60 hover:bg-slate-100 hover:border-accent"
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-2.5 bg-white border border-slate-350 rounded-lg text-accent shadow-sm">
              <FileSpreadsheet className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Drag &amp; drop worker CSV roster here, or <span className="text-accent underline text-xs font-bold">browse computer</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-normal font-medium">
                Columns auto-matched: <code className="bg-white border border-slate-200 px-1 py-0.5 rounded font-mono text-[9px] text-indigo-700 font-bold">Name</code>, <code className="bg-white border border-slate-200 px-1 py-0.5 rounded font-mono text-[9px] text-indigo-700 font-bold">Passport</code>, <code className="bg-white border border-slate-200 px-1 py-0.5 rounded font-mono text-[9px] text-indigo-700 font-bold">Category</code>.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitBatch} className="space-y-4">
            
            {/* Batch Intake Allocation Summary Panel */}
            {totalRosterCount > 0 && (
              <div id="cohort-summary-panel" className="p-3.5 bg-paper/55 border border-line rounded-lg space-y-2.5 animate-fade-in font-sans">
                <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-muted">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    <ClipboardList className="w-3.5 h-3.5 text-accent" />
                    Pending Intake Summary
                  </span>
                  <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {totalRosterCount} Worker{totalRosterCount !== 1 ? 's' : ''} in list
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(categoryCounts).map(([catName, count]) => (
                    <div key={catName} className="bg-card border border-line p-2 rounded-md flex flex-col justify-between space-y-1">
                      <span className="text-[10px] text-muted truncate font-mono" title={catName}>{catName}</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-bold text-ink leading-none">{count}</span>
                        <span className="text-[8px] text-muted-more uppercase tracking-tight font-mono">assigned</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Real-time Passport Duplication Alert Banner */}
            {passportWarnings.length > 0 && (
              <div id="passport-duplicates-alert" className="p-3.5 bg-red-50 border border-bad/50 rounded-lg text-bad text-xs space-y-2 animate-fade-in font-sans">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-bad shrink-0" />
                  <span>Real-time Validation Warning: Duplicate Passports Spotted</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] leading-relaxed">
                  {passportWarnings.map((warn, i) => (
                    <li key={i}>
                      Passport <strong className="font-mono bg-red-100 text-bad px-1.5 py-0.5 rounded text-[10px]">{warn.passport}</strong>{" "}
                      {warn.type === "db" ? (
                        <span>
                          already exists in the <strong className="font-semibold text-bad">Sanken Overseas Master Database</strong> (referenced at Row {warn.rowIndices.map(idx => idx + 1).join(", ")}).
                        </span>
                      ) : (
                        <span>
                          is duplicated across rows <strong className="font-semibold text-bad">{warn.rowIndices.map(idx => idx + 1).join(", ")}</strong> in this active cohort draft.
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-muted leading-relaxed italic">
                  Alert: Submitting will be blocked until these duplicate passport registers are fixed or removed.
                </p>
              </div>
            )}

            {/* Scrollable grid table */}
            <div className="border-2 border-slate-350 rounded-lg overflow-hidden shadow-sm">
               <table className="w-full text-left text-xs text-slate-900 font-sans">
                <thead className="bg-slate-100 border-b-2 border-slate-350 text-slate-700 font-mono text-[10px] uppercase font-bold">
                  <tr>
                    <th className="p-3 pl-4 w-10 text-center border-r border-slate-200">Row</th>
                    <th className="p-3 border-r border-slate-200">Worker Full Name</th>
                    <th className="p-3 border-r border-slate-200">Passport Number</th>
                    <th className="p-3 border-r border-slate-200">Nationality</th>
                    <th className="p-3 border-r border-slate-200">Actual Job Category</th>
                    <th className="p-3 border-r border-slate-200">Doc Link / URL <span className="text-slate-500 text-[8px] font-sans lowercase italic font-normal">(optional)</span></th>
                    <th className="p-3 w-12 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-200 bg-white">
                  {rows.map((row, index) => {
                    const passportUpper = row.passport.trim().toUpperCase();
                    const isDuplicateInDb = existingPassportSet.has(passportUpper);
                    const isDuplicateInBatch = rowDuplicates[passportUpper] > 1;

                    return (
                      <tr key={index} className="hover:bg-slate-50/70 transition-colors">
                        {/* Num */}
                        <td className="p-2 text-center font-mono text-[11px] font-bold text-slate-600 bg-slate-50 border-r border-slate-200">
                          {index + 1}
                        </td>
                        
                        {/* Name input */}
                        <td className="p-1.5 border-r border-slate-200">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleRowChange(index, "name", e.target.value)}
                            onPaste={(e) => handlePasteBlock(index, e)}
                            placeholder="Full name (pasting tabbed allowed)"
                            className="w-full bg-white border border-slate-350 focus:border-accent focus:ring-1 focus:ring-accent rounded px-2.5 py-1.5 text-xs outline-none text-slate-900 font-medium shadow-xs"
                            required
                          />
                        </td>
                        
                        {/* Passport Input with dynamic warning */}
                        <td className="p-1.5 relative border-r border-slate-200">
                          <input
                            type="text"
                            value={row.passport}
                            onChange={(e) => handleRowChange(index, "passport", e.target.value.toUpperCase())}
                            onPaste={(e) => handlePasteBlock(index, e)}
                            placeholder="Passport eg: A281938"
                            className={`w-full bg-white border rounded px-2.5 py-1.5 text-xs outline-none mono-text font-bold shadow-xs ${
                              isDuplicateInDb || isDuplicateInBatch ? "border-rose-500 text-rose-900 bg-rose-55 font-extrabold" : "border-slate-350 focus:border-accent focus:ring-1 focus:ring-accent text-slate-900"
                            }`}
                            required
                          />
                          {(isDuplicateInDb || isDuplicateInBatch) && (
                            <span className="absolute right-3.5 top-3.5 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bad opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-bad"></span>
                            </span>
                          )}
                          {passportUpper && isDuplicateInDb && (
                            <div className="text-[9px] text-rose-800 font-bold mt-1 font-sans flex items-center gap-1 leading-tight bg-rose-100 border border-rose-200 px-1 py-0.5 rounded shadow-2xs">
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              <span>Exists in DB Masterfile</span>
                            </div>
                          )}
                          {passportUpper && !isDuplicateInDb && isDuplicateInBatch && (
                            <div className="text-[9px] text-rose-700 font-bold mt-1 font-sans flex items-center gap-1 leading-tight bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              <span>Repeated in list</span>
                            </div>
                          )}
                        </td>

                        {/* Nationality Select dropdown */}
                        <td className="p-1.5 border-r border-slate-200">
                          <select
                            value={row.nationality || ""}
                            onChange={(e) => handleRowChange(index, "nationality", e.target.value)}
                            className={`w-full border rounded px-1.5 py-1.5 text-xs outline-none transition-all shadow-xs ${
                              !row.nationality 
                                ? "border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold" 
                                : "bg-white border-slate-350 focus:border-accent focus:ring-1 focus:ring-accent text-slate-900 font-medium"
                            }`}
                            required
                          >
                            <option value="">-- Nationality --</option>
                            {dropdownOptions
                              .filter(d => d.field === "nationality")
                              .map(opt => (
                                <option key={opt.id} value={opt.value}>
                                  {opt.value}
                                </option>
                              ))}
                          </select>
                        </td>

                         {/* Category */}
                        <td className="p-1.5 border-r border-slate-200">
                          <select
                            value={row.category}
                            onChange={(e) => handleRowChange(index, "category", e.target.value)}
                            className={`w-full border rounded px-1.5 py-1.5 text-xs outline-none transition-all shadow-xs ${
                              !row.category 
                                ? "border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold" 
                                : "bg-white border-slate-350 focus:border-accent focus:ring-1 focus:ring-accent text-slate-900 font-medium"
                            }`}
                            required
                          >
                            <option value="">-- Select Actual Job Category --</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                          {row.category && (
                            (() => {
                              const cat = categories.find(c => c.name === row.category);
                              // Resolve company for this row
                              const resolvedCompany = row.supply_company || (currentUser?.role === "recruiter" ? (currentUser.recruiter_company || defaultCompany) : (companies[0]?.name || "KSJ"));
                              if (cat) {
                                const limit = cat.company_allocations?.[resolvedCompany] ?? 0;
                                const activeCount = workers.filter(w => w.category === cat.name && w.supply_company === resolvedCompany && w.state === "active").length;
                                const remaining = limit - activeCount;
                                return (
                                  <div className={`mt-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded-md border flex justify-between items-center transition-all ${remaining <= 0 ? 'text-rose-900 bg-rose-100 border-rose-300 font-extrabold shadow-2xs' : remaining <= 2 ? 'text-amber-950 bg-amber-100 border-amber-300 font-bold' : 'text-emerald-950 bg-emerald-100 border-emerald-300 font-bold'}`}>
                                    <span>Alloc limit: {limit}</span>
                                    <span>{remaining} left</span>
                                  </div>
                                );
                              }
                              return null;
                            })()
                          )}
                        </td>

                        {/* Related Doc Link Input */}
                        <td className="p-1.5 border-r border-slate-200">
                          <input
                            type="text"
                            value={row.doc_link || ""}
                            onChange={(e) => handleRowChange(index, "doc_link", e.target.value)}
                            placeholder="Link (Optional) e.g. Drive, Dropbox"
                            className="w-full bg-white border border-slate-350 focus:border-accent focus:ring-1 focus:ring-accent rounded px-2.5 py-1.5 text-xs outline-none text-slate-800 shadow-xs"
                          />
                        </td>

                        {/* Remove */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            className="text-slate-400 hover:text-bad p-1.5 rounded-md border border-slate-200 hover:border-red-200 hover:bg-red-50 transition-all shadow-2xs"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Form actions and Agency selection */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t-2 border-slate-250">
              {/* Global company selector to apply to all added workers */}
              <div className="flex items-center gap-2 w-full sm:w-auto font-sans">
                <span className="text-[10px] font-mono text-slate-700 uppercase tracking-wider shrink-0 font-bold">
                  Supply Agency Assigned:
                </span>
                {currentUser?.role === "recruiter" ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border-2 border-indigo-400 text-indigo-900 rounded-lg text-xs font-bold shadow-2xs">
                    <Lock className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                    <span>{defaultCompany}</span>
                  </div>
                ) : (
                  <select
                    value={rows[0]?.supply_company || ""}
                    onChange={(e) => {
                      const co = e.target.value;
                      const updated = rows.map((r) => ({ ...r, supply_company: co }));
                      setRows(updated);
                    }}
                    className="bg-white text-xs px-2.5 py-1.5 rounded-lg border-2 border-slate-350 outline-none font-bold cursor-pointer text-slate-900 shadow-xs focus:border-accent"
                  >
                    {companies.map(co => (
                      <option key={co.id} value={co.name}>{co.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Bulk Document Link Input (Shared Folder URL) */}
              <div className="flex flex-col gap-1 w-full sm:w-64 max-w-full">
                <label className="text-[9px] uppercase font-mono font-bold text-slate-700 flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Bulk Doc Link <span className="text-[8px] lowercase font-sans font-semibold text-slate-500 italic">(optional)</span></span>
                </label>
                <input
                  type="text"
                  value={bulkDocLinkInput}
                  onChange={(e) => setBulkDocLinkInput(e.target.value)}
                  placeholder="Optional batch Google Drive / Dropbox folder"
                  className="w-full bg-white border-2 border-slate-350 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-2.5 py-1.5 text-xs outline-none italic text-slate-900 font-bold shadow-xs whitespace-nowrap"
                />
              </div>

              {/* Rows Controls */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 border-2 border-slate-350 rounded-lg text-xs font-mono text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all font-bold cursor-pointer shadow-sm"
                >
                  + Add Next Row
                </button>
                <button
                  id="intake-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-accent hover:bg-accent/95 disabled:opacity-50 text-white rounded-lg text-xs font-mono uppercase tracking-wider font-bold transition-all cursor-pointer shadow-md"
                >
                  {isSubmitting ? "Syncing..." : `Register cohort (${rows.filter(r => r.name || r.passport).length} rows)`}
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* Bureau queue Column (Below Form) */}
        <div className="w-full bg-card border border-slate-300 rounded-xl p-5 shadow-md space-y-4">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                  <FileCheck2 className="w-4 text-emerald-600 animate-pulse" />
                  <span>Bureau Pending Queue</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">Workers whose visa got approved. Clear them for travel book.</p>
              </div>
              {/* Expand/Collapse All Toggles to quickly save space */}
              {bureauQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allExpanded = bureauQueue.every(w => expandedBureauWorkers[w.id]);
                    const newStates: {[key: string]: boolean} = {};
                    if (!allExpanded) {
                      bureauQueue.forEach(w => { newStates[w.id] = true; });
                    }
                    setExpandedBureauWorkers(newStates);
                  }}
                  className="px-3 py-1.5 text-[10px] font-mono font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-2 border-slate-300 rounded-md text-slate-700 transition self-end sm:self-center shrink-0 shadow-sm cursor-pointer"
                >
                  {bureauQueue.every(w => expandedBureauWorkers[w.id]) ? "Collapse All ◭" : "Expand All ⧩"}
                </button>
              )}
            </div>

            {/* Optional beautiful inline warning/alert notification for pending tasks */}
            {pendingBureauCount > 0 && (
              <div className="p-3 bg-amber-100 border-2 border-amber-400 rounded-lg text-xs text-amber-950 flex gap-2 items-center animate-pulse shadow-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="font-bold">
                  Action Required: {pendingBureauCount} candidate{pendingBureauCount !== 1 ? 's' : ''} awaiting Bureau Clearance action.
                </div>
              </div>
            )}

            {/* Filters specific to bureau pending queue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-300 shadow-sm">
              <input
                type="text"
                placeholder="Find by Name or Passport..."
                value={bureauSearch}
                onChange={(e) => setBureauSearch(e.target.value)}
                className="text-[11px] px-2.5 py-1.5 bg-white border-2 border-slate-350 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg outline-none w-full font-bold shadow-xs text-slate-900"
              />
              <div className="relative">
                <select
                  value={activeSupplyCompany}
                  disabled={currentUser?.role === "recruiter"}
                  onChange={(e) => setBureauCompanyFilter(e.target.value)}
                  className={`text-[11px] px-3 py-1.5 bg-white border-2 rounded-lg outline-none w-full font-bold pr-8 font-sans appearance-none shadow-xs text-slate-900 ${
                    currentUser?.role === "recruiter"
                      ? "border-amber-500 text-amber-950 cursor-not-allowed bg-amber-50/70"
                      : "border-slate-350 hover:border-indigo-600 focus:border-indigo-600 text-slate-900 cursor-pointer"
                  }`}
                >
                  {currentUser?.role === "recruiter" ? (
                    <option value={defaultCompany}>{defaultCompany}</option>
                  ) : (
                    <>
                      <option value="All" className="text-slate-900 font-bold">All Companies</option>
                      {companies.map(co => (
                        <option key={co.id} value={co.name} className="text-slate-900 font-medium">{co.name}</option>
                      ))}
                    </>
                  )}
                </select>
                <div className={`pointer-events-none absolute inset-y-0 right-3 flex items-center ${
                  currentUser?.role === "recruiter" ? "text-amber-600" : "text-indigo-600"
                }`}>
                  <Building className="w-3.5 h-3.5 stroke-[2]" />
                </div>
              </div>
            </div>
          </div>
          {/* Two-Column Layout for Bureau Pending List vs Ready for Departure List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Box 1: Bureau Pending List */}
            <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold font-display text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                  Bureau Pending List
                </span>
                {pendingBureauWorkers.length > 0 ? (
                  <span className="px-2.5 py-0.5 text-[11px] font-mono font-extrabold bg-red-50 text-red-650 border border-red-250 rounded-full shrink-0 animate-flash-red">
                    {pendingBureauWorkers.length} Pending
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-full shrink-0">
                    {pendingBureauWorkers.length} Pending
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[420px] pr-1.5 scrollbar-thin">
                {pendingBureauWorkers.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 bg-white rounded-lg text-slate-500 text-xs font-semibold my-2">
                    <p className="font-bold text-slate-700">Bureau pending is clear</p>
                    <p className="text-[10px] mt-1 text-slate-400">Awaiting worker status updates to &quot;Visa Approved (xpact)&quot;.</p>
                  </div>
                ) : (
                  pendingBureauWorkers.map((w, index) => {
                    const isCleared = w.bureau === "Complete";
                    const isRejected = w.bureau === "Reject";
                    const isExpanded = !!expandedBureauWorkers[w.id];

                    return (
                      <div 
                        key={w.id} 
                        className="border-2 border-slate-250 bg-white shadow-3xs rounded-xl hover:shadow-sm hover:border-indigo-400 focus-within:border-indigo-400 transition-all duration-200 flex flex-col text-xs leading-relaxed"
                      >
                        {/* Compact Header row */}
                        <div className="p-3 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                          {/* Index & Basic details */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Serial Number Badge */}
                            <span className="shrink-0 flex items-center justify-center font-mono font-extrabold text-[11px] w-6.5 h-6.5 bg-indigo-50 border-2 border-indigo-200 text-indigo-950 rounded-lg shadow-3xs">
                              {index + 1}
                            </span>
                            
                            <div className="min-w-0">
                              {/* Name (Compact typography) */}
                              <div className="font-display font-extrabold text-slate-900 text-[13px] truncate select-all">{w.name}</div>
                              <div className="font-mono text-[10px] font-bold text-slate-500 tracking-wide truncate">
                                {w.passport} &nbsp;⬩&nbsp; {w.category}
                              </div>
                            </div>
                          </div>

                          {/* Right column: Status waiting badge, Quick actions and Toggle */}
                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                            {/* Compact Bureau Waiting Duration */}
                            {w.bureau === "Pending" && (
                              <span className="px-2.5 py-1 font-mono text-[9.5px] font-extrabold text-rose-950 bg-rose-100 border border-rose-300 rounded-md shadow-3xs" title="Active waiting duration in Bureau queue">
                                {(() => {
                                  const baseDateStr = w.bureau_pending_at || w.last_updated || w.created_at;
                                  if (!baseDateStr) return "0 d";
                                  const baseTime = new Date(baseDateStr).getTime();
                                  const now = new Date().getTime();
                                  const diffTime = now - baseTime;
                                  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                  return `${Math.max(0, days)} days waiting`;
                                })()}
                              </span>
                            )}

                            {/* Compact Arrival Waiting Duration */}
                            {w.bureau === "Complete" && w.final_status !== "Arrived" && (
                              <span className="px-2.5 py-1 font-mono text-[9.5px] font-extrabold text-indigo-955 bg-indigo-50 border border-indigo-300 rounded-md shadow-3xs" title="Waiting for Arrival">
                                Waiting Arrival
                              </span>
                            )}

                            {/* Quick Action Decision pill (Complete / Reject buttons) */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                disabled={w.bureau !== "Pending"}
                                onClick={() => handleBureauAction(w.id, "Complete")}
                                className={`px-2.5 py-1 text-[9px] font-bold font-mono rounded uppercase tracking-tight transition-all border-2 cursor-pointer shadow-3xs ${
                                  isCleared 
                                    ? "bg-emerald-600 text-white border-emerald-600" 
                                    : "bg-white text-emerald-800 hover:bg-emerald-50 border-emerald-500"
                                } ${w.bureau !== "Pending" ? "opacity-35 cursor-not-allowed" : "cursor-pointer"}`}
                                title="Complete bureau action"
                              >
                                Complete
                              </button>
                              
                              <button
                                disabled={w.bureau !== "Pending"}
                                onClick={() => handleBureauAction(w.id, "Reject")}
                                className={`px-2.5 py-1 text-[9px] font-bold font-mono rounded uppercase tracking-tight transition-all border-2 cursor-pointer shadow-3xs ${
                                  isRejected 
                                    ? "bg-rose-600 text-white border-rose-600" 
                                    : "bg-white text-rose-800 hover:bg-rose-50 border-rose-400"
                                } ${w.bureau !== "Pending" ? "opacity-35 cursor-not-allowed" : "cursor-pointer"}`}
                                title="Reject bureau action"
                              >
                                Reject
                              </button>
                            </div>

                            {/* Dropdown toggle Chevron */}
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedBureauWorkers(prev => ({
                                  ...prev,
                                  [w.id]: !prev[w.id]
                                }));
                              }}
                              className="p-1 px-1.5 hover:bg-slate-200 rounded-lg transition text-slate-700 hover:text-slate-900 border border-slate-350 cursor-pointer shadow-3xs"
                              title={isExpanded ? "Collapse Details" : "Expand Details"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Details Panel */}
                        {isExpanded && (
                          <div className="px-3.5 pb-3.5 pt-2.5 border-t-2 border-dashed border-slate-300 bg-slate-50 rounded-b-lg flex flex-col gap-2.5 animate-fade-in text-xs text-slate-900 font-semibold shadow-inner">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                              <div>
                                <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Supply Company</span>
                                <span className="font-bold text-slate-800 leading-normal block truncate">{w.supply_company}</span>
                              </div>

                              <div>
                                <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Registered Since</span>
                                <span className="font-mono text-slate-700 font-bold block">
                                  {w.created_at ? new Date(w.created_at).toLocaleDateString() : "Pending"}
                                </span>
                              </div>
                            </div>

                            {/* Expandable Document Download Section */}
                            {(w.doc_link || w.bulk_doc_link) && (
                              <div className="mt-1 pb-1 flex flex-wrap gap-2 items-center border-t border-slate-300/80 pt-2">
                                {w.doc_link && (
                                  <a
                                    href={w.doc_link.startsWith("http") ? w.doc_link : `https://${w.doc_link}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 font-mono text-[9.5px] bg-indigo-50 border-2 border-indigo-200 hover:bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded font-bold transition shrink-0 shadow-3xs"
                                    title="Download Candidate Document"
                                  >
                                    <ExternalLink className="w-3 h-3 shrink-0 stroke-[2.5]" />
                                    <span>Worker Doc</span>
                                  </a>
                                )}
                                {w.bulk_doc_link && (
                                  <a
                                    href={w.bulk_doc_link.startsWith("http") ? w.bulk_doc_link : `https://${w.bulk_doc_link}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 font-mono text-[9.5px] bg-emerald-50 border-2 border-emerald-200 hover:bg-emerald-100 text-emerald-950 px-2.5 py-1 rounded font-bold transition shrink-0 shadow-3xs"
                                    title="Download Bulk Batch Folder"
                                  >
                                    <FolderOpen className="w-3 h-3 shrink-0 stroke-[2.5]" />
                                    <span>Bulk Folder</span>
                                  </a>
                                )}
                              </div>
                            )}
                            
                            {/* Helper explanation details */}
                            <div className="text-[9.5px] text-slate-650 bg-white/70 p-2 rounded-lg border border-slate-250 leading-snug">
                              Waiting duration tracker:{" "}
                              <strong className="text-slate-800">
                                {(() => {
                                  const baseDateStr = w.bureau_pending_at || w.last_updated || w.created_at;
                                  if (!baseDateStr) return "0 Days";
                                  const baseTime = new Date(baseDateStr).getTime();
                                  const now = new Date().getTime();
                                  const diffTime = now - baseTime;
                                  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                  return `${days} Days active since coordinator marked approved.`;
                                })()}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Box 2: Ready for Departure List */}
            <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold font-display text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <Plane className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
                  Ready for Departure List
                </span>
                {readyForDepartureWorkers.length > 0 ? (
                  <span className="px-2.5 py-0.5 text-[11px] font-mono font-extrabold bg-red-50 text-red-650 border border-red-250 rounded-full shrink-0 animate-flash-red">
                    {readyForDepartureWorkers.length} Ready
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full shrink-0">
                    {readyForDepartureWorkers.length} Ready
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[420px] pr-1.5 scrollbar-thin">
                {readyForDepartureWorkers.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 bg-white rounded-lg text-slate-500 text-xs font-semibold my-2">
                    <p className="font-bold text-slate-700">Ready for Departure is clear</p>
                    <p className="text-[10px] mt-1 text-slate-400">Workers cleared from Bureau queue will automatically stream here.</p>
                  </div>
                ) : (
                  readyForDepartureWorkers.map((w, index) => {
                    const isCleared = w.bureau === "Complete";
                    const isRejected = w.bureau === "Reject";
                    const isExpanded = !!expandedBureauWorkers[w.id];

                    return (
                      <div 
                        key={w.id} 
                        className="border-2 border-slate-205 bg-white shadow-3xs rounded-xl hover:shadow-sm hover:border-indigo-400 focus-within:border-indigo-400 transition-all duration-200 flex flex-col text-xs leading-relaxed"
                      >
                        {/* Compact Header row */}
                        <div className="p-3 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                          {/* Index & Basic details */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Serial Number Badge */}
                            <span className="shrink-0 flex items-center justify-center font-mono font-extrabold text-[11px] w-6.5 h-6.5 bg-emerald-50 border-2 border-emerald-200 text-emerald-950 rounded-lg shadow-3xs">
                              {index + 1}
                            </span>
                            
                            <div className="min-w-0">
                              {/* Name (Compact typography) */}
                              <div className="font-display font-extrabold text-slate-900 text-[13px] truncate select-all">{w.name}</div>
                              <div className="font-mono text-[10px] font-bold text-slate-500 tracking-wide truncate">
                                {w.passport} &nbsp;⬩&nbsp; {w.category}
                              </div>
                            </div>
                          </div>

                          {/* Right column: Status waiting badge, Quick actions and Toggle */}
                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                            {/* Compact Bureau Waiting Duration */}
                            {w.bureau === "Pending" && (
                              <span className="px-2.5 py-1 font-mono text-[9.5px] font-extrabold text-rose-955 bg-rose-100 border border-rose-300 rounded-md shadow-3xs" title="Active waiting duration in Bureau queue">
                                {(() => {
                                  const baseDateStr = w.bureau_pending_at || w.last_updated || w.created_at;
                                  if (!baseDateStr) return "0 d";
                                  const baseTime = new Date(baseDateStr).getTime();
                                  const now = new Date().getTime();
                                  const diffTime = now - baseTime;
                                  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                  return `${Math.max(0, days)} days waiting`;
                                })()}
                              </span>
                            )}

                            {/* Compact Arrival Waiting Duration */}
                            {w.bureau === "Complete" && w.final_status !== "Arrived" && (
                              <span className="px-2.5 py-1 font-mono text-[9.5px] font-extrabold text-indigo-955 bg-indigo-50 border border-indigo-300 rounded-md shadow-3xs" title="Waiting for Arrival">
                                Waiting Arrival
                              </span>
                            )}

                            {/* Quick Action Decision pill (Complete / Reject buttons) */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                disabled={w.bureau !== "Pending"}
                                onClick={() => handleBureauAction(w.id, "Complete")}
                                className={`px-2.5 py-1 text-[9px] font-bold font-mono rounded uppercase tracking-tight transition-all border-2 cursor-pointer shadow-3xs ${
                                  isCleared 
                                    ? "bg-emerald-600 text-white border-emerald-600" 
                                    : "bg-white text-emerald-800 hover:bg-emerald-50 border-emerald-500"
                                } ${w.bureau !== "Pending" ? "opacity-35 cursor-not-allowed" : "cursor-pointer"}`}
                                title="Complete bureau action"
                              >
                                Complete
                              </button>
                              
                              <button
                                disabled={w.bureau !== "Pending"}
                                onClick={() => handleBureauAction(w.id, "Reject")}
                                className={`px-2.5 py-1 text-[9px] font-bold font-mono rounded uppercase tracking-tight transition-all border-2 cursor-pointer shadow-3xs ${
                                  isRejected 
                                    ? "bg-rose-600 text-white border-rose-600" 
                                    : "bg-white text-rose-800 hover:bg-rose-50 border-rose-400"
                                } ${w.bureau !== "Pending" ? "opacity-35 cursor-not-allowed" : "cursor-pointer"}`}
                                title="Reject bureau action"
                              >
                                Reject
                              </button>
                            </div>

                            {/* Dropdown toggle Chevron */}
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedBureauWorkers(prev => ({
                                  ...prev,
                                  [w.id]: !prev[w.id]
                                }));
                              }}
                              className="p-1 px-1.5 hover:bg-slate-200 rounded-lg transition text-slate-700 hover:text-slate-900 border border-slate-350 cursor-pointer shadow-3xs"
                              title={isExpanded ? "Collapse Details" : "Expand Details"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Details Panel */}
                        {isExpanded && (
                          <div className="px-3.5 pb-3.5 pt-2.5 border-t-2 border-dashed border-slate-300 bg-slate-50 rounded-b-lg flex flex-col gap-2.5 animate-fade-in text-xs text-slate-900 font-semibold shadow-inner">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                              <div>
                                <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Supply Company</span>
                                <span className="font-bold text-slate-800 leading-normal block truncate">{w.supply_company}</span>
                              </div>

                              <div>
                                <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Registered Since</span>
                                <span className="font-mono text-slate-700 font-bold block">
                                  {w.created_at ? new Date(w.created_at).toLocaleDateString() : "Pending"}
                                </span>
                              </div>
                            </div>

                            {/* Expandable Document Download Section */}
                            {(w.doc_link || w.bulk_doc_link) && (
                              <div className="mt-1 pb-1 flex flex-wrap gap-2 items-center border-t border-slate-300/80 pt-2">
                                {w.doc_link && (
                                  <a
                                    href={w.doc_link.startsWith("http") ? w.doc_link : `https://${w.doc_link}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 font-mono text-[9.5px] bg-indigo-50 border-2 border-indigo-200 hover:bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded font-bold transition shrink-0 shadow-3xs"
                                    title="Download Candidate Document"
                                  >
                                    <ExternalLink className="w-3 h-3 shrink-0 stroke-[2.5]" />
                                    <span>Worker Doc</span>
                                  </a>
                                )}
                                {w.bulk_doc_link && (
                                  <a
                                    href={w.bulk_doc_link.startsWith("http") ? w.bulk_doc_link : `https://${w.bulk_doc_link}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 font-mono text-[9.5px] bg-emerald-50 border-2 border-emerald-200 hover:bg-emerald-100 text-emerald-950 px-2.5 py-1 rounded font-bold transition shrink-0 shadow-3xs"
                                    title="Download Bulk Batch Folder"
                                  >
                                    <FolderOpen className="w-3 h-3 shrink-0 stroke-[2.5]" />
                                    <span>Bulk Folder</span>
                                  </a>
                                )}
                              </div>
                            )}
                            
                            {/* Helper explanation details */}
                            <div className="text-[9.5px] text-slate-650 bg-white/70 p-2 rounded-lg border border-slate-250 leading-snug">
                              Waiting duration tracker:{" "}
                              <strong className="text-slate-800">
                                {(() => {
                                  const baseDateStr = w.bureau_pending_at || w.last_updated || w.created_at;
                                  if (!baseDateStr) return "0 Days";
                                  const baseTime = new Date(baseDateStr).getTime();
                                  const now = new Date().getTime();
                                  const diffTime = now - baseTime;
                                  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                  return `${days} Days active since coordinator marked approved.`;
                                })()}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-105 rounded-lg text-[10px] leading-relaxed text-indigo-800">
            <strong>Recruiter Guideline:</strong> Visas approved by operational team automatically stream into this Bureau list. Mark &quot;Complete&quot; only when bureau permits and deposits are validated.
          </div>
        </div>

      </div>

      {/* 🛡️ Engineering & Coordinator Decisions Audit Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in" id="engineering-coordinator-audits-dashboard">
        {/* Engineer Decisions Card */}
        <div className="bg-card border border-slate-300 rounded-xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <h3 className="text-xs font-bold text-slate-900 font-display flex items-center gap-1.5 animate-fade-in">
              <span className="p-1 px-1.5 bg-indigo-100 text-indigo-950 font-extrabold rounded text-xs font-mono">ENG</span>
              <span>ENGINEER DECISIONS AUDIT</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">Gate Decisions</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {/* Engineer Authorized */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-250 text-center flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-mono text-slate-700 uppercase font-bold">Authorized</span>
              <span className="text-2xl font-serif text-emerald-600 font-extrabold block my-1">
                {recruiterWorkers.filter(w => w.state === "active").length}
              </span>
              <span className="text-[9px] text-slate-500 font-mono font-semibold">Deployment OK</span>
            </div>

            {/* Engineer Hold */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-250 text-center flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-mono text-slate-700 uppercase font-bold">On Hold</span>
              <span className="text-2xl font-serif text-amber-600 font-extrabold block my-1">
                {recruiterWorkers.filter(w => w.state === "held").length}
              </span>
              <span className="text-[9px] text-slate-500 font-mono font-semibold">Gate Hold</span>
            </div>

            {/* Engineer Rejected */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-250 text-center flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-mono text-slate-700 uppercase font-bold">Rejected</span>
              <span className="text-2xl font-serif text-bad font-extrabold block my-1">
                {recruiterWorkers.filter(w => w.state === "rejected").length}
              </span>
              <span className="text-[9px] text-slate-500 font-mono font-semibold">Gate Denied</span>
            </div>
          </div>
        </div>

        {/* Coordinator Decisions Card */}
        <div className="bg-card border border-slate-300 rounded-xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <h3 className="text-xs font-bold text-indigo-900 font-display flex items-center gap-1.5 animate-fade-in">
              <span className="p-1 px-1.5 bg-indigo-150 text-indigo-950 font-extrabold rounded text-xs font-mono">COR</span>
              <span>COORDINATOR WA & PLACEMENT AUDIT</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">Operations Pipeline</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* WA Upload Completed */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-250 text-center flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-mono text-slate-700 uppercase font-bold">WA Uploaded</span>
              <span className="text-2xl font-serif text-indigo-700 font-extrabold block my-1">
                {recruiterWorkers.filter(w => w.doc_upload_wa === "Yes").length}
              </span>
              <span className="text-[9px] text-slate-500 font-mono font-semibold">WhatsApp Doc Ok</span>
            </div>

            {/* WA Pending */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-250 text-center flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-mono text-slate-700 uppercase font-bold">WA Pending</span>
              <span className="text-2xl font-serif text-slate-700 font-extrabold block my-1">
                {recruiterWorkers.filter(w => w.doc_upload_wa !== "Yes").length}
              </span>
              <span className="text-[9px] text-slate-500 font-mono font-semibold">Awaiting Upload</span>
            </div>

            {/* Visa/Bureau Rejected */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-250 text-center flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] font-mono text-slate-700 uppercase font-bold">Rejected</span>
              <span className="text-2xl font-serif text-bad font-extrabold block my-1">
                {recruiterWorkers.filter(w => w.status === "Visa Reject (xpact)").length + recruiterWorkers.filter(w => w.bureau === "Reject").length}
              </span>
              <span className="text-[9px] text-slate-500 font-mono font-semibold">Embassy/Bureau</span>
            </div>
          </div>
        </div>
      </div>


      {/* Recruiter Candidates Live Data Feed Section */}
      <div className="bg-card border border-line rounded-xl shadow-sm overflow-hidden font-sans space-y-4">
        {/* Header and Counters Band */}
        <div className="p-5 border-b border-line bg-paper/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-accent" />
              <span>{defaultCompany} — Candidates Register Feed</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Live status overview, allocation stages, and travel updates of candidates registered by your agency.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <span className="px-2.5 py-1 bg-stone-100 border border-line rounded-md text-ink">
              Total Feed: <strong className="font-semibold text-accent">{feedStats.total}</strong>
            </span>
            <span className="px-2.5 py-1 bg-amber-500/10 border border-gold/30 text-gold-900 rounded-md animate-pulse">
              Pending: <strong className="font-bold">{feedStats.pending}</strong>
            </span>
            <span className="px-2.5 py-1 bg-green-50 text-success-green border border-success-green/20 rounded-md">
              Visa Approved: <strong className="font-bold">{feedStats.visaApproved}</strong>
            </span>
            <span className="px-2.5 py-1 bg-red-50 text-bad border border-bad/20 rounded-md">
              Visa Reject: <strong className="font-bold">{feedStats.visaRejected}</strong>
            </span>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
              Arrived: <strong className="font-bold">{feedStats.arrived}</strong>
            </span>
            {feedStats.engineerHeld > 0 && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-md font-semibold">
                ⏸️ Eng Hold: <strong>{feedStats.engineerHeld}</strong>
              </span>
            )}
            {feedStats.engineerRejected > 0 && (
              <span className="px-2.5 py-1 bg-red-100 text-red-950 border border-red-300 rounded-md font-semibold animate-bounce">
                ❌ Eng Rejected: <strong>{feedStats.engineerRejected}</strong>
              </span>
            )}
            {feedStats.adminRejected > 0 && (
              <span className="px-2.5 py-1 bg-rose-100 text-rose-950 border border-rose-300 rounded-md font-bold animate-pulse flex items-center gap-1">
                ❌ Admin Rejected: <strong>{feedStats.adminRejected}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Live Filter controls */}
        <div className="px-5 py-2 flex flex-col sm:flex-row gap-3 items-center justify-between bg-paper/10 select-none">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search candidate name or passport..."
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
              className="w-full text-xs bg-paper border border-line rounded-lg py-2 pl-9 pr-4 text-ink focus:border-accent outline-none font-mono"
            />
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-3.5" />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Category filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto text-xs">
              <span className="text-muted shrink-0 text-[11px] font-mono">Category:</span>
              <select
                value={feedCategoryFilter}
                onChange={(e) => setFeedCategoryFilter(e.target.value)}
                className="bg-paper border border-line rounded-md px-2 py-1 text-xs outline-none cursor-pointer text-ink font-semibold"
              >
                <option value="All">All types</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto text-xs">
              <span className="text-muted shrink-0 text-[11px] font-mono">Status:</span>
              <select
                value={feedStatusFilter}
                onChange={(e) => setFeedStatusFilter(e.target.value)}
                className="bg-paper border border-line rounded-md px-2 py-1 text-xs outline-none cursor-pointer text-ink font-semibold"
              >
                <option value="All">All statuses</option>
                <option value="Pending">Pending Validation</option>
                <option value="Visa Approved (xpact)">Visa Approved (xpact)</option>
                <option value="Visa Reject (xpact)">Visa Reject (xpact)</option>
                <option value="Applied second time">Applied second time</option>
                <option value="Engineer_Held">Engineer: ON HOLD (⏸️)</option>
                <option value="Engineer_Rejected">Engineer: REJECTED (❌)</option>
                <option value="Engineer_Pending">Engineer: Awaiting Review (⏳)</option>
                <option value="Engineer_Active">Engineer: Approved/Cleared (✓)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Candidates Feed Table list */}
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-left text-xs font-sans text-ink">
            <thead className="bg-paper text-muted font-mono text-[9px] uppercase tracking-wider">
              <tr>
                <th className="p-3 pl-5">Worker Candidate Name</th>
                <th className="p-3">Passport Number</th>
                <th className="p-3">Bureau Category</th>
                <th className="p-3">Actual Job Category</th>
                <th className="p-3">Gate / Visa Status</th>
                <th className="p-3">Bureau Clearance</th>
                <th className="p-3">Departure Progress</th>
                <th className={currentUser?.role === "admin" ? "p-3 text-right" : "p-3 pr-5 text-right"}>Register Date</th>
                {currentUser?.role === "admin" && (
                  <th className="p-3 pr-5 text-right">Delete Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/45">
              {filteredFeed.length === 0 ? (
                <tr>
                  <td colSpan={currentUser?.role === "admin" ? 9 : 8} className="p-10 text-center text-muted text-xs">
                    No matching candidates found inside your data feed. Clear filters or add new workers above.
                  </td>
                </tr>
              ) : (
                filteredFeed.map((w) => {
                  let statusColor = "bg-stone-100 text-stone-700 border-stone-200";
                  if (w.status === "Visa Approved (xpact)") {
                    statusColor = "bg-green-50 text-success-green border-green-200";
                  } else if (w.status === "Visa Reject (xpact)") {
                    statusColor = "bg-red-50 text-bad border-red-200";
                  } else if (w.status === "Applied second time") {
                    statusColor = "bg-blue-50 text-blue-700 border-blue-200";
                  } else if (w.status === "Pending" || !w.status) {
                    statusColor = "bg-amber-50 text-gold-900 border-amber-200";
                  }

                  let bureauColor = "bg-stone-100 text-stone-600 border-stone-200";
                  if (w.bureau === "Complete") {
                    bureauColor = "bg-green-50 text-success-green border-green-200";
                  } else if (w.bureau === "Reject") {
                    bureauColor = "bg-red-50 text-bad border-red-200";
                  } else if (w.bureau === "Pending") {
                    bureauColor = "bg-amber-50 text-amber-700 border-amber-200";
                  }

                  let travelColor = "bg-stone-100 text-stone-600 border-stone-200";
                  if (w.final_status === "Arrived") {
                    travelColor = "bg-indigo-50 text-indigo-700 border-indigo-200";
                  } else if (w.final_status === "Booked") {
                    travelColor = "bg-teal-50 text-teal-700 border-teal-200";
                  } else if (w.final_status === "Pending") {
                    travelColor = "bg-stone-50 text-muted border-line/50";
                  }

                  let rowBg = "hover:bg-paper/30 transition-colors";
                  if (w.state === "rejected") {
                    rowBg = "bg-red-500/[0.03] hover:bg-red-500/[0.06] transition-colors border-l-4 border-l-[#A30000]";
                  } else if (w.state === "held") {
                    rowBg = "bg-amber-500/[0.03] hover:bg-amber-500/[0.06] transition-colors border-l-4 border-l-amber-500";
                  }

                  return (
                    <tr key={w.id} className={rowBg}>
                      {/* Name */}
                      <td className="p-3 pl-5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-ink text-xs block">{w.name}</span>
                          {w.state === "rejected" && (
                            <span className="px-1.5 py-0.5 text-[8.5px] font-mono font-bold bg-stretch bg-red-100 text-[#A30000] border border-red-200 rounded leading-none shrink-0">
                              ENGINEER REJECTED
                            </span>
                          )}
                          {w.state === "held" && (
                            <span className="px-1.5 py-0.5 text-[8.5px] font-mono font-bold bg-stretch bg-amber-100 text-amber-800 border border-amber-350 rounded leading-none shrink-0">
                              ON HOLD
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <span className="text-[10px] text-muted font-mono block">ID: {w.id.slice(0, 8)}</span>
                          {w.state === "rejected" && (
                            <div className="mt-1 bg-red-50 border border-red-200 rounded-md p-2 max-w-[280px] shadow-sm">
                              <span className="text-[10.5px] font-bold text-[#A30000] font-sans flex items-center gap-1">
                                ❌ Rejected by Site Engineer
                              </span>
                              {w.gate_reject_reason && (
                                <p className="text-[10px] text-red-700 bg-white border border-red-100 rounded px-1.5 py-1 font-mono block mt-1 mb-1.5 break-words">
                                  <strong>Reason:</strong> {w.gate_reject_reason}
                                </p>
                              )}
                              
                              {/* Resubmit and Delete option for Recruiting Agents */}
                              <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-red-100/60">
                                <button
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    if (confirm(`Are you sure you want to resubmit candidate "${w.name}" for engineer review?`)) {
                                      await onUpdateWorker(w.id, {
                                        state: "pending",
                                        gate_reject_reason: ""
                                      });
                                      onRefresh();
                                    }
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-[9.5px] font-bold text-white bg-accent hover:bg-accent/90 rounded border border-accent/20 transition-all cursor-pointer shadow-2xs"
                                  title="Resubmit worker to the engineer review pool"
                                >
                                  🔄 Resubmit
                                </button>
                                
                                {confirmDeleteId === w.id ? (
                                  <div className="flex items-center gap-1 shrink-0 bg-white px-1.5 py-0.5 rounded border border-red-200">
                                    <span className="text-[9px] font-bold text-[#A30000] animate-pulse font-mono leading-none shrink-0">Confirm?</span>
                                    <button
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        if (onDeleteWorker) {
                                          await onDeleteWorker(w.id);
                                        }
                                        setConfirmDeleteId(null);
                                      }}
                                      className="px-1 py-0.5 text-[8.5px] font-bold text-white bg-red-600 hover:bg-[#A30000] rounded leading-none cursor-pointer"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setConfirmDeleteId(null);
                                      }}
                                      className="px-1 py-0.5 text-[8.5px] font-semibold text-ink bg-white border border-line rounded leading-none cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setConfirmDeleteId(w.id);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-[9.5px] font-bold text-white bg-red-650 hover:bg-red-750 rounded border border-red-200/20 transition-all cursor-pointer shadow-2xs shadow-red-105"
                                    title="Delete candidate record permanently"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {w.state === "held" && (
                            <div className="mt-1 bg-amber-50 border border-amber-250/60 rounded p-1.5 max-w-[240px] shadow-2xs">
                              <span className="text-[9px] font-bold text-amber-950 font-sans block">
                                ⏸️ Placed on HOLD by Engineer
                              </span>
                              <span className="text-[9px] text-amber-850 font-mono block mt-0.5">
                                Awaiting approval clearance
                              </span>
                            </div>
                          )}
                          {w.doc_upload_wa === "Rejected" && (
                            <div className="mt-1 bg-rose-50 border border-rose-200 rounded-md p-2.5 max-w-[280px] shadow-sm">
                              <span className="text-[10.5px] font-bold text-rose-800 font-sans flex items-center gap-1">
                                ❌ Rejected by Admin 2 (Ops)
                              </span>
                              {w.wa_doc_reject_reason && (
                                <p className="text-[10px] text-rose-700 bg-white border border-rose-100 rounded px-1.5 py-1 font-mono block mt-1 mb-1.5 break-words">
                                  <strong>Reason:</strong> {w.wa_doc_reject_reason}
                                </p>
                              )}
                              <div className="text-[9px] text-slate-500 font-mono space-y-0.5 mt-1.5">
                                <div className="flex justify-between">
                                  <span>Submit Date:</span>
                                  <span className="font-bold text-slate-700">{w.admin2_submit_date || (w.created_at ? w.created_at.split("T")[0] : "—")}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Rejected Date:</span>
                                  <span className="font-bold text-slate-700">{w.admin2_reject_date || w.doc_upload_wa_date || "—"}</span>
                                </div>
                                {w.admin2_resubmit_date && (
                                  <div className="flex justify-between">
                                    <span>Resubmit Date:</span>
                                    <span className="font-bold text-slate-700">{w.admin2_resubmit_date}</span>
                                  </div>
                                )}
                              </div>
                              
                              {!showLinkInput[w.id] ? (
                                <div className="mt-3 pt-2 border-t border-rose-200/40">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setShowLinkInput(prev => ({ ...prev, [w.id]: true }));
                                    }}
                                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded shadow-3xs cursor-pointer transition-all uppercase tracking-wider font-mono"
                                  >
                                    🔗 Enter Corrected Link
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-3 pt-2 border-t border-rose-200/40 space-y-2 animate-fade-in">
                                  <div>
                                    <label className="text-[9px] uppercase font-mono font-bold text-slate-700 block mb-1">
                                      Corrected Document Link / URL:
                                    </label>
                                    <input
                                      type="text"
                                      value={resubmitLinks[w.id] !== undefined ? resubmitLinks[w.id] : (w.doc_link || "")}
                                      onChange={(e) => {
                                        setResubmitLinks(prev => ({
                                          ...prev,
                                          [w.id]: e.target.value
                                        }));
                                      }}
                                      placeholder="Paste corrected Google Drive or Dropbox link..."
                                      className="w-full bg-white border border-rose-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded px-2.5 py-1.5 text-xs outline-none text-slate-900 font-medium"
                                      autoFocus
                                    />
                                  </div>

                                  <div className="flex items-center gap-1.5 justify-end">
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setShowLinkInput(prev => ({ ...prev, [w.id]: false }));
                                      }}
                                      className="px-2 py-1 text-[9.5px] font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        const finalLink = resubmitLinks[w.id] !== undefined ? resubmitLinks[w.id] : (w.doc_link || "");
                                        if (!finalLink.trim()) {
                                          alert("Please enter a corrected document link before resubmitting.");
                                          return;
                                        }
                                        if (confirm(`Are you sure you want to resubmit candidate "${w.name}" to Admin 2 with the corrected link?`)) {
                                          await onUpdateWorker(w.id, {
                                            doc_upload_wa: "Pending",
                                            doc_link: finalLink.trim(),
                                            admin2_resubmit_date: new Date().toISOString().split("T")[0]
                                          });
                                          setShowLinkInput(prev => ({ ...prev, [w.id]: false }));
                                          onRefresh();
                                        }
                                      }}
                                      className="flex items-center gap-1 px-2.5 py-1 text-[9.5px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded border border-indigo-500/20 transition-all cursor-pointer shadow-2xs"
                                      title="Resubmit worker to Admin 2"
                                    >
                                      🔄 Resubmit
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Passport */}
                      <td className="p-3 font-mono text-xs font-semibold text-ink">
                        {w.passport}
                      </td>

                      {/* Bureau Category */}
                      <td className="p-3">
                        {w.bureau_category ? (
                          <span className="px-2 py-0.5 bg-paper border border-line text-xs font-medium rounded-md text-ink">
                            {w.bureau_category}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic text-[10px] select-none">—</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-paper border border-line text-xs font-medium rounded-md text-ink">
                          {w.category}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded-full border ${statusColor}`}>
                          {w.status || "Pending"}
                        </span>
                        <span className="block text-[9px] text-[#8a8175] font-mono mt-0.5" title="Visa Status Change Date">
                          {w.status_date || (w.created_at ? w.created_at.split("T")[0] : "—")}
                        </span>
                      </td>

                      {/* Bureau */}
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] uppercase font-mono font-medium rounded-full border ${bureauColor}`}>
                          {w.bureau || "Pending"}
                        </span>
                        <span className="block text-[9px] text-[#8a8175] font-mono mt-0.5" title="Bureau Change Date">
                          {w.bureau_date || (w.bureau_completed_at ? w.bureau_completed_at.split("T")[0] : (w.created_at ? w.created_at.split("T")[0] : "—"))}
                        </span>
                      </td>

                      {/* Travel progress */}
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] uppercase font-mono font-medium rounded border ${travelColor}`}>
                          {w.final_status || "Pending"}
                        </span>
                        <span className="block text-[9px] text-[#8a8175] font-mono mt-0.5" title="Final Placement Change Date">
                          {w.final_status_date || (w.created_at ? w.created_at.split("T")[0] : "—")}
                        </span>
                      </td>

                      {/* Date */}
                      <td className={currentUser?.role === "admin" ? "p-3 text-right text-[10px] text-muted font-mono" : "p-3 pr-5 text-right text-[10px] text-muted font-mono"}>
                        {w.created_at ? new Date(w.created_at).toLocaleDateString() : "Pending sync"}
                      </td>

                      {currentUser?.role === "admin" && (
                        <td className="p-3 pr-5 text-right whitespace-nowrap">
                          {confirmDeleteId === w.id ? (
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <span className="text-[9px] text-[#A30000] font-mono font-bold animate-pulse">Delete?</span>
                              <button
                                onClick={async () => {
                                  if (onDeleteWorker) {
                                    await onDeleteWorker(w.id);
                                  }
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-0.5 text-[9px] font-bold text-white bg-bad hover:bg-bad/90 rounded border border-bad transition-all cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-0.5 text-[9px] font-medium text-ink bg-paper border border-line hover:bg-paper/85 rounded transition-all cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(w.id)}
                              className="inline-flex items-center justify-center p-1.5 text-bad hover:bg-bad/10 rounded-md transition-colors cursor-pointer"
                              title="Delete candidate record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
      ) : (
        <div className="space-y-6 animate-fade-in" id="interview-entry-subtab">
          {/* Beautiful Two-Column Interview Entry Form */}
          <div className="bg-card border border-slate-300 rounded-xl p-5 shadow-md space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-ink font-display flex items-center gap-2">
                  <UserCheck2 className="w-4 text-accent" />
                  <span>{editingWorkerId ? `Edit Interview Entry — ${interviewForm.name}` : "New Interview Entry Portal"}</span>
                </h2>
                <p className="text-xs text-slate-500">
                  {editingWorkerId 
                    ? "Modify pre-registered candidate interview details. Changes synchronize instantly across Sanken Overseas portals."
                    : "Register candidate interview and assessment data. Values populate the Sanken Overseas Assessment Portal for Engineers."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRefresh()}
                className="text-[10px] font-mono text-slate-700 hover:text-accent border border-slate-300 rounded px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 cursor-pointer font-semibold shadow-sm"
              >
                Sync DB
              </button>
            </div>

            <form onSubmit={handleSubmitInterview} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SR Number */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block flex items-center justify-between">
                    <span>SR Number</span>
                    <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-mono">Auto-Assigned</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={interviewForm.sr_number}
                    placeholder="Auto-assigning identifier..."
                    className="w-full text-xs bg-slate-100 border border-slate-300 rounded-lg p-2.5 outline-none font-mono font-medium shadow-3xs text-slate-600 cursor-not-allowed"
                  />
                </div>

                {/* Employee Number */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">Employee Number</label>
                  <input
                    type="text"
                    value={interviewForm.employee_number}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, employee_number: e.target.value }))}
                    placeholder="e.g. EMP-9052"
                    className="w-full text-xs bg-white border border-slate-350 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg p-2.5 outline-none font-medium shadow-3xs text-slate-900"
                  />
                </div>

                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Full Name (as per passport) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={interviewForm.name}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. RAMESH PRASAD ADHIKARI"
                    className="w-full text-xs bg-white border border-slate-350 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg p-2.5 outline-none font-medium shadow-3xs text-slate-900"
                  />
                </div>

                {/* NIC Number */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block flex items-center justify-between">
                    <span>NIC Number <span className="text-red-500">*</span></span>
                    <span className="text-[10px] font-mono text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Mandatory</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={interviewForm.nic_number}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, nic_number: e.target.value }))}
                    placeholder="e.g. 12-34-56789 (Mandatory ID card)"
                    className="w-full text-xs bg-white border border-slate-350 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg p-2.5 outline-none font-medium shadow-3xs text-slate-900"
                  />
                </div>

                {/* Passport Number */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">Passport Number</label>
                  <input
                    type="text"
                    value={interviewForm.passport}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, passport: e.target.value }))}
                    placeholder="e.g. PN-123456"
                    className="w-full text-xs bg-white border border-slate-350 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg p-2.5 outline-none font-mono font-medium shadow-3xs text-slate-900"
                  />
                </div>

                {/* Organization */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Organization (Auto Recruiting Agency)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={activeSupplyCompany}
                    className="w-full text-xs bg-slate-100 border border-slate-300 rounded-lg p-2.5 outline-none font-medium shadow-3xs text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Designation / Trade */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">Designation / Trade</label>
                  <select
                    value={interviewForm.category}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full text-xs bg-white border border-slate-350 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg p-2.5 outline-none font-semibold shadow-3xs text-slate-900 cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Project (site) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">Project (site)</label>
                  <select
                    value={interviewForm.project_id}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, project_id: e.target.value }))}
                    className="w-full text-xs bg-white border border-slate-350 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg p-2.5 outline-none font-semibold shadow-3xs text-slate-900 cursor-pointer"
                  >
                    {projects.map(proj => (
                      <option key={proj.id} value={proj.id}>{proj.name} ({proj.location})</option>
                    ))}
                  </select>
                </div>

                {/* Interviewer Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Interviewer Name (Engineer Only)</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={interviewForm.interviewer_name}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, interviewer_name: e.target.value }))}
                    placeholder="Will be filled by site engineer"
                    className="w-full text-xs bg-slate-100 border border-slate-300 rounded-lg p-2.5 outline-none font-medium shadow-3xs text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Pass or Fail */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Pass or Fail (Engineer Only)</span>
                  </label>
                  <select
                    disabled
                    value={interviewForm.interview_status}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, interview_status: e.target.value as any }))}
                    className="w-full text-xs bg-slate-100 border border-slate-300 rounded-lg p-2.5 outline-none font-semibold shadow-3xs text-slate-500 cursor-not-allowed"
                  >
                    <option value="Pending">Pending Evaluation</option>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                  </select>
                </div>

                {/* Marks Received */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Marks Received (Engineer Only)</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={interviewForm.interview_marks}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, interview_marks: e.target.value }))}
                    placeholder="Awaiting engineer assessment"
                    className="w-full text-xs bg-slate-100 border border-slate-300 rounded-lg p-2.5 outline-none font-medium shadow-3xs text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Test Required */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Test Required or Not (Engineer Only)</span>
                  </label>
                  <select
                    disabled
                    value={interviewForm.test_required}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, test_required: e.target.value as any }))}
                    className="w-full text-xs bg-slate-100 border border-slate-300 rounded-lg p-2.5 outline-none font-semibold shadow-3xs text-slate-500 cursor-not-allowed"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Remarks</label>
                <textarea
                  value={interviewForm.remarks}
                  onChange={(e) => setInterviewForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Additional notes about qualifications or assessment..."
                  rows={3}
                  className="w-full text-xs bg-white border border-slate-350 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg p-2.5 outline-none font-medium shadow-3xs text-slate-900"
                />
              </div>

              {/* Actions Button Panel */}
              <div className="flex items-center gap-3 justify-end pt-2">
                {editingWorkerId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWorkerId(null);
                      setInterviewForm({
                        sr_number: "",
                        employee_number: "",
                        name: "",
                        nic_number: "",
                        passport: "",
                        category: "",
                        project_id: projects[0]?.id || "",
                        remarks: "",
                        interviewer_name: "",
                        interview_status: "Pending",
                        interview_marks: "",
                        test_required: "No"
                      });
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 border-2 border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shadow-sm"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isInterviewSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent hover:bg-accent/95 disabled:opacity-50 text-white rounded-lg text-xs font-mono uppercase tracking-wider font-bold transition-all cursor-pointer shadow-md"
                >
                  {isInterviewSubmitting ? "Saving..." : editingWorkerId ? "Update Interview Record" : "Store Interview Entry Record"}
                </button>
              </div>
            </form>
          </div>

          {/* Table: Registered Interview Entries List */}
          <div className="bg-card border border-line rounded-xl shadow-sm overflow-hidden font-sans space-y-4">
            <div className="p-5 border-b border-line bg-paper/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-accent" />
                  <span>Interview Entry Archives — {currentUser?.role === "recruiter" ? defaultCompany : activeSupplyCompany}</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Stored interview roster records with designated site projects and assessment marks.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search name, NIC, or passport..."
                  value={interviewSearch}
                  onChange={(e) => setInterviewSearch(e.target.value)}
                  className="w-full text-xs bg-paper border border-line rounded-lg py-2 pl-9 pr-4 text-ink focus:border-accent outline-none font-mono"
                />
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-3.5" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans text-ink">
                <thead className="bg-paper text-muted font-mono text-[9px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 pl-5">SR / Employee No</th>
                    <th className="p-3">Candidate &amp; NIC Number</th>
                    <th className="p-3">Passport Number</th>
                    <th className="p-3">Designation / Project</th>
                    <th className="p-3">Interviewer &amp; Marks</th>
                    <th className="p-3 text-center">Interview Result</th>
                    <th className="p-3 text-center">Test Required</th>
                    <th className="p-3 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/45">
                  {filteredInterviewRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-muted text-xs">
                        No pre-entered interview records found. Fill out the form above to save a new interview.
                      </td>
                    </tr>
                  ) : (
                    filteredInterviewRecords.map((w) => {
                      let statusText = "Pending";
                      let resColor = "bg-amber-50 text-amber-700 border-amber-200";
                      if (w.status === "Selected") {
                        statusText = "Pass";
                        resColor = "bg-green-50 text-success-green border-green-200";
                      } else if (w.status === "Rejected") {
                        statusText = "Fail";
                        resColor = "bg-red-50 text-bad border-red-200";
                      }

                      const categoryMap: { [key: string]: string } = {
                        bar_bender: "Bar Bender",
                        finishing_carpenter: "Finishing Carpenter",
                        labour: "Labur",
                        mason: "Meson",
                        rigger: "Rigger",
                        shoutering_carpenter: "Shoutering Carpenter",
                        spray_painter: "Spray Painter",
                        survey_helper: "Survey Helper",
                        tile_mason: "Tile Mason",
                        wall_painter: "Wall Painter"
                      };
                      const categoryName = categoryMap[w.positionId] || w.positionId || "Labur";
                      const overallScore = calculateOverallScore(w);

                      return (
                        <tr key={w.id} className="hover:bg-paper/10 transition-colors font-semibold">
                          <td className="p-3 pl-5 font-mono text-[11px] text-slate-700">
                            <div>SR: {w.referenceId || "—"}</div>
                            <div className="text-[10px] text-slate-400">EMP: —</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{w.name}</div>
                            <div className="text-[10px] text-slate-500 font-semibold font-mono">NIC: {w.nicNumber || "—"}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-800">{w.passportNumber || "—"}</td>
                          <td className="p-3">
                            <div className="text-slate-900">{categoryName}</div>
                            <div className="text-[10px] text-indigo-700">{w.projectName || "Default Site"}</div>
                          </td>
                          <td className="p-3 text-slate-800">
                            <div className="text-slate-700 font-medium">Interviewer: {w.assessor || "—"}</div>
                            <div className="text-[10px] font-mono text-slate-500">Marks: {overallScore || "—"}</div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded-full border ${resColor}`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded ${
                              w.practicalTestRequired ? "bg-amber-100 text-amber-850 border border-amber-200" : "bg-slate-100 text-slate-600"
                            }`}>
                              {w.practicalTestRequired ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="p-3 pr-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2 justify-end">
                              <button
                                onClick={() => handleEditInterviewClick(w)}
                                className="px-2 py-1 text-[10px] font-mono font-bold bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded cursor-pointer shadow-3xs"
                              >
                                Edit
                              </button>
                              {currentUser?.role === "admin" && (
                                <button
                                  onClick={async () => {
                                    if (onDeleteCandidate && confirm(`Are you sure you want to delete interview candidate "${w.name}"?`)) {
                                      await onDeleteCandidate(w.id);
                                      onRefresh();
                                    }
                                  }}
                                  className="p-1 text-bad hover:bg-red-50 rounded cursor-pointer animate-fade-in"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
