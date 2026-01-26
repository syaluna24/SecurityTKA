
export type UserRole = 'SECURITY' | 'ADMIN' | 'RESIDENT';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export const ShiftType = {
  MORNING: 'MORNING', // 07:00 - 19:00
  NIGHT: 'NIGHT'     // 19:00 - 07:00
} as const;

export type ShiftType = typeof ShiftType[keyof typeof ShiftType];

export interface PatrolLog {
  id: string;
  securityId: string;
  securityName: string;
  timestamp: string;
  checkpoint: string;
  status: 'OK' | 'WARNING' | 'DANGER';
  note?: string;
  photo?: string;
}

export interface IncidentReport {
  id: string;
  reporterId: string;
  reporterName: string;
  timestamp: string;
  type: string;
  description: string;
  location: string;
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  photo?: string;
}

export interface Resident {
  id: string;
  name: string;
  houseNumber: string;
  block: string;
  isHome: boolean;
  phoneNumber: string;
}

export interface GuestLog {
  id: string;
  name: string;
  visitToId: string;
  visitToName: string;
  purpose: string;
  entryTime: string;
  exitTime?: string;
  status: 'IN' | 'OUT';
  photo?: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  timestamp: string;
}

export interface SecurityLocation {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
}
