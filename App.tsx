
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  SECURITY_USERS as INITIAL_SECURITY, 
  ADMIN_USERS, 
  MOCK_RESIDENTS,
  BLOCKS,
  CHECKPOINTS as INITIAL_CHECKPOINTS 
} from './constants.tsx';
import { User, PatrolLog, IncidentReport, Resident, GuestLog, ChatMessage, UserRole, FullDatabase } from './types.ts';
import Layout from './components/Layout.tsx';
import { 
  Shield, Search, Phone, Send, Users, MapPin, X, Lock, TrendingUp, AlertTriangle, 
  UserPlus, ArrowRight, CheckCircle, Clock, Edit2, Plus, Home, Settings, LogOut, 
  Activity, MessageSquare, FileText, BellRing, Database, Copy, Check, RefreshCw, 
  PhoneCall, Info, LayoutGrid, Ghost, Trash2, UserCog, UserCheck, Map, UserSearch
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing } from './services/geminiService.ts';
import { DatabaseService } from './services/databaseService.ts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const INITIAL_DB: FullDatabase = {
  residents: MOCK_RESIDENTS,
  securityUsers: INITIAL_SECURITY,
  guests: [],
  incidents: [],
  patrolLogs: [],
  chatMessages: [],
  checkpoints: INITIAL_CHECKPOINTS,
  lastUpdated: new Date().toISOString()
};

