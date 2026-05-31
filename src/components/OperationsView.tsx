import React, { useState, useMemo } from "react";
import { Category, Company, Worker, DropdownOption } from "../types";
import CompanyFilterHeader from "./CompanyFilterHeader";
import { 
  ClipboardList, 
  RefreshCw, 
  CheckCircle, 
  HelpCircle, 
  Building2, 
  Clock, 
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

interface OperationsViewProps {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  dropdownOptions: DropdownOption[];
  onRefresh: () => void;
  onUpdateWorker: (id: string, updates: Partial<Worker>) => Promise<boolean>;
}

export default function OperationsView({
  workers,
  categories,
  companies,
  dropdownOptions,
  onRefresh,
  onUpdateWorker
}: OperationsViewProps) {
  
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

  // Active list workers (workers with state = active only)
  const activeWorkers = useMemo(() => {
    return workers.filter((w) => {
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
  }, [workers, selectedCompany, selectedCategory, searchQuery]);

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
                activeWorkers.map((w) => (
                  <tr key={w.id} className="hover:bg-paper/10 transition-colors">
                    
                    {/* Worker credentials info */}
                    <td className="p-3 pl-5 max-w-[150px]">
                      <div className="font-semibold text-ink font-display truncate">{w.name}</div>
                      <div className="text-[10px] text-muted truncate" title={w.supply_company}>{w.supply_company}</div>
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
                      <select
                        value={w.doc_upload_wa}
                        onChange={(e) => handleFieldChange(w.id, "doc_upload_wa", e.target.value)}
                        className={`text-[11px] px-2.5 py-1 font-mono rounded border outline-none cursor-pointer ${
                          w.doc_upload_wa === "Yes" 
                            ? "bg-success-green/10 text-success-green border-success-green/40" 
                            : "bg-red-50 text-bad border-bad/40"
                        }`}
                      >
                        <option value="No">No (Checked Out)</option>
                        <option value="Yes">Yes (WhatsApp OK)</option>
                      </select>
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
                    <td className="p-2">
                      <select
                        value={w.status}
                        onChange={(e) => handleFieldChange(w.id, "status", e.target.value)}
                        className="text-xs px-2 py-1 bg-paper/20 border border-line focus:border-accent rounded outline-none cursor-pointer w-full text-ink font-medium"
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>

                    {/* Bureau Option Picker */}
                    <td className="p-2">
                      <select
                        value={w.bureau}
                        onChange={(e) => handleFieldChange(w.id, "bureau", e.target.value)}
                        className="text-xs px-2 py-1 bg-paper/20 border border-line focus:border-accent rounded outline-none cursor-pointer w-full text-ink font-medium"
                      >
                        {bureauOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>

                    {/* Final Arrival Status Selector */}
                    <td className="p-2 pr-5">
                      <select
                        value={w.final_status}
                        onChange={(e) => handleFieldChange(w.id, "final_status", e.target.value)}
                        className="text-xs px-2 py-1 bg-paper/20 border border-line focus:border-accent rounded outline-none cursor-pointer w-full text-ink font-medium"
                      >
                        {finalStatusOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
