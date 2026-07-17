import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Candidate, POSITIONS, getPositionRubrics } from "../types";
import { calculateOverallScore, exportToExcel, getStatusBadgeClass } from "../utils";
import CandidateForm from "./CandidateForm";
import CandidateDetail from "./CandidateDetail";
import { 
  ClipboardCheck, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  User, 
  Calendar, 
  ArrowRight, 
  Eye, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Info, 
  Activity,
  ListFilter,
  FileText
} from "lucide-react";

interface AssessmentRegistryViewProps {
  currentUser: any;
  darkMode?: boolean;
  candidates?: Candidate[];
  onSaveCandidate?: (candidate: Candidate) => Promise<boolean>;
  onDeleteCandidate?: (id: string) => Promise<boolean>;
  onSendCandidateToEngineer?: (candidate: Candidate) => Promise<{ success: boolean; message?: string }>;
}

export default function AssessmentRegistryView(props: AssessmentRegistryViewProps) {
  const { currentUser, darkMode = false } = props;

  // Navigation / View States
  const [activeView, setActiveView] = useState<"dashboard" | "form" | "detail">("dashboard");
  const [selectedPositionId, setSelectedPositionId] = useState<Candidate["positionId"] | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Data State (Real-time synced from Firestore)
  const [localCandidates, setLocalCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(props.candidates === undefined);

  // Use props.candidates if provided, otherwise local synced candidates
  const candidates = props.candidates !== undefined ? props.candidates : localCandidates;

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all"); // all, pass, fail

  // Subscribe to real-time updates from Firestore "candidates" collection
  useEffect(() => {
    if (props.candidates !== undefined) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "candidates"),
      (snapshot) => {
        const list: Candidate[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Candidate);
        });
        // Sort by date (newest first)
        list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setLocalCandidates(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to candidates in AssessmentRegistryView:", error);
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, "candidates");
      }
    );

    return unsubscribe;
  }, [props.candidates]);

  // Filtered Candidates Memoization
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // 1. Search Query
      const queryLower = searchQuery.toLowerCase();
      const matchesSearch = 
        c.name.toLowerCase().includes(queryLower) ||
        (c.nicNumber || "").toLowerCase().includes(queryLower) ||
        (c.passportNumber || "").toLowerCase().includes(queryLower) ||
        c.referenceId.toLowerCase().includes(queryLower);

      // 2. Trade Filter
      const matchesTrade = tradeFilter === "all" || c.positionId === tradeFilter;

      // 3. Status Filter
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;

      // 4. Pass/Fail Filter
      const score = calculateOverallScore(c);
      const isPass = score > 59;
      const matchesResult = 
        resultFilter === "all" || 
        (resultFilter === "pass" && isPass) || 
        (resultFilter === "fail" && !isPass);

      return matchesSearch && matchesTrade && matchesStatus && matchesResult;
    });
  }, [candidates, searchQuery, tradeFilter, statusFilter, resultFilter]);

  // Handle Save (Add or Edit) candidate assessment
  const handleSaveCandidate = async (candidateData: Candidate) => {
    try {
      if (props.onSaveCandidate) {
        const success = await props.onSaveCandidate(candidateData);
        if (!success) throw new Error("Save prop failed");
      } else {
        // Save directly to firestore
        await setDoc(doc(db, "candidates", candidateData.id), candidateData);
      }
      
      // Update local state temporarily for smooth UX
      if (props.candidates === undefined) {
        setLocalCandidates((prev) => {
          const exists = prev.some((c) => c.id === candidateData.id);
          if (exists) {
            return prev.map((c) => (c.id === candidateData.id ? candidateData : c));
          }
          return [candidateData, ...prev];
        });
      }

      // Navigate to detailed view of saved candidate
      setSelectedCandidate(candidateData);
      setIsEditing(false);
      setActiveView("detail");
    } catch (error) {
      console.error("Error saving candidate:", error);
      handleFirestoreError(error, OperationType.WRITE, `candidates/${candidateData.id}`);
      alert("Failed to save candidate assessment. Please check your Firestore connection.");
    }
  };

  // Handle Delete candidate assessment
  const handleDeleteCandidate = async (id: string) => {
    try {
      if (props.onDeleteCandidate) {
        const success = await props.onDeleteCandidate(id);
        if (!success) throw new Error("Delete prop failed");
      } else {
        await deleteDoc(doc(db, "candidates", id));
      }
      // Reset selected states and go back to dashboard
      setSelectedCandidate(null);
      setIsEditing(false);
      setActiveView("dashboard");
    } catch (error) {
      console.error("Error deleting candidate:", error);
      handleFirestoreError(error, OperationType.DELETE, `candidates/${id}`);
      alert("Failed to delete candidate assessment.");
    }
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = candidates.length;
    let selected = 0;
    let hold = 0;
    let rejected = 0;
    let pendingPractical = 0;
    let drafts = 0;
    let passed = 0;

    candidates.forEach((c) => {
      const score = calculateOverallScore(c);
      if (score > 59) passed++;

      if (c.status === "Selected") selected++;
      else if (c.status === "On Hold") hold++;
      else if (c.status === "Rejected") rejected++;
      else if (c.status === "Pending Practical") pendingPractical++;
      else if (c.status === "Draft") drafts++;
    });

    return {
      total,
      selected,
      hold,
      rejected,
      pendingPractical,
      drafts,
      passed,
      failed: total - passed,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0
    };
  }, [candidates]);

  // Render form view
  if (activeView === "form" && selectedPositionId) {
    return (
      <CandidateForm
        candidate={selectedCandidate}
        positionId={selectedPositionId}
        activeProfile={{
          engineerName: currentUser?.name || "",
          projectName: currentUser?.assigned_projects?.[0] || "Default Project"
        }}
        candidates={candidates}
        darkMode={darkMode}
        onSave={handleSaveCandidate}
        onCancel={() => {
          if (selectedCandidate) {
            setActiveView("detail");
          } else {
            setActiveView("dashboard");
          }
        }}
      />
    );
  }

  // Render detail view
  if (activeView === "detail" && selectedCandidate) {
    return (
      <CandidateDetail
        candidate={selectedCandidate}
        onEdit={(cand) => {
          setSelectedPositionId(cand.positionId);
          setSelectedCandidate(cand);
          setIsEditing(true);
          setActiveView("form");
        }}
        onDelete={() => handleDeleteCandidate(selectedCandidate.id)}
        onBackToList={() => {
          setSelectedCandidate(null);
          setActiveView("dashboard");
        }}
        darkMode={darkMode}
        currentUser={currentUser}
        onSendCandidateToEngineer={props.onSendCandidateToEngineer}
      />
    );
  }

  return (
    <div className={`flex-1 flex flex-col p-4 md:p-6 space-y-6 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-[#f8fafc] text-slate-900"}`}>
      {/* Page Title & Header Branding */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-accent shrink-0 stroke-[2.2]" />
            <h1 className="text-xl font-black tracking-tight font-sans">Assessment Registry</h1>
          </div>
          <p className="text-xs text-muted font-medium mt-1">
            Access, filter, and search the complete database of candidate trade evaluations. Optimized for desktop and phone lookup.
          </p>
        </div>

        {/* Action button - trigger spreadsheet download */}
        <button
          onClick={() => exportToExcel(candidates)}
          className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/10"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Excel Registry</span>
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Metric 1 */}
        <div className={`p-4 rounded-2xl border shadow-3xs flex flex-col justify-between ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Assessed</span>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black">{metrics.total}</span>
            <span className="text-2xs font-semibold text-slate-400">candidates</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className={`p-4 rounded-2xl border shadow-3xs flex flex-col justify-between ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Passed (&gt;59)</span>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">{metrics.passed}</span>
            <span className="text-2xs font-semibold text-emerald-500">Passed</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className={`p-4 rounded-2xl border shadow-3xs flex flex-col justify-between ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Failed</span>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-600">{metrics.failed}</span>
            <span className="text-2xs font-semibold text-rose-500">Failed</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className={`p-4 rounded-2xl border shadow-3xs flex flex-col justify-between ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Pass Ratio</span>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-600">{metrics.passRate}%</span>
            <span className="text-2xs font-semibold text-blue-500">Success</span>
          </div>
        </div>
      </div>

      {/* Database Filters Panel */}
      <div className={`p-4 rounded-2xl border shadow-3xs space-y-3.5 transition-colors duration-300 ${
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
      }`}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidates by name, NIC, passport, or Ref ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-xs transition-all font-semibold focus:outline-none focus:ring-1 ${
              darkMode
                ? "border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-600 focus:ring-slate-700 focus:border-slate-700"
                : "border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:ring-slate-400 focus:border-slate-400"
            }`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Trade Filter */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Trade / Position</label>
            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className={`w-full px-3 py-1.5 border rounded-lg text-xs font-semibold focus:outline-none ${
                darkMode ? "border-slate-800 bg-slate-950 text-slate-200" : "border-slate-200 bg-white text-slate-800"
              }`}
            >
              <option value="all">All Trades</option>
              {POSITIONS.map((pos) => (
                <option key={pos.id} value={pos.id}>{pos.title}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full px-3 py-1.5 border rounded-lg text-xs font-semibold focus:outline-none ${
                darkMode ? "border-slate-800 bg-slate-950 text-slate-200" : "border-slate-200 bg-white text-slate-800"
              }`}
            >
              <option value="all">All Statuses</option>
              <option value="Selected">Selected</option>
              <option value="On Hold">On Hold</option>
              <option value="Rejected">Rejected</option>
              <option value="Pending Practical">Pending Practical</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          {/* Result Filter */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Grade Outcome</label>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className={`w-full px-3 py-1.5 border rounded-lg text-xs font-semibold focus:outline-none ${
                darkMode ? "border-slate-800 bg-slate-950 text-slate-200" : "border-slate-200 bg-white text-slate-800"
              }`}
            >
              <option value="all">All Outcomes</option>
              <option value="pass">PASS (score &gt; 59)</option>
              <option value="fail">FAIL (score &lt; 60)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Database Presentation Layer */}
      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-muted space-y-2">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p>Fetching trade assessment database records...</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className={`p-10 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center space-y-3 transition-colors duration-300 ${
          darkMode ? "border-slate-800 bg-slate-900/10 text-slate-500" : "border-slate-200 bg-slate-50/55 text-slate-400"
        }`}>
          <Info className="w-8 h-8" />
          <div>
            <p className="text-xs font-bold">No Candidates Found</p>
            <p className="text-[10px] mt-0.5">Try widening your search filters or start a new assessment.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* DESKTOP TABLE VIEW (md:block hidden) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-3xs max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                  darkMode ? "bg-slate-900/50 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-100 text-slate-500"
                }`}>
                  <th className="p-3.5 pl-5 font-bold">Ref Number</th>
                  <th className="p-3.5 font-bold">Candidate Name</th>
                  <th className="p-3.5 font-bold">NIC Number</th>
                  <th className="p-3.5 font-bold">Passport</th>
                  <th className="p-3.5 font-bold">Category</th>
                  <th className="p-3.5 text-center font-bold">Final Result</th>
                  <th className="p-3.5 text-center font-bold">Current Status</th>
                  <th className="p-3.5 text-center font-bold">Process Stage</th>
                  <th className="p-3.5 pr-5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                {filteredCandidates.map((c) => {
                  const score = calculateOverallScore(c);
                  const isPass = score > 59;
                  const position = POSITIONS.find((p) => p.id === c.positionId);
                  const stageText = c.sentToEngineer ? "Complete" : "Pending for Interview";

                  return (
                    <tr 
                      key={c.id} 
                      className={`transition-colors text-xs ${
                        darkMode 
                          ? "bg-slate-900/10 hover:bg-slate-900/60 border-slate-800/30 text-slate-200" 
                          : "bg-white hover:bg-slate-50/50 text-slate-700"
                      }`}
                    >
                      {/* Ref Number */}
                      <td className="p-3 pl-5 font-mono text-slate-850 dark:text-slate-300">
                        {c.referenceId}
                      </td>

                      {/* Candidate Name with photo thumbnail */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {c.photoUrl ? (
                            <img 
                              referrerPolicy="no-referrer" 
                              src={c.photoUrl} 
                              alt={c.name} 
                              className="w-8 h-8 rounded-lg object-cover border dark:border-slate-800 shadow-4xs shrink-0" 
                            />
                          ) : (
                            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 shadow-4xs transition-colors ${
                              darkMode ? "bg-slate-950 border-slate-800 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
                            }`}>
                              <User className="w-3.5 h-3.5 stroke-[1.8]" />
                            </div>
                          )}
                          <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                            {c.name}
                          </span>
                        </div>
                      </td>

                      {/* NIC Number */}
                      <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                        {c.nicNumber || "—"}
                      </td>

                      {/* Passport Number */}
                      <td className="p-3 font-mono text-slate-800 dark:text-slate-300">
                        {c.passportNumber || "—"}
                      </td>

                      {/* Category */}
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                        {position?.title || c.positionId}
                      </td>

                      {/* Final Result with Pass/Fail */}
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${
                          isPass 
                            ? "bg-emerald-50 text-success-green border-green-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50" 
                            : "bg-rose-50 text-bad border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50"
                        }`}>
                          {isPass ? (
                            <CheckCircle className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                          )}
                          <span>{score}% ({isPass ? "Pass" : "Fail"})</span>
                        </span>
                      </td>

                      {/* Current Status */}
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded-md border ${
                          c.status === "Selected" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50" :
                          c.status === "On Hold" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50" :
                          c.status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50" :
                          c.status === "Pending Practical" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50" :
                          "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}>
                          {c.status}
                        </span>
                      </td>

                      {/* Process Stage (Pending for Interview vs Complete) */}
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold border leading-none ${
                          c.sentToEngineer 
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50" 
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50"
                        }`}>
                          {stageText}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 pr-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Send to Engineer Action */}
                          {!c.sentToEngineer && (currentUser?.role === "recruiter" || currentUser?.role === "admin") && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (props.onSendCandidateToEngineer) {
                                  const confirmSend = window.confirm(`Send candidate "${c.name}" to the site engineer for gate/visa intake approval?`);
                                  if (confirmSend) {
                                    const res = await props.onSendCandidateToEngineer(c);
                                    if (res?.success) {
                                      alert(`Candidate "${c.name}" successfully sent to the site engineer!`);
                                    } else {
                                      alert(`Error: ${res?.message || "Could not send candidate."}`);
                                    }
                                  }
                                }
                              }}
                              className="px-2 py-1 rounded-lg border border-transparent bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer text-[10px] font-bold flex items-center gap-1"
                              title="Send to Site Engineer"
                            >
                              <ArrowRight className="w-3 h-3" />
                              <span>Send to Gate</span>
                            </button>
                          )}

                          {/* View details */}
                          <button
                            onClick={() => {
                              setSelectedCandidate(c);
                              setActiveView("detail");
                            }}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              darkMode
                                ? "border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300"
                                : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                            }`}
                            title="View Scorecard"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit candidate */}
                          {(currentUser?.role === "admin" || currentUser?.role === "recruiter") && (
                            <button
                              onClick={() => {
                                setSelectedPositionId(c.positionId);
                                setSelectedCandidate(c);
                                setIsEditing(true);
                                setActiveView("form");
                              }}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                darkMode
                                  ? "border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                              }`}
                              title="Edit Candidate"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete candidate */}
                          {currentUser?.role === "admin" && (
                            <button
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete candidate "${c.name}"?`)) {
                                  await handleDeleteCandidate(c.id);
                                }
                              }}
                              className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-all cursor-pointer"
                              title="Delete Candidate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE PHONE CARDS VIEW (md:hidden block) - EXTREMELY EASY TO ACCESS AND TOUCH */}
          <div className="md:hidden space-y-4">
            {filteredCandidates.map((c) => {
              const score = calculateOverallScore(c);
              const isPass = score > 59;
              const position = POSITIONS.find((p) => p.id === c.positionId);
              const stageText = c.sentToEngineer ? "Complete" : "Pending for Interview";

              return (
                <div 
                  key={c.id} 
                  className={`p-4 rounded-2xl border shadow-2xs space-y-3.5 transition-colors ${
                    darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                  }`}
                >
                  {/* Card Header: Trade Category & Status */}
                  <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider font-mono">
                      {position?.title || c.positionId}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] uppercase font-mono font-bold rounded-md border ${
                      c.status === "Selected" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50" :
                      c.status === "On Hold" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50" :
                      c.status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50" :
                      c.status === "Pending Practical" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50" :
                      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    }`}>
                      {c.status}
                    </span>
                  </div>

                  {/* Candidate Identity Details */}
                  <div className="flex items-start gap-3">
                    {c.photoUrl ? (
                      <img 
                        referrerPolicy="no-referrer" 
                        src={c.photoUrl} 
                        alt={c.name} 
                        className="w-12 h-12 rounded-xl object-cover border dark:border-slate-800 shadow-3xs shrink-0" 
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 shadow-3xs transition-colors ${
                        darkMode ? "bg-slate-950 border-slate-800 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}>
                        <User className="w-5 h-5 stroke-[1.8]" />
                      </div>
                    )}
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                        {c.name}
                      </h3>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] font-mono text-muted">
                        <div>Ref: <span className="font-bold text-slate-700 dark:text-slate-300">{c.referenceId}</span></div>
                        <div>NIC: <span className="font-bold text-slate-700 dark:text-slate-300">{c.nicNumber || "—"}</span></div>
                        <div className="col-span-2">Pass: <span className="font-bold text-slate-700 dark:text-slate-300">{c.passportNumber || "—"}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Outcome Score & Process Stage Indicators */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className={`p-2 rounded-xl border flex flex-col justify-center items-center ${
                      isPass 
                        ? "bg-emerald-50/40 border-emerald-100 text-emerald-800 dark:bg-emerald-950/15 dark:border-emerald-900/50 dark:text-emerald-400" 
                        : "bg-rose-50/40 border-rose-100 text-rose-800 dark:bg-rose-950/15 dark:border-rose-900/50 dark:text-rose-400"
                    }`}>
                      <span className="text-[8px] font-black uppercase tracking-widest leading-none">Grade Outcome</span>
                      <span className="text-xs font-black mt-1 leading-none">{score}% ({isPass ? "PASS" : "FAIL"})</span>
                    </div>

                    <div className={`p-2 rounded-xl border flex flex-col justify-center items-center ${
                      c.sentToEngineer 
                        ? "bg-blue-50/40 border-blue-100 text-blue-800 dark:bg-blue-950/15 dark:border-blue-900/50 dark:text-blue-400" 
                        : "bg-amber-50/40 border-amber-100 text-amber-800 dark:bg-amber-950/15 dark:border-amber-900/50 dark:text-amber-400"
                    }`}>
                      <span className="text-[8px] font-black uppercase tracking-widest leading-none">Process Stage</span>
                      <span className="text-xs font-black mt-1 leading-none">{stageText}</span>
                    </div>
                  </div>

                  {/* Actions Bar for Mobile (Minimum 44px Touch Targets) */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {/* View Scorecard Button */}
                    <button
                      onClick={() => {
                        setSelectedCandidate(c);
                        setActiveView("detail");
                      }}
                      className={`flex-1 min-h-[44px] px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                        darkMode 
                          ? "border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-200" 
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <Eye className="w-4 h-4 text-slate-400" />
                      <span>Details</span>
                    </button>

                    {/* Send to Gate (Site Engineer Approval) */}
                    {!c.sentToEngineer && (currentUser?.role === "recruiter" || currentUser?.role === "admin") && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (props.onSendCandidateToEngineer) {
                            const confirmSend = window.confirm(`Send candidate "${c.name}" to the site engineer for gate/visa intake approval?`);
                            if (confirmSend) {
                              const res = await props.onSendCandidateToEngineer(c);
                              if (res?.success) {
                                alert(`Candidate "${c.name}" successfully sent to the site engineer!`);
                              } else {
                                alert(`Error: ${res?.message || "Could not send candidate."}`);
                              }
                            }
                          }
                        }}
                        className="flex-1 min-h-[44px] px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>To Gate</span>
                      </button>
                    )}

                    {/* Edit Option (Admins & Recruiters) */}
                    {(currentUser?.role === "admin" || currentUser?.role === "recruiter") && (
                      <button
                        onClick={() => {
                          setSelectedPositionId(c.positionId);
                          setSelectedCandidate(c);
                          setIsEditing(true);
                          setActiveView("form");
                        }}
                        className={`min-h-[44px] w-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                          darkMode
                            ? "border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                        title="Edit Evaluation"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete Option (Admins only) */}
                    {currentUser?.role === "admin" && (
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete candidate "${c.name}"?`)) {
                            await handleDeleteCandidate(c.id);
                          }
                        }}
                        className="min-h-[44px] w-11 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                        title="Delete Evaluation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}
