export type UserRole = 'recruiter' | 'engineer' | 'ops' | 'admin' | 'viewer';

export interface User {
  username: string;
  password?: string;
  name: string;
  role: UserRole;
}

export interface Worker {
  id: string;
  name: string;
  passport: string;
  category: string;
  supply_company: string;
  sending_batch?: string;
  visa_doc_date?: string;
  state: 'pending' | 'active';
  doc_upload_wa: 'Yes' | 'No';
  last_updated?: string;
  status: string; // e.g. "Pending", "Visa Approved (xpact)", "Visa Reject (xpact)", "Applied second time"
  bureau: string; // e.g. "Pending", "Complete", "Reject"
  final_status: string; // e.g. "Pending", "Booked", "Arrived"
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  max_quota: number;
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
  name: string;
  client: string;
  engineer_in_charge: string;
  admin_coordinator: string;
  location: string;
  contract_number: string;
}

export interface DbState {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  dropdown_options: DropdownOption[];
  users: User[];
  project_detail?: ProjectDetail;
}
