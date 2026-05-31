import React, { useState, useMemo } from "react";
import { Category, Worker, Company, DropdownOption } from "../types";
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
  Search
} from "lucide-react";

interface EngineerApprovalsViewProps {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  dropdownOptions: DropdownOption[];
  onRefresh: () => void;
  onApproveWorker: (id: string, sendingBatch: string) => Promise<{ success: boolean; message?: string }>;
}

export default function EngineerApprovalsView({
  workers,
  categories,
  companies,
  dropdownOptions,
  onRefresh,
  onApproveWorker
}: EngineerApprovalsViewProps) {
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Maintain local state of selected batch per worker rows
  const [workerBatchSelection, setWorkerBatchSelection] = useState<{ [workerId: string]: string }>({});

  // Dropdown list for batches
  const sendingBatches = useMemo(() => {
    return dropdownOptions
      .filter((opt) => opt.field === "sending_batch")
      .map((opt) => opt.value);
  }, [dropdownOptions]);

  // Calculate live vacancies remaining per category
  const categoryStates = useMemo(() => {
    return categories.map((cat) => {
      const activeCount = workers.filter((w) => w.category === cat.name && w.state === "active").length;
      const remaining = Math.max(0, cat.max_quota - activeCount);
      const percent = cat.max_quota > 0 ? (activeCount / cat.max_quota) * 100 : 0;
      return {
        ...cat,
        activeCount,
        remaining,
        percent
      };
    });
  }, [categories, workers]);

  // Map category name to its current vacancy remaining
  const categoryVacanyMap = useMemo(() => {
    const map: { [catName: string]: number } = {};
    categoryStates.forEach((cs) => {
      map[cs.name] = cs.remaining;
    });
    return map;
  }, [categoryStates]);

  // Pending worker list (state = 'pending' only!)
  const pendingWorkers = useMemo(() => {
    return workers.filter((w) => {
      // Must be pending state
      if (w.state !== "pending") return false;

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
  }, [workers, selectedCompany, searchQuery]);

  const handleApprove = async (workerId: string, categoryName: string) => {
    setMessage(null);
    const selectedBatch = workerBatchSelection[workerId] || sendingBatches[0];

    if (!selectedBatch) {
      setMessage({ text: "Please declare a valid Sending Batch for this deployment.", type: "error" });
      return;
    }

    // Double check local vacancy counter
    const remaining = categoryVacanyMap[categoryName] ?? 0;
    if (remaining <= 0) {
      setMessage({ text: `Gate Locked: Maximum quota already reached for category "${categoryName}".`, type: "error" });
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

  return (
    <div id="engineer-viewport" className="flex-1 overflow-y-auto p-6 space-y-6 max-h-screen">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-stone-900 text-[#FDFBF6] rounded-xl p-5 border border-stone-800 shadow-sm gap-4">
        <div>
          <span className="px-2 py-0.5 bg-stone-800 border border-amber-500/20 text-amber-500 font-mono text-[10px] uppercase rounded-full">
            Engineering Approval Gate
          </span>
          <h2 className="text-xl font-serif tracking-tight mt-1">Visa Processing Authorization Desk</h2>
          <p className="text-xs text-stone-400">Validate pending worker records against active category quotas.</p>
        </div>
        
        <button
          onClick={() => onRefresh()}
          className="px-3 py-1.5 border border-stone-700 hover:bg-stone-800 rounded-lg text-xs font-mono text-stone-300 transition-colors cursor-pointer"
        >
          Resync Gate data
        </button>
      </div>

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

      {/* Big Quotas Countdown Grid widget */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {categoryStates.map((cq) => {
          const isLacking = cq.remaining <= 0;
          return (
            <div key={cq.id} className={`bg-card border rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all ${
              isLacking ? "border-bad bg-red-50/10" : "border-line"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans font-semibold text-ink truncate mr-2">{cq.name}</span>
                {isLacking ? (
                  <Lock className="w-3.5 h-3.5 text-bad shrink-0" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-success-green shrink-0" />
                )}
              </div>
              
              <div className="mt-3.5 flex items-baseline gap-2">
                <span className={`text-2xl font-mono font-bold ${isLacking ? "text-bad" : "text-ink"}`}>
                  {cq.remaining}
                </span>
                <span className="text-[10px] text-muted uppercase font-mono">slots left</span>
              </div>

              {/* Progress visualizer */}
              <div className="w-full bg-paper rounded-full h-1.5 overflow-hidden mt-3 border border-line/30">
                <div 
                  className={`h-full rounded-full ${isLacking ? "bg-bad animate-pulse" : "bg-accent"}`}
                  style={{ width: `${Math.min(100, cq.percent)}%` }}
                ></div>
              </div>
              
              <p className="text-[9px] text-muted mt-2 font-mono">
                Allocated Max quota: {cq.max_quota}
              </p>
            </div>
          );
        })}
      </div>

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

        {/* Pending registers list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-paper/35 border-b border-line/60 font-mono text-muted text-[10px] uppercase select-none">
                <th className="p-3 pl-5">Intake Name</th>
                <th className="p-3">Passport No.</th>
                <th className="p-3">Job Category</th>
                <th className="p-3">Associated Supply Agency</th>
                <th className="p-3">Active Vacancy Counter</th>
                <th className="p-3">Sending Batch Declaration</th>
                <th className="p-3 pr-5 text-right w-36">Approval Auth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {pendingWorkers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted">
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
                    <tr key={w.id} className="hover:bg-paper/10 transition-colors">
                      
                      {/* Name */}
                      <td className="p-3 pl-5 font-semibold text-ink font-display">
                        {w.name}
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
                        {isLocked ? (
                          <span className="text-bad font-semibold flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Quota Exhausted
                          </span>
                        ) : (
                          <span className="text-success-green font-semibold">
                            {categoryVacancy} slots open
                          </span>
                        )}
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
                      <td className="p-2 pr-5 text-right">
                        <button
                          id={`approve-btn-${w.id}`}
                          onClick={() => handleApprove(w.id, w.category)}
                          disabled={isLocked || processingId === w.id}
                          className={`w-full px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-wider uppercase inline-flex items-center justify-center gap-1.5 transition-all text-white border ${
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
