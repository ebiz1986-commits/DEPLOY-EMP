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

      {/* 1. SELECT TRADE SECTION (Full Width for grand design balance) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-sm font-black uppercase tracking-tight text-accent flex items-center gap-1.5">
            <Plus className="w-4.5 h-4.5 stroke-[2.2]" />
            <span>Select Trade & Start Evaluation</span>
          </h2>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-muted px-2 py-0.5 rounded-full font-bold">
            10 Positions Available
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
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
    </div>
  );
}
