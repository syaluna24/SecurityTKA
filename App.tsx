
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
  Activity, MessageSquare, Radio, LogOut, Camera, Trash2, UserCheck, RefreshCw, Ghost, PhoneCall, ArrowLeftRight, ClipboardCheck, BookOpen
} from 'lucide-react';
import { getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { db } from './lib/db.ts';

const DB_KEY = 'tka_secure_prisma_v1';

const App: React.FC = () => {
  // --- DATABASE STATES ---
  const [residents, setResidents] = useState<Resident[]>([]);
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [guests, setGuests] = useState<GuestLog[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [checkpoints, setCheckpoints] = useState<string[]>(INITIAL_CHECKPOINTS);
  const [staff, setStaff] = useState<User[]>(INITIAL_SECURITY);

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
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'syncing' | 'offline'>('syncing');
  
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'CHECKPOINT' | 'GUEST' | 'INCIDENT' | 'PATROL_REPORT' | 'STAFF' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');

  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [incForm, setIncForm] = useState<Partial<IncidentReport>>({ type: 'Pencurian', location: '', description: '', severity: 'MEDIUM' });
  const [patrolAction, setPatrolAction] = useState<{cp: string, status: 'OK' | 'WARNING' | 'DANGER'}>({ cp: '', status: 'OK' });
  const [patrolReportData, setPatrolReportData] = useState({ note: '', photo: '' });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INITIAL FETCH & REAL-TIME SYNC ---
  useEffect(() => {
    const loadData = async () => {
      try {
        setCloudStatus('syncing');
        const [res, logs, inc, chat] = await Promise.all([
          db.resident.findMany(),
          db.patrol.findMany(),
          db.incident.findMany(),
          db.chat.findMany()
        ]);
        
        // Gabungkan data cloud dengan mock jika data cloud masih kosong (untuk user baru)
        setResidents(res.length > 0 ? res : MOCK_RESIDENTS);
        setPatrolLogs(logs);
        setIncidents(inc.length > 0 ? inc : MOCK_INCIDENTS);
        setChatMessages(chat);
        setCloudStatus('connected');
      } catch (e) {
        console.error("Fetch Error:", e);
        setCloudStatus('offline');
      }
    };

    loadData();

    // SINKRONISASI REAL-TIME (PRISMA-STYLE)
    const resSub = db.resident.subscribe((p) => {
      if (p.eventType === 'INSERT') setResidents(prev => [p.new as Resident, ...prev]);
      if (p.eventType === 'UPDATE') setResidents(prev => prev.map(r => r.id === p.new.id ? p.new as Resident : r));
      if (p.eventType === 'DELETE') setResidents(prev => prev.filter(r => r.id !== p.old.id));
    });

    const incSub = db.incident.subscribe((p) => {
      if (p.eventType === 'INSERT') setIncidents(prev => [p.new as IncidentReport, ...prev]);
      if (p.eventType === 'UPDATE') setIncidents(prev => prev.map(i => i.id === p.new.id ? p.new as IncidentReport : i));
    });

    const patrolSub = db.patrol.subscribe((p) => {
      if (p.eventType === 'INSERT') setPatrolLogs(prev => [p.new as PatrolLog, ...prev]);
    });

    const chatSub = db.chat.subscribe((p) => {
      if (p.eventType === 'INSERT') setChatMessages(prev => [...prev, p.new as ChatMessage]);
    });

    return () => {
      resSub.unsubscribe();
      incSub.unsubscribe();
      patrolSub.unsubscribe();
      chatSub.unsubscribe();
    };
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
      setLoginError(isAdmin ? 'PIN Admin Salah (admin123)' : 'PIN Salah (1234)');
    }
  };

  const submitResident = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<Resident> = { 
      name: resForm.name, 
      houseNumber: resForm.houseNumber, 
      block: resForm.block, 
      phoneNumber: resForm.phoneNumber || '', 
      isHome: resForm.isHome ?? true 
    };

    if (editingItem) {
      await db.resident.update(editingItem.id, data);
    } else {
      await db.resident.create({ ...data, id: `r-${Date.now()}` });
    }
    
    setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
    setIsModalOpen(null);
    setEditingItem(null);
  };

  const submitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !incForm.description) return;
    const log: Partial<IncidentReport> = {
      id: `inc-${Date.now()}`, 
      reporterId: currentUser.id, 
      reporterName: currentUser.name, 
      timestamp: new Date().toISOString(), 
      type: incForm.type || 'Lainnya', 
      description: incForm.description || '', 
      location: incForm.location || 'Area Perumahan',
      status: 'PENDING', 
      severity: (incForm.severity as any) || 'MEDIUM'
    };
    await db.incident.create(log);
    setIsModalOpen(null);
    setIncForm({ type: 'Pencurian', location: '', description: '', severity: 'MEDIUM' });
  };

  const submitPatrol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !patrolReportData.photo) return;
    const log: Partial<PatrolLog> = {
      id: `p-${Date.now()}`, 
      securityId: currentUser.id, 
      securityName: currentUser.name, 
      timestamp: new Date().toISOString(), 
      checkpoint: patrolAction.cp, 
      status: patrolAction.status, 
      note: patrolReportData.note, 
      photo: patrolReportData.photo
    };
    await db.patrol.create(log);
    setIsModalOpen(null);
    setPatrolReportData({ note: '', photo: '' });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    const msg: Partial<ChatMessage> = {
      id: `msg-${Date.now()}`, 
      senderId: currentUser.id, 
      senderName: currentUser.name, 
      senderRole: currentUser.role, 
      text: chatInput, 
      timestamp: new Date().toISOString()
    };
    await db.chat.create(msg);
    setChatInput('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPatrolReportData(prev => ({ ...prev, photo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const toggleHomeStatus = async (res: Resident) => {
    await db.resident.update(res.id, { isHome: !res.isHome });
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
              <h1 className="text-3xl lg:text-4xl font-black mb-4 tracking-tighter italic uppercase leading-tight">TKA SECURE <br/><span className="text-amber-500 not-italic text-2xl font-light">Prisma Cloud</span></h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-[280px]">Manajemen keamanan terpadu dengan sinkronisasi Prisma *real-time*.</p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3 relative z-10 mt-10">
               <div className={`w-2 h-2 rounded-full animate-pulse ${cloudStatus === 'connected' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">{cloudStatus === 'connected' ? 'Connected' : 'Syncing Data...'}</span>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 lg:p-14 h-[650px] lg:h-[750px] flex flex-col bg-white overflow-y-auto no-scrollbar">
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight italic uppercase">Portal Akses</h2>
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
              <input type="text" placeholder={`Cari ${loginTab}...`}
                className="w-full pl-14 pr-6 py-4.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-500 outline-none font-bold text-sm shadow-inner transition-all"
                value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto pr-1 mb-6 space-y-3 no-scrollbar">
              {filteredPool.map((u: any) => (
                <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setLoginError(''); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50 shadow-lg' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-900 text-base truncate uppercase">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{u.sub || 'Akses Portal'}</p>
                  </div>
                </button>
              ))}
            </div>

            {selectedUser && (
              <form onSubmit={handleLogin} className="pt-8 border-t border-slate-100 space-y-5">
                <input type="password" required placeholder="PIN"
                  className="w-full px-8 py-4.5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-2xl tracking-[0.6em] text-center" 
                  value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center">{loginError}</p>}
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all">
                  KONFIRMASI <ArrowRight size={20} />
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
        <div className="space-y-8 animate-slide-up pb-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[
              { label: 'Petugas Aktif', val: stats.activeGuards, icon: <UserCheck size={24}/>, color: 'blue' },
              { label: 'Insiden Pending', val: stats.pendingIncidents, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Terdaftar', val: stats.guestsIn, icon: <Users size={24}/>, color: 'amber' },
              { label: 'Unit Terdata', val: stats.totalResidents, icon: <Home size={24}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-xl transition-all">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                <p className="text-2xl font-black text-slate-900 tracking-tighter">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 lg:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[400px]">
               <h3 className="text-xl font-black text-slate-900 mb-10 flex items-center gap-4 uppercase italic leading-none"><Activity size={24} className="text-amber-500 animate-pulse"/> Grafik Aktivitas</h3>
               <div className="h-[250px] lg:h-[300px] w-full">
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
            <div className="bg-slate-900 text-white p-8 lg:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <Radio size={32} className="text-amber-500 animate-pulse"/>
                    <h3 className="font-black text-2xl uppercase italic leading-none">AI Briefing</h3>
                  </div>
                  <p className="text-slate-400 text-sm italic leading-relaxed font-medium">"{securityBriefing || 'Menyambungkan asisten virtual...'}"</p>
               </div>
               <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all mt-10">DISKUSI TIM <ArrowRight size={20}/></button>
            </div>
          </div>
        </div>
      )}

      {/* WARGA & DATABASE UNIT */}
      {(activeTab === 'residents' || activeTab === 'log_resident') && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">{activeTab === 'residents' ? 'Database Penghuni' : 'Status Unit'}</h3>
              <div className="flex gap-4 items-center">
                <div className="relative w-full lg:w-[450px]">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                  <input type="text" placeholder="Cari unit atau nama..." className="w-full pl-14 pr-6 py-4.5 rounded-[1.8rem] bg-white border border-slate-100 outline-none focus:border-amber-500 font-bold text-sm shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                {activeTab === 'residents' && currentUser.role === 'ADMIN' && (
                  <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0] }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl active:scale-95"><Plus size={24}/></button>
                )}
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.houseNumber.includes(searchQuery)).map(res => (
                <div key={res.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all group">
                   <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-[1.2rem] flex items-center justify-center font-black text-sm group-hover:bg-amber-50 transition-colors">{res.block}</div>
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{res.isHome ? 'ADA DI UNIT' : 'SEDANG KELUAR'}</span>
                   </div>
                   <div className="mb-8">
                      <h4 className="font-black text-slate-900 uppercase italic truncate text-base mb-1 leading-none">{res.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Unit: <span className="text-slate-900 font-black">{res.block}-{res.houseNumber}</span></p>
                   </div>
                   {activeTab === 'log_resident' ? (
                     <button onClick={() => toggleHomeStatus(res)} className={`w-full py-4.5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg ${res.isHome ? 'bg-slate-900 text-white' : 'bg-green-500 text-white'}`}>
                        {res.isHome ? <ArrowLeftRight size={18}/> : <CheckCircle size={18}/>}
                        {res.isHome ? 'CATAT KELUAR' : 'KONFIRMASI MASUK'}
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
                   <p className="font-black text-slate-300 uppercase tracking-widest italic">Data Belum Sinkron atau Kosong</p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* FEED AKTIVITAS */}
      {activeTab === 'reports' && (
        <div className="space-y-8 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Cloud Feed (Real-time)</h3>
           </div>
           <div className="bg-white p-6 lg:p-12 rounded-[3rem] shadow-sm border border-slate-100">
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
                          {item.feedType === 'PATROL' ? `Area dipastikan ${item.status}. ${item.note || ''}` : item.description || `Pendaftaran tamu ${item.name} menuju ${item.visitToName}.`}
                        </p>
                        {item.photo && <img src={item.photo} alt="Bukti" className="mb-6 rounded-[2rem] w-full max-w-md border border-slate-100 shadow-xl" />}
                        <div className="flex flex-wrap gap-3">
                           <span className={`px-4 lg:px-5 py-2 lg:py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest ${item.status === 'OK' || item.status === 'RESOLVED' || item.status === 'IN' ? 'bg-green-50 text-green-600 shadow-sm' : 'bg-red-50 text-red-600 shadow-sm'}`}>{item.status || 'VERIFIED'}</span>
                           <span className="px-4 lg:px-5 py-2 lg:py-2.5 bg-slate-50 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">Oleh: {item.securityName || item.reporterName || 'Sistem'}</span>
                        </div>
                     </div>
                  </div>
                )) : (
                  <div className="py-24 text-center">
                     <p className="font-black text-slate-200 uppercase tracking-[0.3em] italic">Belum Ada Riwayat Hari Ini</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* TAB LAIN (INSIDEN, PATROLI, CHAT, GUEST) - MENGGUNAKAN PRISMA-LIKE API YANG SAMA */}
      
      {/* MODAL WINDOWS (RESIDENT, INCIDENT, PATROL_REPORT) */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic leading-none">{editingItem ? 'Edit Data Warga' : 'Unit Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={submitResident} className="p-10 space-y-6">
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nama Lengkap:</label>
                 <input type="text" required placeholder="Nama Penghuni" className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-slate-900 transition-all" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
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
                <input type="text" required placeholder="08XXXXXXXXXX" className="w-full px-8 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-2 border-slate-100 focus:border-slate-900" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">SIMPAN DATA MASTER</button>
            </form>
          </div>
        </div>
      )}

      {/* PATROL REPORT MODAL */}
      {isModalOpen === 'PATROL_REPORT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-8 lg:p-10 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-xl lg:text-2xl font-black uppercase leading-none italic">{patrolAction.cp}</h3>
                <p className="text-[10px] font-black uppercase opacity-70 mt-1 tracking-widest">Digital Field Report</p>
              </div>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={submitPatrol} className="p-8 lg:p-12 space-y-6 lg:space-y-8">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Ambil Foto Area (Wajib):</label>
                 <div className="flex flex-col gap-4">
                    {patrolReportData.photo ? (
                      <div className="relative group">
                         <img src={patrolReportData.photo} alt="Preview" className="w-full h-48 lg:h-56 object-cover rounded-[2rem] border-2 border-slate-100 shadow-inner" />
                         <button type="button" onClick={() => setPatrolReportData(prev => ({ ...prev, photo: '' }))} className="absolute top-4 right-4 p-3 bg-red-600 text-white rounded-2xl shadow-2xl active:scale-95 transition-all"><Trash2 size={20}/></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-48 lg:h-56 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-slate-400 transition-all group">
                         <Camera size={48} className="group-hover:scale-110 transition-transform" />
                         <span className="font-black text-[10px] uppercase tracking-widest">AKTIFKAN KAMERA</span>
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                 </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Catatan Keamanan:</label>
                <textarea required placeholder="Jelaskan kondisi detail..." className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-sm min-h-[140px] focus:border-slate-900 transition-all shadow-inner" value={patrolReportData.note} onChange={e => setPatrolReportData({...patrolReportData, note: e.target.value})} />
              </div>
              <button type="submit" className={`w-full py-5 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>KIRIM LAPORAN CLOUD</button>
            </form>
          </div>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-200px)] lg:h-[calc(100vh-250px)] flex flex-col animate-slide-up pb-10">
           <div className="flex-1 bg-white rounded-t-[3rem] shadow-sm border border-slate-100 overflow-y-auto p-6 lg:p-10 space-y-8 no-scrollbar relative">
              {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[85%] p-6 rounded-[2.5rem] relative shadow-sm ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-6 mb-2">
                         <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                         <span className="text-[8px] font-bold px-2 py-0.5 bg-white/10 rounded-full uppercase opacity-40 italic">{msg.senderRole}</span>
                      </div>
                      <p className="text-sm lg:text-base font-medium leading-relaxed">{msg.text}</p>
                      <p className={`text-[8px] mt-3 opacity-30 text-right font-black uppercase tracking-widest`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-200 italic py-24">
                   <MessageSquare size={64} className="mb-6 opacity-5" />
                   <p className="font-black uppercase tracking-[0.3em] text-[10px]">Pusat Koordinasi Satpam</p>
                </div>
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={sendMessage} className="bg-white p-6 lg:p-8 rounded-b-[3rem] border-t border-slate-100 flex gap-4 shadow-xl items-center">
              <input type="text" placeholder="Tulis instruksi atau laporan..." className="flex-1 px-8 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-sm lg:text-base focus:border-amber-500 transition-all shadow-inner" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-5 rounded-2xl active:scale-95 transition-all shadow-2xl hover:bg-slate-800"><Send size={26}/></button>
           </form>
        </div>
      )}

    </Layout>
  );
};

export default App;
