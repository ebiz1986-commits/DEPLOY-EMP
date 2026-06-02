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
  projects?: ProjectDetail[];
  selectedProjectId?: string;
  onRefresh: () => void;
  onUpdateCategories: (newCats: Category[]) => Promise<boolean>;
  onUpdateCompanies: (newCos: Company[]) => Promise<boolean>;
  onUpdateDropdownOptions: (newOpts: DropdownOption[]) => Promise<boolean>;
  onAddUser: (newUser: User) => Promise<{ success: boolean; message?: string }>;
  onDeleteUser: (username: string) => Promise<boolean>;
  onUpdateProjectDetail?: (newDetail: ProjectDetail) => Promise<boolean>;
  onAddProject?: (newProj: Omit<ProjectDetail, "id"> & { id?: string }) => Promise<boolean>;
  onDeleteProject?: (projectId: string) => Promise<boolean>;
  onSelectProject?: (projectId: string) => Promise<boolean>;
}

export default function AdminPanel({
  categories,
  companies,
  dropdownOptions,
  users,
  projectDetail,
  projects = [],
  selectedProjectId = "",
  onRefresh,
  onUpdateCategories,
  onUpdateCompanies,
  onUpdateDropdownOptions,
  onAddUser,
  onDeleteUser,
  onUpdateProjectDetail,
  onAddProject = async () => false,
  onDeleteProject = async () => false,
  onSelectProject = async () => false
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

  // Multi-project editing and creation states
  const [selectedEditProjectId, setSelectedEditProjectId] = useState<string>(projectDetail?.id || "proj-1");
  const [isAddingNewProject, setIsAddingNewProject] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjClient, setNewProjClient] = useState("");
  const [newProjLocation, setNewProjLocation] = useState("");
  const [newProjEngineer, setNewProjEngineer] = useState("");
  const [newProjAdmin, setNewProjAdmin] = useState("");
  const [newProjContract, setNewProjContract] = useState("");

  React.useEffect(() => {
    if (projectDetail) {
      // Default populate with current active project
      setProjName(projectDetail.name);
      setProjClient(projectDetail.client);
      setProjLocation(projectDetail.location);
      setProjEngineer(projectDetail.engineer_in_charge);
      setProjAdmin(projectDetail.admin_coordinator);
      setProjContract(projectDetail.contract_number);
      setSelectedEditProjectId(projectDetail.id || "proj-1");
    }
  }, [projectDetail]);

  const handleLoadProjectForEdit = (proj: ProjectDetail) => {
    setSelectedEditProjectId(proj.id);
    setProjName(proj.name);
    setProjClient(proj.client);
    setProjLocation(proj.location);
    setProjEngineer(proj.engineer_in_charge);
    setProjAdmin(proj.admin_coordinator);
    setProjContract(proj.contract_number);
    setIsAddingNewProject(false);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) {
      showError("Project name key is required.");
      return;
    }
    const ok = await onAddProject({
      name: newProjName.trim(),
      client: newProjClient.trim(),
      location: newProjLocation.trim(),
      engineer_in_charge: newProjEngineer.trim(),
      admin_coordinator: newProjAdmin.trim(),
      contract_number: newProjContract.trim()
    });
    if (ok) {
      showSuccess(`Successfully registered active project: "${newProjName.trim()}"!`);
      setIsAddingNewProject(false);
      setNewProjName("");
      setNewProjClient("");
      setNewProjLocation("");
      setNewProjEngineer("");
      setNewProjAdmin("");
      setNewProjContract("");
    } else {
      showError("Failed to add project to database.");
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) {
      showError("Project name cannot be empty.");
      return;
    }
    if (onUpdateProjectDetail) {
      const ok = await onUpdateProjectDetail({
        id: selectedEditProjectId,
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
  const [newUserAssignedProjects, setNewUserAssignedProjects] = useState<string[]>([]);
  const [newUserRecruiterCompany, setNewUserRecruiterCompany] = useState<string>("");

  React.useEffect(() => {
    if (!newUserRecruiterCompany && companies.length > 0) {
      setNewUserRecruiterCompany(companies[0].name);
    }
  }, [companies, newUserRecruiterCompany]);

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
      role: newUserRole,
      assigned_projects: newUserAssignedProjects,
      recruiter_company: newUserRole === "recruiter" ? newUserRecruiterCompany : undefined
    };

    const res = await onAddUser(userPayload);
    if (res.success) {
      showSuccess(`Successfully provisioned account password for @${newUsername.trim()}`);
      setNewUsername("");
      setNewPassword("");
      setNewRealName("");
      setNewUserAssignedProjects([]);
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in font-sans">
            {/* List of projects */}
            <div className="lg:col-span-7 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-accent shrink-0" />
                    <span>Active Projects Directory ({projects.length})</span>
                  </h3>
                  <p className="text-xs text-muted">
                    Switch focuses or audit system parameters.
                  </p>
                </div>
                {!isAddingNewProject && (
                  <button
                    onClick={() => {
                      setIsAddingNewProject(true);
                    }}
                    className="px-3 py-1.5 bg-accent/15 text-accent hover:bg-accent/25 rounded text-xs font-mono uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Project
                  </button>
                )}
              </div>

              <div className="border border-line/60 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs bg-card">
                  <thead className="bg-paper text-muted font-mono text-[9px] uppercase">
                    <tr>
                      <th className="p-2.5 w-12 text-center">Active</th>
                      <th className="p-2.5">Project Details</th>
                      <th className="p-2.5">Client & site</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {projects.map((proj) => {
                      const isActive = selectedProjectId === proj.id;
                      const isBeingEdited = selectedEditProjectId === proj.id && !isAddingNewProject;
                      return (
                        <tr
                          key={proj.id}
                          className={`hover:bg-paper/30 transition-colors ${
                            isActive ? "bg-accent/5" : ""
                          } ${isBeingEdited ? "ring-1 ring-inset ring-accent/60 bg-accent/2" : ""}`}
                        >
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => {
                                onSelectProject(proj.id);
                                showSuccess(`Focused active portal on "${proj.name}"`);
                              }}
                              className={`p-1.5 rounded transition-colors ${
                                isActive ? "text-accent" : "text-muted hover:text-ink hover:bg-paper/40"
                              }`}
                              title={isActive ? "Currently Selected Active Focus" : "Click to select as active focus"}
                            >
                              <CheckCircle className={`w-4 h-4 ${isActive ? "fill-accent/20" : ""}`} />
                            </button>
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-ink">{proj.name}</div>
                            <div className="text-[10px] text-muted font-mono">{proj.contract_number}</div>
                          </td>
                          <td className="p-2.5 text-muted leading-tight">
                            <div>{proj.client}</div>
                            <div className="text-[10px] italic">{proj.location}</div>
                          </td>
                          <td className="p-2.5 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => handleLoadProjectForEdit(proj)}
                              className="px-2 py-1 bg-paper/60 hover:bg-paper border border-line rounded text-[10px] text-ink font-mono font-medium"
                            >
                              Edit/Load
                            </button>
                            <button
                              onClick={async () => {
                                if (projects.length <= 1) {
                                  showError("Cannot delete the only project block.");
                                  return;
                                }
                                if (window.confirm(`Are you sure you want to delete "${proj.name}"? Sanken workers assigned to this project will remain in the database but lose project affiliation.`)) {
                                  const ok = await onDeleteProject(proj.id);
                                  if (ok) {
                                    showSuccess(`Project "${proj.name}" removed successfully.`);
                                  } else {
                                    showError("Failed to remove project from database.");
                                  }
                                }
                              }}
                              disabled={projects.length <= 1}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-bad border border-bad/30 rounded text-[10px] font-mono font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Editing / Creation panel */}
            <div className="lg:col-span-5 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
              {isAddingNewProject ? (
                <>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-2">
                        <Plus className="w-4 h-4 text-accent shrink-0" />
                        <span>Register New Project</span>
                      </h3>
                      <p className="text-xs text-muted">Submit a new site project draft</p>
                    </div>
                    <button
                      onClick={() => setIsAddingNewProject(false)}
                      className="text-xs text-muted hover:text-ink font-mono underline"
                    >
                      Back to Edit
                    </button>
                  </div>

                  <form onSubmit={handleCreateProject} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Project Name (Title) *</label>
                      <input
                        type="text"
                        value={newProjName}
                        onChange={(e) => setNewProjName(e.target.value)}
                        placeholder="e.g. Sanken Airport Terminal Expansion"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Client Organization</label>
                      <input
                        type="text"
                        value={newProjClient}
                        onChange={(e) => setNewProjClient(e.target.value)}
                        placeholder="e.g. Malaysia Civil Aviation"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Contract # / Reference</label>
                      <input
                        type="text"
                        value={newProjContract}
                        onChange={(e) => setNewProjContract(e.target.value)}
                        placeholder="e.g. APT3-2026-SANKEN-0012"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Core Site Location</label>
                      <input
                        type="text"
                        value={newProjLocation}
                        onChange={(e) => setNewProjLocation(e.target.value)}
                        placeholder="e.g. KLIA Terminal 3 Outer Sector"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Assigned Site Engineer</label>
                      <input
                        type="text"
                        value={newProjEngineer}
                        onChange={(e) => setNewProjEngineer(e.target.value)}
                        placeholder="e.g. Ir. Tan"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Lead Admin Coordinator</label>
                      <input
                        type="text"
                        value={newProjAdmin}
                        onChange={(e) => setNewProjAdmin(e.target.value)}
                        placeholder="e.g. Admin Coordinator"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Register Project Block
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-accent shrink-0" />
                      <span>Edit Project Details</span>
                    </h3>
                    <p className="text-xs text-muted">
                      Updating settings for: <strong className="font-semibold text-ink">{projName || "Selected project"}</strong>
                    </p>
                  </div>

                  <form onSubmit={handleUpdateProject} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Project Name (Title) *</label>
                      <input
                        type="text"
                        value={projName}
                        onChange={(e) => setProjName(e.target.value)}
                        placeholder="e.g. Sanken Airport Terminal Expansion"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Client</label>
                        <input
                          type="text"
                          value={projClient}
                          onChange={(e) => setProjClient(e.target.value)}
                          placeholder="e.g. Malaysia Civil Aviation"
                          className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Contract #</label>
                        <input
                          type="text"
                          value={projContract}
                          onChange={(e) => setProjContract(e.target.value)}
                          placeholder="e.g. APT3-2026-SANKEN-0012"
                          className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Core Site Location</label>
                      <input
                        type="text"
                        value={projLocation}
                        onChange={(e) => setProjLocation(e.target.value)}
                        placeholder="e.g. KLIA Terminal 3 Outer Sector"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Site Engineer</label>
                        <input
                          type="text"
                          value={projEngineer}
                          onChange={(e) => setProjEngineer(e.target.value)}
                          placeholder="e.g. Ir. Tan"
                          className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Lead Coordinator</label>
                        <input
                          type="text"
                          value={projAdmin}
                          onChange={(e) => setProjAdmin(e.target.value)}
                          placeholder="e.g. Admin Coordinator"
                          className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Save/Update Project Details
                    </button>
                  </form>
                </>
              )}
            </div>
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
                      <th className="p-3">Assigned Projects Focus Scope</th>
                      <th className="p-3 w-20 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/45">
                    {users.map((u) => (
                      <tr key={u.username} className="hover:bg-paper/10">
                        <td className="p-3 font-semibold text-ink font-display">
                          <div>{u.name}</div>
                          {u.recruiter_company && (
                            <div className="text-[10px] text-accent font-mono mt-0.5 font-bold bg-accent/5 px-2 py-0.5 rounded border border-accent/15 w-fit flex items-center gap-1">
                              <span>Agency: {u.recruiter_company}</span>
                            </div>
                          )}
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
                        <td className="p-3">
                          {!u.assigned_projects || u.assigned_projects.length === 0 ? (
                            <span className="text-accent font-semibold text-[9px] uppercase font-mono bg-accent/5 px-2 py-0.5 rounded border border-accent/15">
                              All Projects (Unrestricted)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {u.assigned_projects.map(pid => {
                                const proj = projects.find(p => p.id === pid);
                                return (
                                  <span key={pid} className="bg-paper border border-line text-muted text-[10px] px-1.5 py-0.5 rounded font-mono select-none" title={proj?.name || pid}>
                                    {proj ? (proj.name.length > 20 ? proj.name.substring(0, 18) + "..." : proj.name) : pid}
                                  </span>
                                );
                              })}
                            </div>
                          )}
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

                {newUserRole === "recruiter" && (
                  <div className="bg-amber-500/5 border border-accent/15 rounded-lg p-3 space-y-1.5 animate-fade-in">
                    <label className="block text-[10px] uppercase font-mono text-accent font-bold mb-1">
                      Supply Agency Assigned (Required)
                    </label>
                    <select
                      value={newUserRecruiterCompany}
                      onChange={(e) => setNewUserRecruiterCompany(e.target.value)}
                      className="w-full bg-card border border-accent/25 focus:border-accent rounded px-2.5 py-1.5 text-xs font-semibold text-accent outline-none cursor-pointer"
                      required
                    >
                      <option value="" disabled>-- Select Supply Agency --</option>
                      {companies.map(co => (
                        <option key={co.id} value={co.name}>{co.name}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-muted/80 leading-normal">
                      Note: Under Role 1, this user is locked strictly to this supply company to represent their agency data entry.
                    </p>
                  </div>
                )}

                {/* Assigned Projects Selector */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">
                    Assigned Project Focus (Multi-select)
                  </label>
                  <div className="bg-paper/20 border border-line rounded p-3 space-y-2 max-h-48 overflow-y-auto">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="user-project-all"
                        checked={newUserAssignedProjects.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUserAssignedProjects([]);
                          }
                        }}
                        className="rounded border-line text-accent focus:ring-accent cursor-pointer"
                      />
                      <label htmlFor="user-project-all" className="text-xs text-ink font-semibold cursor-pointer">
                        All Projects (Unrestricted)
                      </label>
                    </div>
                    <div className="border-t border-line/40 my-1"></div>
                    {projects.map((p) => (
                      <div key={p.id} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          id={`user-project-${p.id}`}
                          checked={newUserAssignedProjects.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUserAssignedProjects([...newUserAssignedProjects, p.id]);
                            } else {
                              setNewUserAssignedProjects(newUserAssignedProjects.filter(id => id !== p.id));
                            }
                          }}
                          className="rounded border-line text-accent focus:ring-accent mt-0.5 cursor-pointer"
                        />
                        <label htmlFor={`user-project-${p.id}`} className="text-xs text-muted cursor-pointer leading-tight">
                          {p.name} <span className="text-[9px] font-mono text-muted/60">({p.contract_number})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted mt-1 leading-normal">
                    Assigned personnel can only view pipeline metrics and perform intake/approvals operations on their chosen projects.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer font-bold"
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
