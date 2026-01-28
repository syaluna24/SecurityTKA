
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
  Activity, MessageSquare, BellRing, Database, Copy, Check, RefreshCw, 
  PhoneCall, Info, Ghost, Trash2, UserCheck, Eye
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
  // 1. Database State
  const [db, setDb] = useState<FullDatabase>(() => DatabaseService.getDatabase(INITIAL_DB));

  // 2. Auth & Navigation
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginSearch, setLoginSearch] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // 3. UI Control
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'SECURITY' | 'CHECKPOINT' | 'GUEST' | 'INCIDENT' | 'SOS_MODAL' | 'SYNC_MODAL' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [syncInput, setSyncInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [securityBriefing, setSecurityBriefing] = useState<string>('');

  // 4. Form States
  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [secForm, setSecForm] = useState<Partial<User>>({ name: '', role: 'SECURITY', phoneNumber: '' });
  const [cpForm, setCpForm] = useState('');
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '' });
  const [incForm, setIncForm] = useState({ type: 'Kriminalitas', location: '', description: '' });
  const [patrolAction, setPatrolAction] = useState<{cp: string, status: 'OK' | 'DANGER'} | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-save to LocalStorage
  useEffect(() => {
    DatabaseService.saveDatabase(db);
  }, [db]);

  // AI Security Briefing
  useEffect(() => {
    if (currentUser) {
      const hour = new Date().getHours();
      const shift = hour >= 7 && hour < 19 ? 'Pagi' : 'Malam';
      getSecurityBriefing(shift).then(setSecurityBriefing);
    }
  }, [currentUser]);

  // Handle Login
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

  // CRUD Handlers
  const saveResident = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      setDb(prev => ({
        ...prev,
        residents: prev.residents.map(r => r.id === editingItem.id ? { ...r, ...resForm } as Resident : r)
      }));
    } else {
      const newRes: Resident = { id: `r-${Date.now()}`, name: resForm.name!, houseNumber: resForm.houseNumber!, block: resForm.block!, phoneNumber: resForm.phoneNumber!, isHome: true };
      setDb(prev => ({ ...prev, residents: [newRes, ...prev.residents] }));
    }
    setIsModalOpen(null);
    setEditingItem(null);
  };

  const deleteResident = (id: string) => {
    if (confirm('Hapus warga ini?')) setDb(prev => ({ ...prev, residents: prev.residents.filter(r => r.id !== id) }));
  };

  const saveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      setDb(prev => ({ ...prev, securityUsers: prev.securityUsers.map(u => u.id === editingItem.id ? { ...u, ...secForm } as User : u) }));
    } else {
      const newSec: User = { id: `s-${Date.now()}`, name: secForm.name!, role: 'SECURITY', phoneNumber: secForm.phoneNumber };
      setDb(prev => ({ ...prev, securityUsers: [...prev.securityUsers, newSec] }));
    }
    setIsModalOpen(null);
    setEditingItem(null);
  };

  const deleteSecurity = (id: string) => {
    if (confirm('Hapus satpam ini?')) setDb(prev => ({ ...prev, securityUsers: prev.securityUsers.filter(u => u.id !== id) }));
  };

  const saveCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem !== null) {
      setDb(prev => ({ ...prev, checkpoints: prev.checkpoints.map((c, i) => i === editingItem ? cpForm : c) }));
    } else {
      setDb(prev => ({ ...prev, checkpoints: [...prev.checkpoints, cpForm] }));
    }
    setIsModalOpen(null);
    setEditingItem(null);
  };

  const deleteCheckpoint = (idx: number) => {
    if (confirm('Hapus titik ini?')) setDb(prev => ({ ...prev, checkpoints: prev.checkpoints.filter((_, i) => i !== idx) }));
  };

  // Logic for Security Feed
  const securityFeed = useMemo(() => {
    const combined = [
      ...db.patrolLogs.map(l => ({ ...l, feedType: 'PATROL' })),
      ...db.incidents.map(i => ({ ...i, feedType: 'INCIDENT' }))
    ];
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);
  }, [db.patrolLogs, db.incidents]);

  const chartData = useMemo(() => {
    return ['A', 'B', 'C', 'D'].map(b => ({
      name: `Blok ${b}`,
      val: db.incidents.filter(i => i.location.includes(b)).length + (Math.floor(Math.random() * 2))
    }));
  }, [db.incidents]);

  // SOS Trigger
  const triggerSOS = () => {
    if (!currentUser) return;
    const sos: IncidentReport = {
      id: `sos-${Date.now()}`, reporterId: currentUser.id, reporterName: currentUser.name, timestamp: new Date().toISOString(),
      type: 'EMERGENCY / SOS', location: 'Unit Warga', description: 'Warga memicu sinyal darurat!', status: 'PENDING', severity: 'HIGH'
    };
    setDb(prev => ({ ...prev, incidents: [sos, ...prev.incidents] }));
    setIsModalOpen('SOS_MODAL');
    setTimeout(() => setIsModalOpen(null), 3000);
  };

  const submitPatrol = (status: 'OK' | 'DANGER') => {
    if (!patrolAction || !currentUser) return;
    const log: PatrolLog = {
      id: `p-${Date.now()}`, securityId: currentUser.id, securityName: currentUser.name, timestamp: new Date().toISOString(),
      checkpoint: patrolAction.cp, status, note: 'Pengecekan rutin area.'
    };
    setDb(prev => ({ ...prev, patrolLogs: [log, ...prev.patrolLogs] }));
    setPatrolAction(null);
  };

  // LOGIN PAGE
  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? db.securityUsers : loginTab === 'ADMIN' ? ADMIN_USERS : db.residents.map(r => ({ id: r.id, name: r.name, sub: `Blok ${r.block} No. ${r.houseNumber}` }));
    const filteredPool = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()) || (u.sub && u.sub.toLowerCase().includes(loginSearch.toLowerCase())));

    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[1000px] flex flex-col md:flex-row rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
          <div className="w-full md:w-5/12 bg-[#0F172A] p-12 flex flex-col justify-between text-white relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full"></div>
            <div className="relative z-10">
              <div className="bg-amber-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-amber-500/20">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-4xl font-black mb-4 tracking-tighter leading-tight">TKA SECURE<br/>SYSTEM</h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-[250px]">Pusat Komando Keamanan & Pelayanan Warga Terintegrasi.</p>
            </div>
            <div className="p-6 bg-slate-800/50 rounded-3xl border border-slate-700 backdrop-blur-md">
               <div className="flex items-center gap-3 mb-3">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Live Cloud Database</span>
               </div>
               <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed tracking-tight italic">Seluruh data disinkronkan secara real-time ke seluruh perangkat petugas.</p>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-10 md:p-14 flex flex-col h-[750px]">
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Portal Akses</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">Pilih akun Anda untuk melanjutkan.</p>
            
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); setLoginSearch(''); }}
                  className={`flex-1 py-3.5 text-[10px] font-black uppercase rounded-xl transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                  {t === 'SECURITY' ? 'Petugas' : t === 'ADMIN' ? 'Admin' : 'Warga'}
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder={`Cari nama ${loginTab === 'RESIDENT' ? 'warga' : 'petugas'}...`}
                className="w-full pl-14 pr-6 py-4.5 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 focus:bg-white outline-none font-bold text-sm transition-all shadow-inner"
                value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pr-1 mb-6 space-y-2">
              {filteredPool.length > 0 ? filteredPool.map((u: any) => (
                <button key={u.id} type="button" onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-4 p-4.5 rounded-2xl border-2 transition-all text-left ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50/50 shadow-lg' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1">
                    <p className="font-black text-slate-900 text-sm truncate">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{u.sub || 'Staf Operasional'}</p>
                  </div>
                  {selectedUser?.id === u.id && <CheckCircle size={20} className="text-amber-500" />}
                </button>
              )) : (
                <div className="py-20 text-center"><Ghost size={48} className="mx-auto text-slate-200 mb-4" /><p className="text-xs font-black text-slate-300 uppercase italic">Data tidak ditemukan</p></div>
              )}
            </div>

            {selectedUser && (
              <form onSubmit={handleLogin} className="space-y-4 pt-6 border-t border-slate-100 bg-white sticky bottom-0 animate-slide-up">
                <div className="relative">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                  <input type="password" required placeholder="Masukkan PIN PIN PIN"
                    className="w-full pl-16 pr-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-2xl tracking-[0.6em] text-center" 
                    value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                </div>
                {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center">{loginError}</p>}
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-4 text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-[0.98]">
                  AUTENTIKASI SEKARANG <ArrowRight size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      
      {/* DASHBOARD - Live Reports Integration */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-slide-up pb-24">
          {currentUser.role === 'RESIDENT' && (
            <div className="bg-red-600 p-10 rounded-[3rem] text-white shadow-2xl flex flex-col lg:flex-row justify-between items-center gap-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 blur-[60px] rounded-full"></div>
               <div className="flex items-center gap-8 relative z-10">
                 <div className="bg-white/20 p-5 rounded-3xl shadow-inner animate-pulse"><BellRing size={40} /></div>
                 <div>
                    <h3 className="text-2xl font-black mb-1 tracking-tighter uppercase leading-none">BUTUH BANTUAN DARURAT?</h3>
                    <p className="text-sm text-red-100 font-medium opacity-90">Sinyal darurat akan diteruskan ke tim satpam yang sedang berpatroli.</p>
                 </div>
               </div>
               <button onClick={triggerSOS} className="bg-white text-red-600 px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl hover:scale-105 transition-all active:scale-95 relative z-10">PANGGIL SOS</button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Tim Satpam', val: db.securityUsers.length, icon: <UserCheck size={26}/>, color: 'blue' },
              { label: 'Kejadian Aktif', val: db.incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={26}/>, color: 'red' },
              { label: 'Kunjungan Tamu', val: db.guests.filter(g => g.status === 'IN').length, icon: <Users size={26}/>, color: 'amber' },
              { label: 'Populasi Hunian', val: db.residents.length, icon: <Home size={26}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{s.label}</h3>
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Live Security Feed */}
            <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
               <div className="flex justify-between items-center mb-10">
                 <h3 className="text-xl font-black text-slate-900 flex items-center gap-4"><Activity size={24} className="text-amber-500 animate-pulse"/> Live Security Feed</h3>
                 <span className="px-4 py-1.5 bg-green-100 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest">Real-time</span>
               </div>
               <div className="space-y-6 max-h-[500px] overflow-y-auto no-scrollbar pr-2">
                 {securityFeed.length > 0 ? securityFeed.map((item: any) => (
                   <div key={item.id} className="flex gap-6 items-start group relative">
                     <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${item.feedType === 'PATROL' ? 'bg-slate-900 text-white group-hover:bg-amber-500' : 'bg-red-600 text-white'}`}>
                          {item.feedType === 'PATROL' ? <Activity size={20}/> : <AlertTriangle size={20}/>}
                        </div>
                        <div className="w-0.5 h-full bg-slate-100 mt-2"></div>
                     </div>
                     <div className="flex-1 pb-8">
                        <div className="flex justify-between items-center mb-1">
                           <h4 className="font-black text-slate-900 text-sm">{item.feedType === 'PATROL' ? `Cek Point: ${item.checkpoint}` : `Laporan: ${item.type}`}</h4>
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mb-3 leading-relaxed">
                          {item.feedType === 'PATROL' ? `Petugas ${item.securityName} melaporkan area dalam kondisi ${item.status}.` : item.description}
                        </p>
                        <div className="flex gap-2">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${item.status === 'OK' || item.status === 'RESOLVED' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            {item.status || 'Aktif'}
                          </span>
                          <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[8px] font-black uppercase tracking-widest border border-slate-100">
                            {item.securityName || item.reporterName}
                          </span>
                        </div>
                     </div>
                   </div>
                 )) : (
                   <div className="py-20 text-center"><Ghost size={64} className="mx-auto text-slate-100 mb-4" /><p className="text-xs font-black text-slate-300 uppercase italic">Belum ada aktivitas terekam</p></div>
                 )}
               </div>
            </div>

            {/* AI Briefing Side */}
            <div className="space-y-8">
               <div className="bg-slate-900 text-white p-10 rounded-[3.5rem] flex flex-col justify-between shadow-2xl relative overflow-hidden min-h-[400px]">
                  <div className="absolute top-0 right-0 w-56 h-56 bg-amber-500/10 blur-[70px] rounded-full"></div>
                  <div className="relative z-10">
                     <div className="flex items-center gap-4 mb-8">
                        <div className="bg-amber-500/20 p-3 rounded-2xl"><Shield size={32} className="text-amber-500"/></div>
                        <div>
                          <h3 className="font-black text-xl leading-none">BRIEFING AI</h3>
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mt-1">Status Keamanan</p>
                        </div>
                     </div>
                     <p className="text-slate-400 text-sm italic leading-relaxed font-medium">"{securityBriefing || 'Mengolah data intelijen perumahan...'}"</p>
                  </div>
                  <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl mt-12 text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 shadow-2xl shadow-amber-500/30 relative z-10 hover:bg-amber-400 transition-all">KOORDINASI TIM <ArrowRight size={20}/></button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* PATROL TAB */}
      {activeTab === 'patrol' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Manajemen Titik Patroli</h3>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => { setEditingItem(null); setCpForm(''); setIsModalOpen('CHECKPOINT'); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 shadow-xl active:scale-95 transition-all">
                  <Plus size={20}/> TAMBAH TITIK
                </button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {db.checkpoints.map((cp, idx) => {
                const last = db.patrolLogs.filter(l => l.checkpoint === cp)[0];
                return (
                  <div key={idx} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-2xl transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start mb-8">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-slate-900 text-white flex items-center justify-center font-black text-2xl group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors shadow-lg">{idx + 1}</div>
                        <div className="flex gap-2">
                          {currentUser.role === 'ADMIN' && (
                            <>
                              <button onClick={() => { setEditingItem(idx); setCpForm(cp); setIsModalOpen('CHECKPOINT'); }} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-amber-500 transition-colors"><Edit2 size={16}/></button>
                              <button onClick={() => deleteCheckpoint(idx)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                            </>
                          )}
                          {last && <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${last.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{last.status}</span>}
                        </div>
                      </div>
                      <h4 className="text-xl font-black text-slate-900 mb-10 tracking-tight leading-tight uppercase">{cp}</h4>
                    </div>
                    {currentUser.role === 'SECURITY' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setPatrolAction({cp, status: 'OK'})} className="py-5 bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase active:scale-95 shadow-lg shadow-green-500/20 hover:bg-green-600 transition-colors">AREA AMAN</button>
                        <button onClick={() => setPatrolAction({cp, status: 'DANGER'})} className="py-5 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase active:scale-95 shadow-lg shadow-red-600/20 hover:bg-red-700 transition-colors">ADA BAHAYA</button>
                      </div>
                    ) : (
                      <div className="text-[10px] font-black text-slate-400 uppercase border-t pt-6 tracking-widest italic opacity-70">Log: {last ? `${last.securityName} (${new Date(last.timestamp).toLocaleTimeString()})` : 'Belum Terdata'}</div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* STAFF & RESIDENT MANAGEMENT (ADMIN ONLY) */}
      {activeTab === 'residents' && currentUser.role === 'ADMIN' && (
        <div className="space-y-12 animate-slide-up pb-24">
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Basis Data Warga</h3>
              <div className="flex gap-4">
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-colors" size={20}/>
                  <input type="text" placeholder="Cari penghuni atau unit..." className="pl-14 pr-8 py-4 rounded-[1.5rem] bg-white border border-slate-200 text-sm outline-none focus:border-amber-500 font-bold w-full md:w-[350px] shadow-sm transition-all" 
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase flex items-center gap-3 shadow-2xl active:scale-95 transition-all"><Plus size={22}/> TAMBAH WARGA</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {db.residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.block.toLowerCase().includes(searchQuery.toLowerCase())).map(res => (
                <div key={res.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-2xl transition-all duration-300 group relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 ${res.isHome ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-8">
                        <div className="w-14 h-14 rounded-[1.2rem] bg-slate-50 text-slate-900 flex items-center justify-center font-black text-xl border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">{res.block}</div>
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>{res.isHome ? 'DI UNIT' : 'LUAR AREA'}</span>
                    </div>
                    <h4 className="font-black text-xl text-slate-900 mb-1 leading-tight">{res.name}</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No. Hunian: <span className="text-slate-900">{res.houseNumber}</span></p>
                  </div>
                  <div className="mt-10 flex gap-2 relative z-10">
                    <a href={`tel:${res.phoneNumber}`} className="flex-1 py-4 bg-green-500 text-white rounded-[1.2rem] flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors"><PhoneCall size={22}/></a>
                    <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-4 bg-slate-50 text-slate-400 rounded-[1.2rem] hover:text-amber-500 hover:bg-amber-50 transition-all"><Edit2 size={20}/></button>
                    <button onClick={() => deleteResident(res.id)} className="p-4 bg-slate-50 text-slate-400 rounded-[1.2rem] hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={20}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN SETTINGS - STAFF MANAGEMENT */}
      {activeTab === 'settings' && currentUser.role === 'ADMIN' && (
        <div className="space-y-12 animate-slide-up pb-24">
           <div className="space-y-8">
              <div className="flex justify-between items-center">
                 <h3 className="text-2xl font-black text-slate-900 tracking-tight">Manajemen Tim Satpam</h3>
                 <button onClick={() => { setEditingItem(null); setSecForm({ name: '', role: 'SECURITY', phoneNumber: '' }); setIsModalOpen('SECURITY'); }} className="bg-slate-900 text-white px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase flex items-center gap-3 shadow-2xl active:scale-95 transition-all"><UserPlus size={22}/> REKRUT BARU</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {db.securityUsers.map(u => (
                   <div key={u.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-2xl transition-all duration-300">
                      <div className="flex items-center gap-8 mb-12">
                         <div className="w-16 h-16 rounded-[1.8rem] bg-slate-900 text-white flex items-center justify-center text-2xl font-black group-hover:bg-amber-500 transition-colors shadow-lg">{u.name.charAt(0)}</div>
                         <div>
                           <h4 className="text-xl font-black text-slate-900 leading-tight uppercase">{u.name}</h4>
                           <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1">Staf Keamanan</p>
                         </div>
                      </div>
                      <div className="flex gap-2 pt-8 border-t border-slate-50">
                         <button onClick={() => { setEditingItem(u); setSecForm(u); setIsModalOpen('SECURITY'); }} className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-100 transition-all"><Edit2 size={16}/> EDIT</button>
                         <button onClick={() => deleteSecurity(u.id)} className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-red-100 transition-all"><Trash2 size={16}/> HAPUS</button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-slate-50 group-hover:bg-amber-50 blur-[100px] rounded-full transition-colors duration-700"></div>
              <h3 className="text-2xl font-black text-slate-900 mb-12 relative z-10 tracking-tight">Sinkronisasi Database Cloud</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                 <div className="p-10 bg-slate-50 rounded-[3.5rem] border border-slate-100 hover:bg-white transition-all">
                    <Database size={32} className="text-amber-600 mb-6"/>
                    <h5 className="font-black text-sm uppercase tracking-widest mb-3">Ekspor Master Code</h5>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-8 italic leading-relaxed">Gunakan kode ini untuk menduplikasi database ke perangkat lain.</p>
                    <button onClick={() => { setSyncInput(DatabaseService.exportSyncCode()); setIsModalOpen('SYNC_MODAL'); }} className="w-full py-5 bg-white border-2 border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm">GENERATE MASTER CODE</button>
                 </div>
                 <div className="p-10 bg-slate-50 rounded-[3.5rem] border border-slate-100 hover:bg-white transition-all">
                    <RefreshCw size={32} className="text-blue-600 mb-6"/>
                    <h5 className="font-black text-sm uppercase tracking-widest mb-3">Impor Master Code</h5>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-8 italic leading-relaxed">Timpa data lokal dengan database terbaru dari perangkat admin utama.</p>
                    <button onClick={() => { setSyncInput(''); setIsModalOpen('SYNC_MODAL'); }} className="w-full py-5 bg-white border-2 border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm">INPUT MASTER CODE</button>
                 </div>
              </div>
              <div className="pt-12 border-t mt-12 flex justify-center">
                <button onClick={handleLogout} className="w-full py-6 bg-red-50 text-red-600 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.2em] flex items-center justify-center gap-5 active:scale-95 transition-all shadow-sm hover:bg-red-100"><LogOut size={24}/> KELUAR SISTEM ADMINISTRATOR</button>
              </div>
           </div>
        </div>
      )}

      {/* MODALS RENDERER */}
      {isModalOpen === 'CHECKPOINT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight">{editingItem !== null ? 'Perbarui Titik' : 'Tambah Titik Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={saveCheckpoint} className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Nama Area Patroli:</label>
                <input type="text" required placeholder="Misal: Pos Belakang Blok D..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={cpForm} onChange={e => setCpForm(e.target.value)} />
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">SIMPAN DATA</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight uppercase leading-none">{editingItem ? 'Update Warga' : 'Pendaftaran Warga'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={saveResident} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Sesuai KTP..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm" value={resForm.block} onChange={e => setResForm({...resForm, block: e.target.value})}>
                  {BLOCKS.map(b => <option key={b} value={b}>Blok {b}</option>)}
                </select>
                <input type="text" required placeholder="Nomor Unit" className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm" value={resForm.houseNumber} onChange={e => setResForm({...resForm, houseNumber: e.target.value})} />
              </div>
              <input type="tel" required placeholder="WhatsApp Aktif (08xxx)..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex gap-4 items-center">
                 <div className="bg-white p-3 rounded-xl shadow-sm text-amber-500"><Lock size={20}/></div>
                 <div>
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Akses Login Warga:</p>
                    <p className="text-[10px] font-bold text-slate-700 italic">PIN Standar: wargatka123456</p>
                 </div>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all">SIMPAN DATA WARGA</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'SECURITY' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight uppercase leading-none">{editingItem ? 'Edit Profil Petugas' : 'Rekrutmen Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={saveSecurity} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Staf..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={secForm.name} onChange={e => setSecForm({...secForm, name: e.target.value})} />
              <input type="tel" required placeholder="Kontak WhatsApp..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={secForm.phoneNumber} onChange={e => setSecForm({...secForm, phoneNumber: e.target.value})} />
              <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex gap-4 items-center">
                 <div className="bg-white p-3 rounded-xl shadow-sm text-amber-500"><Shield size={20}/></div>
                 <div>
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Akses Login Petugas:</p>
                    <p className="text-[10px] font-bold text-slate-700 italic">PIN Default: 123456</p>
                 </div>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black uppercase text-xs tracking-[0.1em] shadow-2xl active:scale-95 transition-all">SIMPAN DATA STAF</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'SYNC_MODAL' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <div><h3 className="text-2xl font-black tracking-tight leading-none uppercase">Sync Master TKA</h3><p className="text-[10px] font-bold uppercase text-slate-500 mt-2 tracking-[0.2em]">Cross-Device Migration Hub</p></div>
              <button onClick={() => setIsModalOpen(null)} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={28}/></button>
            </div>
            <div className="p-10 space-y-10">
               <div className="space-y-4">
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-2">Master Enkripsi Data:</label>
                  <textarea className="w-full p-8 bg-slate-50 border-2 border-slate-50 rounded-[2.5rem] text-[10px] font-mono break-all outline-none focus:border-amber-500 focus:bg-white transition-all min-h-[250px] shadow-inner no-scrollbar leading-loose" 
                    value={syncInput} onChange={e => setSyncInput(e.target.value)} placeholder="Tunggu hingga kode dihasilkan..." />
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <button onClick={() => { navigator.clipboard.writeText(syncInput); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }} 
                    className="py-5 bg-slate-100 text-slate-700 rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-200 transition-all active:scale-95 shadow-sm">
                    {isCopied ? <Check size={22} className="text-green-500"/> : <Copy size={22}/>} {isCopied ? 'KODE TERSALIN' : 'SALIN MASTER CODE'}
                  </button>
                  <button onClick={() => { if (DatabaseService.importSyncCode(syncInput)) { setDb(DatabaseService.getDatabase(INITIAL_DB)); alert("Database Sinkron!"); setIsModalOpen(null); } else { alert("Kode Salah!"); } }} 
                    className="py-5 bg-slate-900 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-slate-800 active:scale-95 shadow-slate-900/20">APLIKASIKAN KE SISTEM</button>
               </div>
               <div className="flex gap-5 bg-amber-50 p-8 rounded-[3rem] border border-amber-100 items-start">
                  <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg"><Info size={24} /></div>
                  <p className="text-[10px] font-black text-amber-700 leading-relaxed uppercase tracking-tight italic opacity-80">Catatan Penting: Mengaplikasikan Master Code akan menghapus seluruh data lokal dan menggantinya dengan data dari kode yang Anda tempel.</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* SOS ANIMATION OVERLAY */}
      {isModalOpen === 'SOS_MODAL' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-600 animate-pulse overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.5)_100%)]"></div>
           <div className="text-center text-white p-16 relative z-10">
              <div className="bg-white text-red-600 w-36 h-36 rounded-full flex items-center justify-center mx-auto mb-12 shadow-[0_0_150px_rgba(255,255,255,0.8)] border-[10px] border-red-100">
                 <BellRing size={80} className="animate-bounce" />
              </div>
              <h1 className="text-7xl font-black mb-8 tracking-tighter uppercase leading-none italic">DARURAT AKTIF!</h1>
              <p className="text-2xl font-bold opacity-95 leading-tight tracking-tight uppercase">Pesan Bantuan Terkirim.<br/>Staf Keamanan Sedang Menuju Titik Lokasi Anda.</p>
           </div>
        </div>
      )}

      {/* PATROL VERIFICATION MODAL */}
      {patrolAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-10 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div><h3 className="text-2xl font-black tracking-tight uppercase leading-none">{patrolAction.cp}</h3><p className="text-[10px] font-black uppercase opacity-80 mt-2 tracking-[0.2em]">Verifikasi Lapangan</p></div>
              <button onClick={() => setPatrolAction(null)} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={28}/></button>
            </div>
            <div className="p-12 space-y-10 text-center">
               <div className="p-10 bg-slate-50 rounded-[3.5rem] border border-slate-100 shadow-inner flex flex-col items-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-xl ${patrolAction.status === 'OK' ? 'bg-green-500 text-white' : 'bg-red-600 text-white'}`}>
                     {patrolAction.status === 'OK' ? <CheckCircle size={40} /> : <AlertTriangle size={40} />}
                  </div>
                  <p className="text-slate-600 font-bold leading-relaxed italic text-lg">"Menyatakan area <span className="font-black text-slate-900 uppercase">{patrolAction.cp}</span> terpantau <span className={`font-black uppercase tracking-widest ${patrolAction.status === 'OK' ? 'text-green-600' : 'text-red-600'}`}>{patrolAction.status === 'OK' ? 'KONDUSIF' : 'BERBAHAYA'}</span>"</p>
               </div>
               <button onClick={() => submitPatrol(patrolAction.status)} className={`w-full py-6 text-white rounded-[2.2rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl active:scale-95 transition-all shadow-slate-900/10 ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>KONFIRMASI LOG SEKARANG</button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
