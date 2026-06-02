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
  UserCheck2,
  ListRestart,
  Upload,
  FileSpreadsheet,
  ClipboardList,
  Lock
} from "lucide-react";

interface RecruiterIntakeViewProps {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  projectDetail?: ProjectDetail | null;
  onRefresh: () => void;
  onBulkAdd: (newWorkers: { name: string; passport: string; category: string; supply_company: string }[]) => Promise<{ success: boolean; message?: string }>;
  onUpdateWorker: (id: string, updates: Partial<Worker>) => Promise<boolean>;
  currentUser?: User | null;
}

interface WorkerFormInput {
  name: string;
  passport: string;
  category: string;
  supply_company: string;
}

export default function RecruiterIntakeView({
  workers,
  categories,
  companies,
  projectDetail,
  onRefresh,
  onBulkAdd,
  onUpdateWorker,
  currentUser
}: RecruiterIntakeViewProps) {
  
  // Bulk entry lines
  const [rows, setRows] = useState<WorkerFormInput[]>([
    { name: "", passport: "", category: categories[0]?.name || "", supply_company: companies[0]?.name || "" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          || categories[0]?.name 
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
            supply_company: currentUser?.role === "recruiter" ? defaultCompany : matchedCo
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
    return bureauCompanyFilter || defaultCompany;
  }, [bureauCompanyFilter, defaultCompany]);

  // Dynamically default the fast-intake form company once defaultCompany is resolved from currentUser
  React.useEffect(() => {
    if (defaultCompany && rows.length === 1 && rows[0].name === "" && rows[0].passport === "") {
      setRows([
        { name: "", passport: "", category: categories[0]?.name || "", supply_company: defaultCompany }
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
        category: lastRow?.category || categories[0]?.name || "", 
        supply_company: currentUser?.role === "recruiter" ? defaultCompany : (lastRow?.supply_company || companies[0]?.name || "")
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      setRows([{ name: "", passport: "", category: categories[0]?.name || "", supply_company: currentUser?.role === "recruiter" ? defaultCompany : (companies[0]?.name || "") }]);
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
              category: rows[rows.length - 1]?.category || categories[0]?.name || "",
              supply_company: currentUser?.role === "recruiter" ? defaultCompany : (rows[rows.length - 1]?.supply_company || companies[0]?.name || "")
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
      setErrorMessage("Every worker requires both Name and Passport to be registered.");
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
        supply_company: currentUser?.role === "recruiter" ? defaultCompany : r.supply_company
      }));

      const res = await onBulkAdd(payload);
      if (res.success) {
        setSuccessMessage(`Success: ${payload.length} workers registered under State: PENDING.`);
        setRows([{ name: "", passport: "", category: categories[0]?.name || "", supply_company: currentUser?.role === "recruiter" ? defaultCompany : (companies[0]?.name || "") }]);
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
  const bureauQueue = useMemo(() => {
    return workers.filter((w) => {
      const matchesStatus = w.status === "Visa Approved (xpact)";
      
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
              <p className="text-xs text-muted">Register workers fast under state=pending. (Quota is NOT affected yet).</p>
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
                            className="w-full bg-paper/20 border border-line/60 focus:border-accent rounded px-1.5 py-1.5 text-xs outline-none"
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
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
                  onChange={(e) => setBureauCompanyFilter(e.target.value)}
                  className="text-[11px] px-3 py-1.5 bg-card border border-accent/25 hover:border-accent rounded outline-none w-full text-accent font-semibold pr-8 cursor-pointer font-sans appearance-none"
                >
                  <option value="All" className="text-ink font-medium">All Companies</option>
                  {companies.map(co => (
                    <option key={co.id} value={co.name} className="text-ink font-medium">{co.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-accent">
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
                    </div>

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

    </div>
  );
}
