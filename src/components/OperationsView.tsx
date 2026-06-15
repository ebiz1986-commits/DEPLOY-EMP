import React, { useState, useMemo } from "react";
import { Category, Company, Worker, DropdownOption, ProjectDetail, User, BureauAllocation, XpactAllocation } from "../types";
import CompanyFilterHeader from "./CompanyFilterHeader";
import { 
  ClipboardList, 
  RefreshCw, 
  CheckCircle, 
  HelpCircle, 
  Building2, 
  Clock, 
  CheckCircle2,
  AlertTriangle,
  Lock,
  ExternalLink,
  FolderOpen,
  Zap,
  X,
  Pause,
  XCircle,
  AlertOctagon
} from "lucide-react";

interface OperationsViewProps {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  dropdownOptions: DropdownOption[];
  projects?: ProjectDetail[];
  selectedProjectId?: string;
  projectDetail?: ProjectDetail | null;
  onRefresh: () => void;
  onUpdateWorker: (id: string, updates: Partial<Worker>) => Promise<boolean>;
  currentUser?: User;
  bureauAllocations?: BureauAllocation[];
  xpactAllocations?: XpactAllocation[];
}

export default function OperationsView({
  workers,
  categories,
  companies,
  dropdownOptions,
  projects = [],
  selectedProjectId = "",
  projectDetail,
  onRefresh,
  onUpdateWorker,
  currentUser,
  bureauAllocations = [],
  xpactAllocations = []
}: OperationsViewProps) {
  
  const getDaysWaiting = (createdAtStr?: string, completedAtStr?: string, isCompleted?: boolean) => {
    if (!createdAtStr) return null;
    try {
      const createdDate = new Date(createdAtStr);
      const endDate = isCompleted && completedAtStr ? new Date(completedAtStr) : new Date();
      const diffTime = endDate.getTime() - createdDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays < 0 ? 0 : diffDays;
    } catch (e) {
      return null;
    }
  };

  // Filtering States
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Feed alerts/toasts
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Dynamic dropdown lists
  const statusOptions = useMemo(() => {
    return dropdownOptions.filter((o) => o.field === "status").map((o) => o.value);
  }, [dropdownOptions]);

  const bureauOptions = useMemo(() => {
    return dropdownOptions.filter((o) => o.field === "bureau").map((o) => o.value);
  }, [dropdownOptions]);

  const finalStatusOptions = useMemo(() => {
    return dropdownOptions.filter((o) => o.field === "final_status").map((o) => o.value);
  }, [dropdownOptions]);

  // Filter workers so unapproved/rejected/held ones do not show up for Admin 2 (ops)
  const approvedOnlyWorkers = useMemo(() => {
    if (currentUser?.role === "ops") {
      return workers.filter((w) => w.state === "active");
    }
    return workers;
  }, [workers, currentUser]);

  // Compute counts of workers per bureau category (case-insensitive)
  const bureauAssignmentsCount = useMemo(() => {
    const counts: Record<string, number> = {};
    approvedOnlyWorkers.forEach(w => {
      if (w.bureau_category) {
        const key = w.bureau_category.trim().toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [approvedOnlyWorkers]);

  // Extract category names for headers
  const categoryNames = useMemo(() => {
    return categories.map((c) => c.name);
  }, [categories]);

  // Compute scoped worker roster linked exclusively to the active selected project
  const scopedWorkers = useMemo(() => {
    return approvedOnlyWorkers.filter((w) => w.project_id === selectedProjectId);
  }, [approvedOnlyWorkers, selectedProjectId]);

  // Active list workers (workers with state = active, held, or rejected)
  const activeWorkers = useMemo(() => {
    return scopedWorkers.filter((w) => {
      // Must be active, held, or rejected
      if (w.state !== "active" && w.state !== "held" && w.state !== "rejected") return false;

      // Filter by supply company
      if (selectedCompany !== "All" && w.supply_company !== selectedCompany) {
        return false;
      }

      // Filter by category
      if (selectedCategory !== "All" && w.category !== selectedCategory) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = w.name.toLowerCase().includes(query);
        const matchesPassport = w.passport.toLowerCase().includes(query);
        if (!matchesName && !matchesPassport) return false;
      }

      return true;
    });
  }, [scopedWorkers, selectedCompany, selectedCategory, searchQuery]);

  // Filter out individuals who have "Arrived" status from both queues
  const activePipelineWorkers = useMemo(() => {
    return activeWorkers.filter(w => w.final_status !== "Arrived");
  }, [activeWorkers]);

  const bureauPendingList = useMemo(() => {
    return activePipelineWorkers.filter(w => w.bureau !== "Complete");
  }, [activePipelineWorkers]);

  const readyForDepartureList = useMemo(() => {
    return activePipelineWorkers.filter(w => w.bureau === "Complete");
  }, [activePipelineWorkers]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Bulk selection states
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [bulkField, setBulkField] = useState<string>("");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [bulkReason, setBulkReason] = useState<string>("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Bulk status transition modal states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("Arrived");

  // Filter selected IDs to only those that are currently visible and active
  const visibleSelectedIds = useMemo(() => {
    const activeIds = new Set(activeWorkers.map((w) => w.id));
    return selectedWorkerIds.filter((id) => activeIds.has(id));
  }, [selectedWorkerIds, activeWorkers]);

  const handleBulkTransitionSubmit = async (preset: string) => {
    if (visibleSelectedIds.length === 0) return;
    setIsBulkUpdating(true);
    setIsBulkModalOpen(false);

    try {
      const updates: Partial<Worker> = {};
      const dateStr = new Date().toISOString().split("T")[0];

      if (preset === "Arrived") {
        updates.final_status = "Arrived";
        updates.final_status_date = dateStr;
        updates.last_updated = dateStr;
      } else if (preset === "Ready for Deployment") {
        updates.final_status = "Ready for Deployment";
        updates.final_status_date = dateStr;
        updates.last_updated = dateStr;
      } else if (preset === "Ready for Departure") {
        updates.bureau = "Complete";
        updates.bureau_date = dateStr;
        updates.last_updated = dateStr;
      } else if (preset === "Visa Approved") {
        updates.status = "Visa Approved (xpact)";
        updates.status_date = dateStr;
        updates.last_updated = dateStr;
        updates.bureau = "Pending";
      } else if (preset === "Doc Upload Verified") {
        updates.doc_upload_wa = "Yes";
        updates.doc_upload_wa_date = dateStr;
        updates.last_updated = dateStr;
      }

      // Filter applicable workers based on locks for the field being updated
      const applicableWorkers = activeWorkers.filter(
        (w) => visibleSelectedIds.includes(w.id)
      );

      const filteredWorkers = applicableWorkers.filter((w) => {
        if (preset === "Arrived" || preset === "Ready for Deployment") {
          return !isFieldLockedForWorker(w, "final_status");
        }
        if (preset === "Ready for Departure") {
          return !isFieldLockedForWorker(w, "bureau");
        }
        if (preset === "Visa Approved") {
          return !isFieldLockedForWorker(w, "status");
        }
        if (preset === "Doc Upload Verified") {
          return !isFieldLockedForWorker(w, "doc_upload_wa");
        }
        return true;
      });

      const skippedCount = visibleSelectedIds.length - filteredWorkers.length;

      if (filteredWorkers.length === 0) {
        showToast(
          `Update denied: All ${visibleSelectedIds.length} candidate(s) are locked for this option under your user role.`,
          "error"
        );
        return;
      }

      const promises = filteredWorkers.map((w) => onUpdateWorker(w.id, updates));
      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r === true).length;

      let msg = `Successfully transitioned ${successCount} worker(s) to "${preset}".`;
      if (skippedCount > 0) {
        msg += ` (${skippedCount} skipped due to role permissions)`;
      }

      showToast(msg, successCount > 0 ? "success" : "error");
      setSelectedWorkerIds([]);
      onRefresh();
    } catch (e) {
      showToast("Error executing bulk status transition.", "error");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Lock status checker for safety
  const isFieldLockedForWorker = (w: Worker, field: string) => {
    if (currentUser?.role === "viewer") return true;

    if (field === "bureau_category") {
      return false; // only viewer cannot update
    }
    if (field === "doc_upload_wa") {
      return currentUser?.role !== "admin" && w.doc_upload_wa === "Yes";
    }
    if (field === "status") {
      // Order constraint: Doc upload WA must be verified ('Yes') first
      if (w.doc_upload_wa !== "Yes") return true;
      return (currentUser?.role !== "admin" && w.status !== "Pending");
    }
    if (field === "bureau") {
      // Order constraint: Visa status must be 'Visa Approved (xpact)' first
      if (w.status !== "Visa Approved (xpact)") return true;
      return (
        (currentUser?.role !== "admin" && currentUser?.role !== "recruiter") || 
        (currentUser?.role !== "admin" && w.bureau !== "Pending")
      );
    }
    if (field === "final_status") {
      // Order constraint: Bureau clearance must be 'Complete' first
      if (w.bureau !== "Complete") return true;
      return (currentUser?.role !== "admin" && w.final_status !== "Pending");
    }
    return false;
  };

  const handleBulkUpdateSubmit = async () => {
    if (!bulkField || !bulkValue || visibleSelectedIds.length === 0) return;

    // Filter out workers that have roles/locks for that field
    const applicableWorkers = activeWorkers.filter(
      (w) => visibleSelectedIds.includes(w.id) && !isFieldLockedForWorker(w, bulkField)
    );

    const lockedCount = visibleSelectedIds.length - applicableWorkers.length;

    if (applicableWorkers.length === 0) {
      showToast(
        `Update denied: All ${visibleSelectedIds.length} candidate(s) are locked for this field under your user role.`,
        "error"
      );
      return;
    }

    setIsBulkUpdating(true);

    try {
      const baseUpdates: Partial<Worker> = {};
      const dateStr = new Date().toISOString().split("T")[0];

      if (bulkField === "bureau_category") {
        baseUpdates.bureau_category = bulkValue;
        baseUpdates.last_updated = dateStr;
      } else if (bulkField === "doc_upload_wa") {
        baseUpdates.doc_upload_wa = bulkValue as any;
        baseUpdates.doc_upload_wa_date = dateStr;
        baseUpdates.last_updated = dateStr;
        if (bulkValue === "Rejected") {
          baseUpdates.wa_doc_reject_reason = bulkReason.trim();
        } else {
          baseUpdates.wa_doc_reject_reason = "";
        }
      } else if (bulkField === "status") {
        baseUpdates.status = bulkValue;
        baseUpdates.status_date = dateStr;
        baseUpdates.last_updated = dateStr;
        if (bulkValue === "Visa Approved (xpact)") {
          baseUpdates.bureau = "Pending";
        }
      } else if (bulkField === "bureau") {
        baseUpdates.bureau = bulkValue;
        baseUpdates.bureau_date = dateStr;
        baseUpdates.last_updated = dateStr;
      } else if (bulkField === "final_status") {
        baseUpdates.final_status = bulkValue;
        baseUpdates.final_status_date = dateStr;
        baseUpdates.last_updated = dateStr;
      }

      // Execute in parallel
      const updatePromises = applicableWorkers.map((w) => onUpdateWorker(w.id, baseUpdates));
      const results = await Promise.all(updatePromises);
      const successCount = results.filter((r) => r === true).length;

      let msg = `Successfully updated ${successCount} worker(s).`;
      if (lockedCount > 0) {
        msg += ` (${lockedCount} skipped due to role permissions)`;
      }

      showToast(msg, successCount > 0 ? "success" : "error");

      // Reset selection and controls
      setSelectedWorkerIds([]);
      setBulkField("");
      setBulkValue("");
      setBulkReason("");
      onRefresh();
    } catch (e) {
      showToast("Network error executing bulk update.", "error");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleFieldChange = async (workerId: string, field: keyof Worker, value: any) => {
    const worker = approvedOnlyWorkers.find((w) => w.id === workerId);
    if (!worker) return;

    const updates: Partial<Worker> = { [field]: value };
    
    // Explicit cross-role trigger rule: If status is updated to Visa Approved, notify or log!
    if (field === "status" && value === "Visa Approved (xpact)") {
      updates.bureau = "Pending"; // Set bureau to pending list
    }

    const success = await onUpdateWorker(workerId, updates);
    if (success) {
      showToast(`Worker record updated successfully.`, "success");
    } else {
      showToast(`Field change failed. Please verify network.`, "error");
    }
  };

  const renderWorkersTable = (list: Worker[], emptyTitle: string, emptySub: string) => {
    const isAllChecked = list.length > 0 && list.every(w => visibleSelectedIds.includes(w.id));
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-sans">
          <thead>
            <tr className="bg-paper/35 border-b border-line/60 font-mono text-muted text-[10px] uppercase">
              <th className="p-3 pl-5 w-12 text-center text-ink bg-paper/10 font-bold">
                <input
                  type="checkbox"
                  checked={isAllChecked}
                  onChange={(e) => {
                    const visibleIds = list.map(w => w.id);
                    if (e.target.checked) {
                      setSelectedWorkerIds(prev => {
                        const next = [...prev];
                        visibleIds.forEach(id => {
                          if (!next.includes(id)) {
                            next.push(id);
                          }
                        });
                        return next;
                      });
                    } else {
                      setSelectedWorkerIds(prev => prev.filter(id => !visibleIds.includes(id)));
                    }
                  }}
                  className="w-3.5 h-3.5 bg-white border border-stone-300 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  title="Select/deselect all visible visible in list"
                />
              </th>
              <th className="p-3 pl-3">WORKER DETAILS</th>
              <th className="p-3">PASSPORT NO</th>
              <th className="p-3">BUREAU CATEGORY</th>
              <th className="p-3">ACTUAL JOB CATEGORY</th>
              <th className="p-3">DOC UPLOAD (WA CHECKER)</th>
              <th className="p-3">LAST UPDATED STAMP</th>
              <th className="p-3">VISA STATUS (XPACT)</th>
              <th className="p-3">BUREAU CLEARANCE</th>
              <th className="p-3 mr-5 pr-5">FINAL PLACEMENT STATUS</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-line/40">
            {list.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-12 text-center text-muted">
                  <div className="max-w-xs mx-auto space-y-1.5 font-sans">
                    <p className="font-semibold text-ink font-display">{emptyTitle}</p>
                    <p className="text-[11px] text-muted">{emptySub}</p>
                  </div>
                </td>
              </tr>
            ) : (
              list.map((w) => {
                const isSelected = visibleSelectedIds.includes(w.id);
                const isDocUploadLocked = currentUser?.role !== "admin" && w.doc_upload_wa === "Yes";
                
                // Order constraint: Visa status can only be modified if DOC upload is 'Yes' (verified)
                const isStatusLocked = w.doc_upload_wa !== "Yes" || 
                  (currentUser?.role !== "admin" && w.status !== "Pending");
                
                // Order constraint: Bureau Clearance can only be modified if Visa Status is 'Visa Approved (xpact)'
                const isBureauLocked = w.status !== "Visa Approved (xpact)" || 
                  (currentUser?.role !== "admin" && currentUser?.role !== "recruiter") || 
                  (currentUser?.role !== "admin" && w.bureau !== "Pending");
                
                // Order constraint: Final Placement can only be modified if Bureau Clearance is 'Complete'
                const isFinalStatusLocked = w.bureau !== "Complete" || 
                  (currentUser?.role !== "admin" && w.final_status !== "Pending");

                const docValue = w.doc_upload_wa === "No" ? "Pending" : w.doc_upload_wa;
                const isHeld = w.state === "held";
                const isRejected = w.state === "rejected";
                const rowBg = isSelected 
                  ? "bg-amber-500/[0.06]" 
                  : isRejected 
                    ? "bg-red-500/[0.03] border-l-2 border-l-bad" 
                    : isHeld 
                      ? "bg-amber-500/[0.03] border-l-2 border-l-gold" 
                      : "";

                return (
                  <tr key={w.id} className={`hover:bg-paper/10 transition-colors ${rowBg}`}>
                    
                    {/* Checkbox column */}
                    <td className="p-3 pl-5 text-center w-12 border-r border-line/30 bg-paper/5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWorkerIds(prev => [...prev, w.id]);
                          } else {
                            setSelectedWorkerIds(prev => prev.filter(id => id !== w.id));
                          }
                        }}
                        className="w-3.5 h-3.5 bg-white border border-stone-300 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        title="Select candidate for bulk operations"
                      />
                    </td>

                    {/* Worker credentials info */}
                    <td className="p-3 pl-3 max-w-[170px]">
                      <div className="font-semibold text-ink font-display truncate text-xs block" title={w.name}>{w.name}</div>
                      <div className="text-[10px] text-muted truncate text-[9px] block" title={w.supply_company}>{w.supply_company}</div>

                      {/* Indicator Badges for Hold & Rejections */}
                      <div className="flex flex-wrap gap-1 mt-1.5 max-w-[155px]">
                        {/* Worker global state holds / rejections */}
                        {isHeld && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs uppercase tracking-wider font-mono">
                            <Pause className="w-2.5 h-2.5" />
                            <span>Held (Gate)</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800 border border-red-300 shadow-2xs uppercase tracking-wider font-mono" title={w.gate_reject_reason ? `Reason: ${w.gate_reject_reason}` : "Gate Rejected"}>
                            <XCircle className="w-2.5 h-2.5 text-bad" />
                            <span>Rejected (Gate)</span>
                          </span>
                        )}

                        {/* Step-level rejections */}
                        {w.doc_upload_wa === "Rejected" && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200/80 shadow-2xs uppercase tracking-wider font-mono" title={w.wa_doc_reject_reason ? `Reason: ${w.wa_doc_reject_reason}` : "WA Doc Rejected"}>
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            <span>WA Doc Reject</span>
                          </span>
                        )}

                        {(w.status && (w.status.toLowerCase().includes("reject") || w.status.toLowerCase().includes("failed"))) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-700 border border-red-200/60 shadow-2xs uppercase tracking-wider font-mono" title={`Visa Status: ${w.status}`}>
                            <AlertTriangle className="w-2.5 h-2.5 text-red-500" />
                            <span>Visa Reject</span>
                          </span>
                        )}

                        {(w.bureau && (w.bureau.toLowerCase().includes("reject") || w.bureau.toLowerCase().includes("failed"))) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-orange-850 border border-orange-200 shadow-2xs uppercase tracking-wider font-mono" title={`Bureau Status: ${w.bureau}`}>
                            <AlertTriangle className="w-2.5 h-2.5 text-orange-600" />
                            <span>Bureau Reject</span>
                          </span>
                        )}
                      </div>

                      {/* Associated Documents */}
                      <div className="mt-1.5">
                        {w.doc_link ? (
                          <a
                            href={w.doc_link.startsWith("http") ? w.doc_link : `https://${w.doc_link}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-sans text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 rounded font-semibold transition-all w-fit cursor-pointer shadow-xs"
                            title="See Attached Document Link"
                          >
                            <ExternalLink className="w-2.5 h-2.5 shrink-0 text-emerald-500" />
                            <span>See Attached Document Link</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-stone-400 italic">No document link</span>
                        )}
                        
                        {w.bulk_doc_link && (
                          <div className="mt-1">
                            <a
                              href={w.bulk_doc_link.startsWith("http") ? w.bulk_doc_link : `https://${w.bulk_doc_link}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[8.5px] bg-indigo-50 border border-indigo-200/50 hover:bg-indigo-100/50 text-indigo-700 px-1.5 py-0.5 rounded font-medium transition-all w-fit cursor-pointer"
                              title="Download Bulk Folder"
                            >
                              <FolderOpen className="w-2 h-2 shrink-0 text-indigo-500" />
                              <span>Bulk Folder</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Passport */}
                    <td className="p-3 font-mono text-ink font-semibold">
                      {w.passport}
                    </td>

                    {/* Bureau Category */}
                    <td className="p-3 min-w-[195px]">
                      <div className="flex flex-col gap-1.5 justify-center max-w-[210px]">
                        <select
                          value={w.bureau_category || ""}
                          onChange={async (e) => {
                            const newVal = e.target.value;
                            await onUpdateWorker(w.id, { bureau_category: newVal });
                          }}
                          disabled={currentUser?.role === "viewer"}
                          className="bg-paper/30 text-[11px] border border-line/45 focus:border-accent rounded px-2 py-1 outline-none font-mono text-ink focus:text-ink w-full cursor-pointer disabled:cursor-not-allowed text-xs font-semibold"
                          title="Select Bureau Category"
                        >
                          <option value="">-- Select Bureau Category --</option>
                          {bureauAllocations.map((ba) => (
                            <option key={ba.id} value={ba.category}>
                              {ba.category}
                            </option>
                          ))}
                        </select>

                        {/* Selected Category remaining stats info label */}
                        {w.bureau_category && (() => {
                          const selectedCat = w.bureau_category;
                          const ba = bureauAllocations.find(
                            b => b.category.trim().toLowerCase() === selectedCat.trim().toLowerCase()
                          );
                          const count = bureauAssignmentsCount[selectedCat.trim().toLowerCase()] || 0;
                          const bureauRemaining = ba ? ba.qty - count : 0;

                          const xa = xpactAllocations.find(
                            x => x.category.trim().toLowerCase() === selectedCat.trim().toLowerCase()
                          );
                          const xpactRemaining = xa ? xa.qty - count : null;

                          const bureauMax = ba ? ba.qty : 0;
                          const bureauPct = bureauMax > 0 ? (count / bureauMax) * 100 : 0;

                          const xpactMax = xa ? xa.qty : 0;
                          const xpactPct = xpactMax > 0 ? (count / xpactMax) * 100 : 0;

                          return (
                            <div className="flex flex-col gap-2 mt-1 w-full select-none">
                              {/* Bureau Quota Bar */}
                              {ba && (
                                <div className="flex flex-col gap-1 w-full bg-paper/30 p-1.5 rounded-lg border border-line/30">
                                  <div className="flex justify-between items-center text-[10px] font-mono leading-none">
                                    <span className="font-bold text-slate-800">Bureau: {count}/{bureauMax}</span>
                                    {bureauRemaining < 1 ? (
                                      <span className="text-[8px] font-bold text-red-650 bg-red-50 px-1 py-0.2 rounded border border-red-250 animate-pulse">🔴 FULL</span>
                                    ) : bureauPct >= 85 ? (
                                      <span className="text-[8px] font-bold text-rose-650 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">⚠️ {bureauRemaining} left</span>
                                    ) : (
                                      <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 font-semibold">🟢 {bureauRemaining} left</span>
                                    )}
                                  </div>
                                  <div className="w-full bg-paper rounded-full h-1.5 overflow-hidden border border-line/45">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        bureauRemaining < 1 
                                          ? "bg-red-500 animate-pulse" 
                                          : bureauPct >= 85 
                                            ? "bg-rose-500" 
                                            : bureauPct >= 50 
                                              ? "bg-amber-400" 
                                              : "bg-[#10B981]"
                                      }`}
                                      style={{ width: `${Math.min(100, bureauPct)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}

                              {/* XPACT Quota Bar */}
                              {xa && (
                                <div className="flex flex-col gap-1 w-full bg-paper/30 p-1.5 rounded-lg border border-line/30">
                                  <div className="flex justify-between items-center text-[10px] font-mono leading-none">
                                    <span className="font-bold text-slate-800">XPACT: {count}/{xpactMax}</span>
                                    {xpactRemaining !== null && xpactRemaining < 1 ? (
                                      <span className="text-[8px] font-bold text-red-650 bg-red-50 px-1 py-0.2 rounded border border-red-250 animate-pulse">🔴 FULL</span>
                                    ) : xpactPct >= 85 ? (
                                      <span className="text-[8px] font-bold text-rose-650 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">⚠️ {xpactRemaining} left</span>
                                    ) : (
                                      <span className="text-[8px] font-bold text-indigo-650 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200">🟢 {xpactRemaining} left</span>
                                    )}
                                  </div>
                                  <div className="w-full bg-paper rounded-full h-1.5 overflow-hidden border border-line/45">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        xpactRemaining !== null && xpactRemaining < 1 
                                          ? "bg-red-500 animate-pulse" 
                                          : xpactPct >= 85 
                                            ? "bg-rose-500" 
                                            : xpactPct >= 50 
                                              ? "bg-amber-400" 
                                              : "bg-indigo-600"
                                      }`}
                                      style={{ width: `${Math.min(100, xpactPct)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Actual Job Category */}
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-paper border border-line/40 text-[10px] text-ink rounded font-semibold whitespace-nowrap">
                        {w.category}
                      </span>
                    </td>

                    {/* WhatsApp Doc Checked checkbox list toggle */}
                    <td className="p-3">
                      <div className="flex flex-col gap-1.5 min-w-[145px]">
                        <div className="flex items-center gap-1.5 w-full">
                          <select
                            value={docValue}
                            onChange={(e) => handleFieldChange(w.id, "doc_upload_wa", e.target.value)}
                            disabled={isDocUploadLocked}
                            className={`text-[11px] px-2.5 py-1 font-mono rounded border outline-none w-full ${
                              isDocUploadLocked 
                                ? "bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed" 
                                : "cursor-pointer"
                            } ${
                              docValue === "Yes" 
                                ? "bg-success-green/10 text-success-green border-success-green/40 font-semibold" 
                                : docValue === "Rejected"
                                ? "bg-red-50 text-bad border-bad/40 font-semibold"
                                : "bg-amber-50 text-amber-700 border-amber-300 font-semibold"
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Yes">Yes</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                          {isDocUploadLocked && (
                            <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" title="Locked: Only system admin can modify after change applied" />
                          )}
                        </div>
                        <span className="block text-[9px] text-[#8a8175] font-mono pl-1" title="WA Doc Change Date">
                          Date: {w.doc_upload_wa_date || w.last_updated || (w.created_at ? w.created_at.split("T")[0] : "—")}
                        </span>
                        
                        {/* Display days waiting or took to upload */}
                        {(() => {
                          const isCompleted = docValue === "Yes";
                          const completedDate = w.doc_upload_wa_date || w.last_updated || (w.created_at ? w.created_at.split("T")[0] : undefined);
                          const days = getDaysWaiting(w.created_at, completedDate, isCompleted);
                          if (days === null) return null;
                          if (isCompleted) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-success-green bg-success-green/10 border border-success-green/20 px-1.5 py-0.5 rounded w-fit pl-1" title="Completed upload duration since record creation">
                                <CheckCircle2 className="w-3.5 h-3.5 text-success-green shrink-0" />
                                <span>Uploaded in {days} d</span>
                              </span>
                            );
                          }
                          return (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded w-fit pl-1 ${
                              docValue === "Rejected"
                                ? "text-bad bg-red-50 border border-bad/20"
                                : "text-amber-700 bg-amber-50 border border-amber-100"
                            }`} title="Number of days queueing since Candidate record created by recruiting agency">
                              <Clock className="w-3 h-3 animate-pulse shrink-0" />
                              <span>Waiting: {days} {days === 1 ? "day" : "days"}</span>
                            </span>
                          );
                        })()}

                        {(docValue === "Rejected" || w.doc_upload_wa === "No") && (
                          <div className="w-full flex flex-col gap-0.5">
                            <span className="text-[8px] uppercase tracking-wider font-semibold text-bad font-mono">Reject Reason:</span>
                            <input
                              type="text"
                              placeholder="Enter rejection reason..."
                              defaultValue={w.wa_doc_reject_reason || ""}
                              onBlur={(e) => handleFieldChange(w.id, "wa_doc_reject_reason", e.target.value.trim())}
                              onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleFieldChange(w.id, "wa_doc_reject_reason", (e.target as HTMLInputElement).value.trim());
                                    (e.target as HTMLInputElement).blur();
                                  }
                              }}
                              disabled={isDocUploadLocked}
                              className="text-[10px] w-full px-2 py-1 bg-stone-50 border border-stone-200 focus:border-bad/65 rounded shadow-sm outline-none font-sans"
                              title="Press Enter or update focus to save rejection details"
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Read-only Auto Stamp */}
                    <td className="p-3 font-mono text-[10px] text-muted font-semibold">
                      {w.last_updated ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-success-green" />
                          <span>{w.last_updated}</span>
                        </span>
                      ) : (
                        <span className="italic text-stone-400">Not check-in</span>
                      )}
                    </td>

                    {/* Visa Status List Picker */}
                    <td className="p-2 min-w-[170px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <select
                            value={w.status}
                            onChange={(e) => handleFieldChange(w.id, "status", e.target.value)}
                            disabled={isStatusLocked}
                            className={`text-xs px-2 py-1 border rounded outline-none w-full font-medium ${
                              isStatusLocked 
                                ? "bg-stone-50 text-stone-400 border-stone-200 cursor-not-allowed" 
                                : "bg-paper/20 border-line focus:border-accent cursor-pointer text-ink font-semibold"
                            }`}
                          >
                            {statusOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          {isStatusLocked && (
                            <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" title={w.doc_upload_wa !== "Yes" ? "Locked: 'DOC upload' must be Yes" : "Locked: Only system admin can modify after change applied"} />
                          )}
                        </div>
                        <span className="block text-[9px] text-[#8a8175] font-mono pl-1" title="Visa Status Change Date">
                          Date: {w.status_date || (w.created_at ? w.created_at.split("T")[0] : "—")}
                        </span>
                        {w.doc_upload_wa !== "Yes" && (
                          <div className="text-[9px] text-bad font-mono pl-1">Requires DOC Upload</div>
                        )}
                      </div>
                    </td>

                    {/* Bureau Option Picker */}
                    <td className="p-2 min-w-[140px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <select
                            value={w.bureau}
                            onChange={(e) => handleFieldChange(w.id, "bureau", e.target.value)}
                            disabled={isBureauLocked}
                            className={`text-xs px-2 py-1 border rounded outline-none w-full font-medium ${
                              isBureauLocked 
                                ? "bg-stone-50 text-stone-400 border-stone-200 cursor-not-allowed" 
                                : "bg-paper/20 border-line focus:border-accent cursor-pointer text-ink font-semibold"
                            }`}
                          >
                            {bureauOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          {isBureauLocked && (
                            <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" title={
                              w.doc_upload_wa !== "Yes" 
                                ? "Locked: 'DOC upload' must be Yes" 
                                : w.status !== "Visa Approved (xpact)"
                                  ? "Locked: 'Visa Status' must be 'Visa Approved (xpact)'"
                                  : (currentUser?.role !== "admin" && currentUser?.role !== "recruiter")
                                    ? "Locked: Bureau Clearance can only be updated by Recruitment Company"
                                    : "Locked: Only system admin can modify after change applied"
                            } />
                          )}
                        </div>
                        <span className="block text-[9px] text-[#8a8175] font-mono pl-1" title="Bureau Change Date">
                          Date: {w.bureau_date || (w.bureau_completed_at ? w.bureau_completed_at.split("T")[0] : (w.created_at ? w.created_at.split("T")[0] : "—"))}
                        </span>
                        {w.doc_upload_wa !== "Yes" ? (
                          <div className="text-[9px] text-bad font-mono pl-1">Requires DOC Upload</div>
                        ) : w.status !== "Visa Approved (xpact)" ? (
                          <div className="text-[9px] text-bad font-mono pl-1">Requires Visa Approved</div>
                        ) : null}
                      </div>
                    </td>

                    {/* Final Arrival Status Selector */}
                    <td className="p-2 pr-5 min-w-[140px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <select
                            value={w.final_status}
                            onChange={(e) => handleFieldChange(w.id, "final_status", e.target.value)}
                            disabled={isFinalStatusLocked}
                            className={`text-xs px-2 py-1 border rounded outline-none w-full font-medium ${
                              isFinalStatusLocked 
                                ? "bg-stone-50 text-stone-400 border-stone-200 cursor-not-allowed" 
                                : "bg-paper/20 border-line focus:border-accent cursor-pointer text-ink font-semibold"
                            }`}
                          >
                            {finalStatusOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          {isFinalStatusLocked && (
                            <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" title={
                              w.doc_upload_wa !== "Yes" 
                                ? "Locked: 'DOC upload' must be Yes" 
                                : w.bureau !== "Complete"
                                  ? "Locked: 'Bureau Clearance' must be 'Complete'"
                                  : "Locked: Only system admin can modify after change applied"
                            } />
                          )}
                        </div>
                        <span className="block text-[9px] text-[#8a8175] font-mono pl-1" title="Final Placement Change Date">
                          Date: {w.final_status_date || (w.created_at ? w.created_at.split("T")[0] : "—")}
                        </span>
                        {w.doc_upload_wa !== "Yes" ? (
                          <div className="text-[9px] text-bad font-mono pl-1">Requires DOC Upload</div>
                        ) : w.bureau !== "Complete" ? (
                          <div className="text-[9px] text-bad font-mono pl-1">Requires Bureau Complete</div>
                        ) : null}
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div id="operations-viewport" className="flex-1 overflow-y-auto p-6 space-y-6 max-h-screen">
      
      {/* Search Header component */}
      <CompanyFilterHeader
        companies={companies}
        workers={approvedOnlyWorkers}
        selectedCompany={selectedCompany}
        setSelectedCompany={setSelectedCompany}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categoriesList={categoryNames}
        title="Admin2 operations stage tracking"
        subtitle="Manage approved visa documentation statuses, bureau alignments, and arrival times."
        onRefresh={onRefresh}
      />

      {/* Project Target Info Banner */}
      {projectDetail ? (
        <div className="bg-amber-50/40 border border-line rounded-lg p-3 text-xs flex items-center justify-between font-sans">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-accent shrink-0" />
            <div>
              <span className="font-semibold text-ink">Active Destination Project: </span>
              <span className="text-accent font-bold">{projectDetail.name}</span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-muted">
            Lead Coordinator: <span className="font-semibold text-ink">{projectDetail.admin_coordinator}</span>
          </div>
        </div>
      ) : (
        <div className="bg-red-50 text-bad border border-bad/20 p-3 rounded-lg text-xs font-sans">
          Warning: No active project focused. Please select a project context in the sidebar or dashboard.
        </div>
      )}

      {/* Floating Dynamic Feedback Toast */}
      {toastMessage && (
        <div id="save-toast" className={`fixed top-4 right-4 z-50 p-4 border rounded-xl shadow-lg text-xs flex gap-3 items-center animate-fade-in font-sans ${
          toastMessage.type === "success" 
            ? "bg-stone-900 border-success-green/20 text-[#FDFBF6]" 
            : "bg-red-900 border-red-500/20 text-[#FDFBF6]"
        }`}>
          <CheckCircle2 className={`w-4 h-4 ${toastMessage.type === "success" ? "text-success-green" : "text-bad"}`} />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Single full-width grand table deck */}
      <div className="bg-card border border-line rounded-xl shadow-sm overflow-hidden flex flex-col" id="operations-split-queues">
        <div className="p-4 border-b border-line bg-paper/25 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 font-sans text-xs">
          <div>
            <h3 className="text-sm font-bold text-ink font-display flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse inline-block" />
              Field K-O Stage Update Deck (Active Pipeline)
            </h3>
            <p className="text-[11px] mt-0.5 text-muted font-medium">
              Showing {activeWorkers.length} active workers in current selection framework.
            </p>
          </div>
          <div className="text-[10.5px] bg-paper/60 border border-line/90 rounded-md p-2.5 text-muted font-mono leading-relaxed max-w-xl shrink-0 shadow-2xs">
            <strong>TRIGGER LOGIC:</strong> Toggling WhatsApp Checked stamps today's date into Last Updated. Setting Visa Approved places worker in the Sanken Overseas Recruiter's Bureau list.
          </div>
        </div>

        {/* Bulk Action Controls Bar */}
        {visibleSelectedIds.length > 0 && (
          <div className="bg-amber-500/[0.07] border-b border-line/60 px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-sans animate-fade-in select-none">
            <div className="flex flex-wrap items-center gap-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center min-w-[22px] px-1.5 h-5 bg-amber-600/90 text-white rounded-md text-[10px] font-bold shadow-xs">
                  {visibleSelectedIds.length}
                </span>
                <div>
                  <span className="font-semibold text-amber-950 block">Candidates Selected</span>
                  <span className="text-[10px] text-amber-700 font-medium font-mono">Apply bulk stage updates simultaneously</span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-[#FDFBF6] rounded font-bold shadow-md cursor-pointer transition-all duration-150 hover:-translate-y-0.5 text-[11px] tracking-wide shrink-0"
              >
                <Zap className="w-3.5 h-3.5 fill-white/20" />
                <span>⚡ Bulk Status Wizard</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Field selector */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-muted font-medium text-[11px] shrink-0 uppercase tracking-wider font-mono">Update Field:</span>
                <select
                  value={bulkField}
                  onChange={(e) => {
                    setBulkField(e.target.value);
                    setBulkValue("");
                    setBulkReason("");
                  }}
                  disabled={isBulkUpdating}
                  className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs text-ink focus:border-accent outline-none font-semibold cursor-pointer w-full sm:w-auto shadow-2xs"
                >
                  <option value="">-- Choose Field --</option>
                  <option value="bureau_category">Bureau Category</option>
                  <option value="doc_upload_wa">Doc Upload (WA Checker)</option>
                  <option value="status">Visa Status (xpact)</option>
                  <option value="bureau">Bureau Clearance</option>
                  <option value="final_status">Final Placement Status</option>
                </select>
              </div>

              {/* Dynamic Value Selector based on chosen field */}
              {bulkField && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto animate-fade-in">
                  <span className="text-muted font-medium text-[11px] shrink-0 uppercase tracking-wider font-mono">To:</span>
                  
                  {bulkField === "bureau_category" && (
                    <select
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      disabled={isBulkUpdating}
                      className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs text-ink font-mono outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="">-- Select Bureau Category --</option>
                      {bureauAllocations.map((ba) => (
                        <option key={ba.id} value={ba.category}>{ba.category}</option>
                      ))}
                    </select>
                  )}

                  {bulkField === "doc_upload_wa" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={bulkValue}
                        onChange={(e) => {
                          setBulkValue(e.target.value);
                          if (e.target.value !== "Rejected") {
                            setBulkReason("");
                          }
                        }}
                        disabled={isBulkUpdating}
                        className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs text-ink font-semibold outline-none cursor-pointer shadow-2xs"
                      >
                        <option value="">-- Select Document Status --</option>
                        <option value="Pending">Pending</option>
                        <option value="Yes">Yes</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                      
                      {bulkValue === "Rejected" && (
                        <input
                          type="text"
                          placeholder="Rejection Reason (optional)"
                          value={bulkReason}
                          onChange={(e) => setBulkReason(e.target.value)}
                          disabled={isBulkUpdating}
                          className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs text-ink outline-none w-48 shadow-2xs"
                        />
                      )}
                    </div>
                  )}

                  {bulkField === "status" && (
                    <select
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      disabled={isBulkUpdating}
                      className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs text-ink font-semibold outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="">-- Select Visa Status --</option>
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {bulkField === "bureau" && (
                    <select
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      disabled={isBulkUpdating}
                      className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs text-ink font-semibold outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="">-- Select Bureau Clearance --</option>
                      {bureauOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {bulkField === "final_status" && (
                    <select
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      disabled={isBulkUpdating}
                      className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs text-ink font-semibold outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="">-- Select Final Placement --</option>
                      {finalStatusOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                <button
                  type="button"
                  onClick={handleBulkUpdateSubmit}
                  disabled={isBulkUpdating || !bulkField || !bulkValue}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded shadow-xs focus:ring-1 focus:ring-accent outline-none text-[#FDFBF6] transition-all cursor-pointer ${
                    (isBulkUpdating || !bulkField || !bulkValue)
                      ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                      : "bg-accent hover:bg-accent/90"
                  }`}
                >
                  {isBulkUpdating ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-[#FDFBF6]" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 text-[#FDFBF6]" />
                      <span>Apply Updates</span>
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWorkerIds([]);
                    setBulkField("");
                    setBulkValue("");
                    setBulkReason("");
                  }}
                  disabled={isBulkUpdating}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-ink bg-white border border-stone-200 hover:border-slate-300 rounded shadow-2xs cursor-pointer transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}
        
        {renderWorkersTable(
          activeWorkers,
          "No Active Pipeline Candidates Found",
          "There are no active candidates matching your current filter settings for this project."
        )}
      </div>

      {/* BULK STATUS WIZARD MODAL */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in font-sans p-4">
          <div className="bg-card border border-line rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="bg-stone-900 text-[#FDFBF6] px-5 py-4 flex items-center justify-between border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500 fill-amber-500/30 shrink-0 animate-pulse" />
                <div>
                  <h3 className="font-serif text-base tracking-tight font-semibold text-[#FDFBF6]">Bulk Deployment & Stage Wizard</h3>
                  <p className="text-[10px] text-stone-400 font-mono">Operations Command • React Single-Click Pipeline</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-250 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-3 bg-amber-500/[0.04] border border-amber-500/25 rounded-lg text-xs leading-relaxed text-stone-850">
                You have selected <strong className="text-amber-950 font-bold font-mono">{visibleSelectedIds.length}</strong> active candidate(s) from the operations deck. Choose a target deployment milestone below to apply the status transition in one click.
              </div>

              <div className="space-y-2.5">
                <span className="block text-[11px] font-bold text-muted uppercase tracking-wider font-mono">Select Target State Milestone:</span>
                
                <div className="grid grid-cols-1 gap-2">
                  {/* Preset 1: Arrived */}
                  <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                    selectedPreset === "Arrived" 
                      ? "border-accent bg-accent/[0.03] shadow-sm" 
                      : "border-line/70 hover:border-accent/45 hover:bg-paper/5"
                  }`}>
                    <input
                      type="radio"
                      name="presetTarget"
                      checked={selectedPreset === "Arrived"}
                      onChange={() => setSelectedPreset("Arrived")}
                      className="mt-0.5 text-accent focus:ring-accent w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-xs text-ink block">📍 Milestone: Arrived (Deploy site)</span>
                      <p className="text-[10px] text-muted-more max-w-sm mt-0.5 leading-normal">
                        Sets <strong className="font-semibold text-ink font-sans">Final Placement Status</strong> to <span className="font-mono text-accent">"Arrived"</span>. Indicates the worker is safely on-road or in-camp.
                      </p>
                    </div>
                  </label>

                  {/* Preset 2: Ready for Deployment */}
                  <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                    selectedPreset === "Ready for Deployment" 
                      ? "border-accent bg-accent/[0.03] shadow-sm" 
                      : "border-line/70 hover:border-accent/45 hover:bg-paper/5"
                  }`}>
                    <input
                      type="radio"
                      name="presetTarget"
                      checked={selectedPreset === "Ready for Deployment"}
                      onChange={() => setSelectedPreset("Ready for Deployment")}
                      className="mt-0.5 text-accent focus:ring-accent w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-xs text-ink block">✈️ Milestone: Ready for Deployment</span>
                      <p className="text-[10px] text-muted-more max-w-sm mt-0.5 leading-normal">
                        Sets <strong className="font-semibold text-ink font-sans">Final Placement Status</strong> to <span className="font-mono text-accent">"Ready for Deployment"</span>. Highlights that logistics matches are final.
                      </p>
                    </div>
                  </label>

                  {/* Preset 3: Ready for Departure */}
                  <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                    selectedPreset === "Ready for Departure" 
                      ? "border-accent bg-accent/[0.03] shadow-sm" 
                      : "border-line/70 hover:border-accent/45 hover:bg-paper/5"
                  }`}>
                    <input
                      type="radio"
                      name="presetTarget"
                      checked={selectedPreset === "Ready for Departure"}
                      onChange={() => setSelectedPreset("Ready for Departure")}
                      className="mt-0.5 text-accent focus:ring-accent w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-xs text-ink block">📋 Milestone: Ready for Departure</span>
                      <p className="text-[10px] text-muted-more max-w-sm mt-0.5 leading-normal">
                        Sets <strong className="font-semibold text-ink font-sans">Bureau Clearance</strong> to <span className="font-mono text-accent">"Complete"</span>. Clears candidate files for immediate departure queue.
                      </p>
                    </div>
                  </label>

                  {/* Preset 4: Visa Approved */}
                  <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                    selectedPreset === "Visa Approved" 
                      ? "border-accent bg-accent/[0.03] shadow-sm" 
                      : "border-line/70 hover:border-accent/45 hover:bg-paper/5"
                  }`}>
                    <input
                      type="radio"
                      name="presetTarget"
                      checked={selectedPreset === "Visa Approved"}
                      onChange={() => setSelectedPreset("Visa Approved")}
                      className="mt-0.5 text-accent focus:ring-accent w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-xs text-ink block">🎫 Milestone: Visa Approved (xpact)</span>
                      <p className="text-[10px] text-muted-more max-w-sm mt-0.5 leading-normal">
                        Sets <strong className="font-semibold text-ink font-sans">Visa Status</strong> to <span className="font-mono text-accent">"Visa Approved (xpact)"</span> and prepares <strong className="font-semibold">Bureau</strong> record status to <span className="font-mono text-accent">"Pending"</span>.
                      </p>
                    </div>
                  </label>

                  {/* Preset 5: Doc Upload Verified */}
                  <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                    selectedPreset === "Doc Upload Verified" 
                      ? "border-accent bg-accent/[0.03] shadow-sm" 
                      : "border-line/70 hover:border-accent/45 hover:bg-paper/5"
                  }`}>
                    <input
                      type="radio"
                      name="presetTarget"
                      checked={selectedPreset === "Doc Upload Verified"}
                      onChange={() => setSelectedPreset("Doc Upload Verified")}
                      className="mt-0.5 text-accent focus:ring-accent w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-xs text-ink block">✅ Milestone: DOC Upload Verified (WA Checker)</span>
                      <p className="text-[10px] text-muted-more max-w-sm mt-0.5 leading-normal">
                        Sets <strong className="font-semibold text-ink font-sans">Doc Upload (WA)</strong> to <span className="font-mono text-accent">"Yes"</span>. Unlocks downstream visa and bureaucracy triggers.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-paper/40 px-5 py-3.5 flex items-center justify-between border-t border-line/60">
              <span className="text-[10px] text-muted font-mono">
                Permissions enforced for role: <strong className="font-bold uppercase text-ink">{currentUser?.role || "viewer"}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-550 hover:text-ink hover:bg-stone-50 rounded-lg cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkTransitionSubmit(selectedPreset)}
                  className="px-4 py-1.5 bg-accent hover:bg-accent/90 text-[#FDFBF6] rounded-lg text-xs font-bold shadow-sm inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-[#FDFBF6]" />
                  <span>Deploy Targets</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
