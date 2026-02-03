export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface UserAccount {
  id: number;
  country: string;
  year: number;
  url: string;
}

export interface BankAccount {
  id: number;
  name: string;
  position: number;
  flag_balance: boolean;
  opening_balance: string;
  counter_booked_bookings?: number;
  counter_open_bookings?: number;
  counter_deleted_bookings?: number;
  counter_bookingtemplates?: number;
}

export interface CostAccount {
  id: number;
  costaccount?: number; // ID of predefined cost account
  name: string;
  section?: string;
  group: "1" | "2"; // 1=Income, 2=Expense
  inventory?: boolean;
  active: boolean;
  description?: string;
  purchasetaxaccounts?: Partial<PurchaseTaxAccount>[];
}

export interface PurchaseTaxAccount {
  id: number;
  purchasetaxaccount?: number;
  name: string;
  section?: string;
  group: "1" | "2";
  tax_values?: string[];
  active: boolean;
}

export interface CostCentre {
  id: number;
  name: string;
  position: number;
}

export interface ForeignBusinessBase {
  id: number;
  vatin: string;
  position: number;
}

export interface Tag {
  id: number;
  name: string;
  counter_booked_bookings?: number;
}

export interface BookingAmount {
  group?: "1" | "2";
  bankaccount: number | { id: number; name: string };
  costaccount: number | { id: number; name: string };
  purchasetaxaccount: number | { id: number; name: string };
  amount: string;
  amount_after_tax?: string;
  tax_percent: string;
  tax_value?: string;
  deductibility_tax_percent?: string; // e.g. "100.00"
  deductibility_amount_percent?: string; // e.g. "100.00"
  foreign_business_base?: number | null;
  country_dep?: string;
  country_rec?: string;
}

export interface Booking {
  id: number;
  status: "1" | "2" | "3" | "4"; // 1=booked, 2=open, 3=deleted, 4=imported
  title: string;
  document_number?: string;
  date: string; // YYYY-MM-DD
  date_invoice?: string | null;
  date_delivery?: string | null;
  date_order?: string | null;
  costcentre?: number | { id: number; name: string } | null;
  amounts: BookingAmount[];
  tags?: any[];
  attachments?: any[];
  vatin?: string;
  country?: string;
  description?: string;
  create_date?: string;
  update_date?: string;
}

export interface CreateBookingRequest {
  title: string;
  date: string;
  costcentre?: number;
  amounts: {
    bankaccount: number;
    costaccount: number;
    purchasetaxaccount: number;
    amount: string;
    tax_percent: string;
    deductibility_tax_percent: string;
    deductibility_amount_percent: string;
    foreign_business_base?: number | null;
    country_dep?: string;
    country_rec?: string;
  }[];
  vatin?: string;
  country?: string;
  description?: string;
}

export interface Inventory {
  id: number;
  title: string;
  date_purchase: string;
  date_commissioning: string;
  date_disposal?: string | null;
  amount_after_tax: string;
  deductibility_percent: string;
  deductibility_amount?: string;
  deductibility_years: number;
  deductibility_type: number | { id: number; name: string };
  costaccount: number | { id: number; name: string };
  description?: string;
  seller?: string;
  amounts?: any[];
  attachments?: any[];
}

export interface CreateInventoryRequest {
  title: string;
  date_purchase: string;
  date_commissioning: string;
  amount_after_tax: string;
  deductibility_percent?: string;
  deductibility_years: number;
  deductibility_type: number; // 1=Linear, 2=Sofort, 3=None, 4=Degressiv
  costaccount: number;
  description?: string;
  seller?: string;
}

export interface Attachment {
  id: number;
  name: string;
  size: number;
  booking?: number;
  inventory?: number;
}
