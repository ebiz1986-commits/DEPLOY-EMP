import React from "react";
import { Company, Worker, User } from "../types";
import { Search, Filter, RefreshCw, Layers } from "lucide-react";

interface CompanyFilterHeaderProps {
  companies: Company[];
  workers: Worker[];
  selectedCompany: string; // company Name or "All"
  setSelectedCompany: (company: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string; // category name or "All"
  setSelectedCategory: (cat: string) => void;
  categoriesList: string[];
  title: string;
  subtitle: string;
  onRefresh?: () => void;
  currentUser?: User | null;
}

export default function CompanyFilterHeader({
  companies,
  workers,
  selectedCompany,
  setSelectedCompany,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categoriesList,
  title,
  subtitle,
  onRefresh,
  currentUser
}: CompanyFilterHeaderProps) {

  // Restrict workers based on recruiter company membership to avoid revealing leaks in numeric counts
  const restrictionCompany = currentUser?.role === "recruiter" ? (currentUser.recruiter_company || "KSJ") : null;
  const filteredCountWorkers = restrictionCompany 
    ? workers.filter(w => w.supply_company === restrictionCompany)
    : workers;

  // Calculate live count of workers per company
  const getCompanyCount = (companyName: string) => {
    if (companyName === "All") {
      return filteredCountWorkers.length;
    }
    return filteredCountWorkers.filter((w) => w.supply_company === companyName).length;
  };


  return (
    <div className="bg-card border border-line rounded-xl p-5 mb-6 shadow-sm flex flex-col gap-4 font-sans select-none">
      
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-medium tracking-tight text-ink">
            {title}
          </h2>
          <p className="text-xs text-muted">
            {subtitle}
          </p>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 border border-line hover:bg-paper/40 rounded-lg text-xs font-mono text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Resync DB</span>
          </button>
        )}
      </div>

      {/* Inputs and Dropdowns Filter Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1.5 border-t border-line/50">
        
        {/* Search Input Filter */}
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted pointer-events-none" />
          <input
            id="global-search-filter"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by worker name, passport..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-paper/20 focus:bg-card border border-line focus:border-accent focus:ring-1 focus:ring-accent rounded-lg outline-none transition-all placeholder:text-muted/70 text-ink text-ellipsis"
          />
        </div>

        {/* Company Switcher Dropdown Container */}
        <div className="md:col-span-4 flex items-center gap-2">
          <label className="text-[10px] font-mono text-muted uppercase tracking-wider shrink-0">
            Company:
          </label>
          <select
            id="company-switcher-dropdown"
            value={selectedCompany}
            disabled={currentUser?.role === "recruiter"}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className={`w-full text-xs px-2.5 py-2 bg-paper/20 border border-line focus:border-accent focus:ring-1 focus:ring-accent rounded-lg outline-none transition-all text-ink font-medium ${
              currentUser?.role === "recruiter"
                ? "cursor-not-allowed text-[#D97706] border-[#D97706]/30 bg-paper/60"
                : "cursor-pointer"
            }`}
          >
            {currentUser?.role === "recruiter" ? (
              <option value={currentUser.recruiter_company || "KSJ"}>
                {currentUser.recruiter_company || "KSJ"} ({getCompanyCount(currentUser.recruiter_company || "KSJ")} records)
              </option>
            ) : (
              <>
                <option value="All">All Companies ({getCompanyCount("All")} total)</option>
                {companies.map((co) => (
                  <option key={co.id} value={co.name}>
                    {co.name} ({getCompanyCount(co.name)} records)
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Category Column Filter Dropdown Container */}
        <div className="md:col-span-4 flex items-center gap-2">
          <label className="text-[10px] font-mono text-muted uppercase tracking-wider shrink-0">
            Category:
          </label>
          <select
            id="category-column-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full text-xs px-2.5 py-2 bg-paper/20 border border-line focus:border-accent focus:ring-1 focus:ring-accent rounded-lg outline-none transition-all text-ink cursor-pointer font-medium"
          >
            <option value="All">All Categories ({filteredCountWorkers.length})</option>
            {categoriesList.map((catName) => (
              <option key={catName} value={catName}>
                {catName} ({filteredCountWorkers.filter(w => w.category === catName).length} records)
              </option>
            ))}
          </select>
        </div>

      </div>

    </div>
  );
}
