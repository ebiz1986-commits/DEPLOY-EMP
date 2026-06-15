import React, { useState, useMemo } from "react";
import { Category, Worker, Company, ProjectDetail, User } from "../types";
import CompanyFilterHeader from "./CompanyFilterHeader";
import { 
  TrendingUp, 
  UserCheck, 
  HelpCircle, 
  FileCheck2, 
  Download, 
  Calendar,
  Layers,
  ChevronUp,
  ChevronDown,
  Building2,
  Lock,
  ChevronRight,
  Briefcase,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Pause
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import * as XLSX from "xlsx";

interface DashboardViewProps {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  projectDetail?: ProjectDetail | null;
  projects?: ProjectDetail[];
  selectedProjectId?: string;
  onRefresh: () => void;
  onSelectProject?: (id: string) => void;
  currentUser?: User | null;
  onDeleteWorker?: (id: string) => Promise<boolean>;
}

type SortField = "name" | "passport" | "category" | "supply_company" | "state" | "status" | "bureau" | "final_status" | "created_at";
type SortOrder = "asc" | "desc";

export default function DashboardView({
  workers,
  categories,
  companies,
  projectDetail,
  projects = [],
  selectedProjectId = "",
  onRefresh,
  onSelectProject = () => {},
  currentUser,
  onDeleteWorker
}: DashboardViewProps) {
  
  // Filter workers so unapproved/rejected/held ones do not show up for Admin 2 (ops)
  const approvedOnlyWorkers = useMemo(() => {
    if (currentUser?.role === "ops") {
      return workers.filter((w) => w.state === "active");
    }
    return workers;
  }, [workers, currentUser]);

  // Scope filter: lock telemetry statistics and pipeline details on a selected project or view aggregation
  const [projectScope, setProjectScope] = useState<"all" | "selected">("selected");
  
  // Inner view tab to clean up visual clutter
  const [dashboardTab, setDashboardTab] = useState<"roster" | "analytics">("roster");

  // Inline deletion confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Scoped workers list
  const scopedWorkers = useMemo(() => {
    let result = projectScope === "all" ? approvedOnlyWorkers : approvedOnlyWorkers.filter((w) => w.project_id === selectedProjectId);
    if (currentUser?.role === "recruiter" && currentUser.recruiter_company) {
      result = result.filter((w) => w.supply_company === currentUser.recruiter_company);
    }
    return result;
  }, [approvedOnlyWorkers, projectScope, selectedProjectId, currentUser]);

  // States for filtering
  const [selectedCompany, setSelectedCompany] = useState(() => {
    if (currentUser?.role === "recruiter" && currentUser.recruiter_company) {
      return currentUser.recruiter_company;
    }
    return "All";
  });
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // States for table sorting
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Filter list of workers based on parameters
  const filteredWorkers = useMemo(() => {
    return scopedWorkers.filter((w) => {
      // Company filter
      if (selectedCompany !== "All" && w.supply_company !== selectedCompany) {
        return false;
      }
      // Category filter
      if (selectedCategory !== "All" && w.category !== selectedCategory) {
        return false;
      }
      // Text search
      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = w.name.toLowerCase().includes(query);
        const matchesPassport = w.passport.toLowerCase().includes(query);
        if (!matchesName && !matchesPassport) return false;
      }
      return true;
    });
  }, [scopedWorkers, selectedCompany, selectedCategory, searchQuery]);

  // Sort workers
  const sortedWorkers = useMemo(() => {
    const list = [...filteredWorkers];
    list.sort((a, b) => {
      let valA = a[sortField] || "";
      let valB = b[sortField] || "";

      if (sortField === "created_at") {
        return sortOrder === "asc"
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortOrder === "asc" ? -1 : 1;
      if (strA > strB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredWorkers, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Extract unique categories for filter menu
  const categoryNames = useMemo(() => {
    return categories.map((c) => c.name);
  }, [categories]);

  // Metric calculators
  const stats = useMemo(() => {
    const subset = scopedWorkers.filter((w) => selectedCompany === "All" || w.supply_company === selectedCompany);
    
    const countTotal = subset.length;
    const countPending = subset.filter((w) => w.state === "pending" || w.state === "held").length;
    const countPendingOnly = subset.filter((w) => w.state === "pending").length;
    const countHeld = subset.filter((w) => w.state === "held").length;
    const countRejected = subset.filter((w) => w.state === "rejected").length;
    const countActive = subset.filter((w) => w.state === "active").length;
    
    // Coordinator WA Status
    const countWaCompleted = subset.filter((w) => w.doc_upload_wa === "Yes").length;
    const countWaPending = subset.filter((w) => w.doc_upload_wa !== "Yes").length;

    // Pipeline statuses
    const countVisaApproved = subset.filter((w) => w.status === "Visa Approved (xpact)").length;
    const countVisaRejected = subset.filter((w) => w.status === "Visa Reject (xpact)").length;
    const countBureauRejected = subset.filter((w) => w.bureau === "Reject").length;
    const countBureauComplete = subset.filter((w) => w.status === "Visa Approved (xpact)" && w.bureau === "Complete").length;
    const countBooked = subset.filter((w) => w.final_status === "Booked").length;
    const countArrived = subset.filter((w) => w.final_status === "Arrived").length;

    return {
      countTotal,
      countPending,
      countPendingOnly,
      countHeld,
      countRejected,
      countActive,
      countWaCompleted,
      countWaPending,
      countVisaApproved,
      countVisaRejected,
      countBureauRejected,
      countBureauComplete,
      countBooked,
      countArrived
    };
  }, [scopedWorkers, selectedCompany]);

  // Categories quota utilization
  const categoryQuotas = useMemo(() => {
    const isRecruiter = currentUser?.role === "recruiter";
    const recCompany = currentUser?.recruiter_company || "";

    return categories.map((cat) => {
      // Find active workers in this category globally (for this project context or overall)
      const activeCount = scopedWorkers.filter((w) => w.category === cat.name && w.state === "active").length;
      
      const quotaLimit = isRecruiter 
        ? (cat.company_allocations?.[recCompany] ?? 0)
        : cat.max_quota;

      const remaining = Math.max(0, quotaLimit - activeCount);
      const percent = quotaLimit > 0 ? (activeCount / quotaLimit) * 100 : 0;
      return {
        ...cat,
        activeCount,
        max_quota: quotaLimit,
        remaining,
        percent
      };
    });
  }, [categories, scopedWorkers, currentUser]);

  // Compute comparative partner distribution data across all supply companies
  const companyDistributionData = useMemo(() => {
    const list = currentUser?.role === "recruiter" && currentUser.recruiter_company
      ? companies.filter((co) => co.name === currentUser.recruiter_company)
      : companies;

    return list.map((co) => {
      // Filter matching current category and search criteria (to keep it interactive and highly responsive)
      const matches = scopedWorkers.filter((w) => {
        if (w.supply_company !== co.name) return false;
        if (selectedCategory !== "All" && w.category !== selectedCategory) return false;
        if (searchQuery.trim() !== "") {
          const query = searchQuery.trim().toLowerCase();
          const matchesName = w.name.toLowerCase().includes(query);
          const matchesPassport = w.passport.toLowerCase().includes(query);
          if (!matchesName && !matchesPassport) return false;
        }
        return true;
      });

      const active = matches.filter((w) => w.state === "active").length;
      const pending = matches.filter((w) => w.state === "pending" || w.state === "held").length;

      return {
        name: co.name,
        "Gate Approved (Active)": active,
        "Intake Queue (Pending)": pending,
        Total: active + pending
      };
    });
  }, [companies, scopedWorkers, selectedCategory, searchQuery, currentUser]);

  // Compute recruiting partner performance details including WA doc and Visa status after WA doc
  const companyPerformanceStats = useMemo(() => {
    // Determine which companies are visible
    const visibleCompanies = currentUser?.role === "recruiter" && currentUser.recruiter_company
      ? companies.filter(co => co.name === currentUser.recruiter_company)
      : companies;

    return visibleCompanies.map(co => {
      // All workers belonging to this company in the current scoped project list
      const companyWorkers = scopedWorkers.filter(w => w.supply_company === co.name);

      const totalRegisters = companyWorkers.length;

      // WA Doc stats
      const waDocCompleted = companyWorkers.filter(w => w.doc_upload_wa === "Yes").length;
      const waDocPending = companyWorkers.filter(w => w.doc_upload_wa !== "Yes").length;

      // Visa XPact status after WA Doc (i.e. among those with WA Doc = Yes)
      const afterWaDocWorkers = companyWorkers.filter(w => w.doc_upload_wa === "Yes");
      const visaXpactCompleted = afterWaDocWorkers.filter(w => w.status === "Visa Approved (xpact)").length;
      const visaXpactPending = afterWaDocWorkers.filter(w => 
        w.status === "Pending" || 
        (w.status !== "Visa Approved (xpact)" && w.status !== "Visa Reject (xpact)")
      ).length;
      const visaXpactRejected = afterWaDocWorkers.filter(w => w.status === "Visa Reject (xpact)").length;

      return {
        companyName: co.name,
        totalRegisters,
        waDocCompleted,
        waDocPending,
        visaXpactCompleted,
        visaXpactPending,
        visaXpactRejected
      };
    });
  }, [companies, scopedWorkers, currentUser]);

  // Export to Excel / CSV via SheetJS
  const handleExportExcel = () => {
    const excelData = sortedWorkers.map((w, idx) => ({
      "No.": idx + 1,
      "Worker Name": w.name,
      "Passport Number": w.passport,
      "Actual Job Category": w.category,
      "Supply Company": w.supply_company,
      "Pipeline State": w.state.toUpperCase(),
      "Visa Approved Date": w.visa_doc_date || "Pending",
      "Sending Batch": w.sending_batch || "None",
      "WhatsApp Checker": w.doc_upload_wa,
      "WhatsApp Status Date": w.doc_upload_wa_date ? new Date(w.doc_upload_wa_date).toLocaleDateString() : "N/A",
      "Last Stage Transition": w.last_updated || "N/A",
      "Visa Status": w.status,
      "Visa Status Date": w.status_date ? new Date(w.status_date).toLocaleDateString() : "N/A",
      "Bureau Placement": w.bureau,
      "Bureau Date": w.bureau_date ? new Date(w.bureau_date).toLocaleDateString() : "N/A",
      "Final Placement": w.final_status,
      "Final Status Date": w.final_status_date ? new Date(w.final_status_date).toLocaleDateString() : "N/A",
      "Database Creation": new Date(w.created_at).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Masterfile Report");

    // Write file
    const companyLabel = selectedCompany === "All" ? "ALL" : selectedCompany.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Sanken_Overseas_Masterfile_${companyLabel}_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div id="dashboard-viewport" className="flex-1 overflow-y-auto p-6 space-y-6">
      
      {/* Search Header panel with custom props */}
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
        title="Workers Masterfile Portal"
        subtitle="Operational overview and global visa placement funnel."
        onRefresh={onRefresh}
        currentUser={currentUser}
      />

      {/* 🛠️ Simplified Modern Unified Toolbar */}
      <div className="bg-card border border-line rounded-xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 font-sans select-none">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Dashboard View Tabs */}
          <div className="inline-flex rounded-lg p-0.5 bg-paper border border-line">
            <button
              onClick={() => setDashboardTab("roster")}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                dashboardTab === "roster"
                  ? "bg-accent text-white shadow"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Roster Registry</span>
            </button>
            <button
              onClick={() => setDashboardTab("analytics")}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                dashboardTab === "analytics"
                  ? "bg-accent text-white shadow"
                  : "text-muted hover:text-ink"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Analytics & Allocations</span>
            </button>
          </div>

          <div className="hidden sm:block h-5 w-px bg-line/60" />

          {/* Scope selection pill */}
          <div className="inline-flex rounded-lg p-0.5 bg-paper border border-line">
            <button
              onClick={() => setProjectScope("all")}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all cursor-pointer ${
                projectScope === "all"
                  ? "bg-stone-850 text-ink shadow bg-stone-100 border border-line/60"
                  : "text-muted hover:text-ink"
              }`}
            >
              All Projects
            </button>
            <button
              onClick={() => setProjectScope("selected")}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all cursor-pointer ${
                projectScope === "selected"
                  ? "bg-stone-850 text-ink shadow bg-stone-100 border border-line/60"
                  : "text-muted hover:text-ink"
              }`}
            >
              Project Focus
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {projectScope === "selected" && projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => onSelectProject(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-paper border border-line rounded-lg text-ink focus:border-accent outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="text-stone-800 bg-stone-100">
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Sleek Compact Project Information Band */}
      {projectDetail && projectScope !== "all" && (
        <div className="bg-amber-500/[0.03] border border-amber-500/15 rounded-xl px-4 py-3 text-xs font-sans flex flex-wrap gap-x-6 gap-y-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse"></span>
            <span className="font-semibold text-ink">{projectDetail.name}</span>
            <span className="text-muted">({projectDetail.contract_number})</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted text-[11px] font-mono">
            <span>Client: <strong className="text-ink font-semibold">{projectDetail.client}</strong></span>
            <span>Location: <strong className="text-ink font-semibold">{projectDetail.location}</strong></span>
            <span>Engineer: <strong className="text-accent font-semibold">{projectDetail.engineer_in_charge}</strong></span>
            <span>Coordinator: <strong className="text-ink font-semibold">{projectDetail.admin_coordinator}</strong></span>
          </div>
        </div>
      )}

      {/* Main KPI Panel with warm borders and serif/mono typography */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div id="stat-total" className="bg-card border border-line rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Total Registers</span>
            <span className="p-1.5 bg-paper rounded-lg border border-line">
              <Layers className="w-3.5 h-3.5 text-accent" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-serif text-ink tracking-tight">
              {stats.countTotal}
            </span>
          </div>
          <p className="text-[10px] text-muted mt-2">
            Workers registered across selected filters.
          </p>
        </div>

        {/* KPI 2 */}
        <div id="stat-pending" className="bg-card border border-line rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Sanken Intake Queue</span>
            <span className="p-1.5 bg-paper rounded-lg border border-line">
              <HelpCircle className="w-3.5 h-3.5 text-gold" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-serif text-ink tracking-tight text-gold">
              {stats.countPending}
            </span>
          </div>
          <p className="text-[10px] text-muted mt-2">
            Pending initial engineering sending approval.
          </p>
        </div>

        {/* KPI 3 */}
        <div id="stat-active" className="bg-card border border-line rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Active Pipeline</span>
            <span className="p-1.5 bg-paper rounded-lg border border-line">
              <UserCheck className="w-3.5 h-3.5 text-success-green" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-serif text-success-green tracking-tight">
              {stats.countActive}
            </span>
          </div>
          <p className="text-[10px] text-muted mt-2">
            Approved workers consuming category labor allocations.
          </p>
        </div>

        {/* KPI 4 */}
        <div id="stat-arrived" className="bg-card border border-line rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Arrived Safe</span>
            <span className="p-1.5 bg-paper rounded-lg border border-line">
              <FileCheck2 className="w-3.5 h-3.5 text-info" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-serif text-info tracking-tight">
              {stats.countArrived}
            </span>
          </div>
          <p className="text-[10px] text-muted mt-2">
            Final stage of placement completed.
          </p>
        </div>

      </div>

      {/* 🏢 Your Vendor Allocation Status (KSJ) */}
      <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 font-sans select-none" id="dashboard-vendor-remaining-allocations">
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <span className="text-sm font-semibold text-ink font-display flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent shrink-0" />
            {currentUser?.role === "recruiter" 
              ? `Your Vendor Allocation Status (${currentUser.recruiter_company || "KSJ"})` 
              : `Your Vendor Allocation Status (${selectedCompany === "All" ? (companies[0]?.name || "KSJ") : selectedCompany})`
            }
          </span>
          <span className="text-[10px] text-accent font-bold animate-pulse font-mono uppercase tracking-wider">Real-time Allotment Capacity</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((cat) => {
            const resolvedCompany = currentUser?.role === "recruiter" 
              ? (currentUser.recruiter_company || "KSJ") 
              : (selectedCompany === "All" ? (companies[0]?.name || "KSJ") : selectedCompany);

            const limit = cat.company_allocations?.[resolvedCompany] ?? 0;
            const approvedCount = approvedOnlyWorkers.filter(w => w.category === cat.name && w.supply_company === resolvedCompany && w.state === "active").length;
            const rem = limit - approvedCount;
            return (
              <div key={cat.id} className="bg-paper/50 border border-line p-3 rounded-lg flex flex-col justify-between">
                <span className="text-[11px] text-ink font-bold truncate block" title={cat.name}>{cat.name}</span>
                <div className="flex items-center justify-between text-[10px] font-mono mt-2 pt-1 border-t border-line/20">
                  <span className="text-muted font-semibold">{approvedCount}/{limit}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${rem <= 0 ? 'text-red-700 bg-red-100/50' : rem <= 2 ? 'text-amber-700 bg-amber-100/50' : 'text-green-700 bg-green-100/50'}`}>
                    {rem} left
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 📊 Recruiting Agency Performance Desk & WA Doc / Visa Status Summary */}
      <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 font-sans select-none">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-mono uppercase tracking-wider font-bold">
              Agency Status Overview
            </span>
            <span className="text-[10px] text-muted font-mono">
              Project Context: {projectScope === "all" ? "All Projects Combined" : (projectDetail?.name || "Active Project")}
            </span>
          </div>
          <h3 className="text-base font-semibold text-ink font-display mt-2 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent shrink-0" />
            <span>Recruiting Agency Performance Desk</span>
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Live tracker of registered candidates, coordinator &quot;WA Doc&quot; validations, and downstream &quot;Visa Approved (xpact)&quot; completions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-2">
          {companyPerformanceStats.map((coStats) => {
            const hasRegisters = coStats.totalRegisters > 0;
            return (
              <div 
                key={coStats.companyName}
                className="bg-paper/40 p-4 rounded-xl border border-line/75 hover:border-accent/40 transition-all shadow-xs flex flex-col justify-between space-y-4"
              >
                {/* Agency Title and Registers badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-accent/5 rounded-lg border border-accent/15">
                      <Briefcase className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-ink leading-tight">
                        {coStats.companyName}
                      </h4>
                      <p className="text-[10px] text-muted font-mono">Supply Agency</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-serif font-bold text-ink block">
                      {coStats.totalRegisters}
                    </span>
                    <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">
                      Total Registers
                    </span>
                  </div>
                </div>

                {/* Sub-panels representing WA Doc and Visa status after WA Doc */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line/45">
                  
                  {/* Left Column: WA Doc Status (WhatsApp Checker) */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-mono text-muted uppercase tracking-wider block font-semibold border-b border-line/30 pb-1">
                      &quot;WA Doc&quot; Status
                    </span>
                    
                    <div className="space-y-1.5">
                      {/* WA Completed */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-stone-500 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-success-green shrink-0" />
                          <span>Completed</span>
                        </span>
                        <span className="font-bold text-success-green">
                          {coStats.waDocCompleted}
                        </span>
                      </div>

                      {/* WA Pending */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-stone-500 flex items-center gap-1" title="Pending from Coordinator">
                          <Clock className="w-3.5 h-3.5 text-gold shrink-0" />
                          <span>Pending</span>
                        </span>
                        <span className="font-bold text-gold">
                          {coStats.waDocPending}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Visa Approved (xpact) after WA Doc */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-mono text-muted uppercase tracking-wider block font-semibold border-b border-line/30 pb-1">
                      Visa (XPact) After WA
                    </span>
                    
                    <div className="space-y-1.5">
                      {/* Visa Approved */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-stone-500 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-info shrink-0" />
                          <span>Approved</span>
                        </span>
                        <span className="font-bold text-info">
                          {coStats.visaXpactCompleted}
                        </span>
                      </div>

                      {/* Visa Pending */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-stone-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>Pending</span>
                        </span>
                        <span className="font-bold text-stone-600">
                          {coStats.visaXpactPending}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Optional Visa Rejections info if any exist */}
                {coStats.visaXpactRejected > 0 && (
                  <div className="bg-red-50/50 border border-bad/15 rounded-lg p-2 text-[10px] text-bad flex items-center gap-1.5 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{coStats.visaXpactRejected} post-WA registration(s) rejected by embassy</span>
                  </div>
                )}

                {/* Progress helper */}
                {hasRegisters && (
                  <div className="pt-2">
                    <div className="w-full bg-paper rounded-full h-1.5 overflow-hidden border border-line/30">
                      <div 
                        className="bg-accent h-full rounded-full transition-all duration-300"
                        style={{ width: `${(coStats.waDocCompleted / coStats.totalRegisters) * 100}%` }}
                        title={`${((coStats.waDocCompleted / coStats.totalRegisters) * 100).toFixed(0)}% WA Doc Checked`}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-muted font-mono mt-1">
                      <span>{((coStats.waDocCompleted / coStats.totalRegisters) * 100).toFixed(0)}% WA Compliant</span>
                      <span>{coStats.visaXpactCompleted} placement(s) in flight</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Categories Quota Utilization Section */}
      <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 font-sans select-none">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink font-display">Category Vacancy & Vendor Allocations</h3>
            <p className="text-[11px] text-muted">Limits set by System Administrator. Action is fully locked at zero vacancies.</p>
          </div>
          <div className="px-2 py-1 bg-stone-900 border border-stone-800 text-[#FDFBF6] text-[10px] font-mono rounded flex items-center gap-1">
            <Lock className="w-3 h-3 text-amber-500" />
            <span>CAP CHECK</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {categoryQuotas.map((cq) => {
            const isLocked = cq.remaining <= 0;
            return (
              <div key={cq.id} className={`p-3.5 border rounded-xl transition-all ${
                isLocked ? "bg-red-50/40 border-bad/30" : "bg-paper/20 border-line"
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                      {cq.name} 
                      {isLocked && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-bad text-[#FDFBF6] text-[9px] font-mono tracking-tight rounded-md">
                          FULLY OCCUPIED
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-muted font-mono">
                      Active Utilization: {cq.activeCount} of {cq.max_quota} allocation ({(cq.percent).toFixed(0)}%)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-mono block ${isLocked ? "text-bad font-bold" : "text-success-green"}`}>
                      Vacancy Remaining
                    </span>
                    <span className={`text-base font-serif font-bold ${isLocked ? "text-bad" : "text-ink"}`}>
                      {cq.remaining}
                    </span>
                  </div>
                </div>

                {/* Progress bar with lock visual highlight */}
                <div className="w-full bg-paper rounded-full h-2 overflow-hidden border border-line/40">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${isLocked ? "bg-bad animate-pulse" : "bg-accent"}`}
                    style={{ width: `${Math.min(100, cq.percent)}%` }}
                  ></div>
                </div>

                {/* Vendor Allotments Display block */}
                <div className="mt-3 pt-2 border-t border-line/40 space-y-1">
                  <span className="text-[9px] font-mono text-muted uppercase tracking-wider block font-semibold">Supply Vendors Slots:</span>
                  {(currentUser?.role === "recruiter" && currentUser.recruiter_company
                    ? companies.filter((co) => co.name === currentUser.recruiter_company)
                    : companies
                  ).map((co) => {
                    const limit = cq.company_allocations?.[co.name] ?? 0;
                    const activeCount = approvedOnlyWorkers.filter(w => w.category === cq.name && w.supply_company === co.name && w.state === "active").length;
                    const rem = Math.max(0, limit - activeCount);
                    return (
                      <div key={co.id} className="text-[10px] flex justify-between font-mono text-muted leading-tight border-b border-dashed border-line/10 pb-0.5 last:border-0 last:pb-0">
                        <span>{co.name}:</span>
                        <span className={`font-bold ${rem <= 0 ? 'text-[#C82333]' : 'text-accent'}`}>{rem} / {limit} left</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {dashboardTab === "analytics" ? (
        <>
          {/* Analytics and Funnel Insights Segment */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Supply Company Comparative Distribution Bar Chart */}
        <div className="lg:col-span-7 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-mono uppercase tracking-wider font-semibold">
                Comparative Analytics
              </span>
              <span className="text-[10px] font-mono text-muted">
                {selectedCategory !== "All" ? `Category: ${selectedCategory}` : "All Trades"}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-ink font-display mt-1.5">Recruiting Partner Distribution</h3>
            <p className="text-[11px] text-muted">Comparative breakdown of active and pending worker cohorts registered by partner supply agencies.</p>
          </div>

          <div className="h-[260px] w-full pt-4 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={companyDistributionData}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eae6df" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#8a8175', fontSize: '10px', fontFamily: 'var(--font-mono)' }} 
                  axisLine={{ stroke: '#d8cfc0' }}
                  tickLine={{ stroke: '#d8cfc0' }}
                />
                <YAxis 
                  tick={{ fill: '#8a8175', fontSize: '10px', fontFamily: 'var(--font-mono)' }}
                  axisLine={{ stroke: '#d8cfc0' }}
                  tickLine={{ stroke: '#d8cfc0' }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fdfbf6', 
                    borderRadius: '8px', 
                    border: '1px solid #d8cfc0',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    color: '#1a1614'
                  }} 
                  cursor={{ fill: 'rgba(184, 70, 14, 0.04)' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px', fontFamily: 'var(--font-mono)', paddingTop: '8px' }}
                />
                <Bar 
                  dataKey="Gate Approved (Active)" 
                  name="Gate Approved (Active)" 
                  fill="#1f5c4d" 
                  stackId="a" 
                  radius={[0, 0, 0, 0]} 
                />
                <Bar 
                  dataKey="Intake Queue (Pending)" 
                  name="Intake Queue (Pending)" 
                  fill="#b8460e" 
                  stackId="a" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-line/40 pt-3 flex items-center justify-between text-[10px] text-muted font-mono">
            <span>Graph reflects category and search queries</span>
            <span>Total Units: {scopedWorkers.length}</span>
          </div>
        </div>

        {/* Funnel Pipeline Visualisation Column (Role-based stages) */}
        <div className="lg:col-span-5 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink font-display">Workflow Deployment Funnel</h3>
            <p className="text-[11px] text-muted">Pipeline progress breakdown for {selectedCompany === "All" ? "all agencies" : selectedCompany}.</p>
          </div>

          <div className="space-y-3.5 pt-2">
            {/* Step 1: Intake (total registered) */}
            <div className="flex items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <span className="h-2 w-2 rounded-full bg-muted"></span>
                <span className="text-ink">1. Intake Register</span>
              </div>
              <div className="flex-1 bg-paper/60 rounded-full h-2.5 overflow-hidden border border-line/30">
                <div className="bg-muted h-full rounded-full" style={{ width: "100%" }}></div>
              </div>
              <span className="text-[11px] font-semibold text-ink w-8 text-right">{stats.countTotal}</span>
            </div>

            {/* Step 2: Approved / Active */}
            <div className="flex items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <span className="h-2 w-2 rounded-full bg-success-green"></span>
                <span className="text-ink">2. Gate Approved</span>
              </div>
              <div className="flex-1 bg-paper/60 rounded-full h-2.5 overflow-hidden border border-line/30">
                <div className="bg-success-green h-full rounded-full transition-all duration-300" 
                  style={{ width: `${stats.countTotal > 0 ? (stats.countActive / stats.countTotal) * 100 : 0}%` }}></div>
              </div>
              <span className="text-[11px] font-semibold text-success-green w-8 text-right">{stats.countActive}</span>
            </div>

            {/* Step 3: Visa Approved */}
            <div className="flex items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <span className="h-2 w-2 rounded-full bg-accent"></span>
                <span className="text-ink">3. Visa (xpact)</span>
              </div>
              <div className="flex-1 bg-paper/60 rounded-full h-2.5 overflow-hidden border border-line/30">
                <div className="bg-accent h-full rounded-full transition-all duration-300" 
                  style={{ width: `${stats.countTotal > 0 ? (stats.countVisaApproved / stats.countTotal) * 100 : 0}%` }}></div>
              </div>
              <span className="text-[11px] font-semibold text-accent w-8 text-right">{stats.countVisaApproved}</span>
            </div>

            {/* Step 4: Bureau Complete */}
            <div className="flex items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <span className="h-2 w-2 rounded-full bg-gold"></span>
                <span className="text-ink">4. Bureau Clearance</span>
              </div>
              <div className="flex-1 bg-paper/60 rounded-full h-2.5 overflow-hidden border border-line/30">
                <div className="bg-gold h-full rounded-full transition-all duration-300" 
                  style={{ width: `${stats.countTotal > 0 ? (stats.countBureauComplete / stats.countTotal) * 100 : 0}%` }}></div>
              </div>
              <span className="text-[11px] font-semibold text-gold w-8 text-right">{stats.countBureauComplete}</span>
            </div>

            {/* Step 5: Booked */}
            <div className="flex items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <span className="h-2 w-2 rounded-full bg-info"></span>
                <span className="text-ink">5. Travel Booked</span>
              </div>
              <div className="flex-1 bg-paper/60 rounded-full h-2.5 overflow-hidden border border-line/30">
                <div className="bg-info h-full rounded-full transition-all duration-300" 
                  style={{ width: `${stats.countTotal > 0 ? (stats.countBooked / stats.countTotal) * 100 : 0}%` }}></div>
              </div>
              <span className="text-[11px] font-semibold text-info w-8 text-right">{stats.countBooked}</span>
            </div>

            {/* Step 6: Arrived */}
            <div className="flex items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <span className="h-2 w-2 rounded-full bg-emerald-700"></span>
                <span className="text-ink">6. Post Arrival</span>
              </div>
              <div className="flex-1 bg-paper/60 rounded-full h-2.5 overflow-hidden border border-line/30">
                <div className="bg-emerald-700 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${stats.countTotal > 0 ? (stats.countArrived / stats.countTotal) * 100 : 0}%` }}></div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 w-8 text-right">{stats.countArrived}</span>
            </div>
          </div>

          <div className="bg-paper/40 border border-line/45 rounded-lg p-3 text-[10px] text-muted space-y-1">
            <p className="font-semibold text-ink">Pipeline Flow Protocol:</p>
            <p>1. Recruiter registers intake → worker saved as <span className="mono-text font-bold">pending</span>.</p>
            <p>2. Engineer inputs Sending Batch → visa doc date stamps today, <span className="mono-text font-bold">active allocation -1</span>.</p>
            <p>3. Operations manages documentation, visa feedback, transit bookings, and arrivals.</p>
          </div>
        </div>

      </div>


        </>
      ) : (
        /* Main Filterable Data Table Segment */
        <div className="bg-card border border-line rounded-xl shadow-sm overflow-hidden font-sans">
        
        {/* Table Control Header */}
        <div className="p-4 border-b border-line bg-paper/25 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-ink font-display">Combined Master Records Archive</h3>
            <p className="text-[11px] text-muted">Showing {sortedWorkers.length} of {scopedWorkers.length} matching rows</p>
          </div>

          <button
            onClick={handleExportExcel}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-success-green text-white hover:bg-success-green/90 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>XLS Export Master</span>
          </button>
        </div>

        {/* Responsive Table Scroll Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-paper/40 border-b border-line/60 font-mono text-muted text-[10px] uppercase select-none">
                <th className="p-3 pl-5">Worker Name</th>
                <th className="p-3">Passport ID</th>
                <th className="p-3">Bureau Category</th>
                <th className="p-3">Actual Category</th>
                <th className="p-3 cursor-pointer hover:text-ink transition-colors" onClick={() => toggleSort("supply_company")}>
                  Supply Company {sortField === "supply_company" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3">Engineer Action</th>
                <th className="p-3">Gate / Visa Status</th>
                <th className="p-3">Batch / Approved</th>
                <th className="p-3">WA doc</th>
                <th className="p-3">Visa XPact status</th>
                <th className="p-3">Bureau status</th>
                <th className="p-3">Final status</th>
                <th className={currentUser?.role === "admin" ? "p-3 text-right cursor-pointer hover:text-ink transition-colors" : "p-3 pr-5 text-right cursor-pointer hover:text-ink transition-colors"} onClick={() => toggleSort("created_at")}>
                  Created Date {sortField === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                {currentUser?.role === "admin" && (
                  <th className="p-3 pr-5 text-right font-mono text-[10px] text-muted">Delete Actions</th>
                )}
              </tr>
            </thead>
            
            <tbody className="divide-y divide-line/40">
              {sortedWorkers.length === 0 ? (
                <tr>
                  <td colSpan={currentUser?.role === "admin" ? 14 : 13} className="p-12 text-center text-muted">
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="font-semibold text-ink">No matching archives found</p>
                      <p className="text-[11px]">Adjust your company switcher, job category filter, or text inquiry string.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedWorkers.map((w) => {
                  const isPending = w.state === "pending";
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

                      {/* Bureau Category */}
                      <td className="p-3">
                        {w.bureau_category ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-paper rounded border border-line/40 text-[10px] font-medium text-ink">
                            {w.bureau_category}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic text-[10px] select-none">—</span>
                        )}
                      </td>
                      
                      {/* Actual Category */}
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-600 border border-amber-500/20 text-[10px] font-mono font-bold rounded-md animate-pulse">
                            HOLD
                          </span>
                        ) : w.state === "rejected" ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-bad/10 text-bad border border-bad/20 text-[10px] font-mono font-bold rounded-md">
                              REJECTED
                            </span>
                            {w.gate_reject_reason && (
                              <div className="text-[9px] font-sans font-medium text-bad bg-[#FEF2F2] border border-bad/15 rounded px-1.5 py-0.5 leading-tight max-w-[130px] break-words">
                                <span className="font-extrabold text-[8px] text-bad block uppercase tracking-wider">Gate Reject Reason:</span>
                                {w.gate_reject_reason}
                              </div>
                            )}
                          </div>
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
                          <span className="text-amber-600 font-semibold italic">Gate Hold</span>
                        ) : w.state === "rejected" ? (
                          <span className="text-bad font-semibold italic">Gate Reject</span>
                        ) : (
                          <span className="italic">Awaiting Gate</span>
                        )}
                      </td>
                      
                      {/* WhatsApp document */}
                      <td className="p-3">
                        {(() => {
                          const docValue = w.doc_upload_wa === "No" ? "Pending" : w.doc_upload_wa;
                          const isCompleted = docValue === "Yes";
                          const completedDate = w.doc_upload_wa_date || w.last_updated;
                          const getDaysLocal = (createdAtStr?: string) => {
                            if (!createdAtStr) return null;
                            try {
                              const createdDate = new Date(createdAtStr);
                              const endDate = isCompleted && completedDate ? new Date(completedDate) : new Date();
                              const diffTime = endDate.getTime() - createdDate.getTime();
                              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                              return diffDays < 0 ? 0 : diffDays;
                            } catch (e) {
                              return null;
                            }
                          };
                          const days = getDaysLocal(w.created_at);
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-block px-1.5 py-0.5 font-mono text-[10px] rounded w-fit ${
                                docValue === "Yes" 
                                  ? "bg-success-green/10 text-success-green border border-success-green/20" 
                                  : docValue === "Rejected"
                                  ? "bg-red-50 text-bad border border-bad/20 font-semibold"
                                  : "bg-amber-50 text-amber-700 border border-amber-200 font-semibold"
                              }`}>
                                {docValue}
                              </span>
                              {days !== null && (
                                <span className="block text-[9.5px] text-[#8a8175] font-mono mt-0.5" title={isCompleted ? "Duration from record creation to WA upload" : "Active waiting time since record creation"}>
                                  {isCompleted ? `Took ${days} d` : `Waiting ${days} d`}
                                </span>
                              )}
                              
                              {(docValue === "Rejected" || docValue === "No") && w.wa_doc_reject_reason && (
                                <div className="mt-1 text-[9px] font-sans font-medium text-bad bg-[#FEF2F2] border border-bad/15 rounded px-1.5 py-0.5 leading-tight max-w-[130px] break-words">
                                  <span className="font-extrabold text-[8px] text-bad block uppercase tracking-wider">Reject Reason:</span>
                                  {w.wa_doc_reject_reason}
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                          {w.status}
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
                          {w.bureau}
                        </span>
                      </td>
                      
                      {/* Final Status */}
                      <td className="p-3 font-medium">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                          w.final_status === "Arrived"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-250 font-semibold"
                            : w.final_status === "Booked"
                            ? "bg-sky-50 text-sky-800 border-sky-200"
                            : "bg-neutral-50 text-muted border-line/50"
                        }`}>
                          {w.final_status}
                        </span>
                      </td>
                      
                      {/* Created date */}
                      <td className={currentUser?.role === "admin" ? "p-3 text-right font-mono text-[10px] text-muted whitespace-nowrap" : "p-3 pr-5 text-right font-mono text-[10px] text-muted whitespace-nowrap"}>
                        {new Date(w.created_at).toLocaleDateString()}
                      </td>

                      {currentUser?.role === "admin" && (
                        <td className="p-3 pr-5 text-right whitespace-nowrap">
                          {confirmDeleteId === w.id ? (
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <span className="text-[9px] text-[#A30000] font-mono font-bold animate-pulse">Are you sure?</span>
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
      )}

    </div>
  );
}
