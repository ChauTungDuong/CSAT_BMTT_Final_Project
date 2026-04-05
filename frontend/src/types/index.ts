export interface User {
  id: string;
  username: string;
  role: "customer" | "admin";
}

export interface Customer {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  cccd: string;
  dateOfBirth: string;
  address: string;
  isPinVerified: boolean;
  hasPin: boolean;
}

export interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  balance: string;
  balanceMasked: string;
  isPinVerified?: boolean;
  createdAt: string;
}

export interface Card {
  id: string;
  cardNumber: string;
  expiry: string;
  createdAt: string;
  cvv?: string;
}

export interface Transaction {
  id: string;
  type: string;
  amount: string;
  direction: "debit" | "credit";
  status: string;
  description?: string;
  referenceCode?: string;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  eventType: string;
  userId?: string;
  targetId?: string;
  ipAddress?: string;
  detail?: string;
  createdAt: string;
}
