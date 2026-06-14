import React, { useState, useMemo } from "react";
import { Category, Worker, Company, DropdownOption, ProjectDetail } from "../types";
import { 
  ShieldCheck, 
  AlertOctagon, 
  CheckCircle, 
  Clock, 
  Lock, 
  Unlock,
  ChevronRight,
  TrendingDown,
  Layers,
  Search,
  XCircle,
  Pause
} from "lucide-react";

interface EngineerApprovalsViewProps {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  dropdownOptions: DropdownOption[];
  projects?: ProjectDetail[];
  selectedProjectId?: string;
  projectDetail?: ProjectDetail | null;
  onRefresh: () => void;
  onApproveWorker: (id: string, sendingBatch: string) => Promise<{ success: boolean; message?: string }>;
  onHoldWorker: (id: string) => Promise<{ success: boolean; message?: string }>;
  onRejectWorker: (id: string, reason?: string) => Promise<{ success: boolean; message?: string }>;
}

export default function EngineerApprovalsView({
  workers,
  categories,
  companies,
  dropdownOptions,
  projects = [],
  selectedProjectId = "",
  projectDetail,
  onRefresh,
  onApproveWorker,
  onHoldWorker,
  onRejectWorker
}: EngineerApprovalsViewProps) {
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Maintain local state of selected batch per worker rows
  const [workerBatchSelection, setWorkerBatchSelection] = useState<{ [workerId: string]: string }>({});

  // Maintain local state of rejection reasons per worker rows
  const [rejectReasons, setRejectReasons] = useState<{ [workerId: string]: string }>({});

  // Bulk operation states for technical approvals
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [bulkBatch, setBulkBatch] = useState<string>("");
  const [bulkRejectReason, setBulkRejectReason] = useState<string>("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Scope worker actions strictly within the currently selected active project focus
  const scopedWorkers = useMemo(() => {
    return workers.filter((w) => w.project_id === selectedProjectId);
  }, [workers, selectedProjectId]);

  // Dropdown list for batches
  const sendingBatches = useMemo(() => {
    return dropdownOptions
      .filter((opt) => opt.field === "sending_batch")
      .map((opt) => opt.value);
  }, [dropdownOptions]);

  // Calculate live vacancies remaining per category
  const categoryStates = useMemo(() => {
    return categories.map((cat) => {
      const activeCount = scopedWorkers.filter((w) => w.category === cat.name && w.state === "active").length;
      const remaining = Math.max(0, cat.max_quota - activeCount);
      const percent = cat.max_quota > 0 ? (activeCount / cat.max_quota) * 100 : 0;
      return {
        ...cat,
        activeCount,
        remaining,
        percent
      };
    });
  }, [categories, scopedWorkers]);

  // Map category name to its current vacancy remaining
  const categoryVacanyMap = useMemo(() => {
    const map: { [catName: string]: number } = {};
    categoryStates.forEach((cs) => {
      map[cs.name] = cs.remaining;
    });
    return map;
  }, [categoryStates]);

  // Map category_company combo to its current vacancy remaining for that specific supplier
  const companyCategoryVacancyMap = useMemo(() => {
    const map: { [comboKey: string]: number } = {};
    categories.forEach((cat) => {
      companies.forEach((co) => {
        const comboKey = `${cat.name}_${co.name}`;
        const limit = cat.company_allocations?.[co.name] ?? 0;
        const activeCount = scopedWorkers.filter((w) => w.category === cat.name && w.supply_company === co.name && w.state === "active").length;
        map[comboKey] = Math.max(0, limit - activeCount);
      });
    });
    return map;
  }, [categories, companies, scopedWorkers]);

  // Pending worker list (state = 'pending' or 'held'!)
  const pendingWorkers = useMemo(() => {
    return scopedWorkers.filter((w) => {
      // Must be pending or held state
      if (w.state !== "pending" && w.state !== "held") return false;

      // Filter by supply company
      if (selectedCompany !== "All" && w.supply_company !== selectedCompany) {
        return false;
      }

      // Filter by search string
      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = w.name.toLowerCase().includes(query);
        const matchesPassport = w.passport.toLowerCase().includes(query);
        if (!matchesName && !matchesPassport) return false;
      }

      return true;
    });
  }, [scopedWorkers, selectedCompany, searchQuery]);

  // Synchronously compute selected IDs that are visible in current workspace
  const visibleSelectedIds = useMemo(() => {
    const pendingIds = new Set(pendingWorkers.map((w) => w.id));
    return selectedWorkerIds.filter((id) => pendingIds.has(id));
  }, [selectedWorkerIds, pendingWorkers]);

  // Set default bulkBatch once sendingBatches is populated
  React.useEffect(() => {
    if (sendingBatches.length > 0 && !bulkBatch) {
      setBulkBatch(sendingBatches[0]);
    }
  }, [sendingBatches, bulkBatch]);

  const handleBulkApprove = async () => {
    if (visibleSelectedIds.length === 0 || !bulkBatch) return;
    setIsBulkProcessing(true);
    setMessage(null);

    let approvedCount = 0;
    let failedCount = 0;
    let quotaSkippedCount = 0;

    // To prevent over-allocation during bulk queue, track local decrements
    const localCategoryRemaining = { ...categoryVacanyMap };
    const localCompanyCategoryRemaining = { ...companyCategoryVacancyMap };

    try {
      for (const workerId of visibleSelectedIds) {
        const w = pendingWorkers.find((x) => x.id === workerId);
        if (!w) continue;

        const categoryName = w.category;
        const companyName = w.supply_company || "KSJ";
        const comboKey = `${categoryName}_${companyName}`;

        const companyRemaining = localCompanyCategoryRemaining[comboKey] ?? 0;
        const globalRemaining = localCategoryRemaining[categoryName] ?? 0;

        if (companyRemaining <= 0 || globalRemaining <= 0) {
          quotaSkippedCount++;
          continue;
        }

        // Apply deduction locally first
        localCompanyCategoryRemaining[comboKey] = companyRemaining - 1;
        localCategoryRemaining[categoryName] = globalRemaining - 1;

        const res = await onApproveWorker(workerId, bulkBatch);
        if (res.success) {
          approvedCount++;
        } else {
          // Revert deduction
          localCompanyCategoryRemaining[comboKey] = companyRemaining;
          localCategoryRemaining[categoryName] = globalRemaining;
          failedCount++;
        }
      }

      let msg = `Bulk Authorization executed. Approved: ${approvedCount} worker(s).`;
      if (failedCount > 0) msg += ` Failed: ${failedCount} worker(s).`;
      if (quotaSkippedCount > 0) msg += ` Skipped due to quota limits: ${quotaSkippedCount} worker(s).`;

      setMessage({
        text: msg,
        type: approvedCount > 0 ? "success" : "error"
      });

      setSelectedWorkerIds([]);
      onRefresh();
    } catch (err) {
      setMessage({ text: "Error executing bulk approval.", type: "error" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkHold = async () => {
    if (visibleSelectedIds.length === 0) return;
    setIsBulkProcessing(true);
    setMessage(null);

    let holdCount = 0;
    let failedCount = 0;

    try {
      for (const workerId of visibleSelectedIds) {
        const res = await onHoldWorker(workerId);
        if (res.success) {
          holdCount++;
        } else {
          failedCount++;
        }
      }

      let msg = `Bulk Hold completed. Placed on hold: ${holdCount} worker(s).`;
      if (failedCount > 0) msg += ` Failed: ${failedCount} worker(s).`;

      setMessage({
        text: msg,
        type: holdCount > 0 ? "success" : "error"
      });

      setSelectedWorkerIds([]);
      onRefresh();
    } catch (err) {
      setMessage({ text: "Error placing workers on bulk hold.", type: "error" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (visibleSelectedIds.length === 0 || !bulkRejectReason.trim()) {
      setMessage({ text: "Please enter a valid reject reason for bulk rejection.", type: "error" });
      return;
    }
    setIsBulkProcessing(true);
    setMessage(null);

    let rejectCount = 0;
    let failedCount = 0;

    try {
      for (const workerId of visibleSelectedIds) {
        const res = await onRejectWorker(workerId, bulkRejectReason.trim());
        if (res.success) {
          rejectCount++;
        } else {
          failedCount++;
        }
      }

      let msg = `Bulk Reject completed. Rejected: ${rejectCount} worker(s).`;
      if (failedCount > 0) msg += ` Failed: ${failedCount} worker(s).`;

      setMessage({
        text: msg,
        type: rejectCount > 0 ? "success" : "error"
      });

      setSelectedWorkerIds([]);
      setBulkRejectReason("");
      onRefresh();
    } catch (err) {
      setMessage({ text: "Error executing bulk rejection.", type: "error" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleApprove = async (workerId: string, categoryName: string) => {
    setMessage(null);
    const selectedBatch = workerBatchSelection[workerId] || sendingBatches[0];

    if (!selectedBatch) {
      setMessage({ text: "Please declare a valid Sending Batch for this deployment.", type: "error" });
      return;
    }

    const workerObj = scopedWorkers.find(w => w.id === workerId);
    if (!workerObj) return;

    const companyName = workerObj.supply_company || "KSJ";
    const comboKey = `${categoryName}_${companyName}`;
    const companyVacancy = companyCategoryVacancyMap[comboKey] ?? 0;

    // Double check local vacancy counter for the specific supply company
    if (companyVacancy <= 0) {
      setMessage({ text: `Gate Locked: Vendor "${companyName}" allocation already reached for category "${categoryName}".`, type: "error" });
      return;
    }

    // Double check global vacancy counter
    const remaining = categoryVacanyMap[categoryName] ?? 0;
    if (remaining <= 0) {
      setMessage({ text: `Gate Locked: Maximum allocation already reached for category "${categoryName}".`, type: "error" });
      return;
    }

    setProcessingId(workerId);
    try {
      const res = await onApproveWorker(workerId, selectedBatch);
      if (res.success) {
        setMessage({ text: `Gateway Authorized: Worker approved and registered in Active pipeline under ${selectedBatch}!`, type: "success" });
        // Purge row batch state
        const updatedSelections = { ...workerBatchSelection };
        delete updatedSelections[workerId];
        setWorkerBatchSelection(updatedSelections);
      } else {
        setMessage({ text: res.message || "Approval authorization failed.", type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Database connection timed out during execution.", type: "error" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleHold = async (workerId: string) => {
    setMessage(null);
    setProcessingId(workerId);
    try {
      const res = await onHoldWorker(workerId);
      if (res.success) {
        setMessage({ text: `Worker successfully placed on HOLD and related supply agency was notified!`, type: "success" });
      } else {
        setMessage({ text: res.message || "Failed to place on hold.", type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Database connection timed out during execution.", type: "error" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (workerId: string, reason?: string) => {
    setMessage(null);
    setProcessingId(workerId);
    try {
      const res = await onRejectWorker(workerId, reason);
      if (res.success) {
        setMessage({ text: `Worker successfully REJECTED and notified to their supply agency.`, type: "success" });
      } else {
        setMessage({ text: res.message || "Failed to reject worker.", type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Database connection timed out during execution.", type: "error" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div id="engineer-viewport" className="flex-1 overflow-y-auto p-6 space-y-6 max-h-screen">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-stone-900 text-[#FDFBF6] rounded-xl p-5 border border-stone-800 shadow-sm gap-4">
        <div>
          <span className="px-2 py-0.5 bg-stone-800 border border-amber-500/20 text-amber-500 font-mono text-[10px] uppercase rounded-full">
            Engineering Approval Gate
          </span>
          <h2 className="text-xl font-serif tracking-tight mt-1">Visa Processing Authorization Desk</h2>
          <p className="text-xs text-stone-400">Validate pending worker records against active category allocations.</p>
        </div>
        
        <button
          onClick={() => onRefresh()}
          className="px-3 py-1.5 border border-stone-700 hover:bg-stone-800 rounded-lg text-xs font-mono text-stone-300 transition-colors cursor-pointer"
        >
          Resync Gate data
        </button>
      </div>

      {/* Project Target Info Banner */}
      {projectDetail ? (
        <div className="bg-amber-50/40 border border-line rounded-lg p-3 text-xs flex items-center justify-between font-sans">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent shrink-0" />
            <div>
              <span className="font-semibold text-ink">Active Project Context: </span>
              <span className="text-accent font-bold">{projectDetail.name}</span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-muted">
            Site Engineer: <span className="font-semibold text-ink">{projectDetail.engineer_in_charge}</span>
          </div>
        </div>
      ) : (
        <div className="bg-red-50 text-bad border border-bad/20 p-3 rounded-lg text-xs font-sans">
          Warning: No active project focused. Please select a project context in the sidebar or dashboard.
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`p-4 border rounded-xl text-xs flex gap-3 items-start animate-fade-in font-sans ${
          message.type === "success" 
            ? "bg-green-50 text-success-green border-green-200" 
            : "bg-red-50 text-bad border-red-200"
        }`}>
          <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-medium">{message.text}</p>
        </div>
      )}



      {/* Main Table segment */}
      <div className="bg-card border border-line rounded-xl shadow-sm overflow-hidden">
        
        {/* Table Title & Inline Quick Filters */}
        <div className="p-4 border-b border-line bg-paper/20 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans select-none">
          <div>
            <h3 className="text-sm font-semibold text-ink font-display">Sanken Overseas Intake Queue Waiting Gate</h3>
            <p className="text-[11px] text-muted">Showing {pendingWorkers.length} pending workers of {workers.filter(w => w.state === 'pending').length} globally.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Find Search bar */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find records..."
                className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-paper/30 border border-line focus:border-accent rounded-lg outline-none"
              />
            </div>

            {/* Quick Agency Switcher */}
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="text-xs px-2 py-1.5 bg-paper/30 border border-line focus:border-accent rounded-lg outline-none w-full sm:w-44"
            >
              <option value="All">All Supply Agencies</option>
              {companies.map(co => (
                <option key={co.id} value={co.name}>{co.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Action Controls Bar for Engineer approvals */}
        {visibleSelectedIds.length > 0 && (
          <div className="bg-amber-500/[0.07] border-b border-line/60 px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-sans animate-fade-in select-none">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center min-w-[22px] px-1.5 h-5 bg-amber-600/90 text-[#FDFBF6] rounded-md text-[10px] font-bold shadow-xs">
                {visibleSelectedIds.length}
              </span>
              <div>
                <span className="font-semibold text-amber-950 block">Bulk Intake Actions</span>
                <span className="text-[10px] text-amber-700 font-medium font-mono">Approve, hold, or reject selected intake cohorts</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Batch option for Bulk Approval */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-muted font-medium text-[11px] shrink-0 uppercase tracking-wider font-mono">Sending Batch:</span>
                <select
                  value={bulkBatch}
                  onChange={(e) => setBulkBatch(e.target.value)}
                  disabled={isBulkProcessing}
                  className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs text-ink font-semibold outline-none cursor-pointer shadow-2xs"
                >
                  {sendingBatches.map((batch) => (
                    <option key={batch} value={batch}>
                      {batch}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reject Reason input for Bulk Rejection */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-muted font-medium text-[11px] shrink-0 uppercase tracking-wider font-mono">Reject Reason:</span>
                <input
                  type="text"
                  placeholder="Reason (req. for rejection)"
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                  disabled={isBulkProcessing}
                  className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs text-ink outline-none w-44 shadow-2xs"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                <button
                  type="button"
                  onClick={handleBulkApprove}
                  disabled={isBulkProcessing || !bulkBatch}
                  className="flex items-center gap-1 px-3 py-1 text-[11px] font-mono text-[#FDFBF6] bg-accent hover:bg-accent/90 disabled:bg-stone-300 disabled:text-stone-500 rounded font-semibold cursor-pointer transition-colors shadow-2xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#FDFBF6]" />
                  <span>Bulk Authorize</span>
                </button>

                <button
                  type="button"
                  onClick={handleBulkHold}
                  disabled={isBulkProcessing}
                  className="flex items-center gap-1 px-3 py-1 text-[11px] font-mono text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300/40 rounded font-semibold cursor-pointer transition-colors shadow-2xs"
                >
                  <Pause className="w-3 h-3" />
                  <span>Bulk Hold</span>
                </button>

                <button
                  type="button"
                  onClick={handleBulkReject}
                  disabled={isBulkProcessing || !bulkRejectReason.trim()}
                  className="flex items-center gap-1 px-3 py-1 text-[11px] font-mono text-bad bg-red-50 hover:bg-red-100 border border-red-300/40 disabled:bg-stone-50 disabled:border-stone-200 disabled:text-stone-400 rounded font-semibold cursor-pointer transition-colors shadow-2xs"
                >
                  <XCircle className="w-3 h-3 animate-pulse" />
                  <span>Bulk Reject</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWorkerIds([]);
                    setBulkRejectReason("");
                  }}
                  disabled={isBulkProcessing}
                  className="px-2.5 py-1 text-[11px] text-stone-500 hover:text-ink bg-white border border-stone-200 rounded font-semibold shadow-2xs cursor-pointer transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending registers list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-paper/35 border-b border-line/60 font-mono text-muted text-[10px] uppercase select-none">
                <th className="p-3 pl-5 w-12 text-center text-ink bg-paper/10 font-bold">
                  <input
                    type="checkbox"
                    checked={
                      pendingWorkers.length > 0 &&
                      pendingWorkers.every((w) => selectedWorkerIds.includes(w.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allPendingIds = pendingWorkers.map((w) => w.id);
                        setSelectedWorkerIds((prev) => Array.from(new Set([...prev, ...allPendingIds])));
                      } else {
                        const pendingIdsSet = new Set(pendingWorkers.map((w) => w.id));
                        setSelectedWorkerIds((prev) => prev.filter((id) => !pendingIdsSet.has(id)));
                      }
                    }}
                    className="rounded border-stone-300 text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer"
                  />
                </th>
                <th className="p-3 pl-2">Intake Name</th>
                <th className="p-3">Passport No.</th>
                <th className="p-3">Actual Job Category</th>
                <th className="p-3">Associated Supply Agency</th>
                <th className="p-3">Active Vacancy Counter</th>
                <th className="p-3">Sending Batch Declaration</th>
                <th className="p-3 pr-5 text-right w-80">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {pendingWorkers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted">
                    <div className="max-w-xs mx-auto space-y-1.5">
                      <p className="font-semibold text-ink">Intake gate contains zero pending workers</p>
                      <p className="text-[11px]">All registered cohorts are fully validated or filters are limiting records.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingWorkers.map((w) => {
                  const currentSelection = workerBatchSelection[w.id] || sendingBatches[0] || "";
                  const categoryVacancy = categoryVacanyMap[w.category] ?? 0;
                  const isLocked = categoryVacancy <= 0;

                  return (
                    <tr key={w.id} className={`transition-colors hover:bg-paper/10 ${w.state === "held" ? "bg-amber-500/[0.04]" : ""}`}>
                      
                      {/* Checkbox Column */}
                      <td className="p-3 pl-5 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectedWorkerIds.includes(w.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedWorkerIds((prev) => [...prev, w.id]);
                            } else {
                              setSelectedWorkerIds((prev) => prev.filter((id) => id !== w.id));
                            }
                          }}
                          className="rounded border-stone-300 text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>

                      {/* Name */}
                      <td className="p-3 pl-2 font-semibold text-ink font-display">
                        <div className="flex items-center gap-2">
                          <span>{w.name}</span>
                          {w.state === "held" && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[9px] font-mono font-bold rounded flex items-center gap-0.5">
                              <Pause className="w-2.5 h-2.5" />
                              ON HOLD
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Passport */}
                      <td className="p-3 font-mono text-ink font-medium">
                        {w.passport}
                      </td>

                      {/* Category */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-paper border border-line/50 text-[10px] text-ink rounded font-semibold">
                          {w.category}
                        </span>
                      </td>

                      {/* Supply Company */}
                      <td className="p-3 text-muted">
                        {w.supply_company}
                      </td>

                      {/* Active Vacancy Counter */}
                      <td className="p-3 font-mono">
                        {(() => {
                          const comboKey = `${w.category}_${w.supply_company}`;
                          const companyVacancy = companyCategoryVacancyMap[comboKey] ?? 0;
                          const isLockedForCompany = companyVacancy <= 0;
                          const isLockedGlobally = categoryVacancy <= 0;

                          if (isLockedForCompany || isLockedGlobally) {
                            return (
                              <span className="text-bad font-semibold flex items-center gap-1 text-[11px]">
                                <Lock className="w-3" />
                                {isLockedForCompany ? `${w.supply_company} Limit Reached` : "Category Maxed"}
                              </span>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-success-green font-semibold text-[11px] leading-tight font-display">
                                {companyVacancy} vendor slots open
                              </span>
                              <span className="text-[9px] text-muted-more font-mono">
                                ({categoryVacancy} global limit)
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Batch selector */}
                      <td className="p-2">
                        <select
                          value={currentSelection}
                          onChange={(e) => {
                            setWorkerBatchSelection({
                              ...workerBatchSelection,
                              [w.id]: e.target.value
                            });
                          }}
                          disabled={isLocked}
                          className="w-full text-xs px-2 py-1 bg-paper/20 border border-line focus:border-accent rounded outline-none cursor-pointer text-ink font-medium disabled:opacity-40"
                        >
                          {sendingBatches.map((batch) => (
                            <option key={batch} value={batch}>
                              {batch}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Action Trigger */}
                      <td className="p-2 pr-5 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Hold triggers */}
                            <button
                              id={`hold-btn-${w.id}`}
                              onClick={() => handleHold(w.id)}
                              disabled={processingId === w.id}
                              title="Place candidate on HOLD status. This lets recruiters know additional checks are active."
                              className={`px-2.5 py-1 text-[10px] font-mono uppercase inline-flex items-center justify-center gap-1 transition-all border rounded ${
                                w.state === "held"
                                  ? "bg-amber-500 text-white border-amber-500 font-bold"
                                  : "bg-paper hover:bg-amber-50 text-amber-600 border-amber-500/30 hover:border-amber-500 cursor-pointer"
                              }`}
                            >
                              <Pause className="w-3 h-3" />
                              <span>{w.state === "held" ? "On Hold" : "Hold"}</span>
                            </button>

                            {/* Reject triggers */}
                            <button
                              id={`reject-btn-${w.id}`}
                              onClick={() => {
                                const reason = rejectReasons[w.id] || "";
                                if (!reason.trim()) {
                                  setMessage({ text: `Please fill in the "Reason" input box below before rejecting Candidate "${w.name}".`, type: "error" });
                                  return;
                                }
                                handleReject(w.id, reason.trim());
                              }}
                              disabled={processingId === w.id}
                              title="Reject candidate. This will remove them from queue and notify the supply agency."
                              className="px-2.5 py-1 text-[10px] font-mono uppercase inline-flex items-center justify-center gap-1 transition-all border rounded bg-paper hover:bg-red-50 text-bad border-bad/30 hover:border-bad cursor-pointer"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Reject</span>
                            </button>

                            {/* Approve triggers */}
                            <button
                              id={`approve-btn-${w.id}`}
                              onClick={() => handleApprove(w.id, w.category)}
                              disabled={isLocked || processingId === w.id}
                              title="Authorize worker deployment to active project pipeline."
                              className={`px-3 py-1 rounded text-[10px] font-mono tracking-wider uppercase inline-flex items-center justify-center gap-1.5 transition-all text-white border ${
                                isLocked 
                                  ? "bg-stone-200 text-stone-400 border-stone-200 cursor-not-allowed" 
                                  : processingId === w.id
                                  ? "bg-muted text-[#FDFBF6] border-muted cursor-wait"
                                  : "bg-accent hover:bg-accent/90 border-accent cursor-pointer"
                              }`}
                            >
                              {isLocked ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>LOCKED</span>
                                </>
                              ) : processingId === w.id ? (
                                <span>Auth...</span>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Authorize</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Rejection comment input inline */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-bad font-mono">Reject Reason:</span>
                            <input
                              type="text"
                              placeholder="Type reason to reject..."
                              value={rejectReasons[w.id] || ""}
                              onChange={(e) => setRejectReasons({ ...rejectReasons, [w.id]: e.target.value })}
                              className="w-48 text-[11px] px-2 py-0.5 bg-red-50/45 border border-bad/20 focus:border-bad/65 focus:bg-red-50 rounded outline-none placeholder-stone-400 text-stone-800 font-sans"
                            />
                          </div>
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
