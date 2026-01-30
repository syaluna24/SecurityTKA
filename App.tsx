
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
  Activity, MessageSquare, Radio, LogOut, Camera, Trash2, UserCog, Database, PhoneCall, ArrowLeftRight, Copy, Download, ClipboardCheck, BookOpen, FileText, UserCheck, RefreshCw, Ghost
} from 'lucide-react';
import { getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { subscribeTable } from './services/supabaseService.ts';
import { db } from './lib/db.ts';

const DB_KEY = 'tka_secure_pro_v15';

const App: React.FC = () => {
  // --- DATABASE STATES ---
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
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'offline'>('offline');
  
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'CHECKPOINT' | 'GUEST' | 'INCIDENT' | 'PATROL_REPORT' | 'STAFF' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');

  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '' });
  const [incForm, setIncForm] = useState<Partial<IncidentReport>>({ type: 'Pencurian', location: '', description: '', severity: 'MEDIUM' });
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

  // Cloud Sync via Prisma-like wrapper
  useEffect(() => {
    const initCloud = async () => {
      try {
        const [res, logs, inc, gst, chat] = await Promise.all([
          db.resident.findMany(),
          db.patrol.findMany(),
          db.incident.findMany(),
          db.guest.findMany(),
          db.chat.findMany()
        ]);
        
        if (res.length) setResidents(res);
        if (logs.length) setPatrolLogs(logs);
        if (inc.length) setIncidents(inc);
        if (gst.length) setGuests(gst);
        if (chat.length) setChatMessages(chat);
        
        setCloudStatus('connected');

        subscribeTable('residents', (p) => {
          if (p.eventType === 'INSERT') setResidents(prev => [p.new as Resident, ...prev]);
          if (p.eventType === 'UPDATE') setResidents(prev => prev.map(r => r.id === p.new.id ? p.new as Resident : r));
        });
        subscribeTable('patrol_logs', (p) => {
          if (p.eventType === 'INSERT') setPatrolLogs(prev => [p.new as PatrolLog, ...prev]);
        });
        subscribeTable('incidents', (p) => {
          if (p.eventType === 'INSERT') setIncidents(prev => [p.new as IncidentReport, ...prev]);
        });
      } catch (e) {
        setCloudStatus('offline');
      }
    };
    initCloud();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const hour = new Date().getHours();
      const shiftName = hour >= 7 && hour < 19 ? 'Pagi' : 'Malam';
      getSecurityBriefing(shiftName).then(setSecurityBriefing);
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
      setLoginError(isAdmin ? 'PIN Admin Salah' : 'PIN Salah');
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

  const submitResident = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: Resident = { 
      id: editingItem?.id || `r-${Date.now()}`, 
      name: resForm.name || '', houseNumber: resForm.houseNumber || '', 
      block: resForm.block || BLOCKS[0], phoneNumber: resForm.phoneNumber || '', 
      isHome: resForm.isHome ?? true 
    };

    if (editingItem) {
      setResidents(prev => prev.map(r => r.id === editingItem.id ? data : r));
      await db.resident.update(data.id, data);
    } else {
      setResidents(prev => [data, ...prev]);
      await db.resident.create(data);
    }
    setIsModalOpen(null);
    setEditingItem(null);
  };

  const submitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !incForm.description) return;
    const log: IncidentReport = {
      id: `inc-${Date.now()}`, reporterId: currentUser.id, reporterName: currentUser.name, 
      timestamp: new Date().toISOString(), type: incForm.type || 'Lainnya', 
      description: incForm.description || '', location: incForm.location || 'Area Perumahan',
      status: 'PENDING', severity: (incForm.severity as any) || 'MEDIUM'
    };
    setIncidents(prev => [log, ...prev]);
    await db.incident.create(log);
    setIsModalOpen(null);
  };

  const submitPatrol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !patrolReportData.photo) return;
    const log: PatrolLog = {
      id: `p-${Date.now()}`, securityId: currentUser.id, securityName: currentUser.name, 
      timestamp: new Date().toISOString(), checkpoint: patrolAction.cp, 
      status: patrolAction.status, note: patrolReportData.note, photo: patrolReportData.photo
    };
    setPatrolLogs(prev => [log, ...prev]);
    await db.patrol.create(log);
    setIsModalOpen(null);
  };

  const submitGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestForm.name || !guestForm.visitToId) return;
    const resTarget = residents.find(r => r.id === guestForm.visitToId);
    const log: GuestLog = {
      id: `g-${Date.now()}`, name: guestForm.name, visitToId: guestForm.visitToId,
      visitToName: resTarget ? `${resTarget.name} (${resTarget.block}-${resTarget.houseNumber})` : 'Unit',
      purpose: guestForm.purpose || 'Kunjungan', entryTime: new Date().toISOString(), status: 'IN'
    };
    setGuests(prev => [log, ...prev]);
    await db.guest.create(log);
    setIsModalOpen(null);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`, senderId: currentUser.id, senderName: currentUser.name, 
      senderRole: currentUser.role, text: chatInput, timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, msg]);
    await db.chat.create(msg);
    setChatInput('');
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

  // --- RENDER ---
  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? staff : loginTab === 'ADMIN' ? ADMIN_USERS : residents.map(r => ({ id: r.id, name: r.name, sub: `${r.block}-${r.houseNumber}` }));
    const filteredPool = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()));

    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[950px] flex flex-col md:flex-row rounded-[2.5rem] shadow-2xl overflow-hidden">
          <div className="w-full md:w-5/12 bg-slate-900 p-8 lg:p-12 text-white flex flex-col justify-between relative">
            <div>
              <div className="bg-amber-500 w-16 h-16 rounded-3xl flex items-center justify-center mb-10 shadow-2xl">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-3xl lg:text-4xl font-black mb-4 tracking-tighter italic uppercase">TKA SECURE <br/><span className="text-amber-500 not-italic text-2xl font-light">Prisma Edition</span></h1>
              <p className="text-slate-400 text-sm italic">Cloud Unified Security Management.</p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
               <div className={`w-2 h-2 rounded-full animate-pulse ${cloudStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{cloudStatus === 'connected' ? 'Prisma Live' : 'Offline'}</span>
            </div>
          </div>
          <div className="w-full md:w-7/12 p-8 lg:p-14 h-[650px] lg:h-[750px] flex flex-col bg-white overflow-y-auto no-scrollbar">
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight italic uppercase">Pintu Masuk</h2>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); setLoginSearch(''); }}
                  className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="relative mb-6">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder={`Cari ${loginTab}...`} className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-500 outline-none font-bold text-sm transition-all" value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto pr-1 mb-6 space-y-3 no-scrollbar">
              {filteredPool.map((u: any) => (
                <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setLoginError(''); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50 shadow-lg' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-900 text-base truncate uppercase">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{u.sub || 'Akses Sistem'}</p>
                  </div>
                </button>
              ))}
            </div>
            {selectedUser && (
              <form onSubmit={handleLogin} className="pt-8 border-t border-slate-100 space-y-5">
                <input type="password" required placeholder="PIN" className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-2xl tracking-[0.6em] text-center" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all">MASUK SISTEM <ArrowRight size={20} /></button>
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
        <div className="space-y-8 animate-slide-up pb-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[
              { label: 'Petugas Aktif', val: stats.activeGuards, icon: <UserCheck size={24}/>, color: 'blue' },
              { label: 'Insiden Aktif', val: stats.pendingIncidents, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Hari Ini', val: stats.guestsIn, icon: <Users size={24}/>, color: 'amber' },
              { label: 'Total Unit', val: stats.totalResidents, icon: <Home size={24}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                <p className="text-2xl font-black text-slate-900">{s.val}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[400px]">
               <h3 className="text-xl font-black text-slate-900 mb-10 flex items-center gap-4 uppercase italic"><Activity size={24} className="text-amber-500 animate-pulse"/> Analisis Keamanan</h3>
               <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                      <Bar dataKey="val" radius={[8, 8, 8, 8]} barSize={55}>
                        {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#EF4444'][index % 3]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between">
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <Radio size={32} className="text-amber-500 animate-pulse"/>
                    <h3 className="font-black text-2xl uppercase italic leading-none">Briefing AI</h3>
                  </div>
                  <p className="text-slate-400 text-sm italic leading-relaxed font-medium">"{securityBriefing || 'Memuat instruksi terbaru...'}"</p>
               </div>
               <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all mt-10">GROUP CHAT <ArrowRight size={20}/></button>
            </div>
          </div>
        </div>
      )}

      {/* WARGA & CEK UNIT */}
      {(activeTab === 'residents' || activeTab === 'log_resident') && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">{activeTab === 'residents' ? 'Database Warga' : 'Monitor Kehadiran'}</h3>
              <div className="flex gap-4">
                 <div className="relative w-full lg:w-[450px]">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    <input type="text" placeholder="Cari penghuni..." className="w-full pl-14 pr-6 py-4 rounded-[1.8rem] bg-white border border-slate-100 outline-none focus:border-amber-500 font-bold text-sm shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                 </div>
                 {currentUser.role === 'ADMIN' && activeTab === 'residents' && (
                    <button onClick={() => { setEditingItem(null); setResForm({ name: '', block: BLOCKS[0], houseNumber: '' }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl active:scale-95"><Plus size={24}/></button>
                 )}
              </div>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.houseNumber.includes(searchQuery)).map(res => (
                <div key={res.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all group">
                   <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-[1.2rem] flex items-center justify-center font-black text-sm group-hover:bg-amber-500 transition-colors">{res.block}</div>
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{res.isHome ? 'DI RUMAH' : 'KELUAR'}</span>
                   </div>
                   <div className="mb-8">
                      <h4 className="font-black text-slate-900 uppercase italic truncate text-base leading-none">{res.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">No. Rumah: <span className="text-slate-900">{res.houseNumber}</span></p>
                   </div>
                   {activeTab === 'log_resident' ? (
                     <button onClick={() => setResidents(prev => prev.map(r => r.id === res.id ? {...r, isHome: !r.isHome} : r))} className={`w-full py-4 rounded-[1.5rem] font-black text-[10px] uppercase flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg ${res.isHome ? 'bg-slate-900 text-white' : 'bg-green-500 text-white'}`}>
                        <ArrowLeftRight size={18}/> {res.isHome ? 'KELUAR' : 'MASUK'}
                     </button>
                   ) : (
                     <div className="flex gap-2">
                        <a href={`tel:${res.phoneNumber}`} className="flex-1 py-4 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center gap-2 font-black text-[9px] uppercase hover:bg-green-500 hover:text-white transition-all"><PhoneCall size={16}/> HUBUNGI</a>
                        {currentUser.role === 'ADMIN' && (
                          <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-4 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-2xl transition-all"><Edit2 size={16}/></button>
                        )}
                     </div>
                   )}
                </div>
              ))}
              {residents.length === 0 && (
                <div className="col-span-full py-24 text-center">
                  <Ghost size={64} className="mx-auto text-slate-100 mb-4"/>
                  <p className="font-black text-slate-300 uppercase italic">Data Warga Kosong</p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* INSIDEN */}
      {activeTab === 'incident' && (
        <div className="space-y-8 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Laporan Insiden</h3>
              <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase flex items-center gap-3 shadow-2xl active:scale-95 transition-all"><Plus size={20}/> LAPOR BARU</button>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {incidents.map(inc => (
                <div key={inc.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
                   <div className={`absolute top-0 right-0 w-2 h-full ${inc.severity === 'HIGH' ? 'bg-red-600' : inc.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                   <div className="flex justify-between items-start mb-6">
                      <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${inc.status === 'RESOLVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600 animate-pulse'}`}>{inc.status}</div>
                      <span className="text-[11px] font-black text-slate-300 uppercase">{new Date(inc.timestamp).toLocaleDateString('id-ID')}</span>
                   </div>
                   <h4 className="text-xl lg:text-2xl font-black text-slate-900 mb-2 italic uppercase tracking-tight">{inc.type}</h4>
                   <p className="text-[11px] lg:text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 italic"><MapPin size={14}/> {inc.location}</p>
                   <p className="text-sm lg:text-base text-slate-600 font-medium leading-relaxed italic border-l-4 border-slate-100 pl-4">"{inc.description}"</p>
                </div>
              ))}
              {incidents.length === 0 && (
                <div className="col-span-full py-24 text-center">
                  <Ghost size={64} className="mx-auto text-slate-50 mb-4"/>
                  <p className="font-black text-slate-300 uppercase italic">Tidak Ada Insiden Aktif</p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* FEED (REPORTS) */}
      {activeTab === 'reports' && (
        <div className="space-y-8 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Aktivitas Real-Time</h3>
              <div className="flex items-center gap-3">
                 <Radio size={20} className="text-green-500 animate-pulse"/>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Updates</span>
              </div>
           </div>
           <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="space-y-12">
                {liveTimeline.length > 0 ? liveTimeline.map((item: any, idx) => (
                  <div key={idx} className="flex gap-6 lg:gap-10 group">
                     <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${item.feedType === 'PATROL' ? 'bg-slate-900 text-white' : item.feedType === 'INCIDENT' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                           {item.feedType === 'PATROL' ? <ClipboardCheck size={26}/> : item.feedType === 'INCIDENT' ? <AlertTriangle size={26}/> : <BookOpen size={26}/>}
                        </div>
                        <div className="w-0.5 flex-1 bg-slate-100 mt-6 group-last:hidden"></div>
                     </div>
                     <div className="flex-1 pb-12 border-b border-slate-50 last:border-none">
                        <div className="flex justify-between items-center mb-3">
                           <h4 className="font-black text-slate-900 text-base lg:text-lg uppercase italic">{item.feedType === 'PATROL' ? `Patroli: ${item.checkpoint}` : item.feedType === 'INCIDENT' ? `Insiden: ${item.type}` : `Kunjungan Tamu`}</h4>
                           <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{new Date(item.sortTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-sm lg:text-base text-slate-500 font-medium mb-6 italic leading-relaxed">
                          {item.feedType === 'PATROL' ? `Status: ${item.status}. ${item.note || ''}` : item.description || `Tamu ${item.name} terdaftar ke ${item.visitToName}.`}
                        </p>
                        {item.photo && <img src={item.photo} alt="Bukti" className="mb-6 rounded-[2rem] w-full max-w-md border border-slate-100 shadow-xl" />}
                        <div className="flex flex-wrap gap-3">
                           <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${item.status === 'OK' || item.status === 'RESOLVED' || item.status === 'IN' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{item.status || 'AKTIF'}</span>
                           <span className="px-4 py-2 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase">Oleh: {item.securityName || item.reporterName || 'Sistem'}</span>
                        </div>
                     </div>
                  </div>
                )) : (
                  <div className="py-24 text-center">
                     <p className="font-black text-slate-200 uppercase tracking-widest italic">Belum Ada Riwayat Aktivitas</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-220px)] lg:h-[calc(100vh-250px)] flex flex-col animate-slide-up pb-10">
           <div className="flex-1 bg-white rounded-t-[3rem] shadow-sm border border-slate-100 overflow-y-auto p-6 lg:p-10 space-y-8 no-scrollbar relative">
              {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[85%] p-6 rounded-[2.5rem] relative shadow-sm ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-6 mb-2">
                         <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                         <span className="text-[8px] font-bold px-2 py-0.5 bg-white/10 rounded-full uppercase italic">{msg.senderRole}</span>
                      </div>
                      <p className="text-sm lg:text-base font-medium leading-relaxed">{msg.text}</p>
                      <p className={`text-[8px] mt-3 opacity-30 text-right font-black uppercase tracking-widest`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-200 italic py-24">
                   <MessageSquare size={64} className="mb-6 opacity-5" />
                   <p className="font-black uppercase tracking-[0.3em] text-[10px]">Koordinasi Tim Satpam</p>
                </div>
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={sendMessage} className="bg-white p-6 rounded-b-[3rem] border-t border-slate-100 flex gap-4 shadow-xl items-center">
              <input type="text" placeholder="Tulis instruksi..." className="flex-1 px-8 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-amber-500 transition-all shadow-inner" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-5 rounded-2xl active:scale-95 transition-all shadow-2xl hover:bg-slate-800"><Send size={26}/></button>
           </form>
        </div>
      )}

      {/* PATROL CONTROL */}
      {activeTab === 'patrol' && (
        <div className="space-y-8 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Kontrol Wilayah</h3>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => setIsModalOpen('CHECKPOINT')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 shadow-2xl active:scale-95"><Plus size={20}/> TITIK BARU</button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {checkpoints.map((cp, idx) => {
                const logsForCp = patrolLogs.filter(l => l.checkpoint === cp);
                const last = logsForCp[0];
                return (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-2xl transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start mb-8">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-slate-900 text-white flex items-center justify-center font-black text-2xl group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors shadow-lg">{idx + 1}</div>
                        {last && <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${last.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{last.status}</span>}
                      </div>
                      <h4 className="text-xl font-black text-slate-900 mb-10 tracking-tight uppercase italic leading-tight">{cp}</h4>
                    </div>
                    {currentUser.role === 'SECURITY' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => { setPatrolAction({cp, status: 'OK'}); setIsModalOpen('PATROL_REPORT'); }} className="py-5 bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase active:scale-95 shadow-lg">AMAN</button>
                        <button onClick={() => { setPatrolAction({cp, status: 'DANGER'}); setIsModalOpen('PATROL_REPORT'); }} className="py-5 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase active:scale-95 shadow-lg">BAHAYA</button>
                      </div>
                    ) : (
                      <div className="text-[10px] font-black text-slate-400 uppercase border-t pt-6 italic truncate">Log: {last ? `${last.securityName} (${new Date(last.timestamp).toLocaleTimeString()})` : 'Belum Dicek'}</div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* GUEST LOG */}
      {activeTab === 'guests' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Buku Tamu Digital</h3>
              <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase flex items-center gap-3 shadow-2xl active:scale-95 transition-all"><UserPlus size={20}/> REGISTRASI TAMU</button>
           </div>
           <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tamu</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tujuan</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Check-In</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {guests.map(g => (
                     <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-10 py-8">
                          <p className="font-black text-slate-900 text-sm lg:text-base italic uppercase">{g.name}</p>
                          <p className="text-[11px] text-slate-400">"{g.purpose}"</p>
                       </td>
                       <td className="px-10 py-8 text-xs font-black text-slate-500 uppercase tracking-widest">{g.visitToName}</td>
                       <td className="px-10 py-8 text-[11px] font-black text-slate-400">{new Date(g.entryTime).toLocaleString('id-ID')}</td>
                       <td className="px-10 py-8 text-right">
                          <span className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${g.status === 'IN' ? 'bg-green-100 text-green-600 shadow-sm' : 'bg-slate-100 text-slate-400'}`}>{g.status === 'IN' ? 'DI AREA' : 'KELUAR'}</span>
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
           </div>
        </div>
      )}

      {/* SETTINGS (SINKRONISASI) */}
      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-slide-up pb-20">
           <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-10">
              <div className="w-24 h-24 lg:w-28 lg:h-28 bg-slate-900 text-amber-500 rounded-[2rem] flex items-center justify-center text-4xl lg:text-5xl font-black shadow-2xl border-4 border-slate-50">{currentUser.name.charAt(0)}</div>
              <div className="flex-1 text-center md:text-left">
                 <h3 className="text-2xl lg:text-3xl font-black text-slate-900 italic uppercase mb-2 leading-none">{currentUser.name}</h3>
                 <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    <span className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">{currentUser.role}</span>
                    <span className="px-5 py-2 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><RefreshCw size={12}/> Prisma Sync On</span>
                 </div>
              </div>
              <button onClick={() => setCurrentUser(null)} className="px-10 py-5 bg-red-50 text-red-600 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest border border-red-100 shadow-sm active:scale-95 transition-all hover:bg-red-600 hover:text-white"><LogOut size={18} className="inline mr-2"/> KELUAR</button>
           </div>
           <div className="bg-slate-900 p-8 lg:p-12 rounded-[3.5rem] shadow-2xl text-white">
              <h4 className="text-xl lg:text-2xl font-black italic uppercase mb-4">Integrasi Prisma Cloud</h4>
              <p className="text-slate-400 text-sm mb-8">Data disinkronkan secara otomatis ke Vercel Postgres melalui lapisan ORM Prisma.</p>
              <div className="flex gap-4">
                 <button onClick={() => {
                   const code = btoa(encodeURIComponent(JSON.stringify({ residents, incidents, patrolLogs, guests, chatMessages, checkpoints, staff })));
                   navigator.clipboard.writeText(code);
                   alert("Kode Sinkronisasi disalin!");
                 }} className="px-8 py-5 bg-amber-500 text-slate-900 rounded-[1.5rem] font-black text-[10px] uppercase shadow-2xl active:scale-95">SALIN KODE MASTER</button>
              </div>
           </div>
        </div>
      )}

      {/* MODALS */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic leading-none">{editingItem ? 'Edit Data Warga' : 'Warga Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={submitResident} className="p-10 space-y-6">
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nama Lengkap:</label>
                 <input type="text" required placeholder="Nama Penghuni" className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-slate-900" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Blok:</label>
                   <select className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={resForm.block} onChange={e => setResForm({...resForm, block: e.target.value})}>
                      {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                   </select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">No. Rumah:</label>
                   <input type="text" required placeholder="01-99" className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-slate-900 outline-none font-bold text-sm" value={resForm.houseNumber} onChange={e => setResForm({...resForm, houseNumber: e.target.value})} />
                 </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">No. WhatsApp:</label>
                <input type="text" required placeholder="08XXXXXXXXXX" className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-slate-900" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all">SIMPAN DATA MASTER</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INCIDENT */}
      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 lg:p-10 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black uppercase italic">Lapor Darurat</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={submitIncident} className="p-8 lg:p-12 space-y-6">
              <select required className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 border-2 border-transparent focus:border-red-600 outline-none font-bold text-sm shadow-inner transition-all" value={incForm.type} onChange={e => setIncForm({...incForm, type: e.target.value})}>
                 <option value="Pencurian">Pencurian</option>
                 <option value="Kebakaran">Kebakaran</option>
                 <option value="Kriminalitas">Kriminalitas</option>
                 <option value="Gangguan">Gangguan Keamanan</option>
                 <option value="Lainnya">Lainnya</option>
              </select>
              <input type="text" required placeholder="Lokasi Kejadian..." className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 outline-none font-bold text-sm" value={incForm.location} onChange={e => setIncForm({...incForm, location: e.target.value})} />
              <textarea required placeholder="Deskripsi kejadian..." className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 outline-none font-bold text-sm min-h-[140px]" value={incForm.description} onChange={e => setIncForm({...incForm, description: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-red-600 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all">KIRIM LAPORAN SEKARANG</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PATROL REPORT */}
      {isModalOpen === 'PATROL_REPORT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-8 lg:p-10 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-xl font-black uppercase italic leading-none">{patrolAction.cp}</h3>
                <p className="text-[10px] font-black uppercase opacity-70 mt-1">Laporan Lapangan</p>
              </div>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={submitPatrol} className="p-8 lg:p-12 space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-slate-400">Foto Bukti (Wajib):</label>
                 <div className="flex flex-col gap-4">
                    {patrolReportData.photo ? (
                      <div className="relative group">
                         <img src={patrolReportData.photo} alt="Preview" className="w-full h-48 object-cover rounded-[2rem] border-2 border-slate-100 shadow-inner" />
                         <button type="button" onClick={() => setPatrolReportData(prev => ({ ...prev, photo: '' }))} className="absolute top-4 right-4 p-3 bg-red-600 text-white rounded-2xl shadow-2xl"><Trash2 size={20}/></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-48 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-slate-400 transition-all">
                         <Camera size={48} />
                         <span className="font-black text-[10px] uppercase">AMBIL FOTO</span>
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                 </div>
              </div>
              <textarea required placeholder="Catatan keadaan area..." className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 outline-none font-bold text-sm min-h-[140px]" value={patrolReportData.note} onChange={e => setPatrolReportData({...patrolReportData, note: e.target.value})} />
              <button type="submit" className={`w-full py-5 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>SIMPAN LAPORAN</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GUEST */}
      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 lg:p-10 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black uppercase italic leading-none">Registrasi Tamu</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={submitGuest} className="p-8 lg:p-12 space-y-6">
              <input type="text" required placeholder="Nama Tamu" className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none font-bold text-sm shadow-inner" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 outline-none font-bold text-sm" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                 <option value="">-- Pilih Unit Tujuan --</option>
                 {residents.map(r => <option key={r.id} value={r.id}>{r.block}-{r.houseNumber} ({r.name})</option>)}
              </select>
              <textarea required placeholder="Keperluan..." className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 outline-none font-bold text-sm" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all">DAFTAR TAMU MASUK</button>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
