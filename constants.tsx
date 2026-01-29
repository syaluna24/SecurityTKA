
import { User, Resident, IncidentReport, GuestLog } from './types';

export const SECURITY_USERS: User[] = [
  { id: 'sec-1', name: 'Irwan', role: 'SECURITY', phoneNumber: '08123456701' },
  { id: 'sec-2', name: 'Midin Edo', role: 'SECURITY', phoneNumber: '08123456702' },
  { id: 'sec-3', name: 'Sudrajat', role: 'SECURITY', phoneNumber: '08123456703' },
];

export const ADMIN_USERS: User[] = [
  { id: 'adm-1', name: 'Admin TKA', role: 'ADMIN' },
];

// Blok sesuai permintaan: A1-A11, B1-B6, C1-C8
export const BLOCKS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'
];

export const MOCK_RESIDENTS: Resident[] = [
  { id: 'r1', name: 'Bpk. Budi', houseNumber: '01', block: 'A1', isHome: true, phoneNumber: '0812-3456-7890' },
  { id: 'r2', name: 'Ibu Ani', houseNumber: '05', block: 'B2', isHome: false, phoneNumber: '0812-9999-8888' },
  { id: 'r3', name: 'Sdr. Rizky', houseNumber: '10', block: 'C8', isHome: true, phoneNumber: '0813-1111-2222' },
];

export const MOCK_INCIDENTS: IncidentReport[] = [
  { 
    id: 'inc-1', 
    reporterId: 'r1', 
    reporterName: 'Bpk. Budi', 
    timestamp: new Date().toISOString(), 
    type: 'Pencurian', 
    location: 'Blok A1 No 01', 
    description: 'Kehilangan sepeda di depan pagar.', 
    status: 'PENDING', 
    severity: 'MEDIUM' 
  }
];

export const MOCK_GUESTS: GuestLog[] = [
  {
    id: 'g1',
    name: 'Bpk. Slamet',
    visitToId: 'r1',
    visitToName: 'Bpk. Budi (A1-01)',
    purpose: 'Antar Paket',
    entryTime: new Date().toISOString(),
    status: 'IN'
  }
];

export const CHECKPOINTS = [
  'Gerbang Utama',
  'Pos Satpam Blok A',
  'Pos Satpam Blok B',
  'Taman Bermain C',
  'Pojok Belakang C8',
  'Pintu Keluar Darurat'
];
