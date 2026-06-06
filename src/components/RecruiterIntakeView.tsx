import React, { useState, useMemo, useRef } from "react";
import { Category, Company, Worker, ProjectDetail, User } from "../types";
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
  ExternalLink
} from "lucide-react";
import * as XLSX from "xlsx";

interface RecruiterIntakeViewProps {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  projectDetail?: ProjectDetail | null;
  onRefresh: () => void;
  onBulkAdd: (newWorkers: { name: string; passport: string; category: string; supply_company: string }[]) => Promise<{ success: boolean; message?: string }>;
  onUpdateWorker: (id: string, updates: Partial<Worker>) => Promise<boolean>;
  currentUser?: User | null;
  onDeleteWorker?: (id: string) => Promise<boolean>;
}

interface WorkerFormInput {
  name: string;
  passport: string;
  category: string;
  supply_company: string;
  doc_link?: string;
}

export default function RecruiterIntakeView({
  workers,
  categories,
  companies,
  projectDetail,
  onRefresh,
  onBulkAdd,
  onUpdateWorker,
  currentUser,
  onDeleteWorker
}: RecruiterIntakeViewProps) {
  
  // Bulk document link input state
  const [bulkDocLinkInput, setBulkDocLinkInput] = useState("");

  // Bulk entry lines
  const [rows, setRows] = useState<WorkerFormInput[]>([
    { name: "", passport: "", category: "", supply_company: companies[0]?.name || "", doc_link: "" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

      const finalNameIdx = nameIdx !== -1 ? nameIdx : 0;
      const finalPassportIdx = passportIdx !== -1 ? passportIdx : 1;
      const finalCatIdx = catIdx !== -1 ? catIdx : (lines[0].length > 2 ? 2 : -1);
      const finalCoIdx = coIdx !== -1 ? coIdx : (lines[0].length > 3 ? 3 : -1);

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

        if (name && passport) {
          parsedRows.push({
            name: name.replace(/^["']|["']$/g, "").trim(),
            passport: passport.replace(/^["']|["']$/g, "").trim(),
            category: matchedCat,
            supply_company: currentUser?.role === "recruiter" ? defaultCompany : matchedCo,
            doc_link: ""
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

  // Track passport validation errors
  const existingPassportSet = useMemo(() => {
    return new Set(workers.map(w => w.passport.trim().toUpperCase()));
  }, [workers]);

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
        doc_link: ""
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      setRows([{ name: "", passport: "", category: "", supply_company: currentUser?.role === "recruiter" ? defaultCompany : (companies[0]?.name || ""), doc_link: "" }]);
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
      setErrorMessage("Every worker registered requires a Name, Passport, and a valid Job Category.");
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
        bulk_doc_link: bulkDocLinkInput.trim()
      }));

      const res = await onBulkAdd(payload);
      if (res.success) {
        setSuccessMessage(`Success: ${payload.length} workers registered under State: PENDING.`);
        setRows([{ name: "", passport: "", category: "", supply_company: currentUser?.role === "recruiter" ? defaultCompany : (companies[0]?.name || ""), doc_link: "" }]);
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
      if (feedStatusFilter !== "All" && w.status !== feedStatusFilter) {
        return false;
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
    return { total, pending, visaApproved, visaRejected, arrived };
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
      "Job Category": w.category,
      "Supply Company": w.supply_company,
      "Pipeline State": w.state.toUpperCase(),
      "Visa Approved Date": w.visa_doc_date || "Pending",
      "Sending Batch": w.sending_batch || "None",
      "WhatsApp Checker": w.doc_upload_wa,
      "Last Stage Transition": w.last_updated || "N/A",
      "Visa Status": w.status,
      "Bureau Placement": w.bureau,
      "Final Placement": w.final_status,
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

      {/* Grid Split: Left (Bulk Add form), Right (Bureau Pending Queue) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Bulk Intake Form Column */}
        <div className="xl:col-span-7 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink font-display flex items-center gap-2">
                <UserPlus className="w-4 text-accent" />
                <span>Bulk Fast-Intake Register</span>
              </h2>
              <p className="text-xs text-muted">Register workers fast under state=pending. (Allocation limit is NOT affected yet).</p>
            </div>
            
            <button
              onClick={() => onRefresh()}
              className="text-[10px] font-mono text-muted hover:text-accent border border-line rounded px-2 py-1 bg-paper/30 cursor-pointer"
            >
              Sync DB
            </button>
          </div>

          {/* Project Destination Banner */}
          {projectDetail ? (
            <div className="bg-amber-50/40 border border-line rounded-lg p-3 text-xs flex items-center justify-between font-sans">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-accent shrink-0" />
                <div>
                  <span className="font-semibold text-ink">Intake Target Project: </span>
                  <span className="text-accent font-bold">{projectDetail.name}</span>
                </div>
              </div>
              <div className="text-[10px] font-mono text-muted">
                Contract: <span className="font-semibold text-ink">{projectDetail.contract_number}</span>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 text-bad border border-bad/20 p-3 rounded-lg text-xs font-sans">
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
            className={`cursor-pointer border-2 border-dashed rounded-xl p-4 text-center transition-all flex flex-col items-center justify-center gap-2 ${
              dragActive 
                ? "border-accent bg-accent/5" 
                : "border-line hover:border-accent hover:bg-paper/20"
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-2 bg-paper border border-line rounded-lg text-accent">
              <FileSpreadsheet className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink">
                Drag &amp; drop worker CSV roster here, or <span className="text-accent underline text-xs font-semibold">browse computer</span>
              </p>
              <p className="text-[10px] text-muted mt-1 leading-normal">
                Columns auto-matched: <code className="bg-paper px-1 py-0.5 rounded font-mono text-[9px]">Name</code>, <code className="bg-paper px-1 py-0.5 rounded font-mono text-[9px]">Passport</code>, <code className="bg-paper px-1 py-0.5 rounded font-mono text-[9px]">Category</code>.
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
            <div className="border border-line/60 rounded-lg overflow-hidden">
               <table className="w-full text-left text-xs text-ink font-sans">
                <thead className="bg-paper text-muted font-mono text-[9px] uppercase">
                  <tr>
                    <th className="p-2.5 pl-3 w-10 text-center">Row</th>
                    <th className="p-2.5">Worker Full Name</th>
                    <th className="p-2.5">Passport Number</th>
                    <th className="p-2.5">Job Category</th>
                    <th className="p-2.5">Doc Link / URL <span className="opacity-70 text-[8px] font-sans lowercase italic">(optional)</span></th>
                    <th className="p-2.5 w-12 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/45">
                  {rows.map((row, index) => {
                    const passportUpper = row.passport.trim().toUpperCase();
                    const isDuplicateInDb = existingPassportSet.has(passportUpper);
                    const isDuplicateInBatch = rowDuplicates[passportUpper] > 1;

                    return (
                      <tr key={index} className="hover:bg-paper/10">
                        {/* Num */}
                        <td className="p-2 text-center font-mono text-[10px] text-muted">
                          {index + 1}
                        </td>
                        
                        {/* Name input */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleRowChange(index, "name", e.target.value)}
                            onPaste={(e) => handlePasteBlock(index, e)}
                            placeholder="Full name (pasting tabbed allowed)"
                            className="w-full bg-paper/20 border border-line/60 focus:border-accent rounded px-2 py-1.5 text-xs outline-none"
                            required
                          />
                        </td>
                        
                        {/* Passport Input with dynamic warning */}
                        <td className="p-1.5 relative">
                          <input
                            type="text"
                            value={row.passport}
                            onChange={(e) => handleRowChange(index, "passport", e.target.value.toUpperCase())}
                            onPaste={(e) => handlePasteBlock(index, e)}
                            placeholder="Passport eg: A281938"
                            className={`w-full bg-paper/20 border rounded px-2 py-1.5 text-xs outline-none mono-text font-medium ${
                              isDuplicateInDb || isDuplicateInBatch ? "border-bad/80 text-bad bg-red-50/40 font-semibold" : "border-line/60 focus:border-accent"
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
                            <div className="text-[9px] text-bad font-semibold mt-1 font-sans flex items-center gap-1 leading-tight">
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              <span>Exists in DB Masterfile</span>
                            </div>
                          )}
                          {passportUpper && !isDuplicateInDb && isDuplicateInBatch && (
                            <div className="text-[9px] text-bad font-semibold mt-1 font-sans flex items-center gap-1 leading-tight">
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              <span>Repeated in list</span>
                            </div>
                          )}
                        </td>

                         {/* Category */}
                        <td className="p-1.5">
                          <select
                            value={row.category}
                            onChange={(e) => handleRowChange(index, "category", e.target.value)}
                            className={`w-full bg-paper/20 border rounded px-1.5 py-1.5 text-xs outline-none transition-all ${
                              !row.category 
                                ? "border-amber-500/50 hover:border-amber-500 text-amber-700 bg-amber-50/10 font-medium" 
                                : "border-line/60 focus:border-accent text-ink"
                            }`}
                            required
                          >
                            <option value="">-- Select Category --</option>
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
                                  <div className={`mt-1 text-[10px] uppercase font-mono px-1 rounded flex justify-between items-center transition-all ${remaining <= 0 ? 'text-red-700 bg-red-100/50 font-semibold' : remaining <= 2 ? 'text-amber-700 bg-amber-100/50 font-semibold' : 'text-green-700 bg-green-100/50'}`}>
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
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.doc_link || ""}
                            onChange={(e) => handleRowChange(index, "doc_link", e.target.value)}
                            placeholder="Link (Optional) e.g. Drive, Dropbox"
                            className="w-full bg-paper/20 border border-line/60 focus:border-accent rounded px-2 py-1.5 text-xs outline-none"
                          />
                        </td>

                        {/* Remove */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            className="text-muted hover:text-bad p-1 rounded hover:bg-red-50/50"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Form actions and Agency selection */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-line/50">
              {/* Global company selector to apply to all added workers */}
              <div className="flex items-center gap-2 w-full sm:w-auto font-sans">
                <span className="text-[10px] font-mono text-muted uppercase tracking-wider shrink-0">
                  Supply Agency Assigned:
                </span>
                {currentUser?.role === "recruiter" ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/5 border border-accent/20 text-accent rounded-lg text-xs font-semibold">
                    <Lock className="w-3.5 h-3.5 shrink-0 text-accent/80" />
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
                    className="bg-paper/30 text-xs px-2.5 py-1.5 rounded-lg border border-line outline-none font-medium cursor-pointer"
                  >
                    {companies.map(co => (
                      <option key={co.id} value={co.name}>{co.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Bulk Document Link Input (Shared Folder URL) */}
              <div className="flex flex-col gap-1 w-full sm:w-64 max-w-full">
                <label className="text-[9px] uppercase font-mono font-bold text-muted flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5 text-accent shrink-0 animate-pulse" />
                  <span>Bulk Doc Link <span className="text-[8px] lowercase font-sans font-normal opacity-70 italic">(optional)</span></span>
                </label>
                <input
                  type="text"
                  value={bulkDocLinkInput}
                  onChange={(e) => setBulkDocLinkInput(e.target.value)}
                  placeholder="Optional batch Google Drive / Dropbox folder"
                  className="w-full bg-paper/20 border border-line/60 focus:border-accent rounded-lg px-2.5 py-1.5 text-xs outline-none italic font-medium"
                />
              </div>

              {/* Rows Controls */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-line rounded-lg text-xs font-mono text-muted hover:text-ink hover:bg-paper/40 transition-all cursor-pointer"
                >
                  + Add Next Row
                </button>
                <button
                  id="intake-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-accent hover:bg-accent/95 disabled:opacity-50 text-white rounded-lg text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                >
                  {isSubmitting ? "Syncing..." : `Register cohort (${rows.filter(r => r.name || r.passport).length} rows)`}
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* Bureau queue Column (Right) */}
        <div className="xl:col-span-5 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between max-h-screen">
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-ink font-display flex items-center gap-2">
                <FileCheck2 className="w-4 text-success-green animate-pulse" />
                <span>Bureau Pending Queue</span>
              </h2>
              <p className="text-xs text-muted">Workers whose visa got approved. Clear them for travel book.</p>
            </div>

            {/* Optional beautiful inline warning/alert notification for pending tasks */}
            {pendingBureauCount > 0 && (
              <div className="p-3 bg-amber-500/10 border border-gold/40 rounded-lg text-xs text-amber-700 flex gap-2 items-center animate-pulse">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="font-semibold">
                  Action Required: {pendingBureauCount} candidate{pendingBureauCount !== 1 ? 's' : ''} awaiting Bureau Clearance action.
                </div>
              </div>
            )}

            {/* Filters specific to bureau pending queue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-paper/40 rounded-lg border border-line/60">
              <input
                type="text"
                placeholder="Find Pending name..."
                value={bureauSearch}
                onChange={(e) => setBureauSearch(e.target.value)}
                className="text-[11px] px-2.5 py-1.5 bg-card border border-line rounded outline-none w-full"
              />
              <div className="relative">
                <select
                  value={activeSupplyCompany}
                  disabled={currentUser?.role === "recruiter"}
                  onChange={(e) => setBureauCompanyFilter(e.target.value)}
                  className={`text-[11px] px-3 py-1.5 bg-card border rounded outline-none w-full font-semibold pr-8 font-sans appearance-none ${
                    currentUser?.role === "recruiter"
                      ? "border-[#D97706]/40 text-[#D97706]/90 cursor-not-allowed bg-paper"
                      : "border-accent/25 hover:border-accent text-accent cursor-pointer"
                  }`}
                >
                  {currentUser?.role === "recruiter" ? (
                    <option value={defaultCompany}>{defaultCompany}</option>
                  ) : (
                    <>
                      <option value="All" className="text-ink font-medium">All Companies</option>
                      {companies.map(co => (
                        <option key={co.id} value={co.name} className="text-ink font-medium">{co.name}</option>
                      ))}
                    </>
                  )}
                </select>
                <div className={`pointer-events-none absolute inset-y-0 right-3 flex items-center ${
                  currentUser?.role === "recruiter" ? "text-[#D97706]/80" : "text-accent"
                }`}>
                  <Building className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* List display */}
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[350px] pr-1 scrollbar-thin">
            {bureauQueue.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-line rounded-lg text-muted text-xs">
                <p className="font-semibold text-ink">Bureau pending is clear</p>
                <p className="text-[10px]">Awaiting worker status updates to &quot;Visa Approved (xpact)&quot;.</p>
              </div>
            ) : (
              bureauQueue.map((w) => {
                const isCleared = w.bureau === "Complete";
                const isRejected = w.bureau === "Reject";

                return (
                  <div key={w.id} className="p-3 border border-line/75 rounded-lg bg-paper/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs leading-relaxed">
                    <div>
                      <div className="font-display font-semibold text-ink">{w.name}</div>
                      <div className="font-mono text-[10px] text-muted">{w.passport} | {w.category}</div>
                      <div className="text-[10px] text-muted truncate max-w-[170px]" title={w.supply_company}>
                        {w.supply_company}
                      </div>

                      {/* Attached Document Links */}
                      {(w.doc_link || w.bulk_doc_link) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                          {w.doc_link && (
                            <a
                              href={w.doc_link.startsWith("http") ? w.doc_link : `https://${w.doc_link}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[9px] bg-accent/10 border border-accent/20 hover:bg-accent/15 text-accent px-1.5 py-0.5 rounded font-semibold transition-all shrink-0"
                              title="Download Candidate Document"
                            >
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              <span>Worker Doc</span>
                            </a>
                          )}
                          {w.bulk_doc_link && (
                            <a
                              href={w.bulk_doc_link.startsWith("http") ? w.bulk_doc_link : `https://${w.bulk_doc_link}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[9px] bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/15 text-emerald-700 px-1.5 py-0.5 rounded font-semibold transition-all shrink-0"
                              title="Download Bulk Batch Folder"
                            >
                              <FolderOpen className="w-2.5 h-2.5 shrink-0" />
                              <span>Bulk (Batch) Doc</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                     {/* Waiting Duration since coordinator changed status */}
                    {w.bureau === "Pending" && (
                      <div className="flex flex-col items-start sm:items-center justify-center font-mono text-[#DC2626] bg-[#FEF2F2] border border-[#FCA5A5]/60 rounded-md px-3 py-1.5 leading-tight animate-fade-in shrink-0 self-start sm:self-center">
                        <span className="font-bold tracking-tight uppercase text-[9px] text-[#B91C1C] opacity-90 block">
                          Waiting in Bureau list
                        </span>
                        <span className="font-extrabold text-xs block">
                          {(() => {
                            const baseDateStr = w.bureau_pending_at || w.last_updated || w.created_at;
                            if (!baseDateStr) return "0 Days";
                            const baseTime = new Date(baseDateStr).getTime();
                            const now = new Date().getTime();
                            const diffTime = now - baseTime;
                            const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            const maxDays = Math.max(0, days);
                            return `${maxDays} Day${maxDays === 1 ? "" : "s"}`;
                          })()}
                        </span>
                      </div>
                    )}

                    {/* Waiting Duration since bureau completed to arrival */}
                    {w.bureau === "Complete" && w.final_status !== "Arrived" && (
                      <div className="flex flex-col items-start sm:items-center justify-center font-mono text-[#DC2626] bg-[#FEF2F2] border border-[#FCA5A5]/60 rounded-md px-3 py-1.5 leading-tight animate-fade-in shrink-0 self-start sm:self-center">
                        <span className="font-bold tracking-tight uppercase text-[9px] text-[#B91C1C] opacity-90 block">
                          Waiting for Arrival
                        </span>
                        <span className="font-extrabold text-xs block">
                          {(() => {
                            const baseDateStr = w.bureau_completed_at || w.last_updated || w.created_at;
                            if (!baseDateStr) return "0 Days";
                            const baseTime = new Date(baseDateStr).getTime();
                            const now = new Date().getTime();
                            const diffTime = now - baseTime;
                            const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            const maxDays = Math.max(0, days);
                            return `${maxDays} Day${maxDays === 1 ? "" : "s"}`;
                          })()}
                        </span>
                      </div>
                    )}

                    {/* Quick approvals decision pill */}
                    <div className="flex sm:flex-col items-stretch gap-1.5 w-full sm:w-auto shrink-0">
                      <div className="flex gap-1">
                        <button
                          disabled={w.bureau !== "Pending"}
                          onClick={() => handleBureauAction(w.id, "Complete")}
                          className={`flex-1 px-2.5 py-1 text-[10px] uppercase font-mono rounded tracking-tight transition-all border ${
                            isCleared 
                              ? "bg-success-green text-white border-success-green" 
                              : "bg-card text-success-green hover:bg-success-green/10 border-success-green/30"
                          } ${w.bureau !== "Pending" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          Complete
                        </button>
                        <button
                          disabled={w.bureau !== "Pending"}
                          onClick={() => handleBureauAction(w.id, "Reject")}
                          className={`flex-1 px-2.5 py-1 text-[10px] uppercase font-mono rounded tracking-tight transition-all border ${
                            isRejected 
                              ? "bg-bad text-white border-bad" 
                              : "bg-card text-bad hover:bg-bad/10 border-bad/30"
                          } ${w.bureau !== "Pending" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          Reject
                        </button>
                      </div>
                      
                      {w.bureau && w.bureau !== "Pending" && (
                        <div className="text-[9px] text-muted text-center font-mono">
                          Decision: {w.bureau.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-105 rounded-lg text-[10px] leading-relaxed text-indigo-800">
            <strong>Recruiter Guideline:</strong> Visas approved by operational team automatically stream into this Bureau list. Mark &quot;Complete&quot; only when bureau permits and deposits are validated.
          </div>
        </div>

      </div>

      {/* 🛡️ Engineering & Coordinator Decisions Audit Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in" id="engineering-coordinator-audits-dashboard">
        {/* Engineer Decisions Card */}
        <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-line/40 pb-2.5">
            <h3 className="text-xs font-semibold text-ink font-display flex items-center gap-1.5 animate-fade-in">
              <span className="p-1 px-1.5 bg-accent/10 text-accent font-bold rounded text-xs font-mono">ENG</span>
              <span>ENGINEER DECISIONS AUDIT</span>
            </h3>
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Gate Decisions</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {/* Engineer Authorized */}
            <div className="bg-paper/40 p-3 rounded-lg border border-line/40 text-center flex flex-col justify-between">
              <span className="text-[10px] font-mono text-muted uppercase font-semibold">Authorized</span>
              <span className="text-2xl font-serif text-success-green font-bold block my-1">
                {recruiterWorkers.filter(w => w.state === "active").length}
              </span>
              <span className="text-[9px] text-[#8a8175] font-mono">Deployment OK</span>
            </div>

            {/* Engineer Hold */}
            <div className="bg-paper/40 p-3 rounded-lg border border-line/40 text-center flex flex-col justify-between">
              <span className="text-[10px] font-mono text-muted uppercase font-semibold">On Hold</span>
              <span className="text-2xl font-serif text-amber-600 font-bold block my-1">
                {recruiterWorkers.filter(w => w.state === "held").length}
              </span>
              <span className="text-[9px] text-[#8a8175] font-mono">Gate Hold</span>
            </div>

            {/* Engineer Rejected */}
            <div className="bg-paper/40 p-3 rounded-lg border border-line/40 text-center flex flex-col justify-between">
              <span className="text-[10px] font-mono text-muted uppercase font-semibold">Rejected</span>
              <span className="text-2xl font-serif text-bad font-bold block my-1">
                {recruiterWorkers.filter(w => w.state === "rejected").length}
              </span>
              <span className="text-[9px] text-[#8a8175] font-mono">Gate Denied</span>
            </div>
          </div>
        </div>

        {/* Coordinator Decisions Card */}
        <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-line/40 pb-2.5">
            <h3 className="text-xs font-semibold text-indigo-600 font-display flex items-center gap-1.5 animate-fade-in">
              <span className="p-1 px-1.5 bg-indigo-500/10 text-indigo-600 font-bold rounded text-xs font-mono">COR</span>
              <span>COORDINATOR WA & PLACEMENT AUDIT</span>
            </h3>
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Operations Pipeline</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* WA Upload Completed */}
            <div className="bg-paper/40 p-3 rounded-lg border border-line/40 text-center flex flex-col justify-between">
              <span className="text-[10px] font-mono text-muted uppercase font-semibold">WA Uploaded</span>
              <span className="text-2xl font-serif text-info font-bold block my-1">
                {recruiterWorkers.filter(w => w.doc_upload_wa === "Yes").length}
              </span>
              <span className="text-[9px] text-[#8a8175] font-mono">WhatsApp Doc Ok</span>
            </div>

            {/* WA Pending */}
            <div className="bg-paper/40 p-3 rounded-lg border border-line/40 text-center flex flex-col justify-between">
              <span className="text-[10px] font-mono text-muted uppercase font-semibold">WA Pending</span>
              <span className="text-2xl font-serif text-stone-600 font-bold block my-1">
                {recruiterWorkers.filter(w => w.doc_upload_wa === "No").length}
              </span>
              <span className="text-[9px] text-[#8a8175] font-mono">Awaiting Upload</span>
            </div>

            {/* Visa/Bureau Rejected */}
            <div className="bg-paper/40 p-3 rounded-lg border border-line/40 text-center flex flex-col justify-between">
              <span className="text-[10px] font-mono text-muted uppercase font-semibold">Rejected</span>
              <span className="text-2xl font-serif text-bad font-bold block my-1">
                {recruiterWorkers.filter(w => w.status === "Visa Reject (xpact)").length + recruiterWorkers.filter(w => w.bureau === "Reject").length}
              </span>
              <span className="text-[9px] text-[#8a8175] font-mono">Embassy/Bureau</span>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 Combined Master Records Archive Card */}
      <div className="bg-card border border-line rounded-xl shadow-sm overflow-hidden font-sans select-none space-y-4 animate-fade-in" id="combined-master-records-archive-intake">
        {/* Table Control Header */}
        <div className="p-5 border-b border-line bg-paper/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-ink font-display">Combined Master Records Archive</h3>
            <p className="text-[11px] text-muted font-sans pt-0.5">
              Showing <span className="font-semibold text-accent">{sortedMasterWorkers.length}</span> of <span className="font-semibold">{recruiterWorkers.length}</span> matching rows
            </p>
          </div>

          <button
            onClick={handleExportMasterExcel}
            className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-success-green text-white hover:bg-success-green/90 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>XLS Export Master</span>
          </button>
        </div>

        {/* Filters and Search controls */}
        <div className="px-5 py-2 flex flex-col sm:flex-row gap-3 items-center justify-between bg-paper/10">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search master name or passport..."
              value={masterSearch}
              onChange={(e) => setMasterSearch(e.target.value)}
              className="w-full text-xs bg-paper border border-line rounded-lg py-2 pl-9 pr-4 text-ink focus:border-accent outline-none font-mono"
            />
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-3.5" />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* If Admin, they can filter by Supply Company */}
            {currentUser?.role !== "recruiter" && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted text-[11px] font-mono">Company:</span>
                <select
                  value={masterCompanyFilter}
                  onChange={(e) => setMasterCompanyFilter(e.target.value)}
                  className="bg-paper border border-line rounded-md px-2 py-1 text-xs outline-none cursor-pointer text-ink font-semibold"
                >
                  <option value="All">All Companies</option>
                  {companies.map(co => (
                    <option key={co.id} value={co.name}>{co.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Category filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted text-[11px] font-mono">Category:</span>
              <select
                value={masterCategoryFilter}
                onChange={(e) => setMasterCategoryFilter(e.target.value)}
                className="bg-paper border border-line rounded-md px-2 py-1 text-xs outline-none cursor-pointer text-ink font-semibold"
              >
                <option value="All">All types</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Responsive Table Scroll Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-paper/40 border-b border-line/60 font-mono text-muted text-[9px] uppercase select-none">
                <th className="p-3 pl-5 cursor-pointer hover:text-ink transition-colors font-semibold" onClick={() => toggleMasterSort("name")}>
                  Worker Name {masterSortField === "name" && (masterSortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 cursor-pointer hover:text-ink transition-colors font-semibold" onClick={() => toggleMasterSort("passport")}>
                  Passport ID {masterSortField === "passport" && (masterSortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 cursor-pointer hover:text-ink transition-colors font-semibold" onClick={() => toggleMasterSort("category")}>
                  Category {masterSortField === "category" && (masterSortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 cursor-pointer hover:text-ink transition-colors font-semibold" onClick={() => toggleMasterSort("supply_company")}>
                  Supply Company {masterSortField === "supply_company" && (masterSortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 font-semibold">Engineer Action</th>
                <th className="p-3 font-semibold">Gate / Visa Status</th>
                <th className="p-3 font-semibold">Batch / Approved</th>
                <th className="p-3 font-semibold">WA doc</th>
                <th className="p-3 font-semibold">Visa XPact status</th>
                <th className="p-3 font-semibold">Bureau status</th>
                <th className="p-3 font-semibold">Final status</th>
                <th className="p-3 pr-5 text-right cursor-pointer hover:text-ink transition-colors font-semibold" onClick={() => toggleMasterSort("created_at")}>
                  Created Date {masterSortField === "created_at" && (masterSortOrder === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-line/45">
              {sortedMasterWorkers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-muted">
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="font-semibold text-ink text-xs">No matching archives found</p>
                      <p className="text-[11px]">Adjust your job category filter or text search inquiry.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedMasterWorkers.map((w) => {
                  return (
                    <tr key={w.id} className="hover:bg-paper/20 transition-colors">
                      {/* Name */}
                      <td className="p-3 pl-5 font-semibold text-ink font-display truncate max-w-[150px]">
                        {w.name}
                      </td>
                      
                      {/* Passport */}
                      <td className="p-3 font-mono text-[11px] text-ink whitespace-nowrap">
                        {w.passport}
                      </td>
                      
                      {/* Category */}
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 bg-paper rounded border border-line/40 text-[10px] font-medium text-ink">
                          {w.category}
                        </span>
                      </td>
                      
                      {/* Supply Company */}
                      <td className="p-3 text-muted truncate max-w-[140px]">
                        {w.supply_company}
                      </td>

                      {/* Engineer Action */}
                      <td className="p-3">
                        {w.state === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-green/10 text-success-green border border-success-green/20 text-[10px] font-mono font-bold rounded-md">
                            AUTHORIZED
                          </span>
                        ) : w.state === "held" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-600 border border-amber-500/20 text-[10px] font-mono font-bold rounded-md">
                            HOLD
                          </span>
                        ) : w.state === "rejected" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-bad/10 text-bad border border-bad/20 text-[10px] font-mono font-bold rounded-md">
                            REJECTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-paper text-muted border border-line/60 text-[10px] font-mono font-semibold rounded-md">
                            AWAITING GATE
                          </span>
                        )}
                      </td>
                      
                      {/* State (Gate / Visa Status) */}
                      <td className="p-3">
                        {w.state === "held" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-mono bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                            ON HOLD
                          </span>
                        ) : w.state === "rejected" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-bad font-mono bg-bad/10 px-2 py-0.5 rounded-full border border-bad/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-bad"></span>
                            REJECTED
                          </span>
                        ) : w.state === "pending" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gold font-mono bg-gold/15 px-2 py-0.5 rounded-full border border-gold/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-gold"></span>
                            PENDING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-success-green font-mono bg-success-green/15 px-2 py-0.5 rounded-full border border-success-green/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-success-green animate-pulse"></span>
                            ACTIVE
                          </span>
                        )}
                      </td>
                      
                      {/* Batch & Approvals */}
                      <td className="p-3 font-mono text-[10px] text-muted">
                        {w.state === "active" ? (
                          <div className="leading-normal">
                            <span className="text-ink font-medium">{w.sending_batch || "Direct"}</span>
                            <span className="block text-[9px] text-[#8a8175]">{w.visa_doc_date}</span>
                          </div>
                        ) : w.state === "held" ? (
                          <span className="text-amber-600 font-semibold italic text-[10px]">Gate Hold</span>
                        ) : w.state === "rejected" ? (
                          <span className="text-bad font-semibold italic text-[10px]">Gate Reject</span>
                        ) : (
                          <span className="italic text-[10px]">Awaiting Gate</span>
                        )}
                      </td>
                      
                      {/* WhatsApp document */}
                      <td className="p-3">
                        <span className={`inline-block px-1.5 py-0.5 font-mono text-[10px] rounded ${
                          w.doc_upload_wa === "Yes" 
                            ? "bg-success-green/10 text-success-green border border-success-green/20" 
                            : "bg-red-50 text-bad border border-bad/20"
                        }`}>
                          {w.doc_upload_wa || "No"}
                        </span>
                        <span className="block text-[9px] text-[#8a8175] font-mono mt-0.5" title="WA Doc Change Date">
                          {w.doc_upload_wa_date || w.last_updated || (w.created_at ? w.created_at.split("T")[0] : "—")}
                        </span>
                        {w.doc_upload_wa !== "Yes" && w.wa_doc_reject_reason && (
                          <div className="mt-1 text-[9px] font-sans font-medium text-bad bg-[#FEF2F2] border border-bad/15 rounded px-1.5 py-0.5 leading-tight max-w-[130px] break-words">
                            <span className="font-extrabold text-[8px] text-bad block uppercase tracking-wider">Reject Reason:</span>
                            {w.wa_doc_reject_reason}
                          </div>
                        )}
                      </td>
                      
                      {/* Status */}
                      <td className="p-3 font-medium">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                          w.status === "Visa Approved (xpact)"
                            ? "bg-success-green/10 text-success-green border-success-green/35"
                            : w.status === "Visa Reject (xpact)"
                            ? "bg-bad/10 text-bad border-bad/35"
                            : "bg-neutral-50 text-muted border-line/50"
                        }`}>
                          {w.status || "Pending"}
                        </span>
                        <span className="block text-[9px] text-[#8a8175] font-mono mt-0.5" title="Visa Status Change Date">
                          {w.status_date || (w.created_at ? w.created_at.split("T")[0] : "—")}
                        </span>
                      </td>
                      
                      {/* Bureau */}
                      <td className="p-3 font-medium">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                          w.bureau === "Complete"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : w.bureau === "Reject"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-neutral-50 text-muted border-line/50"
                        }`}>
                          {w.bureau || "Pending"}
                        </span>
                        <span className="block text-[9px] text-[#8a8175] font-mono mt-0.5" title="Bureau Change Date">
                          {w.bureau_date || (w.bureau_completed_at ? w.bureau_completed_at.split("T")[0] : (w.created_at ? w.created_at.split("T")[0] : "—"))}
                        </span>
                      </td>
                      
                      {/* Final Status */}
                      <td className="p-3 font-medium">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                          w.final_status === "Arrived"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-250 font-semibold"
                            : w.final_status === "Booked"
                            ? "bg-sky-50 text-sky-800 border-sky-100"
                            : "bg-neutral-50 text-muted border-line/50"
                        }`}>
                          {w.final_status || "Pending"}
                        </span>
                        <span className="block text-[9px] text-[#8a8175] font-mono mt-0.5" title="Final Placement Change Date">
                          {w.final_status_date || (w.created_at ? w.created_at.split("T")[0] : "—")}
                        </span>
                      </td>
                      
                      {/* Created date */}
                      <td className="p-3 pr-5 text-right font-mono text-[10px] text-muted whitespace-nowrap">
                        {new Date(w.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
            <span className="px-2.5 py-1 bg-amber-500/10 border border-gold/30 text-gold-900 rounded-md">
              Pending: <strong className="font-bold">{feedStats.pending}</strong>
            </span>
            <span className="px-2.5 py-1 bg-green-50 text-success-green border border-success-green/20 rounded-md animate-pulse">
              Visa Approved: <strong className="font-bold">{feedStats.visaApproved}</strong>
            </span>
            <span className="px-2.5 py-1 bg-red-50 text-bad border border-bad/20 rounded-md">
              Visa Reject: <strong className="font-bold">{feedStats.visaRejected}</strong>
            </span>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
              Arrived: <strong className="font-bold">{feedStats.arrived}</strong>
            </span>
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
                <th className="p-3">Job Category</th>
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
                  <td colSpan={currentUser?.role === "admin" ? 8 : 7} className="p-10 text-center text-muted text-xs">
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

                  return (
                    <tr key={w.id} className="hover:bg-paper/30 transition-colors">
                      {/* Name */}
                      <td className="p-3 pl-5">
                        <span className="font-semibold text-ink text-xs block">{w.name}</span>
                        <span className="text-[10px] text-muted font-mono">{w.id.slice(0, 8)}</span>

                        {/* Attached Document Links */}
                        {(w.doc_link || w.bulk_doc_link) && (
                          <div className="mt-1 flex flex-wrap gap-1 items-center">
                            {w.doc_link && (
                              <a
                                href={w.doc_link.startsWith("http") ? w.doc_link : `https://${w.doc_link}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 font-mono text-[8px] bg-accent/10 border border-accent/20 hover:bg-accent/15 text-accent px-1 py-0.5 rounded font-bold transition-all shrink-0"
                                title="Download Worker Document"
                              >
                                <ExternalLink className="w-2 h-2 shrink-0" />
                                <span>Worker Doc</span>
                              </a>
                            )}
                            {w.bulk_doc_link && (
                              <a
                                href={w.bulk_doc_link.startsWith("http") ? w.bulk_doc_link : `https://${w.bulk_doc_link}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 font-mono text-[8px] bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/15 text-emerald-700 px-1 py-0.5 rounded font-bold transition-all shrink-0"
                                title="Download Bulk Folder"
                              >
                                <FolderOpen className="w-2 h-2 shrink-0" />
                                <span>Bulk Folder</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Quick inline edit url prompt */}
                        <div className="mt-1">
                          <input
                            type="text"
                            placeholder="Add/Edit Doc Link..."
                            defaultValue={w.doc_link || ""}
                            onBlur={async (e) => {
                              const newVal = e.target.value.trim();
                              if (newVal !== (w.doc_link || "")) {
                                await onUpdateWorker(w.id, { doc_link: newVal });
                              }
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                const newVal = (e.target as HTMLInputElement).value.trim();
                                if (newVal !== (w.doc_link || "")) {
                                  await onUpdateWorker(w.id, { doc_link: newVal });
                                }
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="bg-paper/30 text-[9px] border border-line/45 focus:border-accent rounded px-1 px-1.5 py-0.5 outline-none font-mono text-muted focus:text-ink w-28 focus:w-44 transition-all"
                            title="Paste URL link here, press Enter or blur to save"
                          />
                        </div>
                      </td>

                      {/* Passport */}
                      <td className="p-3 font-mono text-xs font-semibold text-ink">
                        {w.passport}
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

    </div>
  );
}
