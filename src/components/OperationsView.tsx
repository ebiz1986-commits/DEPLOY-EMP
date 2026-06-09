import React, { useState, useMemo } from "react";
import { Category, Company, Worker, DropdownOption, ProjectDetail, User } from "../types";
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
  FolderOpen
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
  currentUser
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

  // Extract category names for headers
  const categoryNames = useMemo(() => {
    return categories.map((c) => c.name);
  }, [categories]);

  // Compute scoped worker roster linked exclusively to the active selected project
  const scopedWorkers = useMemo(() => {
    return workers.filter((w) => w.project_id === selectedProjectId);
  }, [workers, selectedProjectId]);

  // Active list workers (workers with state = active only)
  const activeWorkers = useMemo(() => {
    return scopedWorkers.filter((w) => {
      // Must be active
      if (w.state !== "active") return false;

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

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleFieldChange = async (workerId: string, field: keyof Worker, value: any) => {
    const worker = workers.find((w) => w.id === workerId);
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

  return (
    <div id="operations-viewport" className="flex-1 overflow-y-auto p-6 space-y-6 max-h-screen">
      
      {/* Search Header component */}
      <CompanyFilterHeader
        companies={companies}
        workers={workers}
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

      {/* Operations Active Grid Table */}
      <div className="bg-card border border-line rounded-xl shadow-sm overflow-hidden select-none">
        
        {/* Table Titlebar */}
        <div className="p-4 border-b border-line bg-paper/20 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs">
          <div>
            <h3 className="text-sm font-semibold text-ink font-display">Field K-O Stage Update Deck (Active Pipeline)</h3>
            <p className="text-[11px] text-muted">Showing {activeWorkers.length} active workers in current selection framework.</p>
          </div>
          
          <div className="text-[10px] bg-paper/40 border border-line rounded px-2.5 py-1 text-muted font-mono leading-relaxed max-w-sm">
            <strong>TRIGGER LOGIC:</strong> Toggling <strong>WhatsApp Checked</strong> stamps today&apos;s date into <strong>Last Updated</strong>. Setting Visa Approved places worker in the Sanken Overseas Recruiter&apos;s Bureau list.
          </div>
        </div>

        {/* Scrollable table content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-paper/35 border-b border-line/60 font-mono text-muted text-[10px] uppercase">
                <th className="p-3 pl-5">Worker details</th>
                <th className="p-3">Passport No</th>
                <th className="p-3">Category</th>
                <th className="p-3">Doc upload (WA CHECKER)</th>
                <th className="p-3">Last updated stamp</th>
                <th className="p-3">Visa Status (xpact)</th>
                <th className="p-3">Bureau clearance</th>
                <th className="p-3 mr-5 pr-5">Final placement status</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-line/40">
              {activeWorkers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted">
                    <div className="max-w-xs mx-auto space-y-1.5">
                      <p className="font-semibold text-ink font-display">No active records in selection</p>
                      <p className="text-[11px]">Approved active workers appear here. Or modify filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                activeWorkers.map((w) => {
                  const isDocUploadLocked = currentUser?.role !== "admin" && w.doc_upload_wa === "Yes";
                  const isStatusLocked = w.doc_upload_wa !== "Yes" || (currentUser?.role !== "admin" && w.status !== "Pending");
                  const isBureauLocked = w.doc_upload_wa !== "Yes" || 
                    (currentUser?.role !== "admin" && currentUser?.role !== "recruiter") || 
                    (currentUser?.role !== "admin" && w.bureau !== "Pending");
                  const isFinalStatusLocked = w.doc_upload_wa !== "Yes" || (currentUser?.role !== "admin" && w.final_status !== "Pending");

                  return (
                    <tr key={w.id} className="hover:bg-paper/10 transition-colors">
                      
                      {/* Worker credentials info */}
                      <td className="p-3 pl-5 max-w-[170px]">
                        <div className="font-semibold text-ink font-display truncate" title={w.name}>{w.name}</div>
                        <div className="text-[10px] text-muted truncate" title={w.supply_company}>{w.supply_company}</div>

                        {/* Associated Documents */}
                        {(w.doc_link || w.bulk_doc_link) && (
                          <div className="mt-1 flex flex-wrap gap-1 items-center">
                            {w.doc_link && (
                              <a
                                href={w.doc_link.startsWith("http") ? w.doc_link : `https://${w.doc_link}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 font-mono text-[8px] bg-accent/10 border border-accent/20 hover:bg-accent/15 text-accent px-1 py-0.5 rounded font-semibold transition-all shrink-0"
                                title="Download Candidate Document URL"
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
                                className="inline-flex items-center gap-0.5 font-mono text-[8px] bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/15 text-emerald-700 px-1 py-0.5 rounded font-semibold transition-all shrink-0"
                                title="Download Bulk Folder"
                              >
                                <FolderOpen className="w-2 h-2 shrink-0" />
                                <span>Bulk (Batch)</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Inline Document Link update for Coordinator */}
                        <div className="mt-1">
                          <input
                            type="text"
                            placeholder="Set Doc Link..."
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
                            className="bg-paper/30 text-[9px] border border-line/45 focus:border-accent rounded px-1.5 py-0.5 outline-none font-mono text-muted focus:text-ink w-24 focus:w-36 transition-all"
                            title="Set reference URL to candidate file"
                          />
                        </div>
                      </td>

                      {/* Passport */}
                      <td className="p-3 font-mono text-ink font-medium">
                        {w.passport}
                      </td>

                      {/* Category */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-paper border border-line/40 text-[10px] text-ink rounded font-semibold whitespace-nowrap">
                          {w.category}
                        </span>
                      </td>

                      {/* WhatsApp Doc Checked checkbox list toggle */}
                      <td className="p-3">
                        {(() => {
                          const docValue = w.doc_upload_wa === "No" ? "Pending" : w.doc_upload_wa;
                          return (
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
                                      <CheckCircle2 className="w-3 h-3 text-success-green shrink-0" />
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

                              {(docValue === "Rejected" || docValue === "No") && (
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
                          );
                        })()}
                      </td>

                      {/* Read-only Auto Stamp */}
                      <td className="p-3 font-mono text-[10px] text-muted">
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
                                  : "bg-paper/20 border-line focus:border-accent cursor-pointer text-ink"
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
                                  : "bg-paper/20 border-line focus:border-accent cursor-pointer text-ink"
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
                                  : (currentUser?.role !== "admin" && currentUser?.role !== "recruiter")
                                    ? "Locked: Bureau Clearance can only be updated by Recruitment Company"
                                    : "Locked: Only system admin can modify after change applied"
                              } />
                            )}
                          </div>
                          <span className="block text-[9px] text-[#8a8175] font-mono pl-1" title="Bureau Change Date">
                            Date: {w.bureau_date || (w.bureau_completed_at ? w.bureau_completed_at.split("T")[0] : (w.created_at ? w.created_at.split("T")[0] : "—"))}
                          </span>
                          {w.doc_upload_wa !== "Yes" && (
                            <div className="text-[9px] text-bad font-mono pl-1">Requires DOC Upload</div>
                          )}
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
                                  : "bg-paper/20 border-line focus:border-accent cursor-pointer text-ink"
                              }`}
                            >
                              {finalStatusOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            {isFinalStatusLocked && (
                              <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" title={w.doc_upload_wa !== "Yes" ? "Locked: 'DOC upload' must be Yes" : "Locked: Only system admin can modify after change applied"} />
                            )}
                          </div>
                          <span className="block text-[9px] text-[#8a8175] font-mono pl-1" title="Final Placement Change Date">
                            Date: {w.final_status_date || (w.created_at ? w.created_at.split("T")[0] : "—")}
                          </span>
                          {w.doc_upload_wa !== "Yes" && (
                            <div className="text-[9px] text-bad font-mono pl-1">Requires DOC Upload</div>
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
  );
}
