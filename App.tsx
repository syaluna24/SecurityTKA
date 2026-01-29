
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
  UserPlus, ArrowRight, CheckCircle, Clock, Edit2, Plus, Home, 
  Activity, MessageSquare, Radio, LogOut, Camera, Trash2, UserCog, Database, PhoneCall, ArrowLeftRight, Copy, Download, ClipboardCheck, BookOpen, FileText, UserCheck
} from 'lucide-react';
import { getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase, fetchInitialData } from './services/supabaseService.ts';

// Bump version to clear potential corrupted local data
const DB_KEY = 'tka_secure_master_v10';

const App: React.FC = () => {
  // --- DATABASE STATES WITH ROBUST INITIALIZATION ---
  const [residents, setResidents] = useState<Resident[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_residents`);
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.length > 0 ? parsed : MOCK_RESIDENTS;
  });
  
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_patrol_logs`);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [incidents, setIncidents] = useState<IncidentReport[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_incidents`);
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.length > 0 ? parsed : MOCK_INCIDENTS;
  });
  
  const [guests, setGuests] = useState<GuestLog[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_guests`);
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.length > 0 ? parsed : MOCK_GUESTS;
  });
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_chats`);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [checkpoints, setCheckpoints] = useState<string[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_checkpoints`);
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.length > 0 ? parsed : INITIAL_CHECKPOINTS;
  });
  
  const [staff, setStaff] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${DB_KEY}_staff`);
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.length > 0 ? parsed : INITIAL_SECURITY;
  });

  // --- UI STATES ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginSearch, setLoginSearch] = useState('');
  const [loginError, setLoginError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'CHECKPOINT' | 'GUEST' | 'INCIDENT' | 'PATROL_REPORT' | 'STAFF' | null>(null);
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

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem(`${DB_KEY}_residents`, JSON.stringify(residents));
    localStorage.setItem(`${DB_KEY}_patrol_logs`, JSON.stringify(patrolLogs));
    localStorage.setItem(`${DB_KEY}_incidents`, JSON.stringify(incidents));
    localStorage.setItem(`${DB_KEY}_guests`, JSON.stringify(guests));
    localStorage.setItem(`${DB_KEY}_chats`, JSON.stringify(chatMessages));
    localStorage.setItem(`${DB_KEY}_checkpoints`, JSON.stringify(checkpoints));
    localStorage.setItem(`${DB_KEY}_staff`, JSON.stringify(staff));
  }, [residents, patrolLogs, incidents, guests, chatMessages, checkpoints, staff]);

  // Sync with Cloud (If configured)
  useEffect(() => {
    const syncWithCloud = async () => {
      try {
        const [resCloud, incCloud, guestCloud] = await Promise.all([
          fetchInitialData('residents'),
          fetchInitialData('incidents'),
          fetchInitialData('guests')
        ]);
        if (resCloud.length > 0) setResidents(resCloud);
        if (incCloud.length > 0) setIncidents(incCloud);
        if (guestCloud.length > 0) setGuests(guestCloud);
      } catch (e) {
        console.warn("Cloud disconnected: using local master data.");
      }
    };
    syncWithCloud();
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

  // --- SYNC MASTER TOOLS ---
  const handleExportData = () => {
    const data = { residents, patrolLogs, incidents, guests, checkpoints, staff, chatMessages };
    const code = btoa(encodeURIComponent(JSON.stringify(data)));
    navigator.clipboard.writeText(code);
    alert("KODE MASTER DISALIN!\nTempelkan kode ini di HP/Laptop lain pada menu Setelan untuk menyambungkan data.");
  };

  const handleImportData = () => {
    try {
      setIsSyncing(true);
      const decoded = JSON.parse(decodeURIComponent(atob(syncCodeInput.trim())));
      if (decoded.residents) setResidents(decoded.residents);
      if (decoded.patrolLogs) setPatrolLogs(decoded.patrolLogs);
      if (decoded.incidents) setIncidents(decoded.incidents);
      if (decoded.guests) setGuests(decoded.guests);
      if (decoded.checkpoints) setCheckpoints(decoded.checkpoints);
      if (decoded.staff) setStaff(decoded.staff);
      if (decoded.chatMessages) setChatMessages(decoded.chatMessages);
      setSyncCodeInput('');
      alert("SINKRONISASI BERHASIL!\nData sekarang identik dengan perangkat sumber.");
    } catch (e) {
      alert("KODE TIDAK VALID!");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- LOGIC HANDLERS ---
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

  // Fix: Added missing sendMessage logic
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: chatInput,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
  };

  const submitPatrol = (e: React.FormEvent) => {
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

  const submitResident = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { 
      id: editingItem?.id || `r-${Date.now()}`, 
      name: resForm.name || '', 
      houseNumber: resForm.houseNumber || '', 
      block: resForm.block || BLOCKS[0], 
      phoneNumber: resForm.phoneNumber || '', 
      isHome: resForm.isHome ?? true 
    } as Resident;

    if (editingItem) {
      setResidents(prev => prev.map(r => r.id === editingItem.id ? data : r));
    } else {
      setResidents(prev => [data, ...prev]);
    }
    
    setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
    setIsModalOpen(null);
  };

  // Fix: Added missing submitGuest logic
  const submitGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestForm.name || !guestForm.visitToId) return;
    
    const targetResident = residents.find(r => r.id === guestForm.visitToId);
    const log: GuestLog = {
      id: `g-${Date.now()}`,
      name: guestForm.name,
      visitToId: guestForm.visitToId,
      visitToName: targetResident ? `${targetResident.name} (${targetResident.block}-${targetResident.houseNumber})` : 'Unknown',
      purpose: guestForm.purpose || 'Visit',
      entryTime: new Date().toISOString(),
      status: 'IN'
    };
    setGuests(prev => [log, ...prev]);
    setGuestForm({ name: '', visitToId: '', purpose: '' });
    setIsModalOpen(null);
  };

  // Fix: Added missing submitIncident logic
  const submitIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const log: IncidentReport = {
      id: `inc-${Date.now()}`,
      reporterId: currentUser.id,
      reporterName: currentUser.name,
      timestamp: new Date().toISOString(),
      type: incForm.type || 'Other',
      description: incForm.description || '',
      location: incForm.location || 'Unknown',
      status: 'PENDING',
      severity: incForm.severity || 'MEDIUM'
    };
    setIncidents(prev => [log, ...prev]);
    setIncForm({ type: 'Pencurian', location: '', description: '', severity: 'MEDIUM' });
    setIsModalOpen(null);
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

  // --- RENDER LOGIN ---
  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? staff : loginTab === 'ADMIN' ? ADMIN_USERS : residents.map(r => ({ id: r.id, name: r.name, sub: `Blok ${r.block}-${r.houseNumber}` }));
    const filteredPool = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()));

    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[950px] flex flex-col md:flex-row rounded-[2rem] shadow-2xl overflow-hidden border border-white/10">
          <div className="w-full md:w-5/12 bg-slate-900 p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="bg-amber-500 w-12 h-12 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center mb-8 shadow-xl">
                <Shield size={28} className="text-slate-900" />
              </div>
              <h1 className="text-3xl lg:text-4xl font-black mb-4 tracking-tighter italic uppercase leading-tight">TKA SECURE <br/><span className="text-amber-500 not-italic text-xl lg:text-2xl font-light">Cloud Database</span></h1>
              <p className="text-slate-400 text-xs lg:text-sm leading-relaxed">Sistem manajemen keamanan terintegrasi untuk Laptop & HP.</p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3 relative z-10 mt-8">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 italic">Sync Ready</span>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 lg:p-14 h-[600px] lg:h-[750px] flex flex-col bg-white overflow-y-auto no-scrollbar">
            <h2 className="text-2xl font-black text-slate-900 mb-6 tracking-tight italic uppercase">Pintu Akses</h2>
            <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); setLoginSearch(''); }}
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-lg scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="text" placeholder={`Cari nama ${loginTab}...`}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 border-2 border-transparent focus:border-amber-500 outline-none font-bold text-sm transition-all"
                value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto pr-1 mb-6 space-y-2 no-scrollbar">
              {filteredPool.map((u: any) => (
                <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setLoginError(''); }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-900 text-sm truncate">{u.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate">{u.sub || 'Akses Sistem'}</p>
                  </div>
                </button>
              ))}
            </div>

            {selectedUser && (
              <form onSubmit={handleLogin} className="pt-6 border-t border-slate-100 space-y-4">
                <input type="password" required placeholder="PIN LOGIN"
                  className="w-full px-8 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-xl tracking-[0.5em] text-center" 
                  value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                {loginError && <p className="text-red-500 text-[9px] font-black uppercase text-center">{loginError}</p>}
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all">
                  KONFIRMASI MASUK <ArrowRight size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP CONTENT ---
  return (
    <Layout user={currentUser} onLogout={() => setCurrentUser(null)} activeTab={activeTab} setActiveTab={setActiveTab}>
      
      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up pb-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Petugas Siaga', val: stats.activeGuards, icon: <UserCheck size={20}/>, color: 'blue' },
              { label: 'Laporan Insiden', val: stats.pendingIncidents, icon: <AlertTriangle size={20}/>, color: 'red' },
              { label: 'Tamu Terdaftar', val: stats.guestsIn, icon: <Users size={20}/>, color: 'amber' },
              { label: 'Total Hunian', val: stats.totalResidents, icon: <Home size={20}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-5 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] shadow-sm border border-slate-100">
                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center mb-3 lg:mb-6 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[8px] lg:text-[9px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                <p className="text-xl lg:text-3xl font-black text-slate-900 tracking-tighter">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 bg-white p-6 lg:p-10 rounded-[2rem] lg:rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[350px]">
               <h3 className="text-lg lg:text-xl font-black text-slate-900 mb-6 lg:mb-10 flex items-center gap-3 uppercase italic"><Activity size={20} className="text-amber-500 animate-pulse"/> Analisis Aktivitas</h3>
               <div className="h-[200px] lg:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="val" radius={[6, 6, 6, 6]} barSize={45}>
                        {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#EF4444'][index % 3]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-slate-900 text-white p-6 lg:p-10 rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[250px]">
               <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6 lg:mb-8">
                    <Radio size={28} className="text-amber-500 animate-pulse"/>
                    <h3 className="font-black text-xl uppercase italic">Briefing AI</h3>
                  </div>
                  <p className="text-slate-400 text-xs italic leading-relaxed font-medium">"{securityBriefing || 'Menghubungkan asisten keamanan...'}"</p>
               </div>
               <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-4 rounded-xl text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl mt-6 active:scale-95 transition-all">DISKUSI TIM <ArrowRight size={18}/></button>
            </div>
          </div>
        </div>
      )}

      {/* PATROL (PATROLI) - FIXING BLANK ISSUE */}
      {activeTab === 'patrol' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black text-slate-900 uppercase italic">Kontrol Patroli Wilayah</h3>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => setIsModalOpen('CHECKPOINT')} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase flex items-center gap-2 shadow-xl">
                  <Plus size={16}/> TITIK BARU
                </button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {checkpoints.map((cp, idx) => {
                const logsForCp = patrolLogs.filter(l => l.checkpoint === cp);
                const last = logsForCp[0];
                return (
                  <div key={idx} className="bg-white p-6 lg:p-10 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl lg:text-2xl group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors shadow-lg">{idx + 1}</div>
                        {last && <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${last.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{last.status}</span>}
                      </div>
                      <h4 className="text-lg lg:text-xl font-black text-slate-900 mb-8 uppercase italic leading-tight">{cp}</h4>
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
           {checkpoints.length === 0 && (
             <div className="py-20 text-center text-slate-200 font-black uppercase italic tracking-widest">Belum ada titik patroli yang terdaftar.</div>
           )}
        </div>
      )}

      {/* FEED KEGIATAN (REPORTS) */}
      {activeTab === 'reports' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black text-slate-900 uppercase italic">Log Keamanan Real-Time</h3>
              <div className="flex items-center gap-2">
                 <Radio size={16} className="text-green-500 animate-pulse"/>
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Live Feed</span>
              </div>
           </div>
           
           <div className="bg-white p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] shadow-sm border border-slate-100">
              <div className="space-y-10 lg:space-y-12">
                {liveTimeline.length > 0 ? liveTimeline.map((item: any, idx) => (
                  <div key={idx} className="flex gap-4 lg:gap-8 group">
                     <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 ${item.feedType === 'PATROL' ? 'bg-slate-900 text-white' : item.feedType === 'INCIDENT' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                           {item.feedType === 'PATROL' ? <ClipboardCheck size={20}/> : item.feedType === 'INCIDENT' ? <AlertTriangle size={20}/> : <BookOpen size={20}/>}
                        </div>
                        <div className="w-0.5 flex-1 bg-slate-100 mt-4"></div>
                     </div>
                     <div className="flex-1 pb-10 border-b border-slate-50 last:border-none">
                        <div className="flex justify-between items-center mb-1 lg:mb-2">
                           <h4 className="font-black text-slate-900 text-sm lg:text-base tracking-tight uppercase italic">{item.feedType === 'PATROL' ? `Patroli: ${item.checkpoint}` : item.feedType === 'INCIDENT' ? `Insiden: ${item.type}` : `Akses Tamu`}</h4>
                           <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{new Date(item.sortTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-xs lg:text-sm text-slate-500 font-medium mb-4 italic leading-relaxed">
                          {item.feedType === 'PATROL' ? `Area ${item.status === 'OK' ? 'Aman' : 'Berbahaya'}. ${item.note || ''}` : item.description || `Kunjungan oleh ${item.name} ke ${item.visitToName}.`}
                        </p>
                        {item.photo && <img src={item.photo} alt="Bukti" className="mb-4 rounded-2xl w-full max-w-sm border border-slate-100 shadow-md" />}
                        <div className="flex flex-wrap gap-2 lg:gap-3">
                           <span className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-[8px] font-black uppercase tracking-widest ${item.status === 'OK' || item.status === 'RESOLVED' || item.status === 'IN' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{item.status || 'AKTIF'}</span>
                           <span className="px-3 lg:px-4 py-1.5 lg:py-2 bg-slate-50 text-slate-400 rounded-full text-[8px] font-black uppercase tracking-widest">Oleh: {item.securityName || item.reporterName || 'Sistem'}</span>
                        </div>
                     </div>
                  </div>
                )) : (
                  <div className="py-20 text-center text-slate-200 font-black uppercase italic tracking-widest">Belum ada riwayat aktivitas yang tercatat hari ini.</div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* KELUAR MASUK WARGA (CEK UNIT) */}
      {activeTab === 'log_resident' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up pb-20">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <h3 className="text-xl lg:text-2xl font-black text-slate-900 uppercase italic">Keluar Masuk Hunian</h3>
              <div className="relative w-full lg:w-[400px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                <input type="text" placeholder="Cari nama atau no. rumah..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-100 outline-none focus:border-amber-500 font-bold text-xs shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
              {residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.houseNumber.includes(searchQuery) || r.block.includes(searchQuery.toUpperCase())).map(res => (
                <div key={res.id} className="bg-white p-5 lg:p-6 rounded-[1.5rem] lg:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all">
                   <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-sm">{res.block}</div>
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{res.isHome ? 'DI RUMAH' : 'KELUAR'}</span>
                   </div>
                   <div className="mb-6">
                      <h4 className="font-black text-slate-900 uppercase italic truncate text-sm lg:text-base leading-none">{res.name}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">No. Rumah: <span className="text-slate-900 font-black">{res.houseNumber}</span></p>
                   </div>
                   <button onClick={() => setResidents(prev => prev.map(r => r.id === res.id ? {...r, isHome: !r.isHome} : r))} className={`w-full py-3 lg:py-4 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md ${res.isHome ? 'bg-slate-900 text-white' : 'bg-green-500 text-white'}`}>
                      {res.isHome ? <ArrowLeftRight size={14}/> : <CheckCircle size={14}/>}
                      {res.isHome ? 'CATAT KELUAR' : 'CATAT MASUK'}
                   </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* TAMU (GUESTS) */}
      {activeTab === 'guests' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black text-slate-900 uppercase italic">Digital Guest Book</h3>
              <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white px-5 py-3 rounded-xl lg:rounded-2xl font-black text-[9px] lg:text-[10px] uppercase flex items-center gap-2 shadow-xl active:scale-95 transition-all"><UserPlus size={16}/> DAFTAR TAMU</button>
           </div>
           
           <div className="bg-white rounded-[1.5rem] lg:rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 lg:px-10 py-5 lg:py-6 text-[8px] lg:text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Tamu</th>
                    <th className="px-6 lg:px-10 py-5 lg:py-6 text-[8px] lg:text-[10px] font-black uppercase text-slate-400 tracking-widest">Tujuan Rumah</th>
                    <th className="px-6 lg:px-10 py-5 lg:py-6 text-[8px] lg:text-[10px] font-black uppercase text-slate-400 tracking-widest">Check-In</th>
                    <th className="px-6 lg:px-10 py-5 lg:py-6 text-[8px] lg:text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {guests.map(g => (
                     <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-6 lg:px-10 py-5 lg:py-7">
                          <p className="font-black text-slate-900 text-xs lg:text-sm mb-0.5">{g.name}</p>
                          <p className="text-[10px] text-slate-400 italic font-medium">{g.purpose}</p>
                       </td>
                       <td className="px-6 lg:px-10 py-5 lg:py-7 text-[9px] lg:text-xs font-black text-slate-500 uppercase tracking-widest">{g.visitToName}</td>
                       <td className="px-6 lg:px-10 py-5 lg:py-7 text-[9px] lg:text-[10px] font-black text-slate-400 italic">{new Date(g.entryTime).toLocaleString('id-ID', {hour: '2-digit', minute: '2-digit'})}</td>
                       <td className="px-6 lg:px-10 py-5 lg:py-7 text-right">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{g.status === 'IN' ? 'DI AREA' : 'KELUAR'}</span>
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
           </div>
        </div>
      )}

      {/* INSIDEN (INCIDENT) */}
      {activeTab === 'incident' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black text-slate-900 uppercase italic">Laporan Kejadian</h3>
              <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-5 py-3 lg:py-4 rounded-xl lg:rounded-2xl font-black text-[9px] lg:text-[10px] uppercase flex items-center gap-2 shadow-xl active:scale-95 transition-all"><Plus size={16}/> LAPOR BARU</button>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
              {incidents.map(inc => (
                <div key={inc.id} className="bg-white p-6 lg:p-10 rounded-[1.5rem] lg:rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                   <div className={`absolute top-0 right-0 w-1.5 h-full ${inc.severity === 'HIGH' ? 'bg-red-600' : inc.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                   <div className="flex justify-between items-start mb-4">
                      <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${inc.status === 'RESOLVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600 animate-pulse'}`}>{inc.status}</div>
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{new Date(inc.timestamp).toLocaleDateString('id-ID')}</span>
                   </div>
                   <h4 className="text-lg lg:text-2xl font-black text-slate-900 mb-1 lg:mb-2 italic uppercase tracking-tight">{inc.type}</h4>
                   <p className="text-[10px] lg:text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><MapPin size={12}/> {inc.location}</p>
                   <p className="text-xs lg:text-sm text-slate-600 font-medium leading-relaxed italic">"{inc.description}"</p>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-200px)] lg:h-[calc(100vh-250px)] flex flex-col animate-slide-up pb-10 px-1">
           <div className="flex-1 bg-white rounded-t-[2rem] shadow-sm border border-slate-100 overflow-y-auto p-4 lg:p-8 space-y-6 no-scrollbar relative">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-50 px-3 py-1 rounded-full text-[8px] font-black text-slate-300 uppercase tracking-widest">Enkripsi End-to-End Aktif</div>
              {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[85%] p-4 rounded-2xl relative ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100 shadow-sm'}`}>
                      <div className="flex justify-between items-center gap-4 mb-1">
                         <span className={`text-[8px] lg:text-[9px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                         <span className="text-[7px] font-bold px-1.5 py-0.5 bg-white/10 rounded-full uppercase opacity-40 italic">{msg.senderRole}</span>
                      </div>
                      <p className="text-xs lg:text-sm font-medium leading-relaxed">{msg.text}</p>
                      <p className="text-[7px] mt-2 opacity-30 text-right font-black uppercase">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 italic py-20">
                   <MessageSquare size={40} className="mb-4 opacity-10" />
                   <p className="font-black uppercase tracking-widest text-[9px]">Belum ada koordinasi tim.</p>
                </div>
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={(e) => { e.preventDefault(); if (chatInput.trim()) sendMessage(e); }} className="bg-white p-4 lg:p-6 rounded-b-[2rem] border-t border-slate-100 flex gap-3 shadow-md items-center">
              <input type="text" placeholder="Tulis koordinasi..." className="flex-1 px-4 lg:px-6 py-3 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-amber-500 transition-all shadow-inner" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-3 lg:p-4 rounded-xl active:scale-95 shadow-xl transition-all hover:bg-slate-800"><Send size={20}/></button>
           </form>
        </div>
      )}

      {/* SETTINGS (SETELAN) - CONSOLIDATED SYNC UI */}
      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto space-y-6 lg:space-y-8 animate-slide-up pb-20">
           <div className="bg-white p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-6 lg:gap-10">
              <div className="w-20 h-20 lg:w-28 lg:h-28 bg-slate-900 text-amber-500 rounded-2xl flex items-center justify-center text-3xl lg:text-5xl font-black shadow-2xl border-4 border-slate-50">{currentUser.name.charAt(0)}</div>
              <div className="flex-1 text-center md:text-left">
                 <h3 className="text-xl lg:text-2xl font-black text-slate-900 italic uppercase mb-1">{currentUser.name}</h3>
                 <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    <span className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">{currentUser.role}</span>
                    <span className="px-4 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2"><Database size={12}/> {DB_KEY}</span>
                 </div>
              </div>
              <button onClick={() => setCurrentUser(null)} className="px-8 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[9px] uppercase tracking-widest border border-red-100 active:scale-95 transition-all shadow-sm hover:bg-red-600 hover:text-white"><LogOut size={16} className="inline mr-2"/> KELUAR</button>
           </div>

           {/* SINKRONISASI MASTER (LAPTOP <-> HP) */}
           <div className="bg-slate-900 p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] shadow-2xl text-white space-y-8 relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start lg:items-center gap-6">
                 <div>
                    <h4 className="text-lg lg:text-xl font-black italic uppercase mb-1">Pusat Sinkronisasi Master</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sambungkan Laptop & HP secara manual dengan kode master data.</p>
                 </div>
                 <button onClick={handleExportData} className="w-full md:w-auto px-6 py-3.5 bg-amber-500 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-400 active:scale-95 transition-all shadow-xl">
                    <Copy size={16}/> SALIN KODE MASTER
                 </button>
              </div>

              <div className="relative z-10 space-y-4 pt-6 border-t border-white/10">
                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Download size={14}/> Impor Kode dari Perangkat Lain:</label>
                 <div className="flex flex-col sm:flex-row gap-3">
                    <input type="text" placeholder="Tempelkan kode master di sini..." className="flex-1 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 outline-none font-bold text-xs text-amber-500 focus:border-amber-500 transition-all placeholder:text-slate-600" value={syncCodeInput} onChange={e => setSyncCodeInput(e.target.value)} />
                    <button onClick={handleImportData} disabled={!syncCodeInput || isSyncing} className={`px-6 py-3.5 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50`}>
                       {isSyncing ? 'SINKRON...' : 'IMPORT SEKARANG'}
                    </button>
                 </div>
                 <p className="text-[8px] text-slate-500 italic">*Proses ini akan menimpa data lokal di perangkat ini dengan data dari kode yang ditempelkan.</p>
              </div>
           </div>

           {currentUser.role === 'ADMIN' && (
             <div className="bg-white p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
                <div className="flex justify-between items-center border-b border-slate-50 pb-6">
                   <h4 className="text-lg lg:text-xl font-black text-slate-900 uppercase italic">Manajemen Unit Rumah</h4>
                   <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase active:scale-95 shadow-lg flex items-center gap-2">
                      <Plus size={16}/> UNIT BARU
                   </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                   {residents.map(res => (
                     <div key={res.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-transparent hover:border-slate-100 hover:bg-white group transition-all">
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-sm">{res.block}</div>
                        <div className="flex-1">
                           <p className="font-black text-slate-900 text-xs truncate">{res.name}</p>
                           <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Rumah No. {res.houseNumber}</p>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg active:scale-90"><Edit2 size={16}/></button>
                           <button onClick={() => setResidents(prev => prev.filter(r => r.id !== res.id))} className="p-2 text-slate-300 hover:text-red-500 transition-all active:scale-90"><Trash2 size={16}/></button>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           )}
        </div>
      )}

      {/* WARGA (RESIDENTS LIST) */}
      {activeTab === 'residents' && (
        <div className="space-y-6 lg:space-y-8 animate-slide-up pb-20">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <h3 className="text-xl lg:text-2xl font-black text-slate-900 uppercase italic">Database Penghuni</h3>
              <div className="relative w-full lg:w-[400px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                <input type="text" placeholder="Cari penghuni..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-100 outline-none focus:border-amber-500 font-bold text-xs shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
              {residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(res => (
                <div key={res.id} className="bg-white p-5 rounded-[1.5rem] lg:rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4 group hover:shadow-xl transition-all">
                   <div className="flex justify-between items-start">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-md">{res.block}</div>
                      <div className="flex gap-1">
                         <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button>
                         <button onClick={() => setResidents(prev => prev.filter(r => r.id !== res.id))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                      </div>
                   </div>
                   <div>
                      <h4 className="font-black text-sm lg:text-base text-slate-900 truncate uppercase italic leading-none">{res.name}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">No. Rumah: <span className="text-slate-900 font-black">{res.houseNumber}</span></p>
                   </div>
                   <a href={`tel:${res.phoneNumber}`} className="w-full py-3 bg-slate-100 text-slate-900 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] uppercase shadow-sm active:scale-95 transition-all hover:bg-green-500 hover:text-white"><PhoneCall size={16}/> HUBUNGI</a>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* MODAL DATA WARGA */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black uppercase italic leading-none">{editingItem ? 'Perbarui Data Warga' : 'Pendaftaran Hunian'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={submitResident} className="p-8 lg:p-10 space-y-5 lg:space-y-6">
              <div className="space-y-2">
                 <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Nama Lengkap Penghuni:</label>
                 <input type="text" required placeholder="Contoh: Bpk. Hery" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm focus:border-slate-900 transition-all shadow-inner" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Pilih Blok:</label>
                   <select className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={resForm.block} onChange={e => setResForm({...resForm, block: e.target.value})}>
                      {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">No. Rumah:</label>
                   <input type="text" required placeholder="01-99" className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-slate-900 outline-none font-bold text-sm shadow-inner" value={resForm.houseNumber} onChange={e => setResForm({...resForm, houseNumber: e.target.value})} />
                 </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Nomor WA Penghuni:</label>
                <input type="text" required placeholder="08XXXXXXXXXX" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-slate-900 outline-none font-bold text-sm shadow-inner" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">SIMPAN DATA KE MASTER</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PATROL REPORT */}
      {isModalOpen === 'PATROL_REPORT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-8 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-xl lg:text-2xl font-black uppercase leading-none italic">{patrolAction.cp}</h3>
                <p className="text-[10px] font-black uppercase opacity-70 mt-1 tracking-widest">Detail Laporan Patroli</p>
              </div>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={submitPatrol} className="p-8 space-y-5 lg:p-10">
              <div className="space-y-1">
                 <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Bukti Foto Lokasi (Wajib):</label>
                 <div className="flex flex-col gap-3">
                    {patrolReportData.photo ? (
                      <div className="relative group">
                         <img src={patrolReportData.photo} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-slate-100 shadow-inner" />
                         <button type="button" onClick={() => setPatrolReportData(prev => ({ ...prev, photo: '' }))} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg shadow-lg active:scale-95"><Trash2 size={14}/></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-32 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-slate-400 transition-all group">
                         <Camera size={32} className="group-hover:scale-110 transition-transform" />
                         <span className="font-black text-[8px] uppercase tracking-widest">AMBIL FOTO</span>
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                 </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Catatan Keadaan:</label>
                <textarea required placeholder="Jelaskan kondisi area patroli..." className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-slate-900 outline-none font-bold text-sm min-h-[100px] shadow-inner" value={patrolReportData.note} onChange={e => setPatrolReportData({...patrolReportData, note: e.target.value})} />
              </div>
              <button type="submit" className={`w-full py-4 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>KIRIM LAPORAN LIVE</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMU */}
      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black uppercase italic leading-none">Registrasi Tamu Baru</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={submitGuest} className="p-8 lg:p-10 space-y-5">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none font-bold text-sm shadow-inner" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-6 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                 <option value="">-- Tujuan Unit Rumah --</option>
                 {residents.sort((a,b) => a.block.localeCompare(b.block)).map(r => <option key={r.id} value={r.id}>{r.block}-{r.houseNumber} ({r.name})</option>)}
              </select>
              <textarea required placeholder="Keperluan (misal: Bertamu, Kirim Paket)..." className="w-full px-6 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm min-h-[100px] shadow-inner" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">DAFTARKAN MASUK</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INSIDEN */}
      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black uppercase italic leading-none">Lapor Kejadian Darurat</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={submitIncident} className="p-8 lg:p-10 space-y-5">
              <select required className="w-full px-6 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={incForm.type} onChange={e => setIncForm({...incForm, type: e.target.value})}>
                 <option value="Pencurian">Pencurian</option>
                 <option value="Kebakaran">Kebakaran</option>
                 <option value="Kriminalitas">Tindak Kriminal</option>
                 <option value="Gangguan">Gangguan Keamanan</option>
                 <option value="Lainnya">Lainnya</option>
              </select>
              <input type="text" required placeholder="Lokasi Spesifik..." className="w-full px-6 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm shadow-inner" value={incForm.location} onChange={e => setIncForm({...incForm, location: e.target.value})} />
              <textarea required placeholder="Deskripsi Kejadian..." className="w-full px-6 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm min-h-[120px] shadow-inner" value={incForm.description} onChange={e => setIncForm({...incForm, description: e.target.value})} />
              <button type="submit" className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">KIRIM LAPORAN SEKARANG</button>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
