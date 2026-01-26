
import { User, Resident } from './types';

export const SECURITY_USERS: User[] = [
  { id: 'sec-1', name: 'Irwan', role: 'SECURITY' },
  { id: 'sec-2', name: 'Midin Edo', role: 'SECURITY' },
  { id: 'sec-3', name: 'Sudrajat', role: 'SECURITY' },
];

export const ADMIN_USERS: User[] = [
  { id: 'adm-1', name: 'Admin TKA', role: 'ADMIN' },
];

export const RESIDENT_USERS: User[] = [
  { id: 'res-1', name: 'Bpk. Budi', role: 'RESIDENT' },
  { id: 'res-2', name: 'Ibu Ani', role: 'RESIDENT' },
];

export const MOCK_RESIDENTS: Resident[] = [
  { id: 'r1', name: 'Bpk. Budi', houseNumber: 'A1', block: 'A', isHome: true, phoneNumber: '0812-3456-7890' },
  { id: 'r2', name: 'Ibu Ani', houseNumber: 'A2', block: 'A', isHome: false, phoneNumber: '0812-9999-8888' },
  { id: 'r3', name: 'Sdr. Rizky', houseNumber: 'B5', block: 'B', isHome: true, phoneNumber: '0813-1111-2222' },
  { id: 'r4', name: 'Keluarga Hartono', houseNumber: 'C10', block: 'C', isHome: true, phoneNumber: '0811-3333-4444' },
  { id: 'r5', name: 'Ibu Maria', houseNumber: 'D2', block: 'D', isHome: false, phoneNumber: '0852-5555-6666' },
];

export const CHECKPOINTS = [
  'Gerbang Utama',
  'Pos Satpam Blok A',
  'Taman Bermain Blok B',
  'Pojok Belakang Blok C',
  'Pos Satpam Blok D',
  'Area Clubhouse'
];
