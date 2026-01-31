
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
  UserPlus, ArrowRight, CheckCircle, Edit2, Plus, Home, 
  Activity, MessageSquare, Radio, LogOut, Camera, Trash2, UserCheck, RefreshCw, Ghost, PhoneCall, ArrowLeftRight, ClipboardCheck, BookOpen, Settings, Clock, Wifi, Globe, Link, Cpu
} from 'lucide-react';
import { getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell, XAxis } from 'recharts';
import { db } from './lib/db.ts';

const App: React.FC = () => {
  // --- DATABASE STATES ---
  const [residents, setResidents] = useState<Resident[]>(MOCK_RESIDENTS);
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>(MOCK_INCIDENTS);
  const [guests, setGuests] = useState<GuestLog[]>(MOCK_GUESTS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [staff] = useState<User[]>(INITIAL_SECURITY);

  // --- UI STATES ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginSearch, setLoginSearch] = useState('');
  const [loginError, setLoginError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'CONNECTED'>('CONNECTED');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Baru saja');
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'GUEST' | 'INCIDENT' | 'PATROL_REPORT' | 'PAIRING' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');
  const [pairingCode, setPairingCode] = useState(db.getCluster());

  // --- FORM STATES ---
  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '', photo: '' });
  const [incForm, setIncForm] = useState<Partial<IncidentReport>>({ type: 'Pencurian', location: '', description: '', severity: 'MEDIUM', photo: '' });
  const [patrolAction, setPatrolAction] = useState<{cp: string, status: 'OK' | 'WARNING' | 'DANGER'}>({ cp: '', status: 'OK' });
  const [patrolReportData, setPatrolReportData] = useState({ note: '', photo: '' });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- GLOBAL SYNC ENGINE ( Laptop <-> Handphone ) ---
  const syncGlobalData = async (silent = true) => {
    if (!silent) setSyncStatus('SYNCING');
    try {
      const globalDb = await db.fetchGlobal();
      setResidents(globalDb.residents);
      setPatrolLogs(globalDb.patrolLogs);
      setIncidents(globalDb.incidents);
      setGuests(globalDb.guests);
      setChatMessages(globalDb.chatMessages);
      
      setSyncStatus('CONNECTED');
      setLastSyncTime(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}));
    } catch (e) {
      console.error("Sync Failed", e);
    }
  };

  useEffect(() => {
    syncGlobalData(false);
    // Interval sinkronisasi sangat cepat (3 detik) agar terasa real-time antara Laptop & HP
    const interval = setInterval(() => syncGlobalData(true), 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentUser) {
      const hour = new Date().getHours();
      const shiftName = hour >= 7 && hour < 19 ? 'Pagi' : 'Malam';
      getSecurityBriefing(shiftName).then(setSecurityBriefing);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // --- HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const isAdmin = loginTab === 'ADMIN';
    const isValid = isAdmin ? passwordInput === 'admin123' : passwordInput === '1234';
    if (isValid) {
      setCurrentUser({ ...selectedUser, role: loginTab as UserRole });
    } else {
      setLoginError('PIN Salah. Satpam: 1234, Admin: admin123');
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncStatus('SYNCING');
    await db.connect(pairingCode);
    setIsModalOpen(null);
  };

  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingItem ? editingItem.id : `r-${Date.now()}`;
    if (editingItem) await db.resident.update(id, resForm);
    else await db.resident.create({ ...resForm, id });
    setIsModalOpen(null);
    syncGlobalData();
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    const resident = residents.find(r => r.id === guestForm.visitToId);
    await db.guest.create({
      ...guestForm,
      id: `g-${Date.now()}`,
      visitToName: resident ? `${resident.name} (${resident.block}-${resident.houseNumber})` : 'Umum',
      entryTime: new Date().toISOString(),
      status: 'IN'
    });
    setIsModalOpen(null);
    syncGlobalData();
  };

  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.incident.create({
      ...incForm,
      id: `inc-${Date.now()}`,
      reporterId: currentUser?.id || 'sys',
      reporterName: currentUser?.name || 'Sistem',
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    });
    setIsModalOpen(null);
    syncGlobalData();
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
      note: patrolReportData.note,
      photo: patrolReportData.photo
    });
    setIsModalOpen(null);
    syncGlobalData();
  };

  const handleStatusChange = async (id: string, isHome: boolean) => {
    await db.resident.update(id, { isHome });
    syncGlobalData();
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    const msg = {
      id: `chat-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: chatInput,
      timestamp: new Date().toISOString()
    };
    await db.chat.create(msg);
    setChatInput('');
    syncGlobalData();
  };

  // --- UI VIEWS ---
  const timelineFeed = useMemo(() => {
    const combined = [
      ...patrolLogs.map(p => ({ ...p, type: 'PATROL', time: p.timestamp, title: `Patroli: ${p.checkpoint}`, color: 'slate' })),
      ...incidents.map(i => ({ ...i, type: 'INCIDENT', time: i.timestamp, title: `Insiden: ${i.type}`, color: 'red' })),
      ...guests.map(g => ({ ...g, type: 'GUEST', time: g.entryTime, title: `Tamu: ${g.name}`, color: 'blue' }))
    ];
    return combined.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 25);
  }, [patrolLogs, incidents, guests]);

  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? staff : loginTab === 'ADMIN' ? ADMIN_USERS : residents.map(r => ({ id: r.id, name: r.name, sub: `${r.block}-${r.houseNumber}` }));
    const filtered = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()));

    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[900px] flex flex-col md:flex-row rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up border border-white/10">
          <div className="w-full md:w-5/12 bg-slate-900 p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="bg-amber-500 w-16 h-16 rounded-3xl flex items-center justify-center mb-10 shadow-2xl">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-3xl lg:text-4xl font-black mb-4 tracking-tighter italic uppercase leading-none">TKA SECURE <br/><span className="text-amber-500 not-italic text-2xl font-light tracking-widest leading-none">Global Sync</span></h1>
              <p className="text-slate-400 text-sm italic leading-relaxed font-medium">Sistem Terintegrasi Nyata. Hubungkan Laptop & HP Anda dengan kode Cluster yang sama.</p>
            </div>
            <div className="p-5 bg-white/5 rounded-2xl border border-white/10 relative z-10 backdrop-blur-sm">
               <div className="flex items-center gap-3 mb-2">
                  <Globe size={16} className="text-amber-500" />
                  <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest leading-none">Cloud Pairing Active</span>
               </div>
               <p className="text-xs font-black text-white italic">{db.getCluster()}</p>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 lg:p-14 flex flex-col bg-white overflow-y-auto max-h-[850px]">
            <h2 className="text-2xl font-black text-slate-900 mb-8 uppercase italic leading-none">Portal Akses</h2>
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-8">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); }}
                  className={`flex-1 py-3.5 text-[10px] font-black uppercase rounded-xl transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder={`Cari nama...`}
                className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-500 outline-none font-bold text-sm shadow-inner transition-all"
                value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto mb-6 space-y-2 no-scrollbar min-h-[250px]">
              {filtered.map((u: any) => (
                <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setLoginError(''); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50 shadow-lg' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-900 text-sm truncate uppercase leading-none mb-1">{u.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{u.sub || 'Authorized'}</p>
                  </div>
                </button>
              ))}
            </div>
            {selectedUser && (
              <form onSubmit={handleLogin} className="pt-6 border-t border-slate-100 space-y-4 animate-slide-up">
                <input type="password" required placeholder="PIN (4 DIGIT)"
                  className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-xl tracking-[0.5em] text-center" 
                  value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                {loginError && <p className="text-red-500 text-[10px] font-black text-center uppercase italic">{loginError}</p>}
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-4 text-[10px] uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all">
                  MASUK <ArrowRight size={18} />
                </button>
              </form>
            )}
            <button onClick={() => setIsModalOpen('PAIRING')} className="mt-6 text-[10px] font-black text-amber-600 uppercase tracking-widest hover:underline flex items-center justify-center gap-2"><Wifi size={14}/> SINKRONISASI CLUSTER</button>
          </div>
        </div>

        {/* Modal Pairing */}
        {isModalOpen === 'PAIRING' && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
              <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 animate-slide-up border border-white/20">
                 <h3 className="text-xl font-black text-slate-900 mb-2 uppercase italic leading-none">Sinkron Laptop & HP</h3>
                 <p className="text-sm text-slate-500 mb-8 font-medium">Masukkan Nama Perumahan yang sama di HP dan Laptop Anda.</p>
                 <form onSubmit={handleConnect} className="space-y-6">
                    <input type="text" required className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-black text-center text-lg focus:border-amber-500 outline-none" 
                      value={pairingCode} onChange={e => setPairingCode(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="MISAL: TKA-SHIFT-1" />
                    <button type="submit" className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">SAMBUNGKAN SEKARANG</button>
                 </form>
                 <button onClick={() => setIsModalOpen(null)} className="w-full mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">BATAL</button>
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
        <div className="space-y-8 animate-slide-up pb-10">
          {/* Cloud Sync Status Visualization */}
          <div className="bg-white p-6 lg:p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all"></div>
             <div className="flex items-center gap-6 relative z-10 w-full lg:w-auto">
                <div className={`w-16 h-16 rounded-[1.8rem] flex items-center justify-center shadow-2xl transition-all duration-700 ${syncStatus === 'SYNCING' ? 'bg-slate-200 animate-spin' : 'bg-slate-900 shadow-slate-900/20'}`}>
                   <Globe size={32} className={`${syncStatus === 'SYNCING' ? 'text-slate-400' : 'text-amber-500 animate-pulse'}`} />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase italic leading-none mb-2">Global Cloud Bridge</h3>
                   <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${syncStatus === 'CONNECTED' ? 'bg-green-500 animate-ping' : 'bg-amber-500'}`}></span>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{syncStatus === 'CONNECTED' ? `${db.getCluster()} • TERSAMBUNG` : 'SINKRONISASI...'}</p>
                   </div>
                </div>
             </div>
             <div className="flex items-center gap-8 w-full lg:w-auto justify-end relative z-10">
                <div className="text-right">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Update Terakhir</p>
                   <p className="text-slate-900 font-black text-sm italic tabular-nums">{lastSyncTime}</p>
                </div>
                <div className="h-10 w-px bg-slate-100 hidden lg:block"></div>
                <button onClick={() => syncGlobalData(false)} className="p-4 bg-slate-50 text-slate-900 rounded-2xl hover:bg-amber-500 transition-all active:scale-90 shadow-inner">
                   <RefreshCw size={20} className={syncStatus === 'SYNCING' ? 'animate-spin' : ''}/>
                </button>
                <button onClick={() => setIsModalOpen('PAIRING')} className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-3 active:scale-95 transition-all">
                   <Link size={16}/> PAIRING HP
                </button>
             </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[
              { label: 'Security Shift', val: staff.length, icon: <UserCheck size={24}/>, color: 'blue' },
              { label: 'Insiden Open', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Masuk', val: guests.filter(g => g.status === 'IN').length, icon: <Users size={24}/>, color: 'amber' },
              { label: 'Data Unit', val: residents.length, icon: <Home size={24}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 leading-none">{s.label}</h4>
                <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[400px]">
                <h3 className="text-lg font-black text-slate-900 mb-10 uppercase italic flex items-center gap-4"><Activity className="text-amber-500 animate-pulse"/> Statistik Aktivitas Nyata</h3>
                <div className="h-[300px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{name: 'Patroli', val: patrolLogs.length}, {name: 'Tamu', val: guests.length}, {name: 'Lapor', val: incidents.length}]}>
                         <XAxis dataKey="name" hide />
                         <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                         <Bar dataKey="val" radius={[8, 8, 8, 8]} barSize={60}>
                            {[0, 1, 2].map((_, i) => <Cell key={i} fill={['#3B82F6', '#F59E0B', '#EF4444'][i]} />)}
                         </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
             <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col justify-between">
                <div className="relative z-10">
                   <div className="bg-amber-500 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-amber-500/20 animate-pulse">
                      <Cpu size={28} className="text-slate-900" />
                   </div>
                   <h3 className="text-2xl font-black uppercase italic mb-4 tracking-tighter">AI Security Briefing</h3>
                   <p className="text-slate-400 text-sm italic leading-relaxed font-medium">"{securityBriefing}"</p>
                </div>
                <button onClick={() => setActiveTab('chat')} className="w-full bg-white text-slate-900 font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all mt-10 shadow-xl">KOORDINASI TIM <ArrowRight size={18} className="inline ml-2"/></button>
             </div>
          </div>
        </div>
      )}

      {/* 2. CEK UNIT */}
      {activeTab === 'log_resident' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none">Status Hunian Real-time</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {residents.map(res => (
                <div key={res.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
                   <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-slate-900 text-white rounded-[1.2rem] flex items-center justify-center font-black text-sm group-hover:bg-amber-500 transition-colors shadow-lg">{res.block}</div>
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{res.isHome ? 'DI UNIT' : 'KELUAR'}</span>
                      </div>
                      <h4 className="font-black text-slate-900 uppercase italic truncate text-base mb-1 leading-none">{res.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Unit: {res.block}-{res.houseNumber}</p>
                   </div>
                   <button onClick={() => handleStatusChange(res.id, !res.isHome)} className={`w-full mt-6 py-4 rounded-[1.5rem] font-black text-[10px] uppercase flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg ${res.isHome ? 'bg-slate-900 text-white' : 'bg-green-500 text-white'}`}>
                      {res.isHome ? <ArrowLeftRight size={18}/> : <CheckCircle size={18}/>} {res.isHome ? 'CATAT KELUAR' : 'KONFIRMASI MASUK'}
                   </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* 3. PATROLI */}
      {activeTab === 'patrol' && (
        <div className="space-y-8 animate-slide-up pb-20">
           <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none">Digital Checkpoints Control</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {INITIAL_CHECKPOINTS.map((cp, idx) => {
                const last = patrolLogs.find(l => l.checkpoint === cp);
                return (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start mb-10">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-slate-900 text-white flex items-center justify-center font-black text-2xl group-hover:bg-amber-500 transition-colors shadow-lg">{idx + 1}</div>
                        {last && <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${last.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{last.status}</span>}
                      </div>
                      <h4 className="text-xl font-black text-slate-900 mb-10 uppercase italic leading-none">{cp}</h4>
                    </div>
                    {currentUser.role === 'SECURITY' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => { setPatrolAction({cp, status: 'OK'}); setIsModalOpen('PATROL_REPORT'); }} className="py-5 bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-green-500/10 active:scale-95">AMAN</button>
                        <button onClick={() => { setPatrolAction({cp, status: 'DANGER'}); setIsModalOpen('PATROL_REPORT'); }} className="py-5 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-red-500/10 active:scale-95">BAHAYA</button>
                      </div>
                    ) : (
                      <div className="text-[10px] font-black text-slate-400 uppercase border-t pt-6 tracking-widest italic truncate leading-none">Terakhir: {last ? `${last.securityName} (${new Date(last.timestamp).toLocaleTimeString()})` : 'Belum Ada Log Cloud'}</div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* 4. FEED AKTIVITAS (TIMELINE GLOBAL) */}
      {activeTab === 'reports' && (
        <div className="space-y-8 animate-slide-up pb-20">
           <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none">Global Activity Timeline</h3>
           <div className="bg-white p-6 lg:p-12 rounded-[3.5rem] shadow-sm border border-slate-100">
              <div className="space-y-12">
                {timelineFeed.length > 0 ? timelineFeed.map((item: any, idx) => (
                  <div key={idx} className="flex gap-6 lg:gap-10 group animate-slide-up" style={{animationDelay: `${idx * 0.05}s`}}>
                     <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${item.color === 'slate' ? 'bg-slate-900 text-white' : item.color === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                           {item.type === 'PATROL' ? <ClipboardCheck size={26}/> : item.type === 'INCIDENT' ? <AlertTriangle size={26}/> : <BookOpen size={26}/>}
                        </div>
                        <div className="w-0.5 flex-1 bg-slate-100 mt-6 group-last:hidden"></div>
                     </div>
                     <div className="flex-1 pb-12 border-b border-slate-50 last:border-none">
                        <div className="flex justify-between items-center mb-3">
                           <h4 className="font-black text-slate-900 text-base uppercase italic leading-none">{item.title}</h4>
                           <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest tabular-nums">{new Date(item.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-sm lg:text-base text-slate-500 font-medium mb-6 italic leading-relaxed">
                          {item.type === 'PATROL' ? `Status: ${item.status}. ${item.note || ''}` : item.type === 'INCIDENT' ? item.description : `Tujuan Unit: ${item.visitToName}. Keperluan: ${item.purpose}`}
                        </p>
                        {item.photo && <img src={item.photo} alt="Visual Proof" className="mb-6 rounded-[2rem] w-full max-w-md border border-slate-100 shadow-xl" />}
                        <div className="flex flex-wrap gap-3">
                           <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${item.status === 'OK' || item.status === 'RESOLVED' || item.status === 'IN' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{item.status || 'VERIFIED'}</span>
                           <span className="px-4 py-2 bg-slate-50 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> Oleh: {item.securityName || item.reporterName || 'Sistem Cloud'}</span>
                        </div>
                     </div>
                  </div>
                )) : (
                   <div className="py-32 text-center opacity-40 italic">
                      <Ghost size={64} className="mx-auto mb-6" />
                      <p className="font-black uppercase tracking-[0.3em] text-[10px]">Menunggu Sinkronisasi Data...</p>
                   </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* 5. TAMU */}
      {activeTab === 'guests' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none">Buku Tamu Cloud</h3>
              <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all"><Plus size={24}/></button>
           </div>
           <div className="bg-white rounded-[3rem] overflow-hidden border border-slate-100 shadow-sm">
              <div className="overflow-x-auto no-scrollbar">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                       <tr>
                          <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Tamu</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tujuan Unit</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Keperluan</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Check-In</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {guests.map(g => (
                          <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                             <td className="px-8 py-6 font-black text-slate-900 uppercase italic">{g.name}</td>
                             <td className="px-8 py-6 text-sm text-slate-500 font-medium">{g.visitToName}</td>
                             <td className="px-8 py-6 text-sm italic text-slate-400">{g.purpose}</td>
                             <td className="px-8 py-6">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{g.status}</span>
                             </td>
                             <td className="px-8 py-6 text-[10px] font-black text-slate-300 tabular-nums">{new Date(g.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* 6. INSIDEN */}
      {activeTab === 'incident' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none">Pelaporan Insiden</h3>
              <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all"><Plus size={24}/></button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {incidents.map(inc => (
                <div key={inc.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 group hover:shadow-xl transition-all">
                   <div className="flex justify-between items-start mb-6">
                      <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${inc.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{inc.severity} SEVERITY</div>
                      <span className="text-[10px] font-black text-slate-300 italic">{new Date(inc.timestamp).toLocaleDateString()}</span>
                   </div>
                   <h4 className="text-xl font-black text-slate-900 uppercase italic mb-2 leading-none">{inc.type}</h4>
                   <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin size={14}/> {inc.location}</p>
                   <p className="text-slate-500 mb-8 italic text-sm leading-relaxed">{inc.description}</p>
                   {inc.photo && <img src={inc.photo} className="w-full h-48 object-cover rounded-2xl mb-6 shadow-md border border-slate-100" />}
                   <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase italic">Reporter: {inc.reporterName}</span>
                      <span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase">{inc.status}</span>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* 7. WARGA */}
      {activeTab === 'residents' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none">Master Database Unit</h3>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all"><Plus size={24}/></button>
              )}
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {residents.map(res => (
                <div key={res.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
                   <div>
                      <div className="flex justify-between items-start mb-8">
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center font-black text-lg group-hover:bg-amber-500 transition-colors shadow-lg">{res.block}</div>
                        <span className="text-[9px] font-black text-slate-300 uppercase italic opacity-50">SYNC-ID: {res.id.slice(0,5)}</span>
                      </div>
                      <h4 className="font-black text-slate-900 uppercase italic truncate text-lg mb-1 leading-none">{res.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 leading-none">Rumah {res.block} No {res.houseNumber}</p>
                   </div>
                   <div className="flex gap-2">
                      <a href={`tel:${res.phoneNumber}`} className="flex-1 py-4 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center gap-2 font-black text-[9px] uppercase hover:bg-green-500 hover:text-white transition-all"><PhoneCall size={16}/> HUBUNGI</a>
                      {currentUser.role === 'ADMIN' && (
                        <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-4 bg-slate-100 text-slate-400 hover:text-blue-500 rounded-2xl transition-all"><Edit2 size={16}/></button>
                      )}
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* 8. CHAT & 9. SETTINGS */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-220px)] flex flex-col animate-slide-up pb-10">
           <div className="flex-1 bg-white rounded-t-[3rem] shadow-sm border border-slate-100 overflow-y-auto p-6 lg:p-10 space-y-8 no-scrollbar relative">
              <div className="sticky top-0 z-10 text-center mb-10">
                 <span className="bg-slate-50 text-slate-400 text-[8px] font-black uppercase px-6 py-2 rounded-full border border-slate-100 tracking-widest italic backdrop-blur-md">Pusat Komunikasi Real-time</span>
              </div>
              {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                   <div className={`max-w-[85%] p-6 rounded-[2.5rem] relative shadow-sm transition-transform hover:scale-[1.01] ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-6 mb-2">
                         <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                         <span className="text-[8px] font-bold px-2 py-0.5 bg-white/10 rounded-full uppercase opacity-40 italic">{msg.senderRole}</span>
                      </div>
                      <p className="text-sm lg:text-base font-medium leading-relaxed">{msg.text}</p>
                      <p className={`text-[8px] mt-3 opacity-30 text-right font-black uppercase tracking-widest tabular-nums`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : (
                 <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale italic">
                    <MessageSquare size={64} className="mb-6" />
                    <p className="font-black uppercase tracking-[0.4em] text-[10px]">Obrolan Tim Masih Kosong</p>
                 </div>
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={handleSendChat} className="bg-white p-6 rounded-b-[3rem] border-t border-slate-100 flex gap-4 shadow-2xl items-center sticky bottom-0">
              <input type="text" placeholder="Ketik koordinasi tim..." className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-amber-500 transition-all shadow-inner" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-5 rounded-2xl active:scale-95 shadow-2xl hover:bg-slate-800 transition-all"><Send size={26}/></button>
           </form>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto space-y-8 animate-slide-up pb-20">
           <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none">Konfigurasi Cloud Bridge</h3>
           <div className="bg-white p-10 lg:p-14 rounded-[4rem] shadow-sm border border-slate-100 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-slate-900"></div>
              <div className="relative mt-4">
                 <div className="w-32 h-32 bg-amber-500 text-slate-900 rounded-[3rem] flex items-center justify-center font-black text-5xl mx-auto mb-8 shadow-2xl border-[6px] border-white">{currentUser.name.charAt(0)}</div>
              </div>
              <h3 className="text-3xl font-black text-slate-900 uppercase italic mb-1 leading-none tracking-tight">{currentUser.name}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12 italic leading-none">Cluster: {db.getCluster()} • Online</p>
              <div className="space-y-4">
                 <button onClick={() => setIsModalOpen('PAIRING')} className="w-full py-6 bg-slate-900 text-amber-500 rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all"><Wifi size={20}/> GANTI CLUSTER (PAIRING HP)</button>
                 <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-6 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all"><Trash2 size={20}/> FULL SYSTEM RESET</button>
                 <button onClick={() => setCurrentUser(null)} className="w-full py-6 bg-red-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all"><LogOut size={20}/> LOGOUT DARI SISTEM</button>
              </div>
           </div>
        </div>
      )}

      {/* --- ALL MODALS (Enhanced for Cloud Sync) --- */}
      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic leading-none">Register Tamu</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveGuest} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-600 transition-all" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-600" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                 <option value="">Pilih Tujuan Unit...</option>
                 {residents.map(r => <option key={r.id} value={r.id}>{r.name} ({r.block}-{r.houseNumber})</option>)}
              </select>
              <textarea required placeholder="Keperluan Kunjungan..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-600 min-h-[120px]" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">CHECK-IN (SINKRON CLOUD)</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic leading-none">Lapor Insiden</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveIncident} className="p-10 space-y-6">
              <select className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none" value={incForm.type} onChange={e => setIncForm({...incForm, type: e.target.value})}>
                 <option value="Pencurian">Pencurian</option>
                 <option value="Kebakaran">Kebakaran</option>
                 <option value="Keributan">Keributan</option>
                 <option value="Lainnya">Lainnya</option>
              </select>
              <input type="text" required placeholder="Lokasi Kejadian..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none" value={incForm.location} onChange={e => setIncForm({...incForm, location: e.target.value})} />
              <textarea required placeholder="Deskripsi Kejadian..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none min-h-[120px]" value={incForm.description} onChange={e => setIncForm({...incForm, description: e.target.value})} />
              <div className="flex gap-4">
                 {(['LOW', 'MEDIUM', 'HIGH'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setIncForm({...incForm, severity: s})} className={`flex-1 py-4 rounded-2xl font-black text-[10px] border-2 transition-all ${incForm.severity === s ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}>{s}</button>
                 ))}
              </div>
              <button type="submit" className="w-full py-5 bg-red-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">KIRIM KE PUSAT (SINKRON)</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'PATROL_REPORT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-8 lg:p-10 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-xl lg:text-2xl font-black uppercase leading-none italic">{patrolAction.cp}</h3>
                <p className="text-[10px] font-black uppercase opacity-70 mt-1 tracking-widest italic leading-none">Cloud Sync System</p>
              </div>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handlePatrolReport} className="p-8 lg:p-12 space-y-8">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 leading-none">Bukti Visual Petugas:</label>
                 <div className="flex flex-col gap-4">
                    {patrolReportData.photo ? (
                      <div className="relative group">
                         <img src={patrolReportData.photo} alt="Preview" className="w-full h-48 lg:h-56 object-cover rounded-[2rem] border-2 border-slate-100 shadow-lg" />
                         <button type="button" onClick={() => setPatrolReportData(prev => ({ ...prev, photo: '' }))} className="absolute top-4 right-4 p-3 bg-red-600 text-white rounded-2xl shadow-xl"><Trash2 size={20}/></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-48 lg:h-56 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 text-slate-400 group hover:border-slate-400 transition-all">
                         <Camera size={48} className="group-hover:scale-110 transition-transform" />
                         <span className="font-black text-[10px] uppercase tracking-widest italic leading-none">AKTIFKAN KAMERA PETUGAS</span>
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const reader = new FileReader();
                         reader.onloadend = () => setPatrolReportData(p => ({ ...p, photo: reader.result as string }));
                         reader.readAsDataURL(file);
                       }
                    }} />
                 </div>
              </div>
              <textarea required placeholder="Tuliskan catatan kondisi area di lapangan..." className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-sm min-h-[140px] focus:border-slate-900 shadow-inner" value={patrolReportData.note} onChange={e => setPatrolReportData({...patrolReportData, note: e.target.value})} />
              <button type="submit" className={`w-full py-5 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-xl ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>SIMPAN & SINKRON CLOUD</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic leading-none">{editingItem ? 'Update Warga' : 'Tambah Unit'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveResident} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Pemilik Unit..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-slate-900 shadow-inner" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                 <select className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={resForm.block} onChange={e => setResForm({...resForm, block: e.target.value})}>
                    {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                 </select>
                 <input type="text" required placeholder="No. Rumah" className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-slate-900 outline-none font-bold text-sm shadow-inner" value={resForm.houseNumber} onChange={e => setResForm({...resForm, houseNumber: e.target.value})} />
              </div>
              <input type="text" required placeholder="WhatsApp (08...)" className="w-full px-8 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-2 border-slate-100 focus:border-slate-900 shadow-inner" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">SINKRONISASI DATA UNIT</button>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
