
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
  PhoneCall, Info, Ghost, Trash2, UserCheck, Eye, ListFilter, ClipboardCheck, BookOpen
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing } from './services/geminiService.ts';
import { DatabaseService } from './services/databaseService.ts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

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
  // 1. Database & Persistence
  const [db, setDb] = useState<FullDatabase>(() => DatabaseService.getDatabase(INITIAL_DB));
  
  // 2. Auth States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginSearch, setLoginSearch] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // 3. UI Control States
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'SECURITY' | 'CHECKPOINT' | 'GUEST' | 'INCIDENT' | 'SOS_MODAL' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [securityBriefing, setSecurityBriefing] = useState<string>('');

  // 4. Form Management
  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [secForm, setSecForm] = useState<Partial<User>>({ name: '', role: 'SECURITY', phoneNumber: '' });
  const [cpForm, setCpForm] = useState('');
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '' });
  const [incForm, setIncForm] = useState({ type: 'Kriminalitas', location: '', description: '' });
  const [patrolAction, setPatrolAction] = useState<{cp: string, status: 'OK' | 'DANGER'} | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-save & Sync
  useEffect(() => {
    DatabaseService.saveDatabase(db);
  }, [db]);

  // AI Insights
  useEffect(() => {
    if (currentUser) {
      const shift = new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Pagi' : 'Malam';
      getSecurityBriefing(shift).then(setSecurityBriefing);
    }
  }, [currentUser]);

  // Login Logic
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
    } else {
      setLoginError('PIN Keamanan Salah!');
    }
  };

  // Add missing handlers for logout and data management
  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
    setSelectedUser(null);
  };

  const deleteCheckpoint = (idx: number) => {
    setDb(prev => ({
      ...prev,
      checkpoints: prev.checkpoints.filter((_, i) => i !== idx)
    }));
  };

  const saveCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpForm.trim()) return;
    setDb(prev => {
      const newCP = [...prev.checkpoints];
      if (editingItem !== null) {
        newCP[editingItem] = cpForm;
      } else {
        newCP.push(cpForm);
      }
      return { ...prev, checkpoints: newCP };
    });
    setIsModalOpen(null);
    setCpForm('');
    setEditingItem(null);
  };

  const deleteResident = (id: string) => {
    setDb(prev => ({
      ...prev,
      residents: prev.residents.filter(r => r.id !== id)
    }));
  };

  const deleteSecurity = (id: string) => {
    setDb(prev => ({
      ...prev,
      securityUsers: prev.securityUsers.filter(u => u.id !== id)
    }));
  };

  const chartData = useMemo(() => [
    { name: 'Patrol', val: db.patrolLogs.length },
    { name: 'Residents', val: db.residents.length },
    { name: 'Guests', val: db.guests.length },
    { name: 'Incidents', val: db.incidents.length }
  ], [db]);

  // Live Security Timeline - Fixed normalization of time properties to avoid property access errors
  const securityTimeline = useMemo(() => {
    const combined = [
      ...db.patrolLogs.map(l => ({ ...l, type: 'PATROL' as const, sortTime: l.timestamp })),
      ...db.incidents.map(i => ({ ...i, type: 'INCIDENT' as const, sortTime: i.timestamp })),
      ...db.guests.map(g => ({ ...g, type: 'GUEST_ENTRY' as const, sortTime: g.entryTime }))
    ];
    return combined.sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime()).slice(0, 20);
  }, [db.patrolLogs, db.incidents, db.guests]);

  // Patrol Action Handler
  const submitPatrol = (status: 'OK' | 'DANGER') => {
    if (!patrolAction || !currentUser) return;
    const log: PatrolLog = {
      id: `p-${Date.now()}`, securityId: currentUser.id, securityName: currentUser.name, timestamp: new Date().toISOString(),
      checkpoint: patrolAction.cp, status, note: 'Patroli Kawasan'
    };
    setDb(prev => ({ ...prev, patrolLogs: [log, ...prev.patrolLogs] }));
    setPatrolAction(null);
  };

  // SOS Handler
  const triggerSOS = () => {
    if (!currentUser) return;
    const sos: IncidentReport = {
      id: `sos-${Date.now()}`, reporterId: currentUser.id, reporterName: currentUser.name, timestamp: new Date().toISOString(),
      type: 'SOS / EMERGENCY', location: 'Unit Warga', description: 'Warga menekan tombol bantuan darurat!', status: 'PENDING', severity: 'HIGH'
    };
    setDb(prev => ({ ...prev, incidents: [sos, ...prev.incidents] }));
    setIsModalOpen('SOS_MODAL');
    setTimeout(() => setIsModalOpen(null), 3000);
  };

  // Login UI
  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? db.securityUsers : loginTab === 'ADMIN' ? ADMIN_USERS : db.residents.map(r => ({ id: r.id, name: r.name, sub: `Blok ${r.block} No. ${r.houseNumber}` }));
    const filteredPool = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()) || (u.sub && u.sub.toLowerCase().includes(loginSearch.toLowerCase())));

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[1000px] flex flex-col md:flex-row rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100">
          <div className="w-full md:w-5/12 bg-slate-900 p-12 text-white flex flex-col justify-between relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full"></div>
            <div>
              <div className="bg-amber-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-amber-500/20">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-4xl font-black mb-4 tracking-tighter leading-tight italic">TKA SECURE</h1>
              <p className="text-slate-400 text-sm leading-relaxed">Integrated Residential Security Hub.</p>
            </div>
            <div className="p-6 bg-slate-800/40 rounded-3xl border border-slate-700">
               <div className="flex items-center gap-2 mb-2">
                 <RefreshCw size={14} className="text-amber-500 animate-spin-slow"/>
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sistem Siaga 24/7</span>
               </div>
               <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed">Seluruh log patroli dan tamu dicatat secara permanen di database pusat.</p>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-10 md:p-14 h-[750px] flex flex-col">
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Login Sistem</h2>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); setLoginSearch(''); }}
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                  {t === 'SECURITY' ? 'Satpam' : t === 'ADMIN' ? 'Admin' : 'Warga'}
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder={`Cari nama ${loginTab === 'RESIDENT' ? 'warga' : 'petugas'}...`}
                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 focus:bg-white outline-none font-bold text-sm transition-all shadow-inner"
                value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pr-1 mb-6 space-y-2">
              {filteredPool.length > 0 ? filteredPool.map((u: any) => (
                <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setLoginError(''); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-sm truncate">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{u.sub || 'Operasional'}</p>
                  </div>
                  {selectedUser?.id === u.id && <CheckCircle size={20} className="text-amber-500" />}
                </button>
              )) : (
                <div className="py-20 text-center text-slate-300 italic font-black text-xs uppercase">Data Tidak Ditemukan</div>
              )}
            </div>

            {selectedUser && (
              <form onSubmit={handleLogin} className="pt-6 border-t border-slate-100 space-y-4 sticky bottom-0 bg-white">
                <div className="relative">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                  <input type="password" required placeholder="PIN"
                    className="w-full pl-16 pr-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-2xl tracking-[0.5em] text-center" 
                    value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                </div>
                {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center">{loginError}</p>}
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-4 text-xs uppercase tracking-widest active:scale-95 shadow-xl shadow-slate-900/10">
                  LOGIN SEKARANG <ArrowRight size={18} />
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
      
      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-slide-up pb-24">
          {currentUser.role === 'RESIDENT' && (
            <div className="bg-red-600 p-10 rounded-[3rem] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 blur-[60px] rounded-full"></div>
               <div className="flex items-center gap-8 relative z-10">
                 <div className="bg-white/20 p-5 rounded-3xl shadow-inner animate-pulse"><BellRing size={40} /></div>
                 <div>
                    <h3 className="text-2xl font-black mb-1 tracking-tighter uppercase leading-none">PANGGILAN DARURAT (SOS)</h3>
                    <p className="text-sm text-red-100 font-medium opacity-90">Sinyal darurat akan diteruskan ke tim satpam yang sedang berpatroli.</p>
                 </div>
               </div>
               <button onClick={triggerSOS} className="bg-white text-red-600 px-12 py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl hover:scale-105 transition-all active:scale-95 relative z-10">AKTIFKAN SOS</button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Tim Satpam', val: db.securityUsers.length, icon: <UserCheck size={26}/>, color: 'blue' },
              { label: 'Kejadian', val: db.incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={26}/>, color: 'red' },
              { label: 'Tamu Area', val: db.guests.filter(g => g.status === 'IN').length, icon: <Users size={26}/>, color: 'amber' },
              { label: 'Total Warga', val: db.residents.length, icon: <Home size={26}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] mb-1">{s.label}</h3>
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
               <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-4"><Activity size={24} className="text-amber-500 animate-pulse"/> Status Wilayah Live</h3>
               <div className="h-[300px] w-full">
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
            <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col justify-between">
               <div className="absolute bottom-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full"></div>
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <Shield size={32} className="text-amber-500"/>
                    <h3 className="font-black text-xl leading-none">BRIEFING AI</h3>
                  </div>
                  <p className="text-slate-400 text-sm italic leading-relaxed font-medium">"{securityBriefing || 'Mengambil data dari asisten keamanan...'}"</p>
               </div>
               <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl mt-8 text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-amber-500/20 active:scale-95 transition-all">KOORDINASI TIM <ArrowRight size={20}/></button>
            </div>
          </div>
        </div>
      )}

      {/* PATROL TAB */}
      {activeTab === 'patrol' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Kontrol Patroli Satpam</h3>
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

      {/* REPORTS (LIVE UPDATES) TAB - KHUSUS WARGA */}
      {activeTab === 'reports' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Live Report Keamanan</h3>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Feed</span>
              </div>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[600px]">
                 <div className="space-y-8">
                   {securityTimeline.length > 0 ? securityTimeline.map((item: any, idx) => (
                     <div key={idx} className="flex gap-6 group">
                        <div className="flex flex-col items-center">
                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${item.type === 'PATROL' ? 'bg-slate-900 text-white' : item.type === 'INCIDENT' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                              {item.type === 'PATROL' ? <ClipboardCheck size={20}/> : item.type === 'INCIDENT' ? <AlertTriangle size={20}/> : <BookOpen size={20}/>}
                           </div>
                           <div className="w-0.5 flex-1 bg-slate-50 mt-4"></div>
                        </div>
                        <div className="flex-1 pb-10">
                           <div className="flex justify-between items-center mb-2">
                              <h4 className="font-black text-slate-900 text-sm tracking-tight">{item.type === 'PATROL' ? `Patroli: ${item.checkpoint}` : item.type === 'INCIDENT' ? `Laporan: ${item.type}` : `Kunjungan Tamu`}</h4>
                              {/* Using normalized sortTime property to fix property access errors */}
                              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date(item.sortTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           </div>
                           <p className="text-xs text-slate-500 font-medium leading-relaxed italic mb-4">
                             {item.type === 'PATROL' ? `Pos ${item.checkpoint} telah diperiksa oleh ${item.securityName}. Kondisi: ${item.status}.` : item.description || `Penerimaan tamu baru untuk unit ${item.visitToName}.`}
                           </p>
                           <div className="flex gap-2">
                              <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.1em] ${item.status === 'OK' || item.status === 'RESOLVED' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>Status: {item.status || 'Aktif'}</span>
                              <span className="px-4 py-1.5 bg-slate-50 text-slate-400 rounded-full text-[8px] font-black uppercase tracking-[0.1em]">Petugas: {item.securityName || 'Piket Utama'}</span>
                           </div>
                        </div>
                     </div>
                   )) : (
                     <div className="py-32 text-center text-slate-300 italic font-black uppercase text-xs">Belum ada aktivitas terekam hari ini.</div>
                   )}
                 </div>
              </div>
              <div className="space-y-6">
                 <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl">
                    <h5 className="font-black text-xs uppercase tracking-[0.2em] mb-6 text-amber-500">Info Layanan</h5>
                    <div className="space-y-6">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-amber-500"><Phone size={18}/></div>
                          <div>
                             <p className="text-[9px] font-black text-slate-500 uppercase">Pos Utama</p>
                             <p className="text-xs font-black">0812-3456-7890</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-amber-500"><Clock size={18}/></div>
                          <div>
                             <p className="text-[9px] font-black text-slate-500 uppercase">Shift Bertugas</p>
                             <p className="text-xs font-black">{new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Pagi (Irwan & Midin)' : 'Malam (Sudrajat)'}</p>
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h5 className="font-black text-xs uppercase tracking-[0.1em] mb-4 text-slate-900">Statistik Keamanan</h5>
                    <div className="h-40 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={chartData}>
                            <Bar dataKey="val" fill="#E2E8F0" radius={[4, 4, 4, 4]} />
                         </BarChart>
                       </ResponsiveContainer>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-4 italic text-center">Berdasarkan data patroli 24 jam terakhir</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* GUESTS TAB */}
      {activeTab === 'guests' && (
        <div className="space-y-8 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Logbook Tamu Kawasan</h3>
              <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 shadow-xl active:scale-95 transition-all shadow-blue-600/20"><UserPlus size={20}/> TAMU BARU</button>
           </div>
           <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Tamu</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Unit Tujuan</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Waktu Masuk</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                    <th className="px-10 py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {db.guests.length > 0 ? db.guests.map(g => (
                     <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-10 py-6">
                          <p className="font-black text-slate-900 text-sm">{g.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{g.purpose}</p>
                       </td>
                       <td className="px-10 py-6 text-xs font-bold text-slate-500 uppercase">{g.visitToName}</td>
                       <td className="px-10 py-6 text-[10px] font-black text-slate-400">{new Date(g.entryTime).toLocaleString()}</td>
                       <td className="px-10 py-6">
                          <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{g.status === 'IN' ? 'DI DALAM AREA' : 'SUDAH KELUAR'}</span>
                       </td>
                       <td className="px-10 py-6 text-right">
                          {g.status === 'IN' && <button onClick={() => setDb(prev => ({...prev, guests: prev.guests.map(item => item.id === g.id ? {...item, status: 'OUT'} : item)}))} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"><LogOut size={18}/></button>}
                       </td>
                     </tr>
                   )) : (
                     <tr><td colSpan={5} className="py-24 text-center text-slate-300 italic font-black uppercase text-xs tracking-widest">Belum ada kunjungan hari ini</td></tr>
                   )}
                </tbody>
              </table>
           </div>
        </div>
      )}

      {/* INCIDENT TAB */}
      {activeTab === 'incident' && (
        <div className="space-y-8 animate-slide-up pb-24">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Pelaporan Insiden</h3>
            <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 shadow-xl shadow-red-600/20 active:scale-95 transition-all"><AlertTriangle size={20}/> LAPORAN BARU</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {db.incidents.length > 0 ? db.incidents.map(i => (
              <div key={i.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:shadow-2xl transition-all">
                <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 ${i.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                <div>
                  <div className="flex justify-between items-start mb-8">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${i.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{i.severity} Priority</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{new Date(i.timestamp).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-2 leading-none">{i.type}</h4>
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin size={14} className="text-amber-500"/> {i.location}</p>
                  <p className="text-sm text-slate-600 leading-relaxed italic mb-10">"{i.description}"</p>
                </div>
                <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-[12px]">{i.reporterName.charAt(0)}</div>
                      <div>
                         <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{i.reporterName}</p>
                         <p className="text-[8px] text-slate-400 font-black uppercase mt-1">Pelapor</p>
                      </div>
                   </div>
                   <span className={`text-[10px] font-black uppercase px-5 py-2 rounded-full border ${i.status === 'RESOLVED' ? 'bg-green-50 text-green-500 border-green-100' : 'bg-amber-50 text-amber-500 border-amber-100'}`}>{i.status}</span>
                </div>
              </div>
            )) : (
              <div className="lg:col-span-2 py-32 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                 <Ghost size={64} className="mx-auto text-slate-200 mb-4" />
                 <p className="text-slate-300 font-black uppercase italic tracking-[0.2em] text-[10px]">Basis data kejadian bersih. Lingkungan kondusif.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESIDENTS TAB */}
      {activeTab === 'residents' && (
        <div className="space-y-8 animate-slide-up pb-24">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Manajemen Hunian</h3>
            <div className="flex gap-4">
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-colors" size={20}/>
                <input type="text" placeholder="Cari warga atau blok..." className="pl-14 pr-8 py-4 rounded-[1.5rem] bg-white border border-slate-200 text-sm outline-none focus:border-amber-500 font-bold w-full md:w-[350px] shadow-sm transition-all" 
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              {currentUser.role === 'ADMIN' && <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase flex items-center gap-3 shadow-2xl active:scale-95 transition-all"><Plus size={22}/> TAMBAH WARGA</button>
              }
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {db.residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.block.toLowerCase().includes(searchQuery.toLowerCase())).map(res => (
              <div key={res.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-2xl transition-all duration-300 group relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 ${res.isHome ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                      <div className="w-14 h-14 rounded-[1.2rem] bg-slate-50 text-slate-900 flex items-center justify-center font-black text-xl border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">{res.block}</div>
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>{res.isHome ? 'ADA DI UNIT' : 'KELUAR AREA'}</span>
                  </div>
                  <h4 className="font-black text-xl text-slate-900 mb-1 leading-tight">{res.name}</h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No. Hunian: <span className="text-slate-900">{res.houseNumber}</span></p>
                </div>
                <div className="mt-10 flex gap-2 relative z-10">
                  <a href={`tel:${res.phoneNumber}`} className="flex-1 py-4 bg-green-500 text-white rounded-[1.2rem] flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors"><PhoneCall size={22}/></a>
                  {currentUser.role === 'ADMIN' && (
                    <>
                      <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-4 bg-slate-50 text-slate-400 rounded-[1.2rem] hover:text-amber-500 hover:bg-amber-50 transition-all"><Edit2 size={20}/></button>
                      <button onClick={() => deleteResident(res.id)} className="p-4 bg-slate-50 text-slate-400 rounded-[1.2rem] hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={20}/></button>
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
           <div className="flex-1 bg-white rounded-t-[3.5rem] shadow-sm border border-slate-100 overflow-y-auto p-10 space-y-6 no-scrollbar relative">
              {db.chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-200 opacity-50 space-y-6">
                  <Ghost size={64} className="animate-pulse" />
                  <p className="font-black uppercase tracking-[0.3em] text-[10px] italic">Koordinasi sepi...</p>
                </div>
              ) : (
                db.chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[80%] p-6 rounded-[2.5rem] shadow-sm ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                        <div className="flex justify-between items-center gap-8 mb-2">
                           <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                           <span className="text-[8px] font-bold px-3 py-1 bg-white/10 rounded-full uppercase tracking-tighter opacity-50">{msg.senderRole}</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                        <p className="text-[8px] mt-2 opacity-30 text-right font-black uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                     </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={(e) => { e.preventDefault(); if (!chatInput.trim()) return; const msg: ChatMessage = { id: `c-${Date.now()}`, senderId: currentUser.id, senderName: currentUser.name, senderRole: currentUser.role, text: chatInput, timestamp: new Date().toISOString() }; setDb(prev => ({ ...prev, chatMessages: [...prev.chatMessages, msg] })); setChatInput(''); }} className="bg-white p-6 rounded-b-[3.5rem] border-t border-slate-100 flex gap-4 shadow-sm relative z-10">
              <input type="text" placeholder="Tulis instruksi atau laporan..." className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-base focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-5 rounded-[2rem] active:scale-95 transition-all shadow-xl hover:bg-slate-800"><Send size={26}/></button>
           </form>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="max-w-5xl mx-auto space-y-12 animate-slide-up pb-24">
           {currentUser.role === 'ADMIN' && (
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
           )}

           <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-slate-50 group-hover:bg-amber-50 blur-[100px] rounded-full transition-colors duration-700"></div>
              <h3 className="text-2xl font-black text-slate-900 mb-8 relative z-10 tracking-tight">Akun & Sesi</h3>
              <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 flex items-center gap-10 relative z-10">
                 <div className="w-24 h-24 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center text-4xl font-black shadow-2xl">{currentUser.name.charAt(0)}</div>
                 <div className="flex-1">
                    <h4 className="text-3xl font-black text-slate-900 tracking-tight">{currentUser.name}</h4>
                    <p className="text-xs font-black text-amber-600 uppercase tracking-[0.2em] mt-2 italic">Akses Level: {currentUser.role}</p>
                 </div>
                 {/* Fixed: Use defined handleLogout function */}
                 <button onClick={handleLogout} className="px-10 py-5 bg-red-600 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest active:scale-95 shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all flex items-center gap-3"><LogOut size={20}/> KELUAR SISTEM</button>
              </div>
           </div>
        </div>
      )}

      {/* MODALS */}
      {isModalOpen === 'CHECKPOINT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight leading-none">{editingItem !== null ? 'Perbarui Titik' : 'Tambah Titik Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            {/* Fixed: Use defined saveCheckpoint function */}
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

      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight leading-none">Registrasi Pengunjung</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const res = db.residents.find(r => r.id === guestForm.visitToId); const newG: GuestLog = { id: `g-${Date.now()}`, name: guestForm.name!, visitToId: guestForm.visitToId!, visitToName: res ? `${res.block}-${res.houseNumber}` : 'Umum', purpose: guestForm.purpose!, entryTime: new Date().toISOString(), status: 'IN' }; setDb(prev => ({ ...prev, guests: [newG, ...prev.guests] })); setIsModalOpen(null); setGuestForm({ name: '', visitToId: '', purpose: '' }); }} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-50 outline-none font-bold text-base focus:border-blue-500 focus:bg-white transition-all shadow-inner" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
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

      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tight">Form Pelaporan</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={async (e) => { e.preventDefault(); if (!currentUser) return; setIsAnalyzing(true); let severity: any = 'MEDIUM'; try { const analysis = await analyzeIncident(incForm.description); if (analysis?.severity) severity = analysis.severity; } catch {} const newI: IncidentReport = { id: `i-${Date.now()}`, reporterId: currentUser.id, reporterName: currentUser.name, timestamp: new Date().toISOString(), type: incForm.type, location: incForm.location, description: incForm.description, status: 'PENDING', severity }; setDb(prev => ({ ...prev, incidents: [newI, ...prev.incidents] })); setIsAnalyzing(false); setIsModalOpen(null); setIncForm({ type: 'Kriminalitas', location: '', description: '' }); }} className="p-10 space-y-6">
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

      {/* SOS OVERLAY */}
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

      {/* PATROL MODAL */}
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

    </Layout>
  );
};

export default App;
