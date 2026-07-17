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
  Filter, 
  Plus, 
  FileSpreadsheet, 
  Hammer, 
  User, 
  Calendar, 
  ArrowRight, 
  Eye, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Info, 
  LayoutGrid, 
  ListFilter,
  Activity,
  Award,
  Sparkles
} from "lucide-react";
import { SankenLogo } from "./SankenLogo";

interface AssessmentsViewProps {
  currentUser: any;
  darkMode?: boolean;
  candidates?: Candidate[];
  onSaveCandidate?: (candidate: Candidate) => Promise<boolean>;
  onDeleteCandidate?: (id: string) => Promise<boolean>;
  onSendCandidateToEngineer?: (candidate: Candidate) => Promise<{ success: boolean; message?: string }>;
}

export default function AssessmentsView(props: AssessmentsViewProps) {
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
        list.sort((a, b) => b.date.localeCompare(a.date));
        setLocalCandidates(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to candidates:", error);
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

  // Start a new assessment
  const startNewAssessment = (positionId: Candidate["positionId"]) => {
    setSelectedPositionId(positionId);
    setSelectedCandidate(null);
    setIsEditing(true);
    setActiveView("form");
  };

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
    <div className={`flex-1 flex flex-col p-6 space-y-6 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-[#f8fafc] text-slate-900"}`}>
      {/* Page Title & Sanken Header branding */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-accent shrink-0 stroke-[2.2]" />
            <h1 className="text-xl font-black tracking-tight font-sans">Trade Competency Assessments</h1>
          </div>
          <p className="text-xs text-muted font-medium mt-1">
            Conduct multi-section trade assessments, log candidate scores, capture live profiles, and synchronize competency registries.
          </p>
        </div>

        {/* Action button - trigger spreadsheet download */}
        <button
          onClick={() => exportToExcel(candidates)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-emerald-500/10"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Excel Registry</span>
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Passed (Score &gt; 59)</span>
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
            <span className="text-2xs font-semibold text-blue-500">Success Rate</span>
          </div>
        </div>
      </div>

      {/* Grid Layout: Left: Trade Position Cards Selector, Right: History Registry */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Position Selection Cards (Grid width 5/12) */}
        <div className="xl:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-sm font-black uppercase tracking-tight text-accent flex items-center gap-1.5">
              <Plus className="w-4.5 h-4.5 stroke-[2.2]" />
              <span>Select Trade & Start Evaluation</span>
            </h2>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-muted px-2 py-0.5 rounded-full font-bold">
              10 Positions
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {POSITIONS.map((pos) => {
              // Count how many assessed for this trade
              const count = candidates.filter((c) => c.positionId === pos.id).length;

              return (
                <button
                  key={pos.id}
                  onClick={() => startNewAssessment(pos.id)}
                  className={`group relative text-left p-4 rounded-xl border hover:border-accent active:scale-97 shadow-3xs transition-all flex flex-col justify-between h-32 cursor-pointer ${
                    darkMode 
                      ? "bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-850" 
                      : "bg-white border-slate-200/80 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent font-black border border-accent/20">
                      <Hammer className="w-4 h-4" />
                    </div>
                    {count > 0 && (
                      <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border dark:border-slate-700 px-2 py-0.5 rounded-full">
                        {count} Evaluated
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <h3 className="text-xs font-black truncate tracking-tight">{pos.title}</h3>
                    <p className="text-[10px] text-muted line-clamp-1 mt-0.5">{pos.description}</p>
                  </div>

                  <span className="absolute bottom-3 right-3 text-accent group-hover:translate-x-1.5 transition-transform">
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Database Registry List (Grid width 7/12) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-sm font-black uppercase tracking-tight text-accent flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 stroke-[2.2]" />
              <span>Assessment Registry Registry</span>
            </h2>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-muted px-2 py-0.5 rounded-full font-bold">
              {filteredCandidates.length} Records Found
            </span>
          </div>

          {/* Filters Panel */}
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

          {/* Candidate Registry Cards */}
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
            <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1.5 custom-scrollbar pb-10">
              {filteredCandidates.map((c) => {
                const score = calculateOverallScore(c);
                const isPass = score > 59;
                const position = POSITIONS.find((p) => p.id === c.positionId);

                return (
                  <div
                    key={c.id}
                    className={`p-4 rounded-2xl border shadow-3xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300 ${
                      darkMode 
                        ? "bg-slate-900 border-slate-800/80 hover:bg-slate-850" 
                        : "bg-white border-slate-100 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Photo Thumbnail */}
                      {c.photoUrl ? (
                        <img referrerPolicy="no-referrer" src={c.photoUrl} alt={c.name} className="w-12 h-12 rounded-xl object-cover border dark:border-slate-800 shrink-0 shadow-3xs" />
                      ) : (
                        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 shadow-3xs transition-colors ${
                          darkMode ? "bg-slate-950 border-slate-800 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
                        }`}>
                          <User className="w-5 h-5 stroke-[1.8]" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase font-mono tracking-wider leading-none">
                            {position?.title || c.positionId}
                          </span>
                          <span className={`px-2 py-0.5 text-4xs font-bold rounded-md border tracking-wide uppercase ${
                            c.status === "Selected" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            c.status === "On Hold" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            c.status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                            c.status === "Pending Practical" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-extrabold truncate max-w-[180px] tracking-tight">{c.name}</h3>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-muted font-mono leading-none">
                          <span>Ref: {c.referenceId}</span>
                          <span>•</span>
                          <span>NIC: {c.nicNumber || "N/A"}</span>
                          <span>•</span>
                          <span>Date: {c.date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Overall Score Badge & Actions */}
                    <div className="flex items-center gap-3 w-full sm:w-auto self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
                      
                      {/* Metric Score circle/badge */}
                      <div className="flex items-center space-x-2.5">
                        <div className="text-right">
                          <div className="flex items-baseline gap-0.5 leading-none">
                            <span className="text-sm font-black leading-none">{score}%</span>
                          </div>
                          <span className={`text-[8px] font-black tracking-widest uppercase leading-none mt-1 inline-block ${
                            isPass ? "text-emerald-500" : "text-rose-500"
                          }`}>
                            {isPass ? "PASS" : "FAIL"}
                          </span>
                        </div>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isPass ? "border-emerald-600 text-emerald-600 bg-emerald-50/10" : "border-rose-600 text-rose-600 bg-rose-50/10"
                        }`}>
                          {isPass ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        </div>
                      </div>

                      {/* Send to site engineer approval */}
                      {!c.sentToEngineer && (currentUser?.role === "recruiter" || currentUser?.role === "admin") && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (props.onSendCandidateToEngineer) {
                              const confirmSend = window.confirm(`Send candidate "${c.name}" to the site engineer for gate/visa intake approval?`);
                              if (confirmSend) {
                                const res = await props.onSendCandidateToEngineer(c);
                                if (res?.success) {
                                  alert(`Candidate "${c.name}" successfully sent to the site engineer! Record is now active in the Visa Authorization Queue.`);
                                } else {
                                  alert(`Error: ${res?.message || "Could not send candidate."}`);
                                }
                              }
                            }
                          }}
                          className="p-2.5 rounded-xl border border-transparent bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1 text-[10px] font-bold shrink-0"
                          title="Send to Site Engineer for approval"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Send to Engineer</span>
                        </button>
                      )}
                      {c.sentToEngineer && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-850 px-2.5 py-1.5 rounded-xl border dark:border-slate-800 shrink-0">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          <span>Sent to Gate</span>
                        </span>
                      )}

                      {/* View details action */}
                      <button
                        onClick={() => {
                          setSelectedCandidate(c);
                          setActiveView("detail");
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 flex items-center gap-1 text-[10px] font-bold ${
                          darkMode
                            ? "border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                        title="View Scorecard & Print"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>View Details</span>
                      </button>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
