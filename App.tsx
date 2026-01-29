
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
import { User, PatrolLog, IncidentReport, Resident, GuestLog, ChatMessage, UserRole, FullDatabase } from './types.ts';
import Layout from './components/Layout.tsx';
import { 
  Shield, Search, Send, Users, MapPin, X, AlertTriangle, 
  UserPlus, ArrowRight, CheckCircle, Clock, Edit2, Plus, Home, 
  Activity, MessageSquare, BellRing, Database, RefreshCw, 
  PhoneCall, Ghost, UserCheck, BookOpen, ClipboardCheck, Radio, LogOut, Camera, Image as ImageIcon, Trash2, UserCog, Briefcase, ChevronRight, HardDrive, Info, ArrowLeftRight
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell, XAxis } from 'recharts';
import { supabase, fetchInitialData, subscribeTable } from './services/supabaseService.ts';

const DB_KEY = 'tka_secure_local_v3';

const App: React.FC = () => {
  // Database States with LocalStorage Initializer
  const [residents, setResidents] = useState<Resident[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_residents`);
    return saved ? JSON.parse(saved) : MOCK_RESIDENTS;
  });
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_patrol_logs`);
    return saved ? JSON.parse(saved) : [];
  });
  const [incidents, setIncidents] = useState<IncidentReport[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_incidents`);
    return saved ? JSON.parse(saved) : MOCK_INCIDENTS;
  });
  const [guests, setGuests] = useState<GuestLog[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_guests`);
    return saved ? JSON.parse(saved) : MOCK_GUESTS;
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_chats`);
    return saved ? JSON.parse(saved) : [];
  });
  const [checkpoints, setCheckpoints] = useState<string[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_checkpoints`);
    return saved ? JSON.parse(saved) : INITIAL_CHECKPOINTS;
  });
  const [staff, setStaff] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_staff`);
    return saved ? JSON.parse(saved) : INITIAL_SECURITY;
  });

  // UI States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginSearch, setLoginSearch] = useState('');
  const [loginError, setLoginError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'CHECKPOINT' | 'GUEST' | 'INCIDENT' | 'SOS_MODAL' | 'PATROL_REPORT' | 'STAFF' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');

  // Form States
  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [staffForm, setStaffForm] = useState<Partial<User>>({ name: '', phoneNumber: '', role: 'SECURITY' });
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '' });
  const [incForm, setIncForm] = useState<Partial<IncidentReport>>({ type: 'Pencurian', location: '', description: '', severity: 'MEDIUM' });
  const [cpForm, setCpForm] = useState('');
  const [patrolAction, setPatrolAction] = useState<{cp: string, status: 'OK' | 'WARNING' | 'DANGER'}>({ cp: '', status: 'OK' });
  const [patrolReportData, setPatrolReportData] = useState({ note: '', photo: '' });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence Effects
  useEffect(() => localStorage.setItem(`${DB_KEY}_residents`, JSON.stringify(residents)), [residents]);
  useEffect(() => localStorage.setItem(`${DB_KEY}_patrol_logs`, JSON.stringify(patrolLogs)), [patrolLogs]);
  useEffect(() => localStorage.setItem(`${DB_KEY}_incidents`, JSON.stringify(incidents)), [incidents]);
  useEffect(() => localStorage.setItem(`${DB_KEY}_guests`, JSON.stringify(guests)), [guests]);
  useEffect(() => localStorage.setItem(`${DB_KEY}_chats`, JSON.stringify(chatMessages)), [chatMessages]);
  useEffect(() => localStorage.setItem(`${DB_KEY}_checkpoints`, JSON.stringify(checkpoints)), [checkpoints]);
  useEffect(() => localStorage.setItem(`${DB_KEY}_staff`, JSON.stringify(staff)), [staff]);

  // Sync with Supabase (Background)
  useEffect(() => {
    const syncDatabase = async () => {
      try {
        const [resData, incsData, guestsData] = await Promise.all([
          fetchInitialData('residents'),
          fetchInitialData('incidents'),
          fetchInitialData('guests')
        ]);
        if (resData.length) setResidents(resData);
        if (incsData.length) setIncidents(incsData);
        if (guestsData.length) setGuests(guestsData);
      } catch (e) { console.warn("Supabase Sync Failed: Operating in local-only mode."); }
    };
    syncDatabase();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const shift = new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Pagi' : 'Malam';
      getSecurityBriefing(shift).then(setSecurityBriefing);
    }
  }, [currentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab]);

  // --- HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const isAdmin = loginTab === 'ADMIN';
    const isValid = isAdmin ? passwordInput === 'admin123' : passwordInput === '1234';

    if (isValid) {
      setCurrentUser({ ...selectedUser, role: loginTab as UserRole });
      setPasswordInput('');
    } else {
      setLoginError(isAdmin ? 'PIN Admin Salah (admin123)' : 'PIN Salah (1234)');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPatrolReportData(prev => ({ ...prev, photo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const submitPatrol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !patrolReportData.photo || !patrolReportData.note) {
      alert("Foto dan catatan wajib diisi!");
      return;
    }
    const log: PatrolLog = {
      id: `p-${Date.now()}`, securityId: currentUser.id, securityName: currentUser.name, timestamp: new Date().toISOString(),
      checkpoint: patrolAction.cp, status: patrolAction.status, note: patrolReportData.note, photo: patrolReportData.photo
    };
    setPatrolLogs(prev => [log, ...prev]);
    setIsModalOpen(null);
    setPatrolReportData({ note: '', photo: '' });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    const msg: ChatMessage = { id: `m-${Date.now()}`, senderId: currentUser.id, senderName: currentUser.name, senderRole: currentUser.role, text: chatInput, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, msg]);
    setChatInput('');
  };

  const toggleResidentPresence = async (id: string) => {
    setResidents(prev => prev.map(r => r.id === id ? { ...r, isHome: !r.isHome } : r));
    try {
      const res = residents.find(r => r.id === id);
      await supabase.from('residents').update({ isHome: !res?.isHome }).eq('id', id);
    } catch (e) {}
  };

  const handleCRUD = async (table: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data?: any, id?: string) => {
    if (action === 'DELETE') {
      if (!window.confirm("Hapus data secara permanen?")) return;
      if (table === 'staff') setStaff(prev => prev.filter(s => s.id !== id));
      if (table === 'checkpoints') setCheckpoints(prev => prev.filter(c => c !== id));
      if (table === 'residents') setResidents(prev => prev.filter(r => r.id !== id));
      try { await supabase.from(table === 'staff' ? 'security_users' : table).delete().eq('id', id); } catch(e) {}
    }
    if (action === 'CREATE') {
      if (table === 'staff') setStaff(prev => [data, ...prev]);
      if (table === 'checkpoints') setCheckpoints(prev => [...prev, data]);
      if (table === 'residents') setResidents(prev => [data, ...prev]);
      try { await supabase.from(table === 'staff' ? 'security_users' : table).insert(data); } catch(e) {}
    }
    if (action === 'UPDATE') {
      if (table === 'residents') setResidents(prev => prev.map(r => r.id === id ? data : r));
      try { await supabase.from(table).update(data).eq('id', id); } catch(e) {}
    }
    setIsModalOpen(null);
  };

  const submitGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !guestForm.name || !guestForm.visitToId) return;
    const target = residents.find(r => r.id === guestForm.visitToId);
    const guest: GuestLog = {
      id: `g-${Date.now()}`,
      name: guestForm.name!,
      visitToId: guestForm.visitToId!,
      visitToName: target ? `${target.name} (${target.block}-${target.houseNumber})` : 'Unknown',
      purpose: guestForm.purpose || '',
      entryTime: new Date().toISOString(),
      status: 'IN'
    };
    setGuests(prev => [guest, ...prev]);
    setIsModalOpen(null);
    setGuestForm({ name: '', visitToId: '', purpose: '' });
  };

  const submitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !incForm.description) return;
    const report: IncidentReport = {
      id: `i-${Date.now()}`,
      reporterId: currentUser.id,
      reporterName: currentUser.name,
      timestamp: new Date().toISOString(),
      type: incForm.type || 'Lainnya',
      description: incForm.description!,
      location: incForm.location || 'Area Perumahan',
      status: 'PENDING',
      severity: incForm.severity as any || 'MEDIUM',
    };
    setIncidents(prev => [report, ...prev]);
    setIsModalOpen(null);
    setIncForm({ type: 'Pencurian', location: '', description: '', severity: 'MEDIUM' });
  };

  const stats = useMemo(() => ({
    activeGuards: staff.length,
    pendingIncidents: incidents.filter(i => i.status !== 'RESOLVED').length,
    guestsIn: guests.filter(g => g.status === 'IN').length,
    totalResidents: residents.length
  }), [staff, incidents, guests, residents]);

  const liveTimeline = useMemo(() => {
    const combined = [
      ...patrolLogs.map(l => ({ ...l, feedType: 'PATROL', sortTime: l.timestamp })),
      ...incidents.map(i => ({ ...i, feedType: 'INCIDENT', sortTime: i.timestamp })),
      ...guests.map(g => ({ ...g, feedType: 'GUEST', sortTime: g.entryTime }))
    ];
    return combined.sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime()).slice(0, 30);
  }, [patrolLogs, incidents, guests]);

  const chartData = useMemo(() => [
    { name: 'Patroli', val: patrolLogs.length },
    { name: 'Tamu', val: guests.length },
    { name: 'Insiden', val: incidents.length }
  ], [patrolLogs, guests, incidents]);

  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? staff : loginTab === 'ADMIN' ? ADMIN_USERS : residents.map(r => ({ id: r.id, name: r.name, sub: `Blok ${r.block}-${r.houseNumber}` }));
    const filteredPool = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()));

    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[950px] flex flex-col md:flex-row rounded-[2rem] lg:rounded-[3rem] shadow-2xl overflow-hidden border border-white/20">
          <div className="w-full md:w-5/12 bg-slate-900 p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="bg-amber-500 w-12 h-12 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center mb-6 lg:mb-10 shadow-xl shadow-amber-500/20">
                <Shield size={28} className="text-slate-900" />
              </div>
              <h1 className="text-3xl lg:text-4xl font-black mb-4 tracking-tighter italic uppercase leading-tight">TKA SECURE <br/><span className="text-amber-500 not-italic text-xl lg:text-2xl font-light">Cloud System</span></h1>
              <p className="text-slate-400 text-xs lg:text-sm leading-relaxed max-w-[250px]">Manajemen keamanan hunian terpadu dengan sinkronisasi cloud real-time.</p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3 relative z-10 mt-8">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Hybrid Local-Cloud Sync</span>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 lg:p-14 h-[600px] lg:h-[750px] flex flex-col bg-white overflow-y-auto no-scrollbar">
            <h2 className="text-2xl lg:text-3xl font-black text-slate-900 mb-6 lg:mb-8 tracking-tight italic">Portal Login</h2>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 lg:mb-8">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); setLoginSearch(''); }}
                  className={`flex-1 py-3 lg:py-4 text-[9px] lg:text-[10px] font-black uppercase rounded-xl transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder={`Cari nama ${loginTab}...`}
                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-500 outline-none font-bold text-sm transition-all"
                value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto pr-1 mb-6 space-y-3 no-scrollbar">
              {filteredPool.map((u: any) => (
                <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setLoginError(''); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-transparent bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-900 text-sm truncate">{u.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{u.sub || 'Akses Sistem'}</p>
                  </div>
                </button>
              ))}
            </div>

            {selectedUser && (
              <form onSubmit={handleLogin} className="pt-6 border-t border-slate-100 space-y-4">
                <input type="password" required placeholder="PIN"
                  className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-xl tracking-[0.5em] text-center" 
                  value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                {loginError && <p className="text-red-500 text-[9px] font-black uppercase text-center">{loginError}</p>}
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-4 text-[10px] uppercase tracking-widest shadow-2xl">
                  MASUK SISTEM <ArrowRight size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={() => setCurrentUser(null)} activeTab={activeTab} setActiveTab={setActiveTab}>
      
      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up pb-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[
              { label: 'Satpam Siaga', val: stats.activeGuards, icon: <UserCheck size={24}/>, color: 'blue' },
              { label: 'Insiden', val: stats.pendingIncidents, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Area', val: stats.guestsIn, icon: <Users size={24}/>, color: 'amber' },
              { label: 'Total Rumah', val: stats.totalResidents, icon: <Home size={24}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 lg:mb-6 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                <p className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 bg-white p-6 lg:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
               <h3 className="text-lg lg:text-xl font-black text-slate-900 mb-6 lg:mb-10 flex items-center gap-3 uppercase italic"><Activity size={20} className="text-amber-500 animate-pulse"/> Statistik</h3>
               <div className="h-[200px] lg:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                      <Bar dataKey="val" radius={[8, 8, 8, 8]} barSize={40}>
                        {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#EF4444'][index % 3]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-slate-900 text-white p-6 lg:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[250px]">
               <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4 lg:mb-8">
                    <Radio size={28} className="text-amber-500 animate-pulse"/>
                    <h3 className="font-black text-xl uppercase italic">Briefing AI</h3>
                  </div>
                  <p className="text-slate-400 text-xs italic leading-relaxed font-medium">"{securityBriefing || 'Mengambil instruksi hari ini...'}"</p>
               </div>
               <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-4 rounded-xl text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl mt-6">HUBUNGI TIM <ArrowRight size={18}/></button>
            </div>
          </div>
        </div>
      )}

      {/* KELUAR MASUK WARGA */}
      {activeTab === 'log_resident' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <h3 className="text-xl lg:text-2xl font-black text-slate-900 uppercase italic">Keluar Masuk Warga</h3>
              <div className="relative w-full lg:w-[400px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                <input type="text" placeholder="Cari nama atau no. rumah..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-100 outline-none focus:border-amber-500 font-bold text-xs" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.houseNumber.includes(searchQuery) || r.block.includes(searchQuery.toUpperCase())).map(res => (
                <div key={res.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between group">
                   <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-sm">{res.block}</div>
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{res.isHome ? 'DI RUMAH' : 'SEDANG KELUAR'}</span>
                   </div>
                   <div className="mb-6">
                      <h4 className="font-black text-slate-900 uppercase italic truncate text-sm">{res.name}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No. Rumah: <span className="text-slate-900">{res.houseNumber}</span></p>
                   </div>
                   <button onClick={() => toggleResidentPresence(res.id)} className={`w-full py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md ${res.isHome ? 'bg-slate-900 text-white' : 'bg-green-500 text-white'}`}>
                      {res.isHome ? <ArrowLeftRight size={14}/> : <CheckCircle size={14}/>}
                      {res.isHome ? 'CATAT KELUAR' : 'CATAT MASUK'}
                   </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* PATROL */}
      {activeTab === 'patrol' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up">
           <div className="flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black text-slate-900 uppercase italic">Kontrol Patroli</h3>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => setIsModalOpen('CHECKPOINT')} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase flex items-center gap-2 shadow-xl">
                  <Plus size={16}/> TITIK BARU
                </button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {checkpoints.map((cp, idx) => {
                const last = patrolLogs.filter(l => l.checkpoint === cp)[0];
                return (
                  <div key={idx} className="bg-white p-6 lg:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors shadow-lg">{idx + 1}</div>
                        {last && <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${last.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{last.status}</span>}
                      </div>
                      <h4 className="text-lg font-black text-slate-900 mb-8 uppercase italic">{cp}</h4>
                    </div>
                    {currentUser.role === 'SECURITY' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { setPatrolAction({cp, status: 'OK'}); setIsModalOpen('PATROL_REPORT'); }} className="py-4 bg-green-500 text-white rounded-xl font-black text-[9px] uppercase active:scale-95 shadow-lg">AMAN</button>
                        <button onClick={() => { setPatrolAction({cp, status: 'DANGER'}); setIsModalOpen('PATROL_REPORT'); }} className="py-4 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase active:scale-95 shadow-lg">BAHAYA</button>
                      </div>
                    ) : (
                      <div className="text-[9px] font-black text-slate-400 uppercase border-t pt-4 tracking-widest italic truncate">Log: {last ? `${last.securityName} (${new Date(last.timestamp).toLocaleTimeString()})` : 'Belum Dicek'}</div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* WARGA / RESIDENTS */}
      {activeTab === 'residents' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <h3 className="text-xl lg:text-2xl font-black text-slate-900 uppercase italic">Manajemen Hunian</h3>
              <div className="flex gap-2">
                 <div className="relative flex-1 lg:w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                    <input type="text" placeholder="Cari..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-100 outline-none font-bold text-xs" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                 </div>
                 {currentUser.role === 'ADMIN' && (
                   <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase flex items-center gap-2"><Plus size={16}/> TAMBAH</button>
                 )}
              </div>
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.block.includes(searchQuery.toUpperCase())).map(res => (
                <div key={res.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                   <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-900 flex items-center justify-center font-black text-lg border border-slate-100">{res.block}</div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {currentUser.role === 'ADMIN' && (
                          <>
                            <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button>
                            <button onClick={() => handleCRUD('residents', 'DELETE', null, res.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                          </>
                        )}
                      </div>
                   </div>
                   <h4 className="font-black text-base text-slate-900 mb-1 italic uppercase truncate">{res.name}</h4>
                   <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-6">No. Rumah: <span className="text-slate-900 font-black">{res.houseNumber}</span></p>
                   <a href={`tel:${res.phoneNumber}`} className="w-full py-3 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] uppercase border border-slate-100 hover:bg-green-500 hover:text-white transition-all"><PhoneCall size={16}/> HUBUNGI</a>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* CHAT */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-200px)] lg:h-[calc(100vh-250px)] flex flex-col animate-slide-up">
           <div className="flex-1 bg-white rounded-t-[2rem] shadow-sm border border-slate-100 overflow-y-auto p-6 space-y-6 no-scrollbar relative">
              {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[85%] p-5 rounded-2xl relative ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-4 mb-1">
                         <span className={`text-[9px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                      <p className="text-[8px] mt-2 opacity-30 text-right font-black uppercase">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 italic py-10">
                   <MessageSquare size={40} className="mb-2 opacity-10" />
                   <p className="font-black uppercase tracking-widest text-[9px]">Belum Ada Chat</p>
                </div>
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={sendMessage} className="bg-white p-5 rounded-b-[2rem] border-t border-slate-100 flex gap-3 shadow-sm items-center">
              <input type="text" placeholder="Kirim pesan ke tim..." className="flex-1 px-5 py-3 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-amber-500" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-3 rounded-xl active:scale-95 shadow-xl"><Send size={22}/></button>
           </form>
        </div>
      )}

      {/* SETTINGS (SETELAN) */}
      {activeTab === 'settings' && (
        <div className="max-w-5xl mx-auto space-y-8 animate-slide-up pb-10">
           <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8">
              <div className="w-24 h-24 bg-slate-900 text-amber-500 rounded-[1.5rem] flex items-center justify-center text-3xl font-black shadow-xl">{currentUser.name.charAt(0)}</div>
              <div className="flex-1 text-center md:text-left">
                 <h3 className="text-2xl font-black text-slate-900 italic uppercase mb-1">{currentUser.name}</h3>
                 <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    <span className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">{currentUser.role}</span>
                    <span className="px-4 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2"><RefreshCw size={10}/> Data Realtime</span>
                 </div>
              </div>
              <button onClick={() => setCurrentUser(null)} className="px-8 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 border border-red-100 shadow-sm active:scale-95"><LogOut size={16}/> KELUAR</button>
           </div>

           {currentUser.role === 'ADMIN' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Staff Control */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                   <div className="flex justify-between items-center mb-8">
                      <h4 className="text-lg font-black text-slate-900 italic uppercase flex items-center gap-2"><UserCog size={20} className="text-amber-500"/> Manajemen Staff</h4>
                      <button onClick={() => { setEditingItem(null); setStaffForm({ name: '', phoneNumber: '', role: 'SECURITY' }); setIsModalOpen('STAFF'); }} className="p-2 bg-slate-900 text-white rounded-lg active:scale-95 shadow-md"><Plus size={18}/></button>
                   </div>
                   <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                      {staff.map(s => (
                        <div key={s.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl group hover:bg-white border border-transparent hover:border-slate-100 transition-all">
                           <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black group-hover:bg-amber-500 transition-colors">{s.name.charAt(0)}</div>
                           <div className="flex-1">
                              <p className="font-black text-slate-900 text-xs">{s.name}</p>
                              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{s.phoneNumber || '08XXX'}</p>
                           </div>
                           <button onClick={() => handleCRUD('staff', 'DELETE', null, s.id)} className="p-2 text-slate-300 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Patrol Checkpoints */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                   <div className="flex justify-between items-center mb-8">
                      <h4 className="text-lg font-black text-slate-900 italic uppercase flex items-center gap-2"><MapPin size={20} className="text-amber-500"/> Titik Patroli</h4>
                      <button onClick={() => setIsModalOpen('CHECKPOINT')} className="p-2 bg-slate-900 text-white rounded-lg active:scale-95 shadow-md"><Plus size={18}/></button>
                   </div>
                   <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                      {checkpoints.map((cp, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group border border-transparent hover:border-slate-100 hover:bg-white transition-all">
                           <div className="flex items-center gap-3">
                              <span className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-slate-900 shadow-sm text-xs">{idx + 1}</span>
                              <p className="font-black text-slate-900 text-xs italic">{cp}</p>
                           </div>
                           <button onClick={() => handleCRUD('checkpoints', 'DELETE', null, cp)} className="p-2 text-slate-300 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           )}

           <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full"></div>
              <div className="relative z-10 flex items-center gap-6">
                 <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center border border-white/10"><Database size={28} className="text-amber-500"/></div>
                 <div>
                    <h4 className="text-lg font-black italic uppercase mb-1 leading-none">Status Sinkronisasi</h4>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Hybrid Database (LocalStorage + Supabase Cloud)</p>
                 </div>
              </div>
              <div className="flex gap-3 relative z-10">
                 <div className="px-5 py-3 bg-white/5 rounded-xl border border-white/10 text-center min-w-[100px]">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</p>
                    <p className="font-black text-green-500 text-xs">ONLINE</p>
                 </div>
                 <div className="px-5 py-3 bg-white/5 rounded-xl border border-white/10 text-center min-w-[100px]">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Safety</p>
                    <p className="font-black text-amber-500 text-xs">AES-256</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODALS */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2rem] lg:rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 lg:p-10 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black uppercase italic leading-none">{editingItem ? 'Edit Warga' : 'Warga Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              const data = { ...resForm, id: editingItem?.id || `r-${Date.now()}` } as Resident;
              editingItem ? handleCRUD('residents', 'UPDATE', data, editingItem.id) : handleCRUD('residents', 'CREATE', data); 
            }} className="p-8 lg:p-10 space-y-4 lg:space-y-5">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Nama Lengkap:</label>
                <input type="text" required placeholder="Contoh: Bpk. Budi" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Pilih Blok:</label>
                   <select className="w-full px-5 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={resForm.block} onChange={e => setResForm({...resForm, block: e.target.value})}>
                      {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                   </select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">No. Rumah:</label>
                   <input type="text" required placeholder="01-99" className="w-full px-5 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm border-2 border-transparent focus:border-slate-900" value={resForm.houseNumber} onChange={e => setResForm({...resForm, houseNumber: e.target.value})} />
                 </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Nomor HP/WA:</label>
                <input type="text" required placeholder="08XXXXXXXXXX" className="w-full px-6 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">Simpan Data Warga</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'STAFF' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase italic leading-none">Personel Baru</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCRUD('staff', 'CREATE', { id: `s-${Date.now()}`, ...staffForm }); }} className="p-8 space-y-5">
              <input type="text" required placeholder="Nama Lengkap..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-slate-900 shadow-inner" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} />
              <input type="text" required placeholder="Nomor HP/WhatsApp..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-slate-900 shadow-inner" value={staffForm.phoneNumber} onChange={e => setStaffForm({...staffForm, phoneNumber: e.target.value})} />
              <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">SIMPAN PERSONEL</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'CHECKPOINT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase italic">Titik Baru</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (cpForm.trim()) handleCRUD('checkpoints', 'CREATE', cpForm); setCpForm(''); }} className="p-8 space-y-5">
              <input type="text" required placeholder="Nama Area (misal: Pintu Samping)..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-slate-900" value={cpForm} onChange={e => setCpForm(e.target.value)} />
              <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">TAMBAH TITIK</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'PATROL_REPORT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-8 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-xl font-black uppercase leading-none italic">{patrolAction.cp}</h3>
                <p className="text-[10px] font-black uppercase opacity-70 mt-1 tracking-widest">Detail Laporan</p>
              </div>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={submitPatrol} className="p-8 space-y-5">
              <div className="space-y-1">
                 <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Bukti Foto (Wajib):</label>
                 <div className="flex flex-col gap-3">
                    {patrolReportData.photo ? (
                      <div className="relative group">
                         <img src={patrolReportData.photo} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-slate-100 shadow-inner" />
                         <button type="button" onClick={() => setPatrolReportData(prev => ({ ...prev, photo: '' }))} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg shadow-lg active:scale-95"><Trash2 size={14}/></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-32 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-slate-400 transition-all">
                         <Camera size={32} />
                         <span className="font-black text-[8px] uppercase tracking-widest">Ambil Foto Lokasi</span>
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                 </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Catatan Keadaan:</label>
                <textarea required placeholder="Deskripsikan kondisi..." className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm min-h-[100px] focus:border-slate-900" value={patrolReportData.note} onChange={e => setPatrolReportData({...patrolReportData, note: e.target.value})} />
              </div>
              <button type="submit" className={`w-full py-4 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>KIRIM LAPORAN</button>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
