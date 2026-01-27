
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

export const BLOCKS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'
];

export const MOCK_RESIDENTS: Resident[] = [
  { id: 'r1', name: 'Bpk. Budi', houseNumber: '10', block: 'A1', isHome: true, phoneNumber: '0812-3456-7890' },
  { id: 'r2', name: 'Ibu Ani', houseNumber: '05', block: 'A2', isHome: false, phoneNumber: '0812-9999-8888' },
  { id: 'r3', name: 'Sdr. Rizky', houseNumber: '22', block: 'B5', isHome: true, phoneNumber: '0813-1111-2222' },
  { id: 'r4', name: 'Keluarga Hartono', houseNumber: '11', block: 'C8', isHome: true, phoneNumber: '0811-3333-4444' },
];

export const CHECKPOINTS = [
  'Gerbang Utama',
  'Pos Satpam Blok A',
  'Taman Bermain Blok B',
  'Pojok Belakang Blok C',
  'Pos Satpam Blok D',
  'Area Clubhouse'
];
