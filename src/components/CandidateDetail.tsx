import { useState } from "react";
import { Candidate, POSITIONS, getPositionRubrics } from "../types";
import {
  calculateS1Score,
  calculateS2Score,
  calculateS3Score,
  calculateOverallScore,
  getStatusColor,
} from "../utils";
import {
  Printer,
  Edit,
  Trash2,
  Calendar,
  User,
  Phone,
  AlertTriangle,
  FileText,
  UserCheck,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Award,
  BookOpen,
  Heart,
  Hammer
} from "lucide-react";
import { SankenLogo } from "./SankenLogo";

interface CandidateDetailProps {
  candidate: Candidate;
  onEdit: (candidate: Candidate) => void;
  onDelete: (id: string) => void;
  onBackToList: () => void;
  darkMode?: boolean;
  currentUser?: any;
  onSendCandidateToEngineer?: (candidate: Candidate) => Promise<{ success: boolean; message?: string }>;
}

export default function CandidateDetail({
  candidate,
  onEdit,
  onDelete,
  onBackToList,
  darkMode = false,
  currentUser,
  onSendCandidateToEngineer,
}: CandidateDetailProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Accordion state for rubric sections on mobile
  const [expandedSection, setExpandedSection] = useState<string | null>("s1");

  const s1 = calculateS1Score(candidate);
  const s2 = calculateS2Score(candidate);
  const s3 = calculateS3Score(candidate);
  const overall = calculateOverallScore(candidate);

  // Get dynamic rubric definitions
  const rubrics = getPositionRubrics(candidate.positionId);
  const positionInfo = POSITIONS.find(p => p.id === candidate.positionId);

  const handlePrint = () => {
    window.print();
  };

  const getPracticalGrade = (required: boolean) => {
    if (required) {
      return { label: "Required", color: "text-amber-700 bg-amber-50 border-amber-100" };
    }
    return { label: "Not Required", color: "text-slate-600 bg-slate-100 border-slate-200" };
  };

  const practicalGrade = getPracticalGrade(candidate.practicalTestRequired);

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  return (
    <div id="candidate-detail-mobile" className={`flex flex-col h-full animate-fadeIn overflow-hidden transition-colors duration-300 ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Mobile Top Navigation (Hidden on Print) */}
      <div className="bg-gradient-to-r from-[#2ea1e5] to-[#1e88e5] text-white px-4 py-3.5 flex items-center justify-between shadow-md shrink-0 no-print">
        <div className="flex items-center space-x-2.5">
          <button
            id="btn-detail-back"
            onClick={onBackToList}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <SankenLogo className="w-7 h-7" />
            <div>
              <span className="text-[8px] uppercase font-mono tracking-widest text-sky-100 font-bold block leading-none">Scorecard Details</span>
              <h1 className="text-sm font-black text-white mt-0.5 line-clamp-1">
                {candidate.name}
              </h1>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center space-x-1">
          <button
            id="btn-detail-edit"
            onClick={() => onEdit(candidate)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white cursor-pointer"
            title="Edit Assessment"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            id="btn-detail-print"
            onClick={handlePrint}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white cursor-pointer"
            title="Print Scorecard"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Detail Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar print-container print:p-0">
        
        {/* Action Banner for Recruiter to Send to Engineer (Hidden on Print) */}
        {!candidate.sentToEngineer && (currentUser?.role === "recruiter" || currentUser?.role === "admin") && (
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print ${
            darkMode ? "bg-blue-950/20 border-blue-900/60 text-blue-200" : "bg-blue-50/70 border-blue-100 text-blue-900"
          }`}>
            <div className="space-y-0.5">
              <h4 className="text-xs font-black text-blue-800 dark:text-blue-300">Ready for Gate Approval?</h4>
              <p className="text-[10px] text-slate-500">Send this candidate's interview results to the site engineer to start the worker visa & deployment tracker workflow.</p>
            </div>
            <button
              onClick={async () => {
                if (onSendCandidateToEngineer) {
                  const confirmSend = window.confirm(`Send "${candidate.name}" to the site engineer for gate/visa intake approval?`);
                  if (confirmSend) {
                    const res = await onSendCandidateToEngineer(candidate);
                    if (res?.success) {
                      alert(`Candidate "${candidate.name}" successfully sent to the site engineer!`);
                      onBackToList();
                    } else {
                      alert(`Error: ${res?.message || "Could not send candidate."}`);
                    }
                  }
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs shrink-0"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Send to Engineer</span>
            </button>
          </div>
        )}
        {candidate.sentToEngineer && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 no-print ${
            darkMode ? "bg-slate-900/50 border-slate-800/80" : "bg-slate-50 border-slate-100"
          }`}>
            <UserCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300">Sent to Engineer for Gate Approval</h4>
              <p className="text-[10px] text-slate-500">This candidate's trade assessment results have been submitted. The site engineer can now authorize them in the Visa Queue.</p>
            </div>
          </div>
        )}

        {/* PRINT ONLY HEADER - Preserves previous printable layout */}
        <div className="hidden print-only border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">CONSTRUCTION TRADES ASSESSMENT CENTRE</h1>
              <p className="text-xs text-slate-500 font-mono">STANDARDIZED {positionInfo?.title.toUpperCase()} SKILLS EVALUATION FORM</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold bg-[#1e88e5] text-white px-2.5 py-1 rounded">
                SCORECARD: {positionInfo?.title.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Candidate Profile Metadata */}
        <div className={`rounded-2xl p-4.5 border shadow-3xs space-y-4 print:border-none print:shadow-none print:p-0 print:mb-6 transition-colors duration-300 ${
          darkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-100'
        }`}>
          <div className={`flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b transition-colors duration-300 ${
            darkMode ? 'border-slate-800' : 'border-slate-100/60'
          }`}>
            <div className="flex items-center space-x-3.5">
              {candidate.photoUrl ? (
                <img referrerPolicy="no-referrer" src={candidate.photoUrl} alt={candidate.name} className={`w-16 h-16 rounded-2xl object-cover border shadow-3xs shrink-0 ${
                  darkMode ? 'border-slate-700' : 'border-slate-200'
                }`} />
              ) : (
                <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center shrink-0 shadow-3xs transition-colors ${
                  darkMode ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  <User className="w-7 h-7 stroke-[1.6]" />
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-blue-600 uppercase font-mono tracking-wider">
                    {positionInfo?.title}
                  </span>
                  <span className={`px-2 py-0.5 text-4xs font-bold rounded-full border tracking-wide uppercase ${getStatusColor(candidate.status)}`}>
                    {candidate.status === "Pending Practical" ? "Pending" : candidate.status}
                  </span>
                </div>
                <h2 className={`text-xl font-extrabold font-sans mt-1 transition-colors ${
                  darkMode ? 'text-white' : 'text-slate-950'
                }`}>
                  {candidate.name}
                </h2>
              </div>
            </div>

            {/* Overall Metric Circular Score with Pass/Fail Badge */}
            <div className={`flex items-center space-x-3 p-2.5 rounded-xl border self-stretch sm:self-auto justify-center print:border-none print:bg-white print:p-0 transition-colors duration-300 ${
              darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="relative flex items-center justify-center w-12 h-12 shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="24" cy="24" r="21" className={darkMode ? 'stroke-slate-800' : 'stroke-slate-200/60'} strokeWidth="4.5" fill="transparent" />
                  <circle
                    cx="24"
                    cy="24"
                    r="21"
                    className={`${overall > 59 ? "stroke-emerald-600" : "stroke-rose-600"} transition-all duration-300`}
                    strokeWidth="4.5"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 21}`}
                    strokeDashoffset={`${2 * Math.PI * 21 * (1 - overall / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className={`absolute text-2xs font-extrabold transition-colors ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>{overall}%</span>
              </div>
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">STATUS &amp; SCORE</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <p className={`text-xs font-black transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-800'}`}>Scorecard</p>
                  <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded-md uppercase border ${overall > 59 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
                    {overall > 59 ? "Pass" : "Fail"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className={`grid grid-cols-2 gap-3.5 text-2xs transition-colors duration-300 ${
            darkMode ? 'text-slate-400' : 'text-slate-600'
          }`}>
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <span><strong className={darkMode ? 'text-slate-250 font-bold' : 'text-slate-800 font-semibold'}>Ref No:</strong> {candidate.referenceId}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span><strong className={darkMode ? 'text-slate-250 font-bold' : 'text-slate-800 font-semibold'}>Date:</strong> {candidate.date}</span>
            </div>
            <div className="flex items-center space-x-2 col-span-2 sm:col-span-1">
              <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
              <span><strong className={darkMode ? 'text-slate-250 font-bold' : 'text-slate-800 font-semibold'}>NIC No:</strong> {candidate.nicNumber || "N/A"}</span>
            </div>
            <div className="flex items-center space-x-2 col-span-2 sm:col-span-1">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <span><strong className={darkMode ? 'text-slate-250 font-bold' : 'text-slate-800 font-semibold'}>Passport:</strong> {candidate.passportNumber || "N/A"}</span>
            </div>
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span><strong className={darkMode ? 'text-slate-250 font-bold' : 'text-slate-800 font-semibold'}>Assessor:</strong> {candidate.assessor || "N/A"}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <span><strong className={darkMode ? 'text-slate-250 font-bold' : 'text-slate-800 font-semibold'}>Contact:</strong> {candidate.contact || "N/A"}</span>
            </div>
          </div>
        </div>



        {/* Interactive Rubrics Container (Accordions on screen, fully expanded on print) */}
        <div className="space-y-3">
          
          {/* S1 Accordion */}
          <div className={`rounded-2xl border-l-[6px] border-l-blue-600 border-y border-r shadow-3xs overflow-hidden transition-colors duration-300 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <button
              onClick={() => toggleSection("s1")}
              className={`w-full px-4 py-3.5 flex items-center justify-between text-left cursor-pointer no-print transition-all ${
                expandedSection === "s1"
                  ? darkMode ? "bg-blue-950/35" : "bg-blue-50/20"
                  : darkMode ? "active:bg-blue-950/20" : "active:bg-blue-50/40"
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'bg-blue-950/80 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                  <Award className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className={`text-xs font-black font-sans transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}>Section 1: Experience & Quals</h3>
                  <p className={`text-[10px] font-semibold mt-0.5 transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Subtotal: {s1.raw}/100 | Weight: 50%</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-lg border transition-colors ${
                  darkMode ? 'text-blue-300 bg-blue-950/80 border-blue-900/50' : 'text-blue-800 bg-blue-100/70 border-blue-200/50'
                }`}>
                  {s1.weighted}%
                </span>
                {expandedSection === "s1" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {/* Content block: visible when expanded or on print */}
            {(expandedSection === "s1" || window.matchMedia("print").matches) && (
              <div className={`p-4 pt-4 border-t space-y-4 transition-colors duration-300 ${
                darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/30'
              }`}>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s1.s1_siteExperience.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s1_siteExperience}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-blue-400 bg-blue-950/60' : 'text-blue-700 bg-blue-50'}`}>Res: {Math.round(((candidate.s1_siteExperience || 0) / 100) * 50 * 10) / 10}/50</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${candidate.s1_siteExperience}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s1.s1_siteExperience.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s1.s1_nvqQualification.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s1_nvqQualification}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-blue-400 bg-blue-950/60' : 'text-blue-700 bg-blue-50'}`}>Res: {Math.round(((candidate.s1_nvqQualification || 0) / 100) * 30 * 10) / 10}/30</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${candidate.s1_nvqQualification}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s1.s1_nvqQualification.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s1.s1_recommendation.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s1_recommendation}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-blue-400 bg-blue-950/60' : 'text-blue-700 bg-blue-50'}`}>Res: {Math.round(((candidate.s1_recommendation || 0) / 100) * 20 * 10) / 10}/20</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${candidate.s1_recommendation}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s1.s1_recommendation.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* S2 Accordion */}
          <div className={`rounded-2xl border-l-[6px] border-l-indigo-600 border-y border-r shadow-3xs overflow-hidden transition-colors duration-300 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <button
              onClick={() => toggleSection("s2")}
              className={`w-full px-4 py-3.5 flex items-center justify-between text-left cursor-pointer no-print transition-all ${
                expandedSection === "s2"
                  ? darkMode ? "bg-indigo-950/35" : "bg-indigo-50/20"
                  : darkMode ? "active:bg-indigo-950/20" : "active:bg-indigo-50/40"
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'bg-indigo-950/80 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
                  <BookOpen className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className={`text-xs font-black font-sans transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}>Section 2: Knowledge & Practice</h3>
                  <p className={`text-[10px] font-semibold mt-0.5 transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Subtotal: {s2.raw}/100 | Weight: 40%</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-lg border transition-colors ${
                  darkMode ? 'text-indigo-300 bg-indigo-950/80 border-indigo-900/50' : 'text-indigo-800 bg-indigo-100/70 border-indigo-200/50'
                }`}>
                  {s2.weighted}%
                </span>
                {expandedSection === "s2" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {/* Content block: visible when expanded or on print */}
            {(expandedSection === "s2" || window.matchMedia("print").matches) && (
              <div className={`p-4 pt-4 border-t space-y-4 transition-colors duration-300 ${
                darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/30'
              }`}>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s2.s2_measurementReading.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s2_measurementReading}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-indigo-400 bg-indigo-950/60' : 'text-indigo-700 bg-indigo-50'}`}>Res: {Math.round(((candidate.s2_measurementReading || 0) / 100) * 20 * 10) / 10}/20</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${candidate.s2_measurementReading}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s2.s2_measurementReading.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s2.s2_machineKnowledge.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s2_machineKnowledge}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-indigo-400 bg-indigo-950/60' : 'text-indigo-700 bg-indigo-50'}`}>Res: {Math.round(((candidate.s2_machineKnowledge || 0) / 100) * 20 * 10) / 10}/20</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${candidate.s2_machineKnowledge}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s2.s2_machineKnowledge.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s2.s2_methodology.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s2_methodology}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-indigo-400 bg-indigo-950/60' : 'text-indigo-700 bg-indigo-50'}`}>Res: {Math.round(((candidate.s2_methodology || 0) / 100) * 50 * 10) / 10}/50</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${candidate.s2_methodology}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s2.s2_methodology.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s2.s2_hseEquipment.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s2_hseEquipment}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-indigo-400 bg-indigo-950/60' : 'text-indigo-700 bg-indigo-50'}`}>Res: {Math.round(((candidate.s2_hseEquipment || 0) / 100) * 10 * 10) / 10}/10</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${candidate.s2_hseEquipment}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s2.s2_hseEquipment.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* S3 Accordion */}
          <div className={`rounded-2xl border-l-[6px] border-l-amber-500 border-y border-r shadow-3xs overflow-hidden transition-colors duration-300 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <button
              onClick={() => toggleSection("s3")}
              className={`w-full px-4 py-3.5 flex items-center justify-between text-left cursor-pointer no-print transition-all ${
                expandedSection === "s3"
                  ? darkMode ? "bg-amber-950/35" : "bg-amber-50/20"
                  : darkMode ? "active:bg-amber-950/20" : "active:bg-amber-50/40"
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'bg-amber-950/80 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                  <Heart className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className={`text-xs font-black font-sans transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}>Section 3: Appearance & Attitude</h3>
                  <p className={`text-[10px] font-semibold mt-0.5 transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Subtotal: {s3.raw}/100 | Weight: 10%</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-lg border transition-colors ${
                  darkMode ? 'text-amber-300 bg-amber-950/80 border-amber-900/50' : 'text-amber-800 bg-amber-100/70 border-amber-200/50'
                }`}>
                  {s3.weighted}%
                </span>
                {expandedSection === "s3" ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {/* Content block: visible when expanded or on print */}
            {(expandedSection === "s3" || window.matchMedia("print").matches) && (
              <div className={`p-4 pt-4 border-t space-y-4 transition-colors duration-300 ${
                darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/30'
              }`}>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s3.s3_physicalAppearance.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s3_physicalAppearance}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-amber-400 bg-amber-950/60' : 'text-amber-700 bg-amber-50'}`}>Res: {Math.round(((candidate.s3_physicalAppearance || 0) / 100) * 25 * 10) / 10}/25</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-amber-600 h-full rounded-full" style={{ width: `${candidate.s3_physicalAppearance}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s3.s3_physicalAppearance.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s3.s3_healthCondition.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s3_healthCondition}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-amber-400 bg-amber-950/60' : 'text-amber-700 bg-amber-50'}`}>Res: {Math.round(((candidate.s3_healthCondition || 0) / 100) * 25 * 10) / 10}/25</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-amber-600 h-full rounded-full" style={{ width: `${candidate.s3_healthCondition}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s3.s3_healthCondition.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s3.s3_characterAttitude.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s3_characterAttitude}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-amber-400 bg-amber-950/60' : 'text-amber-700 bg-amber-50'}`}>Res: {Math.round(((candidate.s3_characterAttitude || 0) / 100) * 30 * 10) / 10}/30</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-amber-600 h-full rounded-full" style={{ width: `${candidate.s3_characterAttitude}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s3.s3_characterAttitude.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs font-semibold">
                      <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{rubrics.s3.s3_extendedHours.label}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Mark: <strong className={darkMode ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>{candidate.s3_extendedHours}/100</strong></span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${darkMode ? 'text-amber-400 bg-amber-950/60' : 'text-amber-700 bg-amber-50'}`}>Res: {Math.round(((candidate.s3_extendedHours || 0) / 100) * 20 * 10) / 10}/20</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="bg-amber-600 h-full rounded-full" style={{ width: `${candidate.s3_extendedHours}%` }}></div>
                    </div>
                    <p className={`text-[10px] italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{rubrics.s3.s3_extendedHours.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Practical Field Test Section Card */}
        <div className={`rounded-2xl border-l-[6px] border-l-emerald-600 border-y border-r p-4.5 shadow-3xs space-y-4 transition-colors duration-300 ${
          darkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-200/80'
        }`}>
          <h3 className={`text-xs font-black flex items-center gap-2 font-sans transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            <div className={`p-1.5 rounded-lg shrink-0 ${darkMode ? 'bg-emerald-950/80 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
              <Hammer className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span>Field Bench Practical Test</span>
          </h3>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between items-center text-2xs font-semibold">
                <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>Bench Fabrication Test Status</span>
                <div className="flex items-center space-x-1.5">
                  {candidate.practicalTestRequired ? (
                    <span className="font-extrabold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-100 text-3xs">
                      REQUIRED (YES)
                    </span>
                  ) : (
                    <span className="font-extrabold text-slate-700 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-100 text-3xs">
                      NOT REQUIRED (NO)
                    </span>
                  )}
                </div>
              </div>
              <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                Practical assessment of speed, accuracy, safety compliance, and trade-specific blueprint execution under real site conditions.
              </p>
            </div>

            <div className={`flex flex-col items-center justify-center p-3 rounded-xl border border-dashed text-center shrink-0 min-w-[120px] transition-colors ${
              darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200/80 bg-slate-50/50'
            }`}>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">RATING</span>
              <span className={`mt-1.5 px-2.5 py-0.5 text-3xs font-extrabold rounded-md border tracking-wide uppercase ${practicalGrade.color}`}>
                {practicalGrade.label}
              </span>
            </div>
          </div>
        </div>

        {/* Remarks & Signatures */}
        <div className={`rounded-2xl border-l-[6px] border-l-slate-700 border-y border-r p-4.5 shadow-3xs space-y-4 transition-colors duration-300 ${
          darkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-200/80'
        }`}>
          <h3 className={`text-xs font-black flex items-center gap-2 font-sans transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            <div className={`p-1.5 rounded-lg ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-700'}`}>
              <UserCheck className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span>Assessor Final Remarks</span>
          </h3>
          <p className={`text-xs italic p-3.5 rounded-xl border leading-relaxed transition-colors duration-300 ${
            darkMode ? 'text-slate-300 bg-slate-950/50 border-slate-800' : 'text-slate-600 bg-slate-50/60 border-slate-100/50'
          }`}>
            &ldquo;{candidate.notes || "No custom evaluation comments entered. Subject evaluated under standardized trade protocols."}&rdquo;
          </p>

          {/* SIGNATURES BLOCK FOR PRINT LAYOUT */}
          <div className="hidden print-only pt-10 grid grid-cols-2 gap-12 text-center text-xs">
            <div className="space-y-4">
              <div className="border-b border-slate-400 h-8"></div>
              <p className="font-bold text-slate-700">Assessor Signature</p>
              <p className="text-3xs text-slate-400">Date: ________________________</p>
            </div>
            <div className="space-y-4">
              <div className="border-b border-slate-400 h-8"></div>
              <p className="font-bold text-slate-700">Candidate Signature</p>
              <p className="text-3xs text-slate-400">Date: ________________________</p>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Box */}
        <div className="no-print pt-2">
          {showDeleteConfirm ? (
            <div className={`border rounded-2xl p-4 space-y-3 shadow-3xs transition-colors duration-300 ${
              darkMode ? 'bg-rose-950/20 border-rose-900/50 text-rose-300' : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}>
              <p className="text-xs font-bold">
                Are you absolutely sure you want to delete this scorecard record? This action cannot be undone.
              </p>
              <div className="flex items-center space-x-2">
                <button
                  id="btn-confirm-delete"
                  onClick={() => {
                    onDelete(candidate.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer active:scale-95 animate-pulse"
                >
                  Yes, Delete Record
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className={`px-4 py-2 border text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95 ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              id="btn-detail-delete-trigger"
              onClick={() => setShowDeleteConfirm(true)}
              className={`w-full py-3.5 border border-dashed rounded-2xl text-xs font-bold transition-colors flex items-center justify-center space-x-2 cursor-pointer active:scale-98 ${
                darkMode
                  ? 'hover:bg-rose-950/20 border-rose-900/60 text-rose-400'
                  : 'hover:bg-rose-50 border-rose-200 text-rose-600'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Candidate Assessment</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
