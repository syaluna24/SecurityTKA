
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
  Activity, MessageSquare, Radio, LogOut, Camera, Trash2, UserCheck, RefreshCw, Ghost, PhoneCall, ArrowLeftRight, ClipboardCheck, BookOpen, Settings, Filter, Clock, Wifi, Globe, Link
} from 'lucide-react';
import { getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell, XAxis } from 'recharts';
import { db } from './lib/db.ts';

const App: React.FC = () => {
  // --- DATABASE STATES (Populated with Mocks) ---
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
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'syncing'>('syncing');
  const [lastSync, setLastSync] = useState<string>('Memulai...');
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'GUEST' | 'INCIDENT' | 'PATROL_REPORT' | 'CLUSTER' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');
  const [clusterInput, setClusterInput] = useState(db.getCluster());

  // --- FORM STATES ---
  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '', photo: '' });
  const [incForm, setIncForm] = useState<Partial<IncidentReport>>({ type: 'Pencurian', location: '', description: '', severity: 'MEDIUM', photo: '' });
  const [patrolAction, setPatrolAction] = useState<{cp: string, status: 'OK' | 'WARNING' | 'DANGER'}>({ cp: '', status: 'OK' });
  const [patrolReportData, setPatrolReportData] = useState({ note: '', photo: '' });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- CLOUD SYNC LOGIC (Multi-Device Support) ---
  const performSync = async () => {
    try {
      const [r, p, i, g, c] = await Promise.all([
        db.resident.findMany(),
        db.patrol.findMany(),
        db.incident.findMany(),
        db.guest.findMany(),
        db.chat.findMany()
      ]);
      
      if (r) setResidents(r);
      if (p) setPatrolLogs(p);
      if (i) setIncidents(i);
      if (g) setGuests(g);
      if (c) setChatMessages(c);
      
      setCloudStatus('connected');
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      setCloudStatus('connected');
    }
  };

  useEffect(() => {
    performSync();
    const interval = setInterval(performSync, 5000); // Sinkronisasi setiap 5 detik
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentUser) {
      const hour = new Date().getHours();
      const shiftName = hour >= 7 && hour < 19 ? 'Pagi' : 'Malam';
      getSecurityBriefing(shiftName).then(setSecurityBriefing);
    }
  }, [currentUser]);

  // Fix: Auto-scroll chat to bottom when new messages arrive
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
      setLoginError('PIN Salah. (Security: 1234, Admin: admin123)');
    }
  };

  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingItem ? editingItem.id : `r-${Date.now()}`;
    if (editingItem) await db.resident.update(id, resForm);
    else await db.resident.create({ ...resForm, id });
    setIsModalOpen(null);
    performSync();
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
    performSync();
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
    performSync();
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
    performSync();
  };

  // Fix: handleStatusChange implementation for resident check-in/out
  const handleStatusChange = async (id: string, isHome: boolean) => {
    await db.resident.update(id, { isHome });
    performSync();
  };

  // Fix: handleSendChat implementation for security communication
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    
    const newMessage: ChatMessage = {
      id: `chat-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: chatInput,
      timestamp: new Date().toISOString()
    };
    
    await db.chat.create(newMessage);
    setChatInput('');
    performSync();
  };

  // --- VIEWS ---
  const timelineFeed = useMemo(() => {
    const combined = [
      ...patrolLogs.map(p => ({ ...p, type: 'PATROL', time: p.timestamp, title: `Patroli: ${p.checkpoint}`, color: 'slate' })),
      ...incidents.map(i => ({ ...i, type: 'INCIDENT', time: i.timestamp, title: `Insiden: ${i.type}`, color: 'red' })),
      ...guests.map(g => ({ ...g, type: 'GUEST', time: g.entryTime, title: `Tamu: ${g.name}`, color: 'blue' }))
    ];
    return combined.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);
  }, [patrolLogs, incidents, guests]);

  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? staff : loginTab === 'ADMIN' ? ADMIN_USERS : residents.map(r => ({ id: r.id, name: r.name, sub: `${r.block}-${r.houseNumber}` }));
    const filtered = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()));

    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[900px] flex flex-col md:flex-row rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
          <div className="w-full md:w-5/12 bg-slate-900 p-8 lg:p-12 text-white flex flex-col justify-between relative">
            <div className="relative z-10">
              <div className="bg-amber-500 w-16 h-16 rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-3xl font-black mb-4 italic uppercase leading-tight">TKA SECURE <br/><span className="text-amber-500 not-italic text-xl font-light tracking-widest">MULTI-DEVICE CONNECT</span></h1>
              <p className="text-slate-400 text-sm font-medium">Data tersinkronisasi otomatis antara Laptop, Tablet, dan HP Satpam.</p>
            </div>
            <div className="mt-12 p-4 bg-white/5 rounded-2xl border border-white/10">
               <div className="flex items-center gap-3 mb-2">
                  <Globe size={16} className="text-amber-500" />
                  <span className="text-[10px] font-black uppercase text-slate-300">CLUSTER ACTIVE:</span>
               </div>
               <p className="text-sm font-black text-white truncate italic">{db.getCluster()}</p>
               <button onClick={() => setIsModalOpen('CLUSTER')} className="mt-3 text-[9px] font-black text-amber-500 uppercase flex items-center gap-2 hover:underline"><RefreshCw size={12}/> GANTI CLUSTER</button>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 lg:p-14 bg-white flex flex-col max-h-[850px]">
            <h2 className="text-2xl font-black text-slate-900 mb-8 uppercase italic">Portal Login</h2>
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-8">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); }} className={`flex-1 py-3.5 text-[10px] font-black uppercase rounded-xl transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>{t}</button>
              ))}
            </div>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder="Cari nama..." className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-500 outline-none font-bold" value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar mb-6">
              {filtered.map((u: any) => (
                <button key={u.id} onClick={() => setSelectedUser(u)} className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50' : 'border-transparent bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="text-left flex-1">
                    <p className="font-black text-slate-900 uppercase text-sm truncate">{u.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{u.sub || 'Authorized'}</p>
                  </div>
                </button>
              ))}
            </div>
            {selectedUser && (
              <form onSubmit={handleLogin} className="space-y-4 animate-slide-up pt-4 border-t border-slate-100">
                <input type="password" required placeholder="PIN" className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-black text-xl tracking-[0.5em] text-center focus:border-amber-500 outline-none" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-widest hover:bg-slate-800">LOGIN <ArrowRight size={18}/></button>
              </form>
            )}
          </div>
        </div>

        {isModalOpen === 'CLUSTER' && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
              <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 animate-slide-up">
                 <h3 className="text-xl font-black text-slate-900 mb-2 uppercase italic">Sinkronisasi Cloud</h3>
                 <p className="text-sm text-slate-500 mb-8 font-medium">Masukkan Nama Cluster yang sama di Laptop & HP agar data otomatis tersambung.</p>
                 <input type="text" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-black text-center mb-6" value={clusterInput} onChange={e => setClusterInput(e.target.value.toUpperCase())} placeholder="MISAL: TKA-SHIFT-1" />
                 <button onClick={() => db.setCluster(clusterInput)} className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl">SIMPAN & SAMBUNGKAN</button>
                 <button onClick={() => setIsModalOpen(null)} className="w-full mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">BATAL</button>
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
        <div className="space-y-8 animate-slide-up">
          {/* Connection Hub Visualization */}
          <div className="bg-white p-6 lg:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all"></div>
             <div className="flex items-center gap-6 relative z-10 w-full lg:w-auto">
                <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-slate-900/20">
                   <Globe size={32} className="text-amber-500 animate-pulse" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase italic leading-none mb-2">Cluster Sync</h3>
                   <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{db.getCluster()} • ONLINE</p>
                   </div>
                </div>
             </div>
             <div className="flex gap-4 w-full lg:w-auto overflow-x-auto no-scrollbar pb-2 lg:pb-0">
                <div className="flex-shrink-0 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center min-w-[120px]">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Status Sync</p>
                   <p className="text-xs font-black text-green-600 uppercase italic">{cloudStatus}</p>
                </div>
                <div className="flex-shrink-0 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center min-w-[120px]">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Last Update</p>
                   <p className="text-xs font-black text-slate-900 uppercase italic">{lastSync}</p>
                </div>
                <button onClick={() => setIsModalOpen('CLUSTER')} className="flex-shrink-0 bg-amber-500 text-slate-900 p-4 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 active:scale-95 transition-all">
                   <Link size={16}/> LINK DEVICE
                </button>
             </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Petugas Shift', val: staff.length, icon: <UserCheck />, color: 'blue' },
              { label: 'Lapor Terbuka', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle />, color: 'red' },
              { label: 'Tamu Aktif', val: guests.filter(g => g.status === 'IN').length, icon: <Users />, color: 'amber' },
              { label: 'Unit Terdaftar', val: residents.length, icon: <Home />, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {React.cloneElement(s.icon as React.ReactElement, { size: 24 })}
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</h4>
                <p className="text-2xl font-black text-slate-900 tracking-tighter">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[400px]">
                <h3 className="text-lg font-black text-slate-900 mb-10 uppercase italic flex items-center gap-4"><Activity className="text-amber-500"/> Analitik Keamanan Cloud</h3>
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
             <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl flex flex-col justify-between">
                <div>
                   <Radio size={32} className="text-amber-500 animate-pulse mb-8" />
                   <h3 className="text-2xl font-black uppercase italic mb-4">Briefing AI</h3>
                   <p className="text-slate-400 text-sm italic leading-relaxed">"{securityBriefing}"</p>
                </div>
                <button onClick={() => setActiveTab('chat')} className="w-full bg-white text-slate-900 font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-amber-500 transition-colors">KOORDINASI TIM <ArrowRight size={18} className="inline ml-2"/></button>
             </div>
          </div>
        </div>
      )}

      {/* 2. CEK UNIT (REAL-TIME STATUS) */}
      {activeTab === 'log_resident' && (
        <div className="space-y-8 animate-slide-up">
           <h3 className="text-2xl font-black text-slate-900 uppercase italic">Status Unit Warga</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {residents.map(res => (
                <div key={res.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all group">
                   <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-slate-900 text-white rounded-[1.2rem] flex items-center justify-center font-black group-hover:bg-amber-500 transition-colors shadow-lg">{res.block}</div>
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{res.isHome ? 'DI UNIT' : 'KELUAR'}</span>
                      </div>
                      <h4 className="font-black text-slate-900 uppercase italic truncate text-base mb-1">{res.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit: {res.block}-{res.houseNumber}</p>
                   </div>
                   <button onClick={() => handleStatusChange(res.id, !res.isHome)} className={`w-full mt-6 py-4 rounded-[1.5rem] font-black text-[10px] uppercase flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all ${res.isHome ? 'bg-slate-900 text-white' : 'bg-green-500 text-white'}`}>
                      {res.isHome ? <ArrowLeftRight size={16}/> : <CheckCircle size={16}/>} {res.isHome ? 'CATAT KELUAR' : 'KONFIRMASI MASUK'}
                   </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* 3. PATROLI (MULTI-DEVICE LOGGING) */}
      {activeTab === 'patrol' && (
        <div className="space-y-8 animate-slide-up">
           <h3 className="text-2xl font-black text-slate-900 uppercase italic">Checkpoints Keamanan</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
              {INITIAL_CHECKPOINTS.map((cp, idx) => {
                const last = patrolLogs.find(l => l.checkpoint === cp);
                return (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all group">
                    <div>
                      <div className="flex justify-between items-start mb-8">
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
                      <div className="text-[10px] font-black text-slate-400 uppercase border-t pt-6 tracking-widest italic truncate leading-none">Terakhir: {last ? `${last.securityName} (${new Date(last.timestamp).toLocaleTimeString()})` : 'Belum Ada Data Cloud'}</div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* 4. FEED (GLOBAL TIMELINE) */}
      {activeTab === 'reports' && (
        <div className="space-y-8 animate-slide-up pb-20">
           <h3 className="text-2xl font-black text-slate-900 uppercase italic">Timeline Aktivitas Cloud</h3>
           <div className="bg-white p-6 lg:p-12 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="space-y-12">
                {timelineFeed.length > 0 ? timelineFeed.map((item: any, idx) => (
                  <div key={idx} className="flex gap-6 lg:gap-10 group animate-slide-up">
                     <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${item.color === 'slate' ? 'bg-slate-900 text-white' : item.color === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                           {item.type === 'PATROL' ? <ClipboardCheck size={26}/> : item.type === 'INCIDENT' ? <AlertTriangle size={26}/> : <BookOpen size={26}/>}
                        </div>
                        <div className="w-0.5 flex-1 bg-slate-100 mt-6 group-last:hidden"></div>
                     </div>
                     <div className="flex-1 pb-12 border-b border-slate-50 last:border-none">
                        <div className="flex justify-between items-center mb-3">
                           <h4 className="font-black text-slate-900 text-base uppercase italic leading-none">{item.title}</h4>
                           <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{new Date(item.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
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
                      <p className="font-black uppercase tracking-[0.3em] text-[10px]">Menunggu Sinkronisasi Global...</p>
                   </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* 5. TAMU (GUEST REGISTRATION) */}
      {activeTab === 'guests' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase italic">Buku Tamu Digital</h3>
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
                             <td className="px-8 py-6 text-[10px] font-black text-slate-300">{new Date(g.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* 6. INSIDEN (REPORTING) */}
      {activeTab === 'incident' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase italic">Laporan Insiden</h3>
              <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all"><Plus size={24}/></button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {incidents.map(inc => (
                <div key={inc.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all">
                   <div className="flex justify-between items-start mb-6">
                      <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${inc.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{inc.severity} SEVERITY</div>
                      <span className="text-[10px] font-black text-slate-300 italic">{new Date(inc.timestamp).toLocaleDateString()}</span>
                   </div>
                   <h4 className="text-xl font-black text-slate-900 uppercase italic mb-2">{inc.type}</h4>
                   <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin size={14}/> {inc.location}</p>
                   <p className="text-slate-500 mb-8 italic text-sm leading-relaxed">{inc.description}</p>
                   {inc.photo && <img src={inc.photo} className="w-full h-48 object-cover rounded-2xl mb-6 shadow-md" />}
                   <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase italic">Oleh: {inc.reporterName}</span>
                      <span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase">{inc.status}</span>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* 7. WARGA (MASTER DATA) */}
      {activeTab === 'residents' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase italic">Master Database Unit</h3>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all"><Plus size={24}/></button>
              )}
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {residents.map(res => (
                <div key={res.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all">
                   <div>
                      <div className="flex justify-between items-start mb-8">
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center font-black text-lg shadow-lg group-hover:bg-amber-500 transition-colors">{res.block}</div>
                        <span className="text-[9px] font-black text-slate-300 uppercase italic opacity-50">NODE: {res.id.slice(0,5)}</span>
                      </div>
                      <h4 className="font-black text-slate-900 uppercase italic truncate text-lg mb-1">{res.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Rumah {res.block} No {res.houseNumber}</p>
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

      {/* 8. CHAT & 9. SETTINGS (UNCHANGED BUT ROBUST) */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-220px)] flex flex-col animate-slide-up pb-10">
           <div className="flex-1 bg-white rounded-t-[3rem] shadow-sm border border-slate-100 overflow-y-auto p-6 lg:p-10 space-y-8 no-scrollbar relative">
              <div className="sticky top-0 z-10 text-center mb-10">
                 <span className="bg-slate-50 text-slate-400 text-[8px] font-black uppercase px-6 py-2 rounded-full border border-slate-100 tracking-widest italic backdrop-blur-md">Pusat Komunikasi Cluster</span>
              </div>
              {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                   <div className={`max-w-[85%] p-6 rounded-[2.5rem] relative shadow-sm transition-transform hover:scale-[1.01] ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-6 mb-2">
                         <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                         <span className="text-[8px] font-bold px-2 py-0.5 bg-white/10 rounded-full uppercase opacity-40 italic">{msg.senderRole}</span>
                      </div>
                      <p className="text-sm lg:text-base font-medium leading-relaxed">{msg.text}</p>
                      <p className={`text-[8px] mt-3 opacity-30 text-right font-black uppercase tracking-widest`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : (
                 <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale italic">
                    <MessageSquare size={64} className="mb-6" />
                    <p className="font-black uppercase tracking-[0.4em] text-[10px]">Obrolan Tim Akan Sinkron Otomatis</p>
                 </div>
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={handleSendChat} className="bg-white p-6 rounded-b-[3rem] border-t border-slate-100 flex gap-4 shadow-2xl items-center sticky bottom-0">
              <input type="text" placeholder="Ketik koordinasi tim..." className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-sm lg:text-base focus:border-amber-500 transition-all shadow-inner" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-5 rounded-2xl active:scale-95 shadow-2xl hover:bg-slate-800 transition-all"><Send size={26}/></button>
           </form>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto space-y-8 animate-slide-up pb-20">
           <h3 className="text-2xl font-black text-slate-900 uppercase italic">Konfigurasi Cloud</h3>
           <div className="bg-white p-10 lg:p-14 rounded-[4rem] shadow-sm border border-slate-100 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-slate-900"></div>
              <div className="relative mt-4">
                 <div className="w-32 h-32 bg-amber-500 text-slate-900 rounded-[3rem] flex items-center justify-center font-black text-5xl mx-auto mb-8 shadow-2xl border-[6px] border-white">{currentUser.name.charAt(0)}</div>
              </div>
              <h3 className="text-3xl font-black text-slate-900 uppercase italic mb-1 leading-none tracking-tight">{currentUser.name}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12 italic leading-none">Role: {currentUser.role} • Cloud Active</p>
              <div className="space-y-4">
                 <button onClick={() => setIsModalOpen('CLUSTER')} className="w-full py-6 bg-slate-900 text-amber-500 rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all"><RefreshCw size={20}/> GANTI NAMA CLUSTER (SINKRONISASI)</button>
                 <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-6 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all"><Trash2 size={20}/> HAPUS CACHE LOKAL</button>
                 <button onClick={() => setCurrentUser(null)} className="w-full py-6 bg-red-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all"><LogOut size={20}/> LOGOUT DARI SISTEM</button>
              </div>
           </div>
        </div>
      )}

      {/* --- ALL MODALS IMPLEMENTATION --- */}
      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic">Register Tamu</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveGuest} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-600 transition-all" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-600" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                 <option value="">Pilih Tujuan Unit...</option>
                 {residents.map(r => <option key={r.id} value={r.id}>{r.name} ({r.block}-{r.houseNumber})</option>)}
              </select>
              <textarea required placeholder="Keperluan Kunjungan..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-600 min-h-[120px]" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">CHECK-IN TAMU</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic">Lapor Insiden</h3>
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
              <button type="submit" className="w-full py-5 bg-red-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">KIRIM KE PUSAT (CLOUD)</button>
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
                <p className="text-[10px] font-black uppercase opacity-70 mt-1 tracking-widest italic leading-none">Vercel Digital Patrol</p>
              </div>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handlePatrolReport} className="p-8 lg:p-12 space-y-8">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 leading-none">Bukti Visual Petugas:</label>
                 <div className="flex flex-col gap-4">
                    {patrolReportData.photo ? (
                      <div className="relative group">
                         <img src={patrolReportData.photo} alt="Preview" className="w-full h-48 lg:h-56 object-cover rounded-[2rem] border-2 border-slate-100" />
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
              <button type="submit" className={`w-full py-5 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>SIMPAN & SINKRON CLOUD</button>
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
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">SINKRONISASI UNIT</button>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
