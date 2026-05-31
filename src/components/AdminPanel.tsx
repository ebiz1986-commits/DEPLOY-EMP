import React, { useState, useMemo } from "react";
import { Category, Company, DropdownOption, User, UserRole, ProjectDetail } from "../types";
import { 
  Sliders, 
  Layers, 
  Building2, 
  Tags, 
  Users2, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  UserPlus,
  Briefcase
} from "lucide-react";

interface AdminPanelProps {
  categories: Category[];
  companies: Company[];
  dropdownOptions: DropdownOption[];
  users: User[];
  projectDetail?: ProjectDetail | null;
  onRefresh: () => void;
  onUpdateCategories: (newCats: Category[]) => Promise<boolean>;
  onUpdateCompanies: (newCos: Company[]) => Promise<boolean>;
  onUpdateDropdownOptions: (newOpts: DropdownOption[]) => Promise<boolean>;
  onAddUser: (newUser: User) => Promise<{ success: boolean; message?: string }>;
  onDeleteUser: (username: string) => Promise<boolean>;
  onUpdateProjectDetail?: (newDetail: ProjectDetail) => Promise<boolean>;
}

export default function AdminPanel({
  categories,
  companies,
  dropdownOptions,
  users,
  projectDetail,
  onRefresh,
  onUpdateCategories,
  onUpdateCompanies,
  onUpdateDropdownOptions,
  onAddUser,
  onDeleteUser,
  onUpdateProjectDetail
}: AdminPanelProps) {
  
  // Navigation internal to Admin Settings panel
  const [activeSubTab, setActiveSubTab] = useState<"project" | "quotas" | "companies" | "dropdowns" | "users">("project");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // States for Project Management
  const [projName, setProjName] = useState(projectDetail?.name || "");
  const [projClient, setProjClient] = useState(projectDetail?.client || "");
  const [projLocation, setProjLocation] = useState(projectDetail?.location || "");
  const [projEngineer, setProjEngineer] = useState(projectDetail?.engineer_in_charge || "");
  const [projAdmin, setProjAdmin] = useState(projectDetail?.admin_coordinator || "");
  const [projContract, setProjContract] = useState(projectDetail?.contract_number || "");

  React.useEffect(() => {
    if (projectDetail) {
      setProjName(projectDetail.name);
      setProjClient(projectDetail.client);
      setProjLocation(projectDetail.location);
      setProjEngineer(projectDetail.engineer_in_charge);
      setProjAdmin(projectDetail.admin_coordinator);
      setProjContract(projectDetail.contract_number);
    }
  }, [projectDetail]);

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) {
      showError("Project name cannot be empty.");
      return;
    }
    if (onUpdateProjectDetail) {
      const ok = await onUpdateProjectDetail({
        name: projName.trim(),
        client: projClient.trim(),
        location: projLocation.trim(),
        engineer_in_charge: projEngineer.trim(),
        admin_coordinator: projAdmin.trim(),
        contract_number: projContract.trim()
      });
      if (ok) {
        showSuccess("Project details updated successfully across all roles!");
      } else {
        showError("Failed to save project settings in database.");
      }
    }
  };

  // States for Category Management
  const [newCatName, setNewCatName] = useState("");
  const [newCatQuota, setNewCatQuota] = useState(100);

  // States for Company Management
  const [newCompanyName, setNewCompanyName] = useState("");

  // States for Dropdowns Option Management
  const [newOptValue, setNewOptValue] = useState("");
  const [newOptField, setNewOptField] = useState<"sending_batch" | "status" | "bureau" | "final_status">("sending_batch");

  // States for User Management
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRealName, setNewRealName] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("recruiter");

  const showSuccess = (text: string) => {
    setSuccessMsg(text);
    setErrorMsg("");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const showError = (text: string) => {
    setErrorMsg(text);
    setSuccessMsg("");
    setTimeout(() => setErrorMsg(""), 4000);
  };

  // Quotas / Categories Change handler
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    if (categories.some((c) => c.name.toLowerCase() === newCatName.toLowerCase().trim())) {
      showError(`Job Category "${newCatName}" already exists.`);
      return;
    }

    const updated = [
      ...categories,
      { id: `cat-${Date.now()}`, name: newCatName.trim(), max_quota: Number(newCatQuota) }
    ];

    const isOk = await onUpdateCategories(updated);
    if (isOk) {
      showSuccess(`Added Category: "${newCatName.trim()}" at quota ${newCatQuota}`);
      setNewCatName("");
    } else {
      showError("Failed to update database.");
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete the category "${catName}"? This will unlink existing counters.`)) {
      return;
    }
    const updated = categories.filter((c) => c.id !== catId);
    const isOk = await onUpdateCategories(updated);
    if (isOk) {
      showSuccess(`Deleted Category "${catName}".`);
    } else {
      showError("Failed to delete category.");
    }
  };

  const handleUpdateQuotaValue = async (catId: string, newQuotaStr: string) => {
    const freshQuota = parseInt(newQuotaStr, 10);
    if (isNaN(freshQuota) || freshQuota < 0) return;

    const updated = categories.map((c) => {
      if (c.id === catId) {
        return { ...c, max_quota: freshQuota };
      }
      return c;
    });

    const isOk = await onUpdateCategories(updated);
    if (isOk) {
      showSuccess("Quota updated successfully!");
    }
  };

  // Companies Management Handler
  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    if (companies.some((co) => co.name.toLowerCase() === newCompanyName.toLowerCase().trim())) {
      showError(`Vendor Agency "${newCompanyName}" already exists.`);
      return;
    }

    const updated = [
      ...companies,
      { id: `co-${Date.now()}`, name: newCompanyName.trim() }
    ];

    const isOk = await onUpdateCompanies(updated);
    if (isOk) {
      showSuccess(`Company "${newCompanyName.trim()}" registered successfully!`);
      setNewCompanyName("");
    } else {
      showError("Failed to add company.");
    }
  };

  const handleDeleteCompany = async (coId: string, coName: string) => {
    if (!window.confirm(`Delete "${coName}"? Active workers tagged to this item will be preserved.`)) return;

    const updated = companies.filter((c) => c.id !== coId);
    const isOk = await onUpdateCompanies(updated);
    if (isOk) {
      showSuccess(`Deleted Supply Company: ${coName}.`);
    } else {
      showError("Failed to remove company.");
    }
  };

  // Dropdowns Lists handler
  const handleAddDropdownOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptValue.trim()) return;

    // Check unique value
    if (dropdownOptions.some(opt => opt.field === newOptField && opt.value.toLowerCase() === newOptValue.toLowerCase().trim())) {
      showError(`Option "${newOptValue}" already exists in ${newOptField}.`);
      return;
    }

    const updated = [
      ...dropdownOptions,
      { id: `opt-${Date.now()}`, field: newOptField, value: newOptValue.trim() }
    ];

    const isOk = await onUpdateDropdownOptions(updated);
    if (isOk) {
      showSuccess(`Created dropdown option "${newOptValue}" inside "${newOptField}"!`);
      setNewOptValue("");
    } else {
      showError("Could not update dropdown list.");
    }
  };

  const handleDeleteDropdownOption = async (optId: string, optVal: string) => {
    const updated = dropdownOptions.filter(d => d.id !== optId);
    const isOk = await onUpdateDropdownOptions(updated);
    if (isOk) {
      showSuccess(`Removed option listing: "${optVal}".`);
    } else {
      showError("Could not delete dropdown option.");
    }
  };

  // User Management
  const handleCreateUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || !newRealName.trim()) {
      showError("Please complete all credentials details.");
      return;
    }

    const userPayload: User = {
      username: newUsername.trim().toLowerCase(),
      password: newPassword.trim(),
      name: newRealName.trim(),
      role: newUserRole
    };

    const res = await onAddUser(userPayload);
    if (res.success) {
      showSuccess(`Successfully provisioned account password for @${newUsername.trim()}`);
      setNewUsername("");
      setNewPassword("");
      setNewRealName("");
    } else {
      showError(res.message || "Failed to create user account.");
    }
  };

  const handleDeleteUserAccount = async (username: string) => {
    if (username === "admin") {
      showError("Gate Lock: Primary Super-Admin account cannot be deleted for safety.");
      return;
    }

    if (!window.confirm(`Revoke session token and permanently delete account representing user: @${username}?`)) {
      return;
    }

    const isOk = await onDeleteUser(username);
    if (isOk) {
      showSuccess(`Account representing @${username} was deleted.`);
    } else {
      showError("Could not delete user.");
    }
  };

  return (
    <div id="admin-panel-viewport" className="flex-1 overflow-y-auto p-6 space-y-6 max-h-screen">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card border border-line rounded-xl p-5 shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-display font-medium text-ink flex items-center gap-2">
            <Sliders className="w-5 text-accent" />
            <span>Master System Settings & Controls</span>
          </h2>
          <p className="text-xs text-muted">Set global metrics capacities, lookup references, companies, and authorize credentials access.</p>
        </div>

        <button
          onClick={() => onRefresh()}
          className="text-[10px] font-mono text-muted hover:text-ink px-2.5 py-1.5 border border-line rounded-lg bg-paper/30 cursor-pointer"
        >
          Force Resync Data
        </button>
      </div>

      {/* Message Toaster */}
      {successMsg && (
        <div className="p-4 bg-green-50 text-success-green border border-green-200 rounded-xl text-xs flex gap-3 items-center animate-fade-in font-sans">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <p className="font-semibold">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 text-bad border border-red-200 rounded-xl text-xs flex gap-3 items-center animate-fade-in font-sans">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="font-semibold">{errorMsg}</p>
        </div>
      )}

      {/* Tab Menu Selection Grid */}
      <div className="flex border-b border-line gap-2 overflow-x-auto select-none font-sans scrollbar-none">
        
        <button
          onClick={() => setActiveSubTab("project")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "project"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 inline mr-1" />
          Project Settings
        </button>

        <button
          onClick={() => setActiveSubTab("quotas")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "quotas"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Layers className="w-3.5 h-3.5 inline mr-1" />
          Quotas
        </button>

        <button
          onClick={() => setActiveSubTab("companies")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "companies"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 inline mr-1" />
          Supply Companies
        </button>

        <button
          onClick={() => setActiveSubTab("dropdowns")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "dropdowns"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Tags className="w-3.5 h-3.5 inline mr-1" />
          Dropdown Options
        </button>

        <button
          onClick={() => setActiveSubTab("users")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "users"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Users2 className="w-3.5 h-3.5 inline mr-1" />
          Credentials Manager
        </button>

      </div>

      {/* Sub Views */}
      <div className="font-sans">

        {/* SUB 0: PROJECT WRAPPER SETTINGS */}
        {activeSubTab === "project" && (
          <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-5 animate-fade-in max-w-2xl font-sans">
            <div>
              <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-accent shrink-0" />
                <span>Single Project Wrapper Setup</span>
              </h3>
              <p className="text-xs text-muted">
                All registered migrant workers and company allocations in this app wrapper belong to this single project context.
              </p>
            </div>

            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-mono text-muted uppercase tracking-wider block">Project Name (Title)</label>
                  <input
                    type="text"
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                    placeholder="e.g. Sanken Overseas Infrastructure Link MRT Project"
                    className="w-full bg-paper/20 border border-line rounded px-3 py-2 text-xs outline-none focus:border-accent text-ink"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted uppercase tracking-wider block">Client Organization</label>
                  <input
                    type="text"
                    value={projClient}
                    onChange={(e) => setProjClient(e.target.value)}
                    placeholder="e.g. Malaysia MRT Corp"
                    className="w-full bg-paper/20 border border-line rounded px-3 py-2 text-xs outline-none focus:border-accent text-ink"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted uppercase tracking-wider block">Project Ref / Contract No.</label>
                  <input
                    type="text"
                    value={projContract}
                    onChange={(e) => setProjContract(e.target.value)}
                    placeholder="e.g. MRT-2026-SANKEN-0982"
                    className="w-full bg-paper/20 border border-line rounded px-3 py-2 text-xs outline-none focus:border-accent text-ink"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-mono text-muted uppercase tracking-wider block">Project Core Site Location</label>
                  <input
                    type="text"
                    value={projLocation}
                    onChange={(e) => setProjLocation(e.target.value)}
                    placeholder="e.g. Kuala Lumpur Central Hub"
                    className="w-full bg-paper/20 border border-line rounded px-3 py-2 text-xs outline-none focus:border-accent text-ink"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted uppercase tracking-wider block">Assigned Site Engineer (Constant)</label>
                  <input
                    type="text"
                    value={projEngineer}
                    onChange={(e) => setProjEngineer(e.target.value)}
                    placeholder="e.g. Ir. Tan"
                    className="w-full bg-paper/20 border border-line rounded px-3 py-2 text-xs outline-none focus:border-accent text-ink"
                  />
                  <p className="text-[9px] text-muted">Core verification engineer for quotas and sending batches.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted uppercase tracking-wider block">Lead Admin Coordinator (Constant)</label>
                  <input
                    type="text"
                    value={projAdmin}
                    onChange={(e) => setProjAdmin(e.target.value)}
                    placeholder="e.g. System Admin"
                    className="w-full bg-paper/20 border border-line rounded px-3 py-2 text-xs outline-none focus:border-accent text-ink"
                  />
                  <p className="text-[9px] text-muted">Coordinator role responsible for final vendor approvals.</p>
                </div>

              </div>

              <div className="border-t border-line/50 pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Save Project Setup
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* SUB 1: QUOTAS & CATEGORIES */}
        {activeSubTab === "quotas" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Left Quotas Table list */}
            <div className="lg:col-span-8 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Manage Categories & Max Quotas</h3>
                <p className="text-xs text-muted">Update quotas instantly. Changes propagate dynamically to the Engineer Approval Screen.</p>
              </div>

              <div className="border border-line/60 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs bg-card">
                  <thead className="bg-paper text-muted font-mono text-[9px] uppercase">
                    <tr>
                      <th className="p-3 pl-4">Category Name</th>
                      <th className="p-3 w-56">Max Limit Quota Allocation</th>
                      <th className="p-3 w-16 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/45">
                    {categories.map((c) => (
                      <tr key={c.id} className="hover:bg-paper/10">
                        <td className="p-3 font-semibold text-ink font-display">
                          {c.name}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={c.max_quota}
                              onChange={(e) => handleUpdateQuotaValue(c.id, e.target.value)}
                              className="w-24 bg-paper/20 border border-line px-2 py-1 text-xs outline-none rounded font-mono font-bold"
                            />
                            <span className="text-[10px] text-muted">Active threshold</span>
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            className="text-muted hover:text-bad p-1 rounded hover:bg-neutral-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right category registration adder */}
            <div className="lg:col-span-4 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 h-fit">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Register New Cohort Category</h3>
                <p className="text-xs text-muted">Enter a unique job category name to set live.</p>
              </div>

              <form onSubmit={handleAddCategory} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Name</label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Hospitality Specialists"
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Max Quota Cap</label>
                  <input
                    type="number"
                    min={1}
                    value={newCatQuota}
                    onChange={(e) => setNewCatQuota(Number(e.target.value))}
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none font-mono"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer"
                >
                  Create Category
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SUB 2: COMPANIES */}
        {activeSubTab === "companies" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Left lists */}
            <div className="lg:col-span-8 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 font-sans">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Registered Supply Companies / Vendors</h3>
                <p className="text-xs text-muted">Agencies currently sending migrant workers under contracts.</p>
              </div>

              <div className="border border-line/60 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs bg-card">
                  <thead className="bg-paper text-muted font-mono text-[9px] uppercase">
                    <tr>
                      <th className="p-3 pl-4">Company Legal Designation Name</th>
                      <th className="p-3 w-20 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/45">
                    {companies.map((co) => (
                      <tr key={co.id} className="hover:bg-paper/10">
                        <td className="p-3 font-semibold text-ink font-display flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted shrink-0" />
                          <span>{co.name}</span>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleDeleteCompany(co.id, co.name)}
                            className="text-muted hover:text-bad p-1 rounded hover:bg-neutral-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Register vendor */}
            <div className="lg:col-span-4 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 h-fit font-sans">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Register Supply Company</h3>
                <p className="text-xs text-muted">Add a new supply agency into active registry selection lists.</p>
              </div>

              <form onSubmit={handleAddCompany} className="space-y-3">
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Apex Transit Ltd"
                  className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none font-semibold text-ink"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer"
                >
                  Register Company
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SUB 3: LOOKUP DROPDOWNS OPTIONS */}
        {activeSubTab === "dropdowns" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in font-sans">
            <div className="lg:col-span-8 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Dropdown Registry System Lookups</h3>
                <p className="text-xs text-muted">Standard options driving state and lists menus on Recruiter, Engineer, and Ops screens.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Section of sending batches */}
                <div className="border border-line rounded-xl p-3 bg-paper/20">
                  <h4 className="font-mono text-[10px] text-muted uppercase border-b border-line pb-1 mb-2">Sending Batches</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {dropdownOptions.filter(d => d.field === "sending_batch").map(opt => (
                      <div key={opt.id} className="flex items-center justify-between p-1 px-2 border border-line/35 bg-card rounded text-xs select-none">
                        <span>{opt.value}</span>
                        <button onClick={() => handleDeleteDropdownOption(opt.id, opt.value)} className="hover:text-bad text-muted text-[10px]">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section of visa statuses */}
                <div className="border border-line rounded-xl p-3 bg-paper/20">
                  <h4 className="font-mono text-[10px] text-muted uppercase border-b border-line pb-1 mb-2">Visa statuses (XPact)</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {dropdownOptions.filter(d => d.field === "status").map(opt => (
                      <div key={opt.id} className="flex items-center justify-between p-1 px-2 border border-line/35 bg-card rounded text-xs select-none">
                        <span>{opt.value}</span>
                        <button onClick={() => handleDeleteDropdownOption(opt.id, opt.value)} className="hover:text-bad text-muted text-[10px]">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bureau list */}
                <div className="border border-line rounded-xl p-3 bg-paper/20">
                  <h4 className="font-mono text-[10px] text-muted uppercase border-b border-line pb-1 mb-2">Bureau alignment states</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {dropdownOptions.filter(d => d.field === "bureau").map(opt => (
                      <div key={opt.id} className="flex items-center justify-between p-1 px-2 border border-line/35 bg-card rounded text-xs select-none">
                        <span>{opt.value}</span>
                        <button onClick={() => handleDeleteDropdownOption(opt.id, opt.value)} className="hover:text-bad text-muted text-[10px]">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Final Placement */}
                <div className="border border-line rounded-xl p-3 bg-paper/20">
                  <h4 className="font-mono text-[10px] text-muted uppercase border-b border-line pb-1 mb-2">Final Arrival placement states</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {dropdownOptions.filter(d => d.field === "final_status").map(opt => (
                      <div key={opt.id} className="flex items-center justify-between p-1 px-2 border border-line/35 bg-card rounded text-xs select-none">
                        <span>{opt.value}</span>
                        <button onClick={() => handleDeleteDropdownOption(opt.id, opt.value)} className="hover:text-bad text-muted text-[10px]">×</button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Right option creator */}
            <div className="lg:col-span-4 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 h-fit">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Add Dropdown List Entry</h3>
                <p className="text-xs text-muted">Submit lookup values manually without software modifications.</p>
              </div>

              <form onSubmit={handleAddDropdownOption} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Select Field Family</label>
                  <select
                    value={newOptField}
                    onChange={(e: any) => setNewOptField(e.target.value)}
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2 py-1.5 text-xs outline-none cursor-pointer"
                  >
                    <option value="sending_batch">Sending Batch</option>
                    <option value="status">Visa Status (xpact)</option>
                    <option value="bureau">Bureau Clearance</option>
                    <option value="final_status">Final Placement Status</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">New Option Value string</label>
                  <input
                    type="text"
                    value={newOptValue}
                    onChange={(e) => setNewOptValue(e.target.value)}
                    placeholder="e.g. Batch #108 or In-Transit"
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer"
                >
                  Create Option Listing
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SUB 4: USER MANAGER */}
        {activeSubTab === "users" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in font-sans">
            {/* Left list of users */}
            <div className="lg:col-span-8 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Registered Security Staff Accounts</h3>
                <p className="text-xs text-muted">Authorised personnel currently registered in credentials lists.</p>
              </div>

              <div className="border border-line/60 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs bg-card">
                  <thead className="bg-paper text-muted font-mono text-[9px] uppercase">
                    <tr>
                      <th className="p-3 pl-4">Staff Name</th>
                      <th className="p-3">Username handle</th>
                      <th className="p-3">Scope Role assigned</th>
                      <th className="p-3 w-20 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/45">
                    {users.map((u) => (
                      <tr key={u.username} className="hover:bg-paper/10">
                        <td className="p-3 font-semibold text-ink font-display">
                          {u.name}
                        </td>
                        <td className="p-3 font-mono text-muted">
                          @{u.username}
                        </td>
                        <td className="p-3 font-mono">
                          <span className={`px-2 py-0.5 border rounded-full text-[9px] uppercase ${
                            u.role === "admin" 
                              ? "bg-red-50 text-bad border-bad/30" 
                              : u.role === "engineer"
                              ? "bg-green-50 text-success-green border-success-green/30"
                              : "bg-neutral-50 text-muted border-line/40"
                          }`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleDeleteUserAccount(u.username)}
                            disabled={u.username === "admin"}
                            className="text-muted hover:text-bad p-1 rounded hover:bg-neutral-50 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* User creation block */}
            <div className="lg:col-span-4 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 h-fit">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Provision New User Account</h3>
                <p className="text-xs text-muted">Creates usernames and scope roles matching user types.</p>
              </div>

              <form onSubmit={handleCreateUserAccount} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Corporate Full Name</label>
                  <input
                    type="text"
                    value={newRealName}
                    onChange={(e) => setNewRealName(e.target.value)}
                    placeholder="e.g. Farid Recruiter"
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Username handle</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. recruiter_ksj"
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Secret Access Passkey</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="password..."
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Authorized Role Group</label>
                  <select
                    value={newUserRole}
                    onChange={(e: any) => setNewUserRole(e.target.value)}
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2 py-1.5 text-xs outline-none cursor-pointer"
                  >
                    <option value="recruiter">Role 1: Sanken Overseas Recruiter Intake</option>
                    <option value="engineer">Role 2: Engineer Gate Approvals</option>
                    <option value="ops">Role 3: Admin2 Operations Updates</option>
                    <option value="admin">Role 4: Primary Super Administrator</option>
                    <option value="viewer">Role 5: Dashboard Viewer Scope Only</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer"
                >
                  Provision Credentials
                </button>
              </form>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
