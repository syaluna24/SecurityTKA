
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  SECURITY_USERS as INITIAL_SECURITY, 
  ADMIN_USERS, 
  BLOCKS,
  CHECKPOINTS as INITIAL_CHECKPOINTS,
  MOCK_RESIDENTS,
  MOCK_INCIDENTS,
  MOCK_GUESTS
} from './constants.tsx';
import { User, PatrolLog, IncidentReport, Resident, GuestLog, ChatMessage, UserRole } from './types.ts';
import Layout from './components/Layout.tsx';
import { 
  Shield, Search, Send, Users, MapPin, X, AlertTriangle, 
  ArrowRight, CheckCircle, Edit2, Plus, Home, 
  Activity, MessageSquare, Radio, LogOut, Camera, Trash2, UserCheck, RefreshCw, Ghost, PhoneCall, ArrowLeftRight, ClipboardCheck, BookOpen, Globe, Wifi, Link, Cpu, Clock
} from 'lucide-react';
import { getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell, XAxis } from 'recharts';
import { db } from './lib/db.ts';

const App: React.FC = () => {
  // --- REAL-TIME DATABASE STATES ---
  const [residents, setResidents] = useState<Resident[]>(MOCK_RESIDENTS);
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>(MOCK_INCIDENTS);
  const [guests, setGuests] = useState<GuestLog[]>(MOCK_GUESTS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [staff] = useState<User[]>(INITIAL_SECURITY);

  // --- UI & SYNC STATES ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginSearch, setLoginSearch] = useState('');
  const [loginError, setLoginError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'CONNECTED'>('CONNECTED');
  const [lastSyncText, setLastSyncText] = useState<string>('Baru saja');
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'GUEST' | 'INCIDENT' | 'PATROL_REPORT' | 'CONNECT' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');
  const [clusterCode, setClusterCode] = useState(db.getCluster());

  // --- FORM STATES ---
  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '', photo: '' });
  const [incForm, setIncForm] = useState<Partial<IncidentReport>>({ type: 'Pencurian', location: '', description: '', severity: 'MEDIUM', photo: '' });
  const [patrolAction, setPatrolAction] = useState<{cp: string, status: 'OK' | 'WARNING' | 'DANGER'}>({ cp: '', status: 'OK' });
  const [patrolData, setPatrolData] = useState({ note: '', photo: '' });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- SINKRONISASI OTOMATIS (Sistem Polling Agresif 3s) ---
  const syncWithCloud = async (silent = true) => {
    if (!silent) setSyncStatus('SYNCING');
    try {
      const global = await db.fetch();
      setResidents(global.residents);
      setPatrolLogs(global.patrolLogs);
      setIncidents(global.incidents);
      setGuests(global.guests);
      setChatMessages(global.chatMessages);
      
      setSyncStatus('CONNECTED');
      setLastSyncText(new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}));
    } catch (e) {
      console.error("Cloud offline");
    }
  };

  useEffect(() => {
    syncWithCloud(false);
    const interval = setInterval(() => syncWithCloud(true), 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentUser) {
      const hour = new Date().getHours();
      const shift = hour >= 7 && hour < 19 ? 'Pagi' : 'Malam';
      getSecurityBriefing(shift).then(setSecurityBriefing);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // --- HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const isValid = loginTab === 'ADMIN' ? passwordInput === 'admin123' : passwordInput === '1234';
    if (isValid) setCurrentUser({ ...selectedUser, role: loginTab as UserRole });
    else setLoginError('PIN Salah. Satpam: 1234, Admin: admin123');
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.connect(clusterCode);
    setIsModalOpen(null);
  };

  const handleResidentStatus = async (id: string, isHome: boolean) => {
    await db.resident.update(id, { isHome });
    syncWithCloud();
  };

  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingItem ? editingItem.id : `r-${Date.now()}`;
    if (editingItem) await db.resident.update(id, resForm);
    else await db.resident.create({ ...resForm, id });
    setIsModalOpen(null);
    syncWithCloud();
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = residents.find(r => r.id === guestForm.visitToId);
    await db.guest.create({
      ...guestForm,
      id: `g-${Date.now()}`,
      visitToName: res ? `${res.name} (${res.block}-${res.houseNumber})` : 'Umum',
      entryTime: new Date().toISOString(),
      status: 'IN'
    });
    setIsModalOpen(null);
    syncWithCloud();
  };

  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.incident.create({
      ...incForm,
      id: `inc-${Date.now()}`,
      reporterId: currentUser?.id || 'sys',
      reporterName: currentUser?.name || 'Petugas',
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    });
    setIsModalOpen(null);
    syncWithCloud();
  };

  const handlePatrolReport = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.patrol.create({
      id: `p-${Date.now()}`,
      securityId: currentUser?.id || 'sec',
      securityName: currentUser?.name || 'Petugas',
      timestamp: new Date().toISOString(),
      checkpoint: patrolAction.cp,
      status: patrolAction.status,
      note: patrolData.note,
      photo: patrolData.photo
    });
    setIsModalOpen(null);
    syncWithCloud();
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    await db.chat.create({
      id: `chat-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: chatInput,
      timestamp: new Date().toISOString()
    });
    setChatInput('');
    syncWithCloud();
  };

  // --- AGGREGATED VIEWS ---
  const globalTimeline = useMemo(() => {
    const list = [
      ...patrolLogs.map(p => ({ ...p, type: 'PATROL', time: p.timestamp, title: `Patroli: ${p.checkpoint}`, color: 'slate' })),
      ...incidents.map(i => ({ ...i, type: 'INCIDENT', time: i.timestamp, title: `Insiden: ${i.type}`, color: 'red' })),
      ...guests.map(g => ({ ...g, type: 'GUEST', time: g.entryTime, title: `Tamu: ${g.name}`, color: 'blue' }))
    ];
    return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 30);
  }, [patrolLogs, incidents, guests]);

  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? staff : loginTab === 'ADMIN' ? ADMIN_USERS : residents.map(r => ({ id: r.id, name: r.name, sub: `${r.block}-${r.houseNumber}` }));
    const filtered = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()));

    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[900px] flex flex-col md:flex-row rounded-[3.5rem] shadow-2xl overflow-hidden animate-slide-up">
          <div className="w-full md:w-5/12 bg-slate-900 p-10 lg:p-14 text-white flex flex-col justify-between relative">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px]"></div>
            <div className="relative z-10">
              <div className="bg-amber-500 w-16 h-16 rounded-[1.8rem] flex items-center justify-center mb-10 shadow-2xl shadow-amber-500/20">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-3xl lg:text-4xl font-black mb-6 tracking-tighter italic uppercase leading-none">TKA SECURE <br/><span className="text-amber-500 not-italic text-2xl font-light tracking-[0.2em] leading-none uppercase">Cloud Hub</span></h1>
              <p className="text-slate-400 text-sm italic font-medium leading-relaxed">Sistem Terintegrasi Nyata. Hubungkan HP & Laptop dengan Kode Cluster yang sama.</p>
            </div>
            <div className="p-6 bg-white/5 rounded-3xl border border-white/10 relative z-10 backdrop-blur-md">
               <div className="flex items-center gap-3 mb-2">
                  <Globe size={18} className="text-amber-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Global Connection</span>
               </div>
               <p className="text-xs font-black text-white italic truncate">{db.getCluster()}</p>
               <button onClick={() => setIsModalOpen('CONNECT')} className="mt-4 text-[9px] font-black text-amber-500 uppercase tracking-widest hover:underline flex items-center gap-2">Ganti Cluster <RefreshCw size={12}/></button>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 lg:p-16 flex flex-col bg-white overflow-y-auto max-h-[850px] no-scrollbar">
            <h2 className="text-2xl font-black text-slate-900 mb-10 uppercase italic leading-none">Portal Login</h2>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-10">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); }}
                  className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="relative mb-8">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input type="text" placeholder={`Cari nama...`}
                className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-500 outline-none font-bold text-sm shadow-inner transition-all"
                value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto mb-8 space-y-3 no-scrollbar min-h-[250px]">
              {filtered.map((u: any) => (
                <button key={u.id} onClick={() => { setSelectedUser(u); setLoginError(''); }}
                  className={`w-full flex items-center gap-5 p-5 rounded-3xl border-2 transition-all duration-300 ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50 shadow-xl scale-[1.02]' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-900 text-base truncate uppercase leading-none mb-1.5">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">{u.sub || 'Authorized Personnel'}</p>
                  </div>
                </button>
              ))}
            </div>
            {selectedUser && (
              <form onSubmit={handleLogin} className="pt-8 border-t border-slate-100 space-y-5 animate-slide-up">
                <input type="password" required placeholder="PIN"
                  className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-3xl tracking-[0.5em] text-center" 
                  value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                {loginError && <p className="text-red-500 text-[10px] font-black text-center uppercase italic">{loginError}</p>}
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 active:scale-95 transition-all">
                  MASUK SISTEM <ArrowRight size={20} />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Pairing Perangkat */}
        {isModalOpen === 'CONNECT' && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-xl">
              <div className="bg-white w-full max-w-md rounded-[3rem] p-12 animate-slide-up border border-white/20 shadow-[0_0_100px_rgba(245,158,11,0.2)]">
                 <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase italic leading-none">Cloud Pairing</h3>
                 <p className="text-sm text-slate-500 mb-10 font-medium">Masukkan Kode Cluster yang sama di HP & Laptop agar data tersinkronisasi.</p>
                 <form onSubmit={handleConnect} className="space-y-8">
                    <input type="text" required className="w-full p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 font-black text-center text-xl uppercase tracking-widest focus:border-amber-500 outline-none" 
                      value={clusterCode} onChange={e => setClusterCode(e.target.value)} placeholder="KODE CLUSTER" />
                    <button type="submit" className="w-full bg-amber-500 text-slate-900 font-black py-6 rounded-3xl uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all">SINKRONKAN SEKARANG</button>
                    <button type="button" onClick={() => setIsModalOpen(null)} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">BATAL</button>
                 </form>
              </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={() => setCurrentUser(null)} activeTab={activeTab} setActiveTab={setActiveTab}>
      
      {/* 1. DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-10 animate-slide-up pb-10">
          {/* Status Sinkronisasi Global */}
          <div className="bg-white p-8 lg:p-12 rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-10 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] group-hover:bg-amber-500/10 transition-all"></div>
             <div className="flex items-center gap-8 relative z-10 w-full lg:w-auto">
                <div className={`w-20 h-20 rounded-[2.2rem] flex items-center justify-center shadow-2xl transition-all duration-1000 ${syncStatus === 'SYNCING' ? 'bg-slate-200 animate-pulse' : 'bg-slate-900 shadow-slate-900/30'}`}>
                   <Globe size={40} className={`${syncStatus === 'SYNCING' ? 'text-slate-400' : 'text-amber-500 animate-pulse'}`} />
                </div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none mb-3">TKA Global Sync</h3>
                   <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${syncStatus === 'CONNECTED' ? 'bg-green-500 animate-ping' : 'bg-amber-500'}`}></span>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">{db.getCluster()} • ONLINE</p>
                   </div>
                </div>
             </div>
             <div className="flex items-center gap-10 w-full lg:w-auto justify-end relative z-10">
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Update Terakhir</p>
                   <p className="text-slate-900 font-black text-base italic tabular-nums">{lastSyncText}</p>
                </div>
                <div className="h-12 w-px bg-slate-100 hidden lg:block"></div>
                <button onClick={() => setIsModalOpen('CONNECT')} className="px-8 py-5 bg-slate-900 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-2xl flex items-center gap-4 active:scale-95 hover:bg-slate-800 transition-all">
                   <Wifi size={20}/> PAIRING HP
                </button>
             </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Security Shift', val: staff.length, icon: <UserCheck size={28}/>, color: 'blue' },
              { label: 'Laporan Open', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={28}/>, color: 'red' },
              { label: 'Tamu Aktif', val: guests.filter(g => g.status === 'IN').length, icon: <Users size={28}/>, color: 'amber' },
              { label: 'Data Unit', val: residents.length, icon: <Home size={28}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-8 lg:p-10 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-2xl transition-all duration-500 group">
                <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h4 className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1 leading-none">{s.label}</h4>
                <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
             <div className="lg:col-span-2 bg-white p-10 lg:p-14 rounded-[4rem] shadow-sm border border-slate-100 min-h-[450px]">
                <h3 className="text-xl font-black text-slate-900 mb-12 uppercase italic flex items-center gap-5"><Activity className="text-amber-500 animate-pulse"/> Analisis Aktivitas Cloud</h3>
                <div className="h-[320px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{name: 'Patroli', val: patrolLogs.length}, {name: 'Tamu', val: guests.length}, {name: 'Lapor', val: incidents.length}]}>
                         <XAxis dataKey="name" hide />
                         <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)'}} />
                         <Bar dataKey="val" radius={[12, 12, 12, 12]} barSize={70}>
                            {[0, 1, 2].map((_, i) => <Cell key={i} fill={['#3B82F6', '#F59E0B', '#EF4444'][i]} />)}
                         </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
             <div className="bg-slate-900 text-white p-12 lg:p-14 rounded-[4rem] shadow-[0_30px_60px_-15px_rgba(15,23,42,0.5)] relative overflow-hidden flex flex-col justify-between group">
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                <div className="relative z-10">
                   <div className="bg-amber-500 w-16 h-16 rounded-[1.8rem] flex items-center justify-center mb-10 shadow-2xl shadow-amber-500/20 animate-pulse">
                      <Cpu size={32} className="text-slate-900" />
                   </div>
                   <h3 className="text-3xl font-black uppercase italic mb-6 tracking-tight leading-none">Security Briefing</h3>
                   <p className="text-slate-400 text-base italic leading-relaxed font-medium">"{securityBriefing}"</p>
                </div>
                <button onClick={() => setActiveTab('chat')} className="w-full bg-white text-slate-900 font-black py-6 rounded-3xl uppercase text-xs tracking-[0.2em] active:scale-95 transition-all mt-14 shadow-2xl hover:bg-amber-500 hover:text-white">KOORDINASI TIM <ArrowRight size={20} className="inline ml-3"/></button>
             </div>
          </div>
        </div>
      )}

      {/* 2. CEK UNIT (STATUS WARGA) */}
      {activeTab === 'log_resident' && (
        <div className="space-y-10 animate-slide-up pb-24">
           <h3 className="text-3xl font-black text-slate-900 uppercase italic leading-none">Status Hunian Real-time</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {residents.map(res => (
                <div key={res.id} className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-2xl transition-all duration-500">
                   <div>
                      <div className="flex justify-between items-start mb-8">
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center font-black text-base group-hover:bg-amber-500 transition-colors shadow-2xl">{res.block}</div>
                        <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{res.isHome ? 'DI UNIT' : 'KELUAR'}</span>
                      </div>
                      <h4 className="font-black text-slate-900 uppercase italic truncate text-xl mb-1 leading-none">{res.name}</h4>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Unit: {res.block}-{res.houseNumber}</p>
                   </div>
                   <button onClick={() => handleResidentStatus(res.id, !res.isHome)} className={`w-full mt-10 py-5 rounded-[2rem] font-black text-[11px] uppercase flex items-center justify-center gap-4 active:scale-95 transition-all shadow-xl ${res.isHome ? 'bg-slate-900 text-white' : 'bg-green-600 text-white'}`}>
                      {res.isHome ? <ArrowLeftRight size={20}/> : <CheckCircle size={20}/>} {res.isHome ? 'CATAT KELUAR' : 'KONFIRMASI MASUK'}
                   </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* 3. PATROLI */}
      {activeTab === 'patrol' && (
        <div className="space-y-10 animate-slide-up pb-20">
           <h3 className="text-3xl font-black text-slate-900 uppercase italic leading-none">Control Checkpoints</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {INITIAL_CHECKPOINTS.map((cp, idx) => {
                const last = patrolLogs.find(l => l.checkpoint === cp);
                return (
                  <div key={idx} className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-2xl transition-all duration-500">
                    <div>
                      <div className="flex justify-between items-start mb-12">
                        <div className="w-20 h-20 rounded-[2.2rem] bg-slate-900 text-white flex items-center justify-center font-black text-3xl group-hover:bg-amber-500 transition-colors shadow-2xl shadow-slate-900/20">{idx + 1}</div>
                        {last && <span className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest ${last.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{last.status}</span>}
                      </div>
                      <h4 className="text-2xl font-black text-slate-900 mb-12 uppercase italic leading-none tracking-tight">{cp}</h4>
                    </div>
                    {currentUser.role === 'SECURITY' ? (
                      <div className="grid grid-cols-2 gap-5">
                        <button onClick={() => { setPatrolAction({cp, status: 'OK'}); setIsModalOpen('PATROL_REPORT'); }} className="py-6 bg-green-600 text-white rounded-3xl font-black text-xs uppercase shadow-2xl active:scale-95">AMAN</button>
                        <button onClick={() => { setPatrolAction({cp, status: 'DANGER'}); setIsModalOpen('PATROL_REPORT'); }} className="py-6 bg-red-600 text-white rounded-3xl font-black text-xs uppercase shadow-2xl active:scale-95">BAHAYA</button>
                      </div>
                    ) : (
                      <div className="text-[11px] font-black text-slate-400 uppercase border-t pt-8 tracking-[0.1em] italic truncate leading-none">Update: {last ? `${last.securityName} (${new Date(last.timestamp).toLocaleTimeString()})` : 'Belum Ada Laporan'}</div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* 4. FEED (TIMELINE GLOBAL) */}
      {activeTab === 'reports' && (
        <div className="space-y-10 animate-slide-up pb-20">
           <h3 className="text-3xl font-black text-slate-900 uppercase italic leading-none">Global Activity Feed</h3>
           <div className="bg-white p-8 lg:p-16 rounded-[4.5rem] shadow-sm border border-slate-100">
              <div className="space-y-14">
                {globalTimeline.length > 0 ? globalTimeline.map((item: any, idx) => (
                  <div key={idx} className="flex gap-8 lg:gap-14 group animate-slide-up" style={{animationDelay: `${idx * 0.05}s`}}>
                     <div className="flex flex-col items-center">
                        <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-2xl transition-all group-hover:scale-110 ${item.color === 'slate' ? 'bg-slate-900 text-white' : item.color === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                           {item.type === 'PATROL' ? <ClipboardCheck size={28}/> : item.type === 'INCIDENT' ? <AlertTriangle size={28}/> : <BookOpen size={28}/>}
                        </div>
                        <div className="w-1 flex-1 bg-slate-50 mt-8 group-last:hidden"></div>
                     </div>
                     <div className="flex-1 pb-14 border-b border-slate-50 last:border-none">
                        <div className="flex justify-between items-center mb-4">
                           <h4 className="font-black text-slate-900 text-lg lg:text-xl uppercase italic leading-none">{item.title}</h4>
                           <span className="text-xs font-black text-slate-300 uppercase tracking-widest tabular-nums">{new Date(item.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-base lg:text-lg text-slate-500 font-medium mb-8 italic leading-relaxed">
                          {item.type === 'PATROL' ? `Status: ${item.status}. ${item.note || ''}` : item.type === 'INCIDENT' ? item.description : `Tujuan Unit: ${item.visitToName}. Keperluan: ${item.purpose}`}
                        </p>
                        {item.photo && <img src={item.photo} alt="Proof" className="mb-8 rounded-[2.5rem] w-full max-w-lg border border-slate-100 shadow-2xl" />}
                        <div className="flex flex-wrap gap-4">
                           <span className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest ${item.status === 'OK' || item.status === 'RESOLVED' || item.status === 'IN' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{item.status || 'LOGGED'}</span>
                           <span className="px-5 py-2.5 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3"><Clock size={14}/> Petugas: {item.securityName || item.reporterName}</span>
                        </div>
                     </div>
                  </div>
                )) : (
                   <div className="py-40 text-center opacity-40 italic">
                      <Ghost size={80} className="mx-auto mb-8" />
                      <p className="font-black uppercase tracking-[0.5em] text-xs">Menunggu Sinkronisasi Awan...</p>
                   </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* --- ALL MODALS (Cloud Connected) --- */}
      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-[0_0_100px_rgba(37,99,235,0.2)] animate-slide-up overflow-hidden">
            <div className="p-10 lg:p-12 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic leading-none">Register Tamu</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={32}/></button>
            </div>
            <form onSubmit={handleSaveGuest} className="p-10 lg:p-14 space-y-8">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-8 py-6 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-600 transition-all text-lg shadow-inner" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-8 py-6 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-600 text-lg" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                 <option value="">Pilih Tujuan Unit...</option>
                 {residents.map(r => <option key={r.id} value={r.id}>{r.name} ({r.block}-{r.houseNumber})</option>)}
              </select>
              <textarea required placeholder="Keperluan Kunjungan..." className="w-full px-8 py-6 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-600 min-h-[160px] text-lg shadow-inner" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">SINKRONISASI CHECK-IN</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-[0_0_100px_rgba(220,38,38,0.2)] animate-slide-up overflow-hidden">
            <div className="p-10 lg:p-12 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic leading-none">Lapor Kejadian</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={32}/></button>
            </div>
            <form onSubmit={handleSaveIncident} className="p-10 lg:p-14 space-y-8">
              <select className="w-full px-8 py-6 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none text-lg" value={incForm.type} onChange={e => setIncForm({...incForm, type: e.target.value})}>
                 <option value="Pencurian">Pencurian</option>
                 <option value="Kebakaran">Kebakaran</option>
                 <option value="Keributan">Keributan</option>
                 <option value="Lainnya">Lainnya</option>
              </select>
              <input type="text" required placeholder="Lokasi Spesifik..." className="w-full px-8 py-6 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none text-lg shadow-inner" value={incForm.location} onChange={e => setIncForm({...incForm, location: e.target.value})} />
              <textarea required placeholder="Deskripsi Kejadian Lengkap..." className="w-full px-8 py-6 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none min-h-[160px] text-lg shadow-inner" value={incForm.description} onChange={e => setIncForm({...incForm, description: e.target.value})} />
              <div className="flex gap-4">
                 {(['LOW', 'MEDIUM', 'HIGH'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setIncForm({...incForm, severity: s})} className={`flex-1 py-5 rounded-2xl font-black text-[10px] border-2 transition-all ${incForm.severity === s ? 'bg-slate-900 text-white border-slate-900 shadow-2xl' : 'bg-white text-slate-400 border-slate-100'}`}>{s}</button>
                 ))}
              </div>
              <button type="submit" className="w-full py-6 bg-red-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">KIRIM KE PUSAT (CLOUD)</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'PATROL_REPORT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-10 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-2xl font-black uppercase leading-none italic">{patrolAction.cp}</h3>
                <p className="text-[10px] font-black uppercase opacity-70 mt-2 tracking-widest italic leading-none">Vercel Digital Log</p>
              </div>
              <button onClick={() => setIsModalOpen(null)}><X size={32}/></button>
            </div>
            <form onSubmit={handlePatrolReport} className="p-10 lg:p-14 space-y-10">
              <div className="space-y-4">
                 <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">Bukti Foto Lokasi:</label>
                 <div className="flex flex-col gap-6">
                    {patrolData.photo ? (
                      <div className="relative group">
                         <img src={patrolData.photo} alt="Preview" className="w-full h-56 lg:h-72 object-cover rounded-[3rem] border-2 border-slate-100 shadow-2xl" />
                         <button type="button" onClick={() => setPatrolData(prev => ({ ...prev, photo: '' }))} className="absolute top-6 right-6 p-4 bg-red-600 text-white rounded-2xl shadow-2xl active:scale-90 transition-all"><Trash2 size={24}/></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-56 lg:h-72 rounded-[3rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-6 text-slate-400 hover:border-slate-400 transition-all shadow-inner group">
                         <Camera size={64} className="group-hover:scale-110 transition-transform" />
                         <span className="font-black text-[11px] uppercase tracking-widest italic">AKTIFKAN KAMERA LAPANGAN</span>
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const reader = new FileReader();
                         reader.onloadend = () => setPatrolData(p => ({ ...p, photo: reader.result as string }));
                         reader.readAsDataURL(file);
                       }
                    }} />
                 </div>
              </div>
              <textarea required placeholder="Tuliskan catatan kondisi area..." className="w-full px-8 py-6 rounded-[2rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-base min-h-[160px] focus:border-slate-900 shadow-inner" value={patrolData.note} onChange={e => setPatrolData({...patrolData, note: e.target.value})} />
              <button type="submit" className={`w-full py-6 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest active:scale-95 transition-all shadow-2xl ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>SIMPAN & SINKRON CLOUD</button>
            </form>
          </div>
        </div>
      )}

      {/* Database Master Warga */}
      {activeTab === 'residents' && (
        <div className="space-y-10 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-3xl font-black text-slate-900 uppercase italic leading-none">Database Master Warga</h3>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white p-5 rounded-2xl shadow-2xl active:scale-95 transition-all"><Plus size={28}/></button>
              )}
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {residents.map(res => (
                <div key={res.id} className="bg-white p-10 rounded-[4rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-2xl transition-all duration-500">
                   <div>
                      <div className="flex justify-between items-start mb-10">
                        <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.8rem] flex items-center justify-center font-black text-xl group-hover:bg-amber-500 transition-colors shadow-2xl shadow-slate-900/10">{res.block}</div>
                        <span className="text-[10px] font-black text-slate-300 uppercase italic">NODE: {res.id.slice(0,5)}</span>
                      </div>
                      <h4 className="font-black text-slate-900 uppercase italic truncate text-xl mb-1.5 leading-none tracking-tight">{res.name}</h4>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-10 leading-none">Blok {res.block} No {res.houseNumber}</p>
                   </div>
                   <div className="flex gap-3">
                      <a href={`tel:${res.phoneNumber}`} className="flex-1 py-5 bg-slate-50 text-slate-900 rounded-3xl flex items-center justify-center gap-3 font-black text-[10px] uppercase hover:bg-green-600 hover:text-white transition-all shadow-sm"><PhoneCall size={18}/> HUBUNGI</a>
                      {currentUser.role === 'ADMIN' && (
                        <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-5 bg-slate-100 text-slate-400 hover:text-blue-600 rounded-3xl transition-all"><Edit2 size={18}/></button>
                      )}
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Modal Warga */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 lg:p-12 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic leading-none">{editingItem ? 'Update Warga' : 'Tambah Unit'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={32}/></button>
            </div>
            <form onSubmit={handleSaveResident} className="p-10 lg:p-14 space-y-8">
              <input type="text" required placeholder="Nama Lengkap Pemilik..." className="w-full px-8 py-6 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-lg focus:border-slate-900 shadow-inner" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-5">
                 <select className="w-full px-6 py-6 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base" value={resForm.block} onChange={e => setResForm({...resForm, block: e.target.value})}>
                    {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                 </select>
                 <input type="text" required placeholder="No. Rumah" className="w-full px-6 py-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-slate-900 outline-none font-bold text-base shadow-inner" value={resForm.houseNumber} onChange={e => setResForm({...resForm, houseNumber: e.target.value})} />
              </div>
              <input type="text" required placeholder="WhatsApp (08...)" className="w-full px-8 py-6 rounded-2xl bg-slate-50 outline-none font-bold text-base border-2 border-slate-100 focus:border-slate-900 shadow-inner" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all">SINKRONISASI DATABASE</button>
            </form>
          </div>
        </div>
      )}

      {/* Obrolan Tim (Chat) */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-230px)] flex flex-col animate-slide-up pb-10">
           <div className="flex-1 bg-white rounded-t-[4rem] shadow-sm border border-slate-100 overflow-y-auto p-8 lg:p-12 space-y-10 no-scrollbar relative">
              <div className="sticky top-0 z-10 text-center mb-12">
                 <span className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase px-8 py-3 rounded-full border border-slate-100 tracking-widest italic backdrop-blur-md">Saluran Koordinasi Cluster</span>
              </div>
              {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                   <div className={`max-w-[85%] p-7 rounded-[3rem] relative shadow-sm transition-transform hover:scale-[1.01] ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-8 mb-3">
                         <span className={`text-[11px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                         <span className="text-[9px] font-bold px-3 py-1 bg-white/10 rounded-full uppercase opacity-40 italic">{msg.senderRole}</span>
                      </div>
                      <p className="text-base lg:text-lg font-medium leading-relaxed">{msg.text}</p>
                      <p className={`text-[9px] mt-4 opacity-30 text-right font-black uppercase tracking-widest tabular-nums`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : (
                 <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale italic">
                    <MessageSquare size={80} className="mb-10" />
                    <p className="font-black uppercase tracking-[0.5em] text-xs">Obrolan Tim Akan Tersinkron</p>
                 </div>
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={handleSendChat} className="bg-white p-8 rounded-b-[4rem] border-t border-slate-100 flex gap-5 shadow-2xl items-center sticky bottom-0">
              <input type="text" placeholder="Ketik pesan koordinasi..." className="flex-1 px-10 py-6 rounded-[2.5rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 transition-all shadow-inner" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-6 rounded-3xl active:scale-95 shadow-2xl hover:bg-slate-800 transition-all"><Send size={30}/></button>
           </form>
        </div>
      )}

      {/* Pengaturan & Reset */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto space-y-10 animate-slide-up pb-20">
           <h3 className="text-3xl font-black text-slate-900 uppercase italic leading-none">Konfigurasi Cloud Bridge</h3>
           <div className="bg-white p-12 lg:p-16 rounded-[4.5rem] shadow-sm border border-slate-100 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-28 bg-slate-900"></div>
              <div className="relative mt-6">
                 <div className="w-36 h-36 bg-amber-500 text-slate-900 rounded-[3.5rem] flex items-center justify-center font-black text-6xl mx-auto mb-10 shadow-2xl border-[8px] border-white">{currentUser.name.charAt(0)}</div>
              </div>
              <h3 className="text-4xl font-black text-slate-900 uppercase italic mb-2 leading-none tracking-tight">{currentUser.name}</h3>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-14 italic leading-none">Cluster: {db.getCluster()} • Vercel Bridge Active</p>
              <div className="space-y-5">
                 <button onClick={() => setIsModalOpen('CONNECT')} className="w-full py-7 bg-slate-900 text-amber-500 rounded-[2.5rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-5 active:scale-95 transition-all"><Wifi size={24}/> GANTI CLUSTER (SINKRON HP)</button>
                 <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-7 bg-slate-100 text-slate-400 rounded-[2.5rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-5 active:scale-95 transition-all"><Trash2 size={24}/> RESET SISTEM LOKAL</button>
                 <button onClick={() => setCurrentUser(null)} className="w-full py-7 bg-red-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-5 active:scale-95 transition-all"><LogOut size={24}/> LOGOUT</button>
              </div>
           </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
