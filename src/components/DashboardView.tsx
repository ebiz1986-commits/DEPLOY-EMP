import React, { useState, useMemo } from "react";
import { Category, Worker, Company, ProjectDetail } from "../types";
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
  Briefcase
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
  onRefresh: () => void;
}

type SortField = "name" | "passport" | "category" | "supply_company" | "state" | "status" | "bureau" | "final_status" | "created_at";
type SortOrder = "asc" | "desc";

export default function DashboardView({
  workers,
  categories,
  companies,
  projectDetail,
  onRefresh
}: DashboardViewProps) {
  
  // States for filtering
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // States for table sorting
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Filter list of workers based on parameters
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
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
  }, [workers, selectedCompany, selectedCategory, searchQuery]);

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
    const subset = workers.filter((w) => selectedCompany === "All" || w.supply_company === selectedCompany);
    
    const countTotal = subset.length;
    const countPending = subset.filter((w) => w.state === "pending").length;
    const countActive = subset.filter((w) => w.state === "active").length;
    
    // Pipeline statuses
    const countVisaApproved = subset.filter((w) => w.status === "Visa Approved (xpact)").length;
    const countBureauComplete = subset.filter((w) => w.status === "Visa Approved (xpact)" && w.bureau === "Complete").length;
    const countBooked = subset.filter((w) => w.final_status === "Booked").length;
    const countArrived = subset.filter((w) => w.final_status === "Arrived").length;

    return {
      countTotal,
      countPending,
      countActive,
      countVisaApproved,
      countBureauComplete,
      countBooked,
      countArrived
    };
  }, [workers, selectedCompany]);

  // Categories quota utilization
  const categoryQuotas = useMemo(() => {
    return categories.map((cat) => {
      // Find active workers in this category globally (as quotas apply globally)
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

  // Compute comparative partner distribution data across all supply companies
  const companyDistributionData = useMemo(() => {
    return companies.map((co) => {
      // Filter matching current category and search criteria (to keep it interactive and highly responsive)
      const matches = workers.filter((w) => {
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
      const pending = matches.filter((w) => w.state === "pending").length;

      return {
        name: co.name,
        "Gate Approved (Active)": active,
        "Intake Queue (Pending)": pending,
        Total: active + pending
      };
    });
  }, [companies, workers, selectedCategory, searchQuery]);

  // Export to Excel / CSV via SheetJS
  const handleExportExcel = () => {
    const excelData = sortedWorkers.map((w, idx) => ({
      "No.": idx + 1,
      "Worker Name": w.name,
      "Passport Number": w.passport,
      "Job Category": w.category,
      "Supply Company": w.supply_company,
      "Pipeline State": w.state.toUpperCase(),
      "Visa Approved Date": w.visa_doc_date || "Pending",
      "Sending Batch": w.sending_batch || "None",
      "WhatsApp Checker": w.doc_upload_wa,
      "Last Stage Transition": w.last_updated || "N/A",
      "Visa Status": w.status,
      "Bureau Placement": w.bureau,
      "Final Placement": w.final_status,
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
        workers={workers}
        selectedCompany={selectedCompany}
        setSelectedCompany={setSelectedCompany}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categoriesList={categoryNames}
        title="Workers Masterfile Portal"
        subtitle="Operational overview, cohort telemetry, and global visa placement funnel monitoring."
        onRefresh={onRefresh}
      />

      {/* Unified Project Context Banner */}
      {projectDetail && (
        <div className="bg-amber-50/50 border border-line rounded-xl p-5 shadow-sm space-y-4 font-sans">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-mono uppercase tracking-wider font-semibold">
                Single Project Wrap
              </span>
              <h1 className="text-lg font-display font-semibold tracking-tight text-ink mt-1.5 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-accent shrink-0" />
                <span>{projectDetail.name}</span>
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Multi-agency intake coordinates directly to this single project's capacity limits. Engineer and Admin rosters remain constant.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono text-muted">
              <span className="px-2 py-0.5 bg-paper border border-line rounded">
                Ref Code: <span className="text-ink font-semibold">{projectDetail.contract_number}</span>
              </span>
              <span className="px-2 py-0.5 bg-paper border border-line rounded">
                Client: <span className="text-ink font-semibold">{projectDetail.client}</span>
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3.5 border-t border-line/50">
            <div className="space-y-0.5">
              <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">Project Location</span>
              <p className="text-xs font-semibold text-ink">{projectDetail.location}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">Site Engineer In Charge</span>
              <p className="text-xs font-semibold text-accent">{projectDetail.engineer_in_charge}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">Lead Admin Coordinator</span>
              <p className="text-xs font-semibold text-ink">{projectDetail.admin_coordinator}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">Authorized Feed Companies</span>
              <p className="text-xs font-semibold text-ink truncate" title={companies.map(c => c.name).join(", ")}>
                {companies.length} recruiting agencies active
              </p>
            </div>
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
            Approved workers consuming category quotas.
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
            <span>Total Units: {workers.length}</span>
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
            <p>1. Recruiter registers intake → worker saved as <span className="mono-text">pending</span>.</p>
            <p>2. Engineer inputs Sending Batch → visa doc date stamps today, <span className="mono-text">active quota -1</span>.</p>
            <p>3. Operations manages documentation, visa feedback, transit bookings, and arrivals.</p>
          </div>
        </div>

      </div>

      {/* Categories Quota Utilization Section */}
      <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink font-display">Category Vacancy Quotas</h3>
            <p className="text-[11px] text-muted">Limits set by System Administrator. Action is fully locked at zero vacancys.</p>
          </div>
          <div className="px-2 py-1 bg-neutral-900 border border-neutral-800 text-[#FDFBF6] text-[10px] font-mono rounded flex items-center gap-1">
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
                      Active Utilisation: {cq.activeCount} of {cq.max_quota} allocation ({(cq.percent).toFixed(0)}%)
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
                <div className="w-full bg-paper rounded-full h-3 overflow-hidden border border-line/40">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${isLocked ? "bg-bad animate-pulse" : "bg-accent"}`}
                    style={{ width: `${Math.min(100, cq.percent)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Filterable Data Table Segment */}
      <div className="bg-card border border-line rounded-xl shadow-sm overflow-hidden font-sans">
        
        {/* Table Control Header */}
        <div className="p-4 border-b border-line bg-paper/25 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-ink font-display">Combined Master Records Archive</h3>
            <p className="text-[11px] text-muted">Showing {sortedWorkers.length} of {workers.length} matching rows</p>
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
                <th className="p-3">Category</th>
                <th className="p-3 cursor-pointer hover:text-ink transition-colors" onClick={() => toggleSort("supply_company")}>
                  Supply Company {sortField === "supply_company" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3">State</th>
                <th className="p-3">Batch / Approved</th>
                <th className="p-3">WA doc</th>
                <th className="p-3">Visa XPact status</th>
                <th className="p-3">Bureau status</th>
                <th className="p-3">Final status</th>
                <th className="p-3 pr-5 text-right cursor-pointer hover:text-ink transition-colors" onClick={() => toggleSort("created_at")}>
                  Created Date {sortField === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-line/40">
              {sortedWorkers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-muted">
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
                      
                      {/* Category */}
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 bg-paper rounded border border-line/40 text-[10px] font-medium text-ink">
                          {w.category}
                        </span>
                      </td>
                      
                      {/* Supply Company */}
                      <td className="p-3 text-muted truncate max-w-[140px]">
                        {w.supply_company}
                      </td>
                      
                      {/* State */}
                      <td className="p-3">
                        {isPending ? (
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
                        ) : (
                          <span className="italic">Awaiting Gate</span>
                        )}
                      </td>
                      
                      {/* WhatsApp document */}
                      <td className="p-3">
                        <span className={`inline-block px-1.5 py-0.5 font-mono text-[10px] rounded ${
                          w.doc_upload_wa === "Yes" 
                            ? "bg-success-green/10 text-success-green border border-success-green/20" 
                            : "bg-red-50 text-bad border border-bad/20"
                        }`}>
                          {w.doc_upload_wa}
                        </span>
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
                      <td className="p-3 pr-5 text-right font-mono text-[10px] text-muted whitespace-nowrap">
                        {new Date(w.created_at).toLocaleDateString()}
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
