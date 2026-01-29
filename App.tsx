
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
  Activity, MessageSquare, BellRing, Database, RefreshCw, 
  PhoneCall, Ghost, UserCheck, BookOpen, ClipboardCheck, Radio, LogOut, Camera, Image as ImageIcon, Trash2, UserCog, Briefcase, ChevronRight, HardDrive, Info, ArrowLeftRight
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell, XAxis } from 'recharts';
import { supabase, fetchInitialData, subscribeTable } from './services/supabaseService.ts';

const App: React.FC = () => {
  // Database States
  const [residents, setResidents] = useState<Resident[]>(MOCK_RESIDENTS);
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>(MOCK_INCIDENTS);
  const [guests, setGuests] = useState<GuestLog[]>(MOCK_GUESTS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [checkpoints, setCheckpoints] = useState<string[]>(INITIAL_CHECKPOINTS);
  const [staff, setStaff] = useState<User[]>(INITIAL_SECURITY);

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

  // --- SYNC DATABASE ---
  useEffect(() => {
    const initDatabase = async () => {
      try {
        const [resData, logsData, incsData, guestsData, msgsData] = await Promise.all([
          fetchInitialData('residents'),
          fetchInitialData('patrol_logs'),
          fetchInitialData('incidents'),
          fetchInitialData('guests'),
          fetchInitialData('chat_messages')
        ]);

        if (resData && resData.length) setResidents(resData);
        if (logsData && logsData.length) setPatrolLogs(logsData);
        if (incsData && incsData.length) setIncidents(incsData);
        if (guestsData && guestsData.length) setGuests(guestsData);
        if (msgsData && msgsData.length) setChatMessages(msgsData.reverse());

        subscribeTable('residents', p => {
          if (p.eventType === 'INSERT') setResidents(prev => [p.new as Resident, ...prev]);
          if (p.eventType === 'UPDATE') setResidents(prev => prev.map(r => r.id === p.new.id ? p.new as Resident : r));
        });
        subscribeTable('patrol_logs', p => {
          if (p.eventType === 'INSERT') setPatrolLogs(prev => [p.new as PatrolLog, ...prev]);
        });
        subscribeTable('incidents', p => {
          if (p.eventType === 'INSERT') setIncidents(prev => [p.new as IncidentReport, ...prev]);
        });
        subscribeTable('chat_messages', p => {
          if (p.eventType === 'INSERT') setChatMessages(prev => [...prev, p.new as ChatMessage]);
        });
      } catch (e) { console.warn("Syncing..."); }
    };
    initDatabase();
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

  const toggleResidentPresence = async (id: string) => {
    const res = residents.find(r => r.id === id);
    if (!res) return;
    const updatedStatus = !res.isHome;
    setResidents(prev => prev.map(r => r.id === id ? { ...r, isHome: updatedStatus } : r));
    try {
      await supabase.from('residents').update({ isHome: updatedStatus }).eq('id', id);
    } catch (e) {}
  };

  const handleCRUD = async (table: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data?: any, id?: string) => {
    if (action === 'DELETE') {
      if (!window.confirm("Hapus data secara permanen?")) return;
      if (table === 'staff') setStaff(prev => prev.filter(s => s.id !== id));
      if (table === 'checkpoints') setCheckpoints(prev => prev.filter(c => c !== id));
      if (table === 'residents') setResidents(prev => prev.filter(r => r.id !== id));
    }
    if (action === 'CREATE') {
      if (table === 'staff') setStaff(prev => [data, ...prev]);
      if (table === 'checkpoints') setCheckpoints(prev => [...prev, data]);
      if (table === 'residents') setResidents(prev => [data, ...prev]);
    }
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

  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? staff : loginTab === 'ADMIN' ? ADMIN_USERS : residents.map(r => ({ id: r.id, name: r.name, sub: `Blok ${r.block}-${r.houseNumber}` }));
    const filteredPool = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()));

    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[950px] flex flex-col md:flex-row rounded-[3rem] shadow-2xl overflow-hidden border border-white/20">
          <div className="w-full md:w-5/12 bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="bg-amber-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-10 shadow-xl shadow-amber-500/20">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-4xl font-black mb-4 tracking-tighter italic uppercase leading-tight">TKA SECURE <br/><span className="text-amber-500 not-italic text-2xl font-light">Cloud System</span></h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-[250px]">Manajemen keamanan hunian terpadu dengan briefing berbasis AI.</p>
            </div>
            <div className="p-5 bg-white/5 rounded-3xl border border-white/10 flex items-center gap-3 relative z-10">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Database Realtime Online</span>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-10 md:p-14 h-[750px] flex flex-col bg-white overflow-y-auto no-scrollbar">
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight italic">Portal Login</h2>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); setLoginSearch(''); }}
                  className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input type="text" placeholder={`Cari nama ${loginTab}...`}
                className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-500 focus:bg-white outline-none font-bold text-sm shadow-inner transition-all"
                value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto pr-1 mb-8 space-y-3 no-scrollbar">
              {filteredPool.map((u: any) => (
                <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setLoginError(''); }}
                  className={`w-full flex items-center gap-5 p-5 rounded-2xl border-2 transition-all ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-900 text-base">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{u.sub || 'Akses Sistem'}</p>
                  </div>
                </button>
              ))}
            </div>

            {selectedUser && (
              <form onSubmit={handleLogin} className="pt-6 border-t border-slate-100 space-y-4">
                <input type="password" required placeholder="PIN Login"
                  className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-2xl tracking-[0.6em] text-center" 
                  value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center">{loginError}</p>}
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 flex items-center justify-center gap-4 text-xs uppercase tracking-widest shadow-2xl">
                  MASUK SISTEM <ArrowRight size={20} />
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
        <div className="space-y-8 animate-slide-up pb-24">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Satpam Siaga', val: stats.activeGuards, icon: <UserCheck size={26}/>, color: 'blue' },
              { label: 'Insiden Pending', val: stats.pendingIncidents, icon: <AlertTriangle size={26}/>, color: 'red' },
              { label: 'Tamu Area', val: stats.guestsIn, icon: <Users size={26}/>, color: 'amber' },
              { label: 'Total Hunian', val: stats.totalResidents, icon: <Home size={26}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{s.label}</h3>
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
               <h3 className="text-xl font-black text-slate-900 mb-10 flex items-center gap-4 uppercase italic"><Activity size={24} className="text-amber-500 animate-pulse"/> Statistik Aktivitas</h3>
               <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="val" radius={[8, 8, 8, 8]} barSize={55}>
                        {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#EF4444'][index % 3]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col justify-between">
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <Radio size={32} className="text-amber-500 animate-pulse"/>
                    <h3 className="font-black text-2xl uppercase italic leading-none">Briefing AI</h3>
                  </div>
                  <p className="text-slate-400 text-sm italic leading-relaxed font-medium">"{securityBriefing || 'Menghubungkan asisten keamanan...'}"</p>
               </div>
               <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all mt-8">DISKUSI TIM <ArrowRight size={20}/></button>
            </div>
          </div>
        </div>
      )}

      {/* MENU KELUAR MASUK WARGA */}
      {activeTab === 'log_resident' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Keluar Masuk Warga</h3>
              <div className="relative w-full md:w-[400px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input type="text" placeholder="Cari nama atau nomor rumah..." className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white border border-slate-100 outline-none focus:border-amber-500 font-bold text-xs shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.houseNumber.includes(searchQuery) || r.block.includes(searchQuery.toUpperCase())).map(res => (
                <div key={res.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all group">
                   <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-lg group-hover:bg-amber-500 transition-colors">{res.block}</div>
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{res.isHome ? 'DI RUMAH' : 'SEDANG KELUAR'}</span>
                   </div>
                   <div className="mb-8">
                      <h4 className="font-black text-slate-900 uppercase italic truncate mb-1">{res.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No. Rumah: <span className="text-slate-900 font-black">{res.houseNumber}</span></p>
                   </div>
                   <button onClick={() => toggleResidentPresence(res.id)} className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg ${res.isHome ? 'bg-slate-900 text-white' : 'bg-green-500 text-white'}`}>
                      {res.isHome ? <ArrowLeftRight size={16}/> : <CheckCircle size={16}/>}
                      {res.isHome ? 'CATAT KELUAR' : 'CATAT MASUK'}
                   </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* PATROL (PATROLI) */}
      {activeTab === 'patrol' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Kontrol Patroli Wilayah</h3>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => setIsModalOpen('CHECKPOINT')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 shadow-2xl active:scale-95">
                  <Plus size={20}/> TITIK BARU
                </button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {checkpoints.map((cp, idx) => {
                const last = patrolLogs.filter(l => l.checkpoint === cp)[0];
                return (
                  <div key={idx} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-2xl transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start mb-8">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-slate-900 text-white flex items-center justify-center font-black text-2xl group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors shadow-lg">{idx + 1}</div>
                        {last && <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${last.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{last.status}</span>}
                      </div>
                      <h4 className="text-xl font-black text-slate-900 mb-10 tracking-tight uppercase italic">{cp}</h4>
                    </div>
                    {currentUser.role === 'SECURITY' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => { setPatrolAction({cp, status: 'OK'}); setIsModalOpen('PATROL_REPORT'); }} className="py-5 bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase active:scale-95 shadow-lg shadow-green-500/20">AREA AMAN</button>
                        <button onClick={() => { setPatrolAction({cp, status: 'DANGER'}); setIsModalOpen('PATROL_REPORT'); }} className="py-5 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase active:scale-95 shadow-lg shadow-red-600/20">BAHAYA</button>
                      </div>
                    ) : (
                      <div className="text-[10px] font-black text-slate-400 uppercase border-t pt-6 tracking-widest italic opacity-70 truncate">Log: {last ? `${last.securityName} (${new Date(last.timestamp).toLocaleTimeString()})` : 'Belum Dicek'}</div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* CHAT (KOORDINASI TIM) */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-250px)] flex flex-col animate-slide-up">
           <div className="flex-1 bg-white rounded-t-[3rem] shadow-sm border border-slate-100 overflow-y-auto p-10 space-y-8 no-scrollbar relative">
              <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-slate-100 px-4 py-1 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Saluran Komunikasi Terenkripsi</div>
              {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-6 rounded-[2.5rem] shadow-sm relative group ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-6 mb-2">
                         <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                         <span className="text-[8px] font-bold px-2 py-0.5 bg-white/10 rounded-full uppercase opacity-40 italic">{msg.senderRole}</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                      <p className={`text-[8px] mt-3 opacity-30 text-right font-black uppercase tracking-widest`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 italic py-24">
                   <MessageSquare size={48} className="mb-4 opacity-10" />
                   <p className="font-black uppercase tracking-widest text-[10px]">Belum Ada Percakapan</p>
                </div>
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={sendMessage} className="bg-white p-8 rounded-b-[3rem] border-t border-slate-100 flex gap-4 shadow-sm items-center">
              <input type="text" placeholder="Tulis instruksi atau koordinasi tim..." className="flex-1 px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-5 rounded-2xl active:scale-95 transition-all shadow-2xl hover:bg-slate-800"><Send size={28}/></button>
           </form>
        </div>
      )}

      {/* SETTINGS (SETELAN) - FULL IMPLEMENTATION */}
      {activeTab === 'settings' && (
        <div className="max-w-5xl mx-auto space-y-10 animate-slide-up pb-24">
           {/* Section Profil */}
           <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-10">
              <div className="w-32 h-32 bg-slate-900 text-amber-500 rounded-[2.5rem] flex items-center justify-center text-5xl font-black shadow-2xl border-4 border-slate-50">{currentUser.name.charAt(0)}</div>
              <div className="flex-1 text-center md:text-left">
                 <h3 className="text-3xl font-black text-slate-900 italic tracking-tight uppercase mb-2">{currentUser.name}</h3>
                 <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    <span className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">{currentUser.role}</span>
                    <span className="px-5 py-2 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> Aktif Sebagai {currentUser.role}</span>
                 </div>
              </div>
              <button onClick={() => setCurrentUser(null)} className="px-10 py-5 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition-all active:scale-95 flex items-center gap-3 shadow-sm"><LogOut size={18}/> KELUAR AKUN</button>
           </div>

           {/* Manajemen (Hanya Admin) */}
           {currentUser.role === 'ADMIN' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Staff Control */}
                <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
                   <div className="flex justify-between items-center mb-10">
                      <h4 className="text-xl font-black text-slate-900 italic uppercase flex items-center gap-3"><UserCog size={24} className="text-amber-500"/> Manajemen Staff</h4>
                      <button onClick={() => { setEditingItem(null); setStaffForm({ name: '', phoneNumber: '', role: 'SECURITY' }); setIsModalOpen('STAFF'); }} className="p-3 bg-slate-900 text-white rounded-xl active:scale-95 shadow-lg"><Plus size={20}/></button>
                   </div>
                   <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                      {staff.map(s => (
                        <div key={s.id} className="flex items-center gap-5 p-5 bg-slate-50 rounded-[1.8rem] group hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100">
                           <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black group-hover:bg-amber-500 transition-colors">{s.name.charAt(0)}</div>
                           <div className="flex-1">
                              <p className="font-black text-slate-900 text-sm">{s.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.phoneNumber}</p>
                           </div>
                           <button onClick={() => handleCRUD('staff', 'DELETE', null, s.id)} className="p-3 text-slate-300 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Patrol Checkpoints */}
                <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
                   <div className="flex justify-between items-center mb-10">
                      <h4 className="text-xl font-black text-slate-900 italic uppercase flex items-center gap-3"><MapPin size={24} className="text-amber-500"/> Titik Patroli</h4>
                      <button onClick={() => setIsModalOpen('CHECKPOINT')} className="p-3 bg-slate-900 text-white rounded-xl active:scale-95 shadow-lg"><Plus size={20}/></button>
                   </div>
                   <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                      {checkpoints.map((cp, idx) => (
                        <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.8rem] hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100 group">
                           <div className="flex items-center gap-4">
                              <span className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-slate-900 shadow-sm border border-slate-100">{idx + 1}</span>
                              <p className="font-black text-slate-900 text-sm italic">{cp}</p>
                           </div>
                           <button onClick={() => handleCRUD('checkpoints', 'DELETE', null, cp)} className="p-3 text-slate-300 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           )}

           {/* System Info */}
           <div className="bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full"></div>
              <div className="relative z-10 flex items-center gap-8">
                 <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner"><Database size={32} className="text-amber-500"/></div>
                 <div>
                    <h4 className="text-xl font-black italic uppercase tracking-tight mb-1">Status Sinkronisasi</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Terhubung ke Supabase Cloud PostgreSQL</p>
                 </div>
              </div>
              <div className="flex gap-4 relative z-10">
                 <div className="px-6 py-4 bg-white/5 rounded-2xl border border-white/10 text-center min-w-[120px]">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Response</p>
                    <p className="font-black text-green-500 italic">24ms</p>
                 </div>
                 <div className="px-6 py-4 bg-white/5 rounded-2xl border border-white/10 text-center min-w-[120px]">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Keamanan</p>
                    <p className="font-black text-amber-500 italic">AES-256</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* RENDER VIEW WARGA */}
      {activeTab === 'residents' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Manajemen Hunian</h3>
              <div className="flex gap-3">
                 <div className="relative flex-1 md:w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                    <input type="text" placeholder="Cari nama/blok..." className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white border border-slate-100 outline-none focus:border-amber-500 font-bold text-xs shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                 </div>
                 {currentUser.role === 'ADMIN' && (
                   <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 shadow-xl hover:bg-slate-800 transition-all"><Plus size={20}/> TAMBAH WARGA</button>
                 )}
              </div>
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.block.includes(searchQuery.toUpperCase())).map(res => (
                <div key={res.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-2 h-full bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div>
                      <div className="flex justify-between items-start mb-8">
                         <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-900 flex items-center justify-center font-black text-lg border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">{res.block}</div>
                         <div className="flex flex-col items-end gap-2">
                           <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>{res.isHome ? 'DI UNIT' : 'KELUAR'}</span>
                           {currentUser.role === 'ADMIN' && (
                             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button>
                               <button onClick={() => handleCRUD('residents', 'DELETE', null, res.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                             </div>
                           )}
                         </div>
                      </div>
                      <h4 className="font-black text-xl text-slate-900 mb-2 leading-none italic uppercase truncate">{res.name}</h4>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No. Rumah: <span className="text-slate-900 font-black">{res.houseNumber}</span></p>
                   </div>
                   <div className="mt-10">
                      <a href={`tel:${res.phoneNumber}`} className="w-full py-4 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase border border-slate-100 hover:bg-green-500 hover:text-white hover:border-green-600 transition-all shadow-sm"><PhoneCall size={18}/> HUBUNGI</a>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* RENDER VIEW TAMU */}
      {activeTab === 'guests' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Buku Tamu Digital</h3>
              <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 shadow-xl active:scale-95 transition-all"><UserPlus size={20}/> REGISTRASI TAMU</button>
           </div>
           
           <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[850px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Pengunjung</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tujuan Unit</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Waktu Masuk</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                    <th className="px-10 py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {guests.map(g => (
                     <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-10 py-7">
                          <p className="font-black text-slate-900 text-sm mb-1">{g.name}</p>
                          <p className="text-[11px] text-slate-400 italic">{g.purpose}</p>
                       </td>
                       <td className="px-10 py-7 text-xs font-black text-slate-500 uppercase tracking-widest">{g.visitToName}</td>
                       <td className="px-10 py-7 text-[10px] font-black text-slate-400">{new Date(g.entryTime).toLocaleString('id-ID')}</td>
                       <td className="px-10 py-7">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{g.status === 'IN' ? 'DI AREA' : 'KELUAR'}</span>
                       </td>
                       <td className="px-10 py-7 text-right">
                          {g.status === 'IN' && (
                            <button onClick={() => { setGuests(prev => prev.map(item => item.id === g.id ? {...item, status: 'OUT'} : item)); }} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95"><LogOut size={20}/></button>
                          )}
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
           </div>
        </div>
      )}

      {/* RENDER VIEW INSIDEN */}
      {activeTab === 'incident' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Laporan Kejadian</h3>
              <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 shadow-xl active:scale-95 transition-all"><Plus size={20}/> LAPOR BARU</button>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {incidents.map(inc => (
                <div key={inc.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                   <div className={`absolute top-0 right-0 w-2 h-full ${inc.severity === 'HIGH' ? 'bg-red-600' : inc.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                   <div className="flex justify-between items-start mb-6">
                      <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${inc.status === 'RESOLVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600 animate-pulse'}`}>{inc.status}</div>
                      <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{new Date(inc.timestamp).toLocaleString('id-ID')}</span>
                   </div>
                   <h4 className="text-2xl font-black text-slate-900 mb-2 italic tracking-tight uppercase">{inc.type}</h4>
                   <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin size={14}/> {inc.location}</p>
                   <p className="text-sm text-slate-600 font-medium leading-relaxed mb-8 italic">"{inc.description}"</p>
                   <div className="flex justify-between items-center pt-8 border-t border-slate-50">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">{inc.reporterName.charAt(0)}</div>
                         <div><p className="text-xs font-black text-slate-900 mb-0.5">{inc.reporterName}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pelapor</p></div>
                      </div>
                      {currentUser.role !== 'RESIDENT' && inc.status !== 'RESOLVED' && (
                        <button onClick={() => setIncidents(prev => prev.map(item => item.id === inc.id ? {...item, status: 'RESOLVED'} : item))} className="bg-green-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase active:scale-95 shadow-lg transition-all">SELESAIKAN</button>
                      )}
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* RENDER VIEW LAPORAN FEED */}
      {activeTab === 'reports' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Security Intelligence Feed</h3>
              <div className="flex items-center gap-3">
                 <Radio size={20} className="text-green-500 animate-pulse"/>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Realtime Monitoring</span>
              </div>
           </div>
           
           <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
              <div className="space-y-12">
                {liveTimeline.length > 0 ? liveTimeline.map((item: any, idx) => (
                  <div key={idx} className="flex gap-8 group">
                     <div className="flex flex-col items-center">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${item.feedType === 'PATROL' ? 'bg-slate-900 text-white' : item.feedType === 'INCIDENT' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                           {item.feedType === 'PATROL' ? <ClipboardCheck size={24}/> : item.feedType === 'INCIDENT' ? <AlertTriangle size={24}/> : <BookOpen size={24}/>}
                        </div>
                        <div className="w-0.5 flex-1 bg-slate-100 mt-4"></div>
                     </div>
                     <div className="flex-1 pb-10">
                        <div className="flex justify-between items-center mb-2">
                           <h4 className="font-black text-slate-900 text-base tracking-tight uppercase italic">{item.feedType === 'PATROL' ? `Patroli: ${item.checkpoint}` : item.feedType === 'INCIDENT' ? `Kejadian: ${item.type}` : `Akses Tamu`}</h4>
                           <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{new Date(item.sortTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-sm text-slate-500 font-medium mb-4 italic leading-relaxed">
                          {item.feedType === 'PATROL' ? `Area dipastikan ${item.status}. ${item.note || ''}` : item.description || `Kunjungan oleh ${item.name} ke ${item.visitToName}.`}
                        </p>
                        {item.photo && <img src={item.photo} alt="Bukti" className="mb-6 rounded-3xl w-48 border border-slate-100 shadow-sm" />}
                        <div className="flex gap-3">
                           <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${item.status === 'OK' || item.status === 'RESOLVED' || item.status === 'IN' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{item.status || 'AKTIF'}</span>
                           <span className="px-4 py-2 bg-slate-50 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">Oleh: {item.securityName || item.reporterName || 'Sistem'}</span>
                        </div>
                     </div>
                  </div>
                )) : (
                  <div className="py-24 text-center text-slate-200 font-black uppercase italic tracking-widest">Belum Ada Aktivitas Hari Ini...</div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* MODALS SECTION */}
      {isModalOpen === 'STAFF' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase tracking-tight italic leading-none">Personel Satpam Baru</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCRUD('staff', 'CREATE', { id: `s-${Date.now()}`, ...staffForm }); }} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Satpam Lengkap..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-slate-900 transition-all shadow-inner" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} />
              <input type="text" required placeholder="Nomor WhatsApp..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-slate-900 transition-all shadow-inner" value={staffForm.phoneNumber} onChange={e => setStaffForm({...staffForm, phoneNumber: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">SIMPAN DATA STAFF</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'CHECKPOINT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase tracking-tight italic">Titik Patroli Baru</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (cpForm.trim()) handleCRUD('checkpoints', 'CREATE', cpForm); setCpForm(''); }} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Area (misal: Belakang A11)..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-slate-900 transition-all shadow-inner" value={cpForm} onChange={e => setCpForm(e.target.value)} />
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">TAMBAHKAN TITIK</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase tracking-tight italic leading-none">Registrasi Tamu</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submitGuest(e); }} className="p-10 space-y-5">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-8 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                 <option value="">-- Pilih Tujuan Unit --</option>
                 {residents.sort((a,b) => a.block.localeCompare(b.block)).map(r => <option key={r.id} value={r.id}>{r.block}-{r.houseNumber} ({r.name})</option>)}
              </select>
              <textarea required placeholder="Keperluan (misal: Antar Barang, Bertamu)..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm min-h-[120px]" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">Daftarkan & Izinkan Masuk</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase tracking-tight italic leading-none">Lapor Kejadian</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submitIncident(e); }} className="p-10 space-y-5">
              <select required className="w-full px-8 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm" value={incForm.type} onChange={e => setIncForm({...incForm, type: e.target.value})}>
                 <option value="Pencurian">Pencurian</option>
                 <option value="Kriminalitas">Tindak Kriminal</option>
                 <option value="Kebakaran">Kebakaran</option>
                 <option value="Lainnya">Lainnya</option>
              </select>
              <input type="text" required placeholder="Lokasi Spesifik..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm" value={incForm.location} onChange={e => setIncForm({...incForm, location: e.target.value})} />
              <textarea required placeholder="Deskripsi Kejadian..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm min-h-[120px]" value={incForm.description} onChange={e => setIncForm({...incForm, description: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">Kirim Laporan</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'PATROL_REPORT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-10 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight leading-none italic">{patrolAction.cp}</h3>
                <p className="text-[11px] font-black uppercase opacity-70 mt-1 tracking-widest">Laporan Detail Patroli</p>
              </div>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={submitPatrol} className="p-10 space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Ambil Foto Lokasi (Wajib):</label>
                 <div className="flex flex-col gap-4">
                    {patrolReportData.photo ? (
                      <div className="relative group">
                         <img src={patrolReportData.photo} alt="Preview" className="w-full h-48 object-cover rounded-2xl border-2 border-slate-100 shadow-inner" />
                         <button type="button" onClick={() => setPatrolReportData(prev => ({ ...prev, photo: '' }))} className="absolute top-3 right-3 p-2 bg-red-600 text-white rounded-xl shadow-lg active:scale-95"><Trash2 size={16}/></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-48 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-slate-400 transition-all group">
                         <Camera size={48} className="group-hover:scale-110 transition-transform" />
                         <span className="font-black text-[10px] uppercase tracking-widest">Klik Untuk Ambil Foto</span>
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                 </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Catatan Keadaan (Wajib):</label>
                <textarea required placeholder="Deskripsikan kondisi area..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold min-h-[140px] text-base focus:border-slate-900 focus:bg-white transition-all shadow-inner" value={patrolReportData.note} onChange={e => setPatrolReportData({...patrolReportData, note: e.target.value})} />
              </div>
              <button type="submit" className={`w-full py-5 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all ${patrolAction.status === 'OK' ? 'bg-green-600 shadow-green-600/20' : 'bg-red-600 shadow-red-600/20'}`}>KIRIM LAPORAN CLOUD</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase tracking-tight italic leading-none">{editingItem ? 'Edit Data Warga' : 'Pendaftaran Warga'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const data = { id: editingItem?.id || `r-${Date.now()}`, ...resForm }; editingItem ? handleCRUD('residents', 'UPDATE', data, editingItem.id) : handleCRUD('residents', 'CREATE', data); }} className="p-10 space-y-5">
              <input type="text" required placeholder="Nama Lengkap..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Pilih Blok:</label>
                   <select className="w-full px-6 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm" value={resForm.block} onChange={e => setResForm({...resForm, block: e.target.value})}>
                      {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">No. Rumah:</label>
                   <input type="text" required placeholder="01-99" className="w-full px-6 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm border-2 border-transparent focus:border-slate-900" value={resForm.houseNumber} onChange={e => setResForm({...resForm, houseNumber: e.target.value})} />
                 </div>
              </div>
              <input type="text" required placeholder="Nomor HP/WhatsApp..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 outline-none font-bold text-sm" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-slate-800 transition-all active:scale-95">Simpan Data Warga</button>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
