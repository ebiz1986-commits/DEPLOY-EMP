export type UserRole = 'recruiter' | 'engineer' | 'ops' | 'admin' | 'viewer';

export interface User {
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  assigned_projects?: string[];
  recruiter_company?: string;
}

export interface Worker {
  id: string;
  name: string;
  passport: string;
  category: string;
  supply_company: string;
  sending_batch?: string;
  visa_doc_date?: string;
  state: 'pending' | 'active' | 'rejected' | 'held';
  doc_upload_wa: 'Pending' | 'Yes' | 'Rejected' | 'No';
  last_updated?: string;
  status: string; // e.g. "Pending", "Visa Approved (xpact)", "Visa Reject (xpact)", "Applied second time"
  bureau: string; // e.g. "Pending", "Complete", "Reject"
  final_status: string; // e.g. "Pending", "Booked", "Arrived"
  created_at: string;
  project_id?: string; // Support several projects
  bureau_pending_at?: string;
  bureau_completed_at?: string;
  doc_link?: string;
  bulk_doc_link?: string;
  wa_doc_reject_reason?: string;
  doc_upload_wa_date?: string;
  status_date?: string;
  bureau_date?: string;
  final_status_date?: string;
  gate_reject_reason?: string;
}

export interface Category {
  id: string;
  name: string;
  max_quota: number;
  company_allocations?: Record<string, number>;
}

export interface Company {
  id: string;
  name: string;
}

export interface DropdownOption {
  id: string;
  field: string;
  value: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  client: string;
  engineer_in_charge: string;
  admin_coordinator: string;
  location: string;
  contract_number: string;
}

export interface SystemNotification {
  id: string;
  project_id?: string;
  message: string;
  sender: string;
  role?: UserRole;
  created_at: string;
  type: "info" | "success" | "warning" | "error";
  target_user?: string;
  associated_company?: string;
}

export interface DbState {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  dropdown_options: DropdownOption[];
  users: User[];
  project_detail?: ProjectDetail;
  projects?: ProjectDetail[];
  selected_project_id?: string;
  notifications?: SystemNotification[];
}