const App: React.FC = () => {
  // 1. Database State - Centralized
  const [db, setDb] = useState<FullDatabase>(() => DatabaseService.getDatabase(INITIAL_DB));

  // 2. Auth States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSearch, setLoginSearch] = useState('');
  
  // 3. UI States
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'SECURITY' | 'CHECKPOINT' | 'GUEST' | 'INCIDENT' | 'SOS_MODAL' | 'SYNC_MODAL' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [syncInput, setSyncInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [securityBriefing, setSecurityBriefing] = useState<string>('');

  // 4. Temp Form States
  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [secForm, setSecForm] = useState<Partial<User>>({ name: '', role: 'SECURITY', phoneNumber: '' });
  const [checkpointForm, setCheckpointForm] = useState('');
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '' });
  const [incForm, setIncForm] = useState({ type: 'Kriminalitas', location: '', description: '' });
  const [patrolAction, setPatrolAction] = useState<{cp: string, status: 'OK' | 'DANGER'} | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-save to LocalStorage
  useEffect(() => {
    DatabaseService.saveDatabase(db);
  }, [db]);

  // AI Briefing on login
  useEffect(() => {
    if (currentUser) {
      const shift = new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Pagi' : 'Malam';
      getSecurityBriefing(shift).then(setSecurityBriefing);
    }
  }, [currentUser]);

  // Chat auto-scroll
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [db.chatMessages, activeTab]);

  // Login Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const pin = passwordInput.trim();
    
    const isSec = db.securityUsers.some(u => u.id === selectedUser.id) && pin === '123456';
    const isAdm = ADMIN_USERS.some(u => u.id === selectedUser.id) && pin === 'admin123';
    const isRes = db.residents.some(r => r.id === selectedUser.id) && pin === 'wargatka123456';

    if (isSec || isAdm || isRes) {
      setCurrentUser({ id: selectedUser.id, name: selectedUser.name, role: loginTab as UserRole });
      setActiveTab('dashboard');
      setLoginError('');
      setPasswordInput('');
      setLoginSearch('');
    } else {
      setLoginError('PIN Keamanan Salah!');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedUser(null);
    setActiveTab('dashboard');
    setLoginSearch('');
  };

  // CRUD RESIDENTS
  const handleSaveResident = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      setDb(prev => ({
        ...prev,
        residents: prev.residents.map(r => r.id === editingItem.id ? { ...r, ...resForm } as Resident : r)
      }));
    } else {
      const newRes: Resident = {
        id: `res-${Date.now()}`,
        name: resForm.name || '',
        houseNumber: resForm.houseNumber || '',
        block: resForm.block || BLOCKS[0],
        phoneNumber: resForm.phoneNumber || '',
        isHome: true
      };
      setDb(prev => ({ ...prev, residents: [newRes, ...prev.residents] }));
    }
    setIsModalOpen(null);
    setEditingItem(null);
    setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  };

  const deleteResident = (id: string) => {
    if (window.confirm('Hapus warga ini dari database?')) {
      setDb(prev => ({ ...prev, residents: prev.residents.filter(r => r.id !== id) }));
    }
  };

  // CRUD SECURITY
  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      setDb(prev => ({
        ...prev,
        securityUsers: prev.securityUsers.map(u => u.id === editingItem.id ? { ...u, ...secForm } as User : u)
      }));
    } else {
      const newSec: User = {
        id: `sec-${Date.now()}`,
        name: secForm.name || '',
        role: 'SECURITY',
        phoneNumber: secForm.phoneNumber
      };
      setDb(prev => ({ ...prev, securityUsers: [newSec, ...prev.securityUsers] }));
    }
    setIsModalOpen(null);
    setEditingItem(null);
    setSecForm({ name: '', role: 'SECURITY', phoneNumber: '' });
  };

  const deleteSecurity = (id: string) => {
    if (window.confirm('Hapus petugas ini dari tim satpam?')) {
      setDb(prev => ({ ...prev, securityUsers: prev.securityUsers.filter(u => u.id !== id) }));
    }
  };

  // CRUD CHECKPOINTS
  const handleSaveCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem !== null) {
      setDb(prev => ({
        ...prev,
        checkpoints: prev.checkpoints.map((cp, idx) => idx === editingItem ? checkpointForm : cp)
      }));
    } else {
      setDb(prev => ({ ...prev, checkpoints: [...prev.checkpoints, checkpointForm] }));
    }
    setIsModalOpen(null);
    setEditingItem(null);
    setCheckpointForm('');
  };

  const deleteCheckpoint = (index: number) => {
    if (window.confirm('Hapus titik patroli ini?')) {
      setDb(prev => ({
        ...prev,
        checkpoints: prev.checkpoints.filter((_, idx) => idx !== index)
      }));
    }
  };

  // OTHER HANDLERS
  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    const msg: ChatMessage = {
      id: `chat-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: chatInput,
      timestamp: new Date().toISOString()
    };
    setDb(prev => ({ ...prev, chatMessages: [...prev.chatMessages, msg] }));
    setChatInput('');
  };

  const addGuest = (e: React.FormEvent) => {
    e.preventDefault();
    const res = db.residents.find(r => r.id === guestForm.visitToId);
    const newGuest: GuestLog = {
      id: `gst-${Date.now()}`,
      name: guestForm.name || '',
      visitToId: guestForm.visitToId || '',
      visitToName: res ? `${res.block}-${res.houseNumber} (${res.name})` : 'Umum',
      purpose: guestForm.purpose || '',
      entryTime: new Date().toISOString(),
      status: 'IN'
    };
    setDb(prev => ({ ...prev, guests: [newGuest, ...prev.guests] }));
    setIsModalOpen(null);
    setGuestForm({ name: '', visitToId: '', purpose: '' });
  };

  const addIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsAnalyzing(true);
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    try {
      const analysis = await analyzeIncident(incForm.description);
      if (analysis?.severity) severity = analysis.severity as any;
    } catch {}
    const newInc: IncidentReport = {
      id: `inc-${Date.now()}`,
      reporterId: currentUser.id,
      reporterName: currentUser.name,
      timestamp: new Date().toISOString(),
      type: incForm.type,
      location: incForm.location,
      description: incForm.description,
      status: 'PENDING',
      severity
    };
    setDb(prev => ({ ...prev, incidents: [newInc, ...prev.incidents] }));
    setIsAnalyzing(false);
    setIsModalOpen(null);
    setIncForm({ type: 'Kriminalitas', location: '', description: '' });
  };

  const submitPatrol = (status: 'OK' | 'DANGER') => {
    if (!patrolAction || !currentUser) return;
    const log: PatrolLog = {
      id: `ptr-${Date.now()}`,
      securityId: currentUser.id,
      securityName: currentUser.name,
      timestamp: new Date().toISOString(),
      checkpoint: patrolAction.cp,
      status,
      note: 'Patroli rutin area.'
    };
    setDb(prev => ({ ...prev, patrolLogs: [log, ...prev.patrolLogs] }));
    setPatrolAction(null);
  };

  const triggerSOS = () => {
    if (!currentUser) return;
    const sos: IncidentReport = {
      id: `sos-${Date.now()}`,
      reporterId: currentUser.id, reporterName: currentUser.name,
      timestamp: new Date().toISOString(),
      type: 'EMERGENCY / SOS', location: 'Area Kawasan',
      description: `Warga ${currentUser.name} membutuhkan bantuan segera!`,
      status: 'PENDING', severity: 'HIGH'
    };
    setDb(prev => ({ ...prev, incidents: [sos, ...prev.incidents] }));
    setIsModalOpen('SOS_MODAL');
    setTimeout(() => setIsModalOpen(null), 3000);
  };

  const importData = () => {
    if (DatabaseService.importSyncCode(syncInput)) {
      setDb(DatabaseService.getDatabase(INITIAL_DB));
      alert("Database Berhasil Disinkronkan!");
      setIsModalOpen(null);
    } else {
      alert("Kode Sinkronisasi Tidak Valid!");
    }
  };

  const chartData = useMemo(() => {
    const blocks = ['A', 'B', 'C', 'D'];
    return blocks.map(b => ({
      name: `Blok ${b}`,
      val: db.incidents.filter(i => i.location.toUpperCase().includes(b)).length + 1
    }));
  }, [db.incidents]);

  // LOGIN PAGE RENDERER
  if (!currentUser) {
    const basePool = loginTab === 'SECURITY' 
      ? db.securityUsers 
      : loginTab === 'ADMIN' 
        ? ADMIN_USERS 
        : db.residents.map(r => ({ id: r.id, name: r.name, sub: `Blok ${r.block} No. ${r.houseNumber}` }));

    // Fix: Explicitly type 'u' as 'any' to safely access the 'sub' property which is present on resident objects but not on User objects
    const filteredPool = basePool.filter((u: any) => 
      u.name.toLowerCase().includes(loginSearch.toLowerCase()) || 
      (u.sub && u.sub.toLowerCase().includes(loginSearch.toLowerCase()))
    );

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[1000px] flex flex-col md:flex-row rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
          {/* Left Panel */}
          <div className="w-full md:w-5/12 bg-[#0F172A] p-10 flex flex-col justify-between text-white relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full"></div>
            <div>
              <div className="bg-amber-500 w-16 h-16 rounded-[1.8rem] flex items-center justify-center mb-10 shadow-xl shadow-amber-500/20">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-4xl font-black mb-4 tracking-tighter leading-tight">TKA<br/>SECURE HUB</h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-[240px]">Gerbang Keamanan & Manajemen Hunian Terpadu. Lindungi kawasan dengan teknologi.</p>
            </div>
            <div className="space-y-4">
              <div className="p-5 bg-slate-800/40 rounded-3xl border border-slate-700 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw size={14} className="text-amber-500 animate-spin-slow"/>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Live Sync Ready</span>
                </div>
                <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed tracking-tight">Database terpusat aktif. Sinkronisasi data antar perangkat keamanan diaktifkan otomatis.</p>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-[9px] text-slate-600 font-black uppercase">Ver 2.4.0</span>
                <span className="text-[9px] text-slate-600 font-black uppercase tracking-tighter">© 2025 TKA Security Team</span>
              </div>
            </div>
          </div>

          {/* Right Panel (Login Form) */}
          <div className="w-full md:w-7/12 p-8 md:p-12 flex flex-col h-[700px] max-h-screen">
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Pilih Akses</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Selamat datang kembali di sistem.</p>
            
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button 
                  key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); setLoginError(''); setLoginSearch(''); }}
                  className={`flex-1 py-3.5 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${loginTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {t === 'SECURITY' ? 'Petugas' : t === 'ADMIN' ? 'Admin' : 'Warga'}
                </button>
              ))}
            </div>

            {/* Search Input for Large User Lists */}
            <div className="relative mb-4">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="text" 
                placeholder={`Cari nama ${loginTab === 'RESIDENT' ? 'warga' : 'petugas'}...`}
                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 focus:bg-white outline-none font-bold text-sm transition-all"
                value={loginSearch}
                onChange={e => setLoginSearch(e.target.value)}
              />
            </div>

            <form onSubmit={handleLogin} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto no-scrollbar pr-1 mb-6">
                <div className="grid grid-cols-1 gap-2.5">
                  {filteredPool.length > 0 ? filteredPool.map((u: any) => (
                    <button 
                      key={u.id} type="button"
                      onClick={() => { setSelectedUser(u); setLoginError(''); }}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 text-left group ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50/50 shadow-md translate-x-1' : 'border-transparent bg-slate-50 hover:bg-slate-100 hover:border-slate-200'}`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 text-sm truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate tracking-tighter">{u.sub || (loginTab === 'SECURITY' ? 'Security Force' : 'Management')}</p>
                      </div>
                      {selectedUser?.id === u.id ? (
                        <div className="bg-amber-500 p-1 rounded-full"><Check size={16} className="text-slate-900" /></div>
                      ) : (
                        <ArrowRight size={18} className="text-slate-200 group-hover:text-slate-400" />
                      )}
                    </button>
                  )) : (
                    <div className="py-24 text-center">
                       <Ghost size={56} className="mx-auto text-slate-200 mb-4 animate-pulse" />
                       <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">Data tidak ditemukan</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedUser && (
                <div className="space-y-4 pt-6 border-t border-slate-100 animate-slide-up sticky bottom-0 bg-white">
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    <input 
                      type="password" required placeholder="PIN Keamanan"
                      className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-2xl tracking-[0.8em] text-center" 
                      value={passwordInput} onChange={e => setPasswordInput(e.target.value)} 
                    />
                  </div>
                  {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center">{loginError}</p>}
                  <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-4 text-xs uppercase tracking-[0.2em] active:scale-[0.98] shadow-2xl shadow-slate-900/20">
                    LOGIN SEKARANG <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      
      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-slide-up pb-24">
          {currentUser.role === 'RESIDENT' && (
            <div className="bg-red-600 p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 mb-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[50px] rounded-full"></div>
               <div className="flex items-center gap-6 relative z-10">
                 <div className="bg-white/20 p-4 rounded-2xl shadow-inner"><BellRing size={32} className="animate-bounce" /></div>
                 <div>
                    <h3 className="text-xl font-black mb-1 tracking-tighter uppercase leading-none">PANGGILAN DARURAT (SOS)</h3>
                    <p className="text-xs text-red-100 font-medium opacity-90">Tekan tombol ini jika Anda dalam bahaya. Petugas akan segera datang.</p>
                 </div>
               </div>
               <button onClick={triggerSOS} className="bg-white text-red-600 px-10 py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all relative z-10">AKTIFKAN SOS</button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Petugas Aktif', val: db.securityUsers.length, icon: <UserCheck size={24}/>, color: 'blue' },
              { label: 'Insiden Terbuka', val: db.incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Terdaftar', val: db.guests.filter(g => g.status === 'IN').length, icon: <Users size={24}/>, color: 'amber' },
              { label: 'Data Warga', val: db.residents.length, icon: <Home size={24}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-[2.2rem] shadow-sm border border-slate-100 group hover:shadow-md transition-all">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                <p className="text-2xl font-black text-slate-900 tracking-tighter">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[350px]">
               <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-3"><TrendingUp size={22} className="text-amber-500"/> Tren Keamanan Wilayah</h3>
               <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="val" radius={[8, 8, 8, 8]} barSize={45}>
                        {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#10B981', '#EF4444'][index % 4]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] flex flex-col justify-between shadow-2xl relative overflow-hidden">
               <div className="absolute bottom-0 right-0 w-48 h-48 bg-amber-500/10 blur-[60px] rounded-full"></div>
               <div className="relative z-10">
                  <h3 className="font-black text-xl mb-6 flex items-center gap-3 text-amber-500"><Shield size={28}/> Briefing AI</h3>
                  <div className="space-y-4">
                    <p className="text-slate-400 text-xs italic leading-relaxed font-medium">"{securityBriefing || 'Mengambil instruksi harian dari pusat data...'}"</p>
                    <div className="flex gap-2">
                       <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-[8px] font-black uppercase">Status: Siaga</span>
                       <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-[8px] font-black uppercase">Shift: {new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Pagi' : 'Malam'}</span>
                    </div>
                  </div>
               </div>
               <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-4 rounded-2xl mt-8 text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-amber-500/20 relative z-10 hover:bg-amber-400 transition-all">KOORDINASI TIM <ArrowRight size={18}/></button>
            </div>
          </div>
        </div>
      )}

      {/* PATROL TAB */}
      {activeTab === 'patrol' && (
        <div className="space-y-6 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900">Kendali Patroli</h3>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => { setEditingItem(null); setCheckpointForm(''); setIsModalOpen('CHECKPOINT'); }} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 active:scale-95 shadow-xl">
                  <Plus size={18}/> TAMBAH TITIK
                </button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {db.checkpoints.map((cp, idx) => {
                const last = db.patrolLogs.filter(l => l.checkpoint === cp)[0];
                return (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-lg group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors">{idx + 1}</div>
                        <div className="flex gap-1">
                          {currentUser.role === 'ADMIN' && (
                            <>
                              <button onClick={() => { setEditingItem(idx); setCheckpointForm(cp); setIsModalOpen('CHECKPOINT'); }} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-amber-500 transition-colors"><Edit2 size={14}/></button>
                              <button onClick={() => deleteCheckpoint(idx)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                            </>
                          )}
                          {last && <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${last.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{last.status}</span>}
                        </div>
                      </div>
                      <h4 className="text-lg font-black text-slate-900 mb-8">{cp}</h4>
                    </div>
                    {currentUser.role === 'SECURITY' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setPatrolAction({cp, status: 'OK'})} className="py-4 bg-green-500 text-white rounded-xl font-black text-[10px] uppercase active:scale-95 shadow-lg shadow-green-500/10 hover:bg-green-600 transition-colors">AMAN</button>
                        <button onClick={() => setPatrolAction({cp, status: 'DANGER'})} className="py-4 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase active:scale-95 shadow-lg shadow-red-600/10 hover:bg-red-700 transition-colors">BAHAYA</button>
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-slate-400 uppercase border-t pt-4 tracking-tight">Cek Terakhir: {last ? `${last.securityName} (${new Date(last.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})` : 'Belum Ada History'}</div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* INCIDENT TAB */}
      {activeTab === 'incident' && (
        <div className="space-y-6 animate-slide-up pb-24">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-slate-900">Pelaporan Kejadian</h3>
            <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 active:scale-95 shadow-xl shadow-red-600/20"><AlertTriangle size={18}/> LAPORAN BARU</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {db.incidents.length > 0 ? db.incidents.map(i => (
              <div key={i.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:shadow-xl transition-all">
                <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 ${i.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${i.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{i.severity} Priority</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{new Date(i.timestamp).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-2">{i.type}</h4>
                  <p className="text-xs text-slate-400 font-bold mb-4 flex items-center gap-1"><MapPin size={12} className="text-amber-500"/> {i.location}</p>
                  <p className="text-sm text-slate-600 leading-relaxed italic mb-8">"{i.description}"</p>
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-[10px] shadow-sm">{i.reporterName.charAt(0)}</div>
                      <p className="text-[10px] font-black text-slate-900 uppercase">{i.reporterName}</p>
                   </div>
                   <span className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-full ${i.status === 'RESOLVED' ? 'bg-green-50 text-green-500 border border-green-100' : 'bg-amber-50 text-amber-500 border border-amber-100'}`}>{i.status}</span>
                </div>
              </div>
            )) : (
              <div className="lg:col-span-2 py-32 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-50">
                 <Ghost size={64} className="mx-auto text-slate-100 mb-4" />
                 <p className="text-slate-300 font-black uppercase italic tracking-widest text-[10px]">Basis data kejadian bersih & aman</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GUESTS TAB */}
      {activeTab === 'guests' && (
        <div className="space-y-6 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Buku Tamu Masuk</h3>
              <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-xl active:scale-95 shadow-blue-600/20"><UserPlus size={18}/> DAFTARKAN TAMU</button>
           </div>
           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Pengunjung</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tujuan Unit</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Check In</th>
                    <th className="px-8 py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {db.guests.length > 0 ? db.guests.map(g => (
                     <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-8 py-5 font-bold text-slate-900 text-sm">{g.name}</td>
                       <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase">{g.visitToName}</td>
                       <td className="px-8 py-5">
                          <span className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                            {g.status === 'IN' ? 'BERADA DI AREA' : 'SUDAH KELUAR'}
                          </span>
                       </td>
                       <td className="px-8 py-5 text-[10px] font-black text-slate-400">{new Date(g.entryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                       <td className="px-8 py-5 text-right pr-10">
                          {g.status === 'IN' && <button onClick={() => setDb(prev => ({...prev, guests: prev.guests.map(item => item.id === g.id ? {...item, status: 'OUT'} : item)}))} className="p-2.5 text-slate-300 hover:text-red-500 transition-all hover:bg-red-50 rounded-xl" title="Check Out"><LogOut size={18}/></button>}
                       </td>
                     </tr>
                   )) : (
                     <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-black uppercase italic text-[10px] tracking-widest">Belum ada kunjungan tamu hari ini</td></tr>
                   )}
                </tbody>
              </table>
           </div>
        </div>
      )}

      {/* RESIDENTS TAB */}
      {activeTab === 'residents' && (
        <div className="space-y-6 animate-slide-up pb-24">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Manajemen Basis Warga</h3>
            <div className="flex gap-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-colors" size={18}/>
                <input 
                  type="text" placeholder="Cari warga..." 
                  className="pl-12 pr-6 py-3.5 rounded-2xl bg-white border border-slate-200 text-sm outline-none focus:border-amber-500 font-bold w-full md:w-[300px] shadow-sm transition-all" 
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
                />
              </div>
              {currentUser.role === 'ADMIN' && <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl active:scale-95 transition-all"><Plus size={24}/></button>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {db.residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(res => (
              <div key={res.id} className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-24 h-24 blur-[50px] opacity-10 ${res.isHome ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                <div className="relative z-10">
                   <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-900 flex items-center justify-center font-black text-xl border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">{res.block}</div>
                      <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{res.isHome ? 'ADA DI UNIT' : 'KELUAR AREA'}</span>
                   </div>
                   <h4 className="font-black text-xl text-slate-900 mb-1 leading-tight">{res.name}</h4>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">No. Unit: <span className="text-slate-900 font-black">{res.houseNumber}</span></p>
                </div>
                <div className="mt-10 flex gap-2 relative z-10">
                   <a href={`tel:${res.phoneNumber}`} className="flex-1 py-4 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors"><PhoneCall size={22}/></a>
                   {currentUser.role === 'ADMIN' && (
                     <>
                        <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-amber-500 hover:bg-amber-50 transition-all shadow-sm"><Edit2 size={20}/></button>
                        <button onClick={() => deleteResident(res.id)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"><Trash2 size={20}/></button>
                     </>
                   )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-250px)] flex flex-col animate-slide-up pb-20">
           <div className="flex-1 bg-white rounded-t-[3rem] shadow-sm border border-slate-100 overflow-y-auto p-8 space-y-6 no-scrollbar relative">
              {db.chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-200 opacity-50 space-y-4">
                  <Ghost size={64} className="animate-pulse" />
                  <p className="font-black uppercase tracking-widest text-[10px] italic">Saluran koordinasi sepi...</p>
                </div>
              ) : (
                db.chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[75%] p-6 rounded-[2.5rem] shadow-sm ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                        <div className="flex justify-between items-center gap-6 mb-2">
                           <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                           <span className="text-[8px] font-bold px-2.5 py-1 bg-white/10 rounded-full uppercase tracking-tighter">{msg.senderRole}</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                        <p className="text-[8px] mt-2 opacity-40 text-right font-black tracking-widest uppercase">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                     </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={sendChat} className="bg-white p-6 rounded-b-[3rem] border-t border-slate-100 flex gap-4 shadow-sm relative z-10">
              <input 
                type="text" placeholder="Ketik pesan koordinasi..." 
                className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" 
                value={chatInput} onChange={e => setChatInput(e.target.value)} 
              />
              <button type="submit" className="bg-slate-900 text-white p-5 rounded-[2rem] active:scale-95 transition-all shadow-xl hover:bg-slate-800"><Send size={26}/></button>
           </form>
        </div>
      )}

      {/* ADMIN SETTINGS & STAFF MANAGEMENT */}
      {activeTab === 'settings' && currentUser.role === 'ADMIN' && (
        <div className="space-y-12 animate-slide-up pb-24 max-w-5xl mx-auto">
           {/* Section 1: Staff */}
           <div className="space-y-6">
              <div className="flex justify-between items-center">
                 <h3 className="text-2xl font-black text-slate-900 tracking-tight">Manajemen Tim Keamanan</h3>
                 <button onClick={() => { setEditingItem(null); setSecForm({ name: '', role: 'SECURITY', phoneNumber: '' }); setIsModalOpen('SECURITY'); }} className="bg-slate-900 text-white px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase flex items-center gap-3 shadow-2xl active:scale-95 transition-all"><UserPlus size={20}/> REKRUT PETUGAS BARU</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {db.securityUsers.map(u => (
                   <div key={u.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                      <div className="flex items-center gap-6 mb-10">
                         <div className="w-16 h-16 rounded-[1.8rem] bg-slate-900 text-white flex items-center justify-center text-2xl font-black group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors shadow-lg shadow-slate-900/10">{u.name.charAt(0)}</div>
                         <div>
                           <h4 className="text-xl font-black text-slate-900 tracking-tight leading-tight">{u.name}</h4>
                           <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1">Status: Operasional Siaga</p>
                         </div>
                      </div>
                      <div className="flex gap-2 pt-6 border-t border-slate-50">
                         <button onClick={() => { setEditingItem(u); setSecForm(u); setIsModalOpen('SECURITY'); }} className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-100 transition-all"><Edit2 size={16}/> EDIT</button>
                         <button onClick={() => deleteSecurity(u.id)} className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-red-100 transition-all"><Trash2 size={16}/> HAPUS</button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           {/* Section 2: Sync & Cloud */}
           <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-slate-50 group-hover:bg-amber-50 blur-[100px] rounded-full transition-colors duration-700"></div>
              <h3 className="text-2xl font-black text-slate-900 mb-10 relative z-10 tracking-tight">Arsitektur Database Cloud</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                 <div className="p-10 bg-slate-50 rounded-[3.5rem] border border-slate-100 hover:bg-white transition-all shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
                       <Database size={28} className="text-amber-600"/>
                    </div>
                    <h5 className="font-black text-sm uppercase tracking-widest mb-3">Ekspor Data Master</h5>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-8 italic leading-relaxed tracking-tight">Hasilkan kode enkripsi untuk mencadangkan atau memindahkan basis data perumahan secara menyeluruh ke perangkat lain.</p>
                    <button onClick={() => { setSyncInput(DatabaseService.exportSyncCode()); setIsModalOpen('SYNC_MODAL'); }} className="w-full py-5 bg-white border-2 border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95">GENERATE KODE MASTER</button>
                 </div>
                 <div className="p-10 bg-slate-50 rounded-[3.5rem] border border-slate-100 hover:bg-white transition-all shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                       <RefreshCw size={28} className="text-blue-600"/>
                    </div>
                    <h5 className="font-black text-sm uppercase tracking-widest mb-3">Impor Data Master</h5>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-8 italic leading-relaxed tracking-tight">Masukkan kode master dari perangkat admin utama untuk memulihkan atau menyinkronkan data di perangkat lokal ini.</p>
                    <button onClick={() => { setSyncInput(''); setIsModalOpen('SYNC_MODAL'); }} className="w-full py-5 bg-white border-2 border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95">INPUT KODE MASTER</button>
                 </div>
              </div>
              <div className="pt-12 border-t mt-12">
                <button onClick={handleLogout} className="w-full py-6 bg-red-50 text-red-600 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.2em] flex items-center justify-center gap-5 active:scale-95 transition-all shadow-sm hover:bg-red-100 hover:shadow-md"><LogOut size={24}/> KELUAR SISTEM ADMINISTRATOR</button>
              </div>
           </div>
        </div>
      )}

      {/* MODALS */}
      {/* MODAL CHECKPOINT (ADD/EDIT) */}
      {isModalOpen === 'CHECKPOINT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight leading-none">{editingItem !== null ? 'Perbarui Titik' : 'Titik Patroli Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveCheckpoint} className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nama Area / Kode Titik:</label>
                <input type="text" required placeholder="Misal: Gerbang Belakang Timur..." className="w-full px-7 py-5 rounded-2xl bg-slate-50 border-2 border-slate-50 outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={checkpointForm} onChange={e => setCheckpointForm(e.target.value)} />
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all shadow-slate-900/20">KONFIRMASI DATA</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight">{editingItem ? 'Edit Profil Warga' : 'Registrasi Warga Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveResident} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Nama Lengkap:</label>
                <input type="text" required placeholder="Sesuai KTP..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Pilih Blok:</label>
                  <select className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm" value={resForm.block} onChange={e => setResForm({...resForm, block: e.target.value})}>
                    {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Nomor Unit:</label>
                  <input type="text" required placeholder="Contoh: 08" className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm" value={resForm.houseNumber} onChange={e => setResForm({...resForm, houseNumber: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">WhatsApp / Kontak:</label>
                <input type="tel" required placeholder="08xxxx" className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              </div>
              <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex gap-4 items-center">
                 <div className="bg-white p-3 rounded-xl shadow-sm text-amber-500"><Lock size={20}/></div>
                 <div>
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Akses Login:</p>
                    <p className="text-[10px] font-bold text-slate-700 italic">PIN: wargatka123456</p>
                 </div>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all shadow-slate-900/20">SIMPAN DATABASE</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'SECURITY' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight leading-none">{editingItem ? 'Perbarui Petugas' : 'Rekrut Petugas Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveSecurity} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Nama Petugas:</label>
                <input type="text" required placeholder="Nama Lengkap..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={secForm.name} onChange={e => setSecForm({...secForm, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Kontrol WhatsApp:</label>
                <input type="tel" required placeholder="08xxxx" className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={secForm.phoneNumber} onChange={e => setSecForm({...secForm, phoneNumber: e.target.value})} />
              </div>
              <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex gap-4 items-center">
                 <div className="bg-white p-3 rounded-xl shadow-sm text-amber-500"><Shield size={20}/></div>
                 <div>
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Kredensial Login:</p>
                    <p className="text-[10px] font-bold text-slate-700 italic uppercase">PIN Default: 123456</p>
                 </div>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all shadow-slate-900/20">KONFIRMASI PETUGAS</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight leading-none">Registrasi Pengunjung</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={addGuest} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-50 outline-none font-bold text-base focus:border-blue-500 focus:bg-white transition-all shadow-inner" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <div className="space-y-2">
                 <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Pilih Unit Tujuan:</label>
                 <select required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                    <option value="">-- Cari Unit/Warga --</option>
                    {db.residents.map(r => <option key={r.id} value={r.id}>Blok {r.block} No. {r.houseNumber} - {r.name}</option>)}
                 </select>
              </div>
              <textarea required placeholder="Keperluan / Alasan Berkunjung..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold min-h-[140px] text-base focus:border-blue-500 focus:bg-white transition-all shadow-inner" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.1em] shadow-2xl active:scale-95 transition-all shadow-blue-600/20">IZINKAN MASUK AREA</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'SYNC_MODAL' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <div><h3 className="text-2xl font-black tracking-tight leading-none">Sync Master TKA</h3><p className="text-[10px] font-bold uppercase text-slate-500 mt-1 tracking-widest">Migrasi Basis Data Terenkripsi</p></div>
              <button onClick={() => setIsModalOpen(null)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={28}/></button>
            </div>
            <div className="p-10 space-y-8">
               <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Token Enkripsi Database:</label>
                  <textarea 
                    className="w-full p-6 bg-slate-50 border-2 border-slate-50 rounded-[2rem] text-[10px] font-mono break-all outline-none focus:border-amber-500 focus:bg-white transition-all min-h-[220px] shadow-inner no-scrollbar" 
                    value={syncInput} onChange={e => setSyncInput(e.target.value)} placeholder="Kode master sinkronisasi..."
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => { navigator.clipboard.writeText(syncInput); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }} className="py-5 bg-slate-100 text-slate-600 rounded-[1.8rem] font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-200 transition-all active:scale-95">
                    {isCopied ? <Check size={20} className="text-green-500"/> : <Copy size={20}/>} {isCopied ? 'TERCOPY KE CLIPBOARD' : 'SALIN TOKEN MASTER'}
                  </button>
                  <button onClick={importData} className="py-5 bg-slate-900 text-white rounded-[1.8rem] font-black text-[10px] uppercase shadow-2xl hover:bg-slate-800 active:scale-95 shadow-slate-900/20">APLIKASIKAN KE SISTEM INI</button>
               </div>
               <div className="flex gap-4 bg-amber-50 p-6 rounded-[2.5rem] border border-amber-100 items-start">
                  <div className="p-2 bg-amber-500 text-white rounded-lg"><Info size={20} /></div>
                  <p className="text-[9px] font-black text-amber-700 leading-relaxed uppercase tracking-tight italic">Peringatan Kritis: Mengaplikasikan token ini akan menghapus dan mengganti seluruh data warga, satpam, dan log kejadian di perangkat ini secara permanen.</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight">Form Pelaporan</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={addIncident} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Kategori Kejadian:</label>
                <select required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-red-500 focus:bg-white transition-all shadow-inner" value={incForm.type} onChange={e => setIncForm({...incForm, type: e.target.value})}>
                  <option value="Kriminalitas">Kriminalitas / Pencurian</option>
                  <option value="Kebakaran">Kebakaran / Asap</option>
                  <option value="Aktivitas">Aktivitas Mencurigakan</option>
                  <option value="Infrastruktur">Kerusakan Fasilitas</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Titik Lokasi:</label>
                <input type="text" required placeholder="Misal: Blok A Depan Pos..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-red-500 focus:bg-white transition-all shadow-inner" value={incForm.location} onChange={e => setIncForm({...incForm, location: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Keterangan:</label>
                <textarea required placeholder="Detail kejadian singkat..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold min-h-[160px] text-base focus:border-red-500 focus:bg-white transition-all shadow-inner" value={incForm.description} onChange={e => setIncForm({...incForm, description: e.target.value})} />
              </div>
              <button type="submit" disabled={isAnalyzing} className="w-full py-5 bg-red-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.1em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 shadow-red-600/20">
                {isAnalyzing ? <Clock size={20} className="animate-spin" /> : <Send size={20}/>} {isAnalyzing ? 'MENGANALISIS DATA AI...' : 'KIRIM LAPORAN RESMI'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PATROL ACTION MODAL */}
      {patrolAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-10 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div><h3 className="text-2xl font-black tracking-tight uppercase leading-none">{patrolAction.cp}</h3><p className="text-[10px] font-black uppercase opacity-70 mt-1 tracking-widest">Update Kondisi Wilayah</p></div>
              <button onClick={() => setPatrolAction(null)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={24}/></button>
            </div>
            <div className="p-10 space-y-8">
               <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner">
                  <p className="text-slate-600 font-medium text-center leading-relaxed italic">"Saya menyatakan area <span className="font-black text-slate-900">{patrolAction.cp}</span> dalam kondisi <span className={`font-black uppercase ${patrolAction.status === 'OK' ? 'text-green-600' : 'text-red-600'}`}>{patrolAction.status === 'OK' ? 'AMAN & TERKENDALI' : 'MEMBUTUHKAN TINDAKAN'}</span>"</p>
               </div>
               <button onClick={() => submitPatrol(patrolAction.status)} className={`w-full py-5 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all shadow-slate-900/10 ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>SIMPAN STATUS PATROLI</button>
            </div>
          </div>
        </div>
      )}

      {/* SOS MODAL */}
      {isModalOpen === 'SOS_MODAL' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-600 animate-pulse overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]"></div>
           <div className="text-center text-white p-16 relative z-10">
              <div className="bg-white text-red-600 w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-12 shadow-[0_0_120px_rgba(255,255,255,0.8)] border-[8px] border-red-100">
                 <BellRing size={64} className="animate-bounce" />
              </div>
              <h1 className="text-6xl font-black mb-6 tracking-tighter uppercase leading-none">SOS AKTIF!</h1>
              <p className="text-2xl font-bold opacity-95 leading-tight tracking-tight">Pesan darurat telah menyebar.<br/>Tim siaga TKA menuju titik Anda sekarang.</p>
           </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
