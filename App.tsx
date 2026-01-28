
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  SECURITY_USERS, 
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
  PhoneCall, Info, LayoutGrid, Ghost
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing } from './services/geminiService.ts';
import { DatabaseService } from './services/databaseService.ts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const INITIAL_DB: FullDatabase = {
  residents: MOCK_RESIDENTS,
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
  
  // 3. UI States
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'GUEST' | 'INCIDENT' | 'SOS_MODAL' | 'SYNC_MODAL' | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [syncInput, setSyncInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [securityBriefing, setSecurityBriefing] = useState<string>('');

  // 4. Temp Form States
  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
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

  // Auth Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const pin = passwordInput.trim();
    
    const isSec = SECURITY_USERS.some(u => u.id === selectedUser.id) && pin === '123456';
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

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedUser(null);
    setActiveTab('dashboard');
  };

  // Content Handlers
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

  const addResident = (e: React.FormEvent) => {
    e.preventDefault();
    const newRes: Resident = {
      id: `res-${Date.now()}`,
      name: resForm.name || '',
      houseNumber: resForm.houseNumber || '',
      block: resForm.block || BLOCKS[0],
      phoneNumber: resForm.phoneNumber || '',
      isHome: true
    };
    setDb(prev => ({ ...prev, residents: [newRes, ...prev.residents] }));
    setIsModalOpen(null);
    setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
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

  // Fix: Integrated analyzeIncident AI service to automatically classify incident severity
  const addIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsAnalyzing(true);
    
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    try {
      // Call Gemini for real-time risk assessment
      const analysis = await analyzeIncident(incForm.description);
      if (analysis && analysis.severity) {
        const aiSeverity = analysis.severity.toUpperCase();
        if (['LOW', 'MEDIUM', 'HIGH'].includes(aiSeverity)) {
          severity = aiSeverity as any;
        }
      }
    } catch (error) {
      console.error("AI Analysis failed:", error);
    }

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
      type: 'EMERGENCY / SOS', location: 'Area Warga',
      description: `Warga ${currentUser.name} memicu sinyal darurat!`,
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
    const blocks = ['A', 'B', 'C'];
    return blocks.map(b => ({
      name: `Blok ${b}`,
      val: db.incidents.filter(i => i.location.toUpperCase().includes(b)).length + 1
    }));
  }, [db.incidents]);

  // LOGIN PAGE RENDERER
  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? SECURITY_USERS : loginTab === 'ADMIN' ? ADMIN_USERS : db.residents.map(r => ({ id: r.id, name: r.name, sub: `Blok ${r.block} No. ${r.houseNumber}` }));

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[950px] flex flex-col md:flex-row rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
          <div className="w-full md:w-5/12 bg-[#0F172A] p-10 flex flex-col justify-between text-white relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[60px] rounded-full"></div>
            <div>
              <div className="bg-amber-500 w-16 h-16 rounded-3xl flex items-center justify-center mb-8">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-4xl font-black mb-4">TKA SECURE</h1>
              <p className="text-slate-400 text-sm leading-relaxed">Integrated Security System.<br/>Login menggunakan PIN resmi Anda.</p>
            </div>
            <div className="p-6 bg-slate-800/40 rounded-3xl border border-slate-700">
               <div className="flex items-center gap-2 mb-2">
                 <RefreshCw size={16} className="text-amber-500 animate-spin-slow"/>
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Database Cloud Ready</span>
               </div>
               <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed">Sinkronisasi kode master aktif. Gunakan menu setelan untuk memindahkan data antar perangkat.</p>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-10">
            <h2 className="text-3xl font-black text-slate-900 mb-8">Portal Masuk</h2>
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-8">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button 
                  key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); setLoginError(''); }}
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                >
                  {t === 'SECURITY' ? 'Satpam' : t === 'ADMIN' ? 'Admin' : 'Warga'}
                </button>
              ))}
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto no-scrollbar pr-1">
                {pool.length > 0 ? pool.map((u: any) => (
                  <button 
                    key={u.id} type="button"
                    onClick={() => { setSelectedUser(u); setLoginError(''); }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50' : 'border-slate-50 bg-slate-50 hover:bg-slate-100'}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">{u.name.charAt(0)}</div>
                    <div className="flex-1">
                      <p className="font-black text-slate-900 text-sm">{u.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{u.sub || 'Staff Operasional'}</p>
                    </div>
                    {selectedUser?.id === u.id && <CheckCircle size={20} className="text-amber-500" />}
                  </button>
                )) : (
                  <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                     <Ghost size={48} className="mx-auto text-slate-200 mb-4" />
                     <p className="text-[10px] font-black text-slate-300 uppercase italic">Database Warga Kosong</p>
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="space-y-4 pt-4 animate-slide-up">
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    <input 
                      type="password" required placeholder="PIN Anda"
                      className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-xl tracking-widest" 
                      value={passwordInput} onChange={e => setPasswordInput(e.target.value)} 
                    />
                  </div>
                  {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center">{loginError}</p>}
                  <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest active:scale-95 shadow-xl shadow-slate-900/10">
                    MASUK SEKARANG <ArrowRight size={18} />
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
        <div className="space-y-6 animate-slide-up">
          {currentUser.role === 'RESIDENT' && (
            <div className="bg-red-600 p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 mb-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[50px] rounded-full"></div>
               <div className="flex items-center gap-6 relative z-10">
                 <div className="bg-white/20 p-4 rounded-2xl"><BellRing size={32} className="animate-bounce" /></div>
                 <div>
                    <h3 className="text-xl font-black mb-1 tracking-tighter uppercase">Butuh Bantuan Segera?</h3>
                    <p className="text-xs text-red-100 font-medium opacity-90">Sinyal darurat akan dikirimkan ke seluruh tim keamanan kawasan.</p>
                 </div>
               </div>
               <button onClick={triggerSOS} className="bg-white text-red-600 px-10 py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all relative z-10">PANGGIL SOS</button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Patroli', val: db.patrolLogs.length, icon: <Activity size={24}/>, color: 'amber' },
              { label: 'Insiden Aktif', val: db.incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Terdaftar', val: db.guests.filter(g => g.status === 'IN').length, icon: <Users size={24}/>, color: 'blue' },
              { label: 'Warga Terdaftar', val: db.residents.length, icon: <Home size={24}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                <p className="text-2xl font-black text-slate-900">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
               <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-3"><TrendingUp size={22} className="text-amber-500"/> Statistik Kawasan</h3>
               <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="val" radius={[6, 6, 6, 6]} barSize={40}>
                        {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#10B981', '#EF4444'][index % 4]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] flex flex-col justify-between shadow-2xl relative overflow-hidden">
               <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-500/10 blur-[50px] rounded-full"></div>
               <div className="relative z-10">
                  <h3 className="font-black text-xl mb-6 flex items-center gap-3 text-amber-500"><Shield size={28}/> Briefing AI</h3>
                  <p className="text-slate-400 text-xs italic leading-relaxed">"{securityBriefing || 'Menghubungkan ke server AI...'}"</p>
               </div>
               <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-4 rounded-xl mt-8 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-amber-500/20 relative z-10">KOORDINASI TIM <ArrowRight size={18}/></button>
            </div>
          </div>
        </div>
      )}

      {/* PATROL TAB */}
      {activeTab === 'patrol' && (
        <div className="space-y-6 animate-slide-up pb-24">
           <h3 className="text-2xl font-black text-slate-900">Kendali Patroli</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {db.checkpoints.map((cp, idx) => {
                const last = db.patrolLogs.filter(l => l.checkpoint === cp)[0];
                return (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">{idx + 1}</div>
                        {last && <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${last.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{last.status}</span>}
                      </div>
                      <h4 className="text-lg font-black text-slate-900 mb-8">{cp}</h4>
                    </div>
                    {currentUser.role === 'SECURITY' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setPatrolAction({cp, status: 'OK'})} className="py-4 bg-green-500 text-white rounded-xl font-black text-[10px] uppercase active:scale-95 shadow-lg shadow-green-500/10">AMAN</button>
                        <button onClick={() => setPatrolAction({cp, status: 'DANGER'})} className="py-4 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase active:scale-95 shadow-lg shadow-red-600/10">BAHAYA</button>
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-slate-400 uppercase border-t pt-4">Log: {last ? `${last.securityName} (${new Date(last.timestamp).toLocaleTimeString()})` : 'Belum Dicek'}</div>
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
            <h3 className="text-2xl font-black text-slate-900">Laporan Insiden</h3>
            <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 active:scale-95 shadow-xl shadow-red-500/20"><AlertTriangle size={18}/> LAPOR KEJADIAN</button>
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
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">{i.reporterName.charAt(0)}</div>
                      <p className="text-[10px] font-black text-slate-900 uppercase">{i.reporterName}</p>
                   </div>
                   <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${i.status === 'RESOLVED' ? 'bg-green-50 text-green-500' : 'bg-amber-50 text-amber-500'}`}>{i.status}</span>
                </div>
              </div>
            )) : (
              <div className="lg:col-span-2 py-32 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-50">
                 <Ghost size={64} className="mx-auto text-slate-100 mb-4" />
                 <p className="text-slate-300 font-black uppercase italic tracking-widest text-xs">Lingkungan Kondusif & Aman</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GUESTS TAB */}
      {activeTab === 'guests' && (
        <div className="space-y-6 animate-slide-up pb-24">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900">Buku Tamu</h3>
              <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"><UserPlus size={18}/> DAFTAR TAMU</button>
           </div>
           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Identitas</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Tujuan Unit</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Masuk</th>
                    <th className="px-8 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {db.guests.length > 0 ? db.guests.map(g => (
                     <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-8 py-4 font-bold text-slate-900 text-sm">{g.name}</td>
                       <td className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">{g.visitToName}</td>
                       <td className="px-8 py-4"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{g.status}</span></td>
                       <td className="px-8 py-4 text-[10px] font-black text-slate-400">{new Date(g.entryTime).toLocaleTimeString()}</td>
                       <td className="px-8 py-4 text-right pr-10">
                          {g.status === 'IN' && <button onClick={() => setDb(prev => ({...prev, guests: prev.guests.map(item => item.id === g.id ? {...item, status: 'OUT'} : item)}))} className="p-2 text-slate-300 hover:text-red-500 transition-all"><LogOut size={18}/></button>}
                       </td>
                     </tr>
                   )) : (
                     <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-black uppercase italic text-xs">Belum Ada Tamu Terdaftar Hari Ini</td></tr>
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
            <h3 className="text-2xl font-black text-slate-900">Data Hunian</h3>
            <div className="flex gap-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-colors" size={18}/>
                <input 
                  type="text" placeholder="Cari warga..." 
                  className="pl-12 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm outline-none focus:border-amber-500 font-bold w-full md:w-[250px] transition-all" 
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
                />
              </div>
              {currentUser.role === 'ADMIN' && <button onClick={() => setIsModalOpen('RESIDENT')} className="bg-slate-900 text-white p-3 rounded-xl shadow-lg active:scale-95 transition-all"><Plus size={24}/></button>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {db.residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(res => (
              <div key={res.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all duration-300 group">
                <div>
                   <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-900 flex items-center justify-center font-black text-lg border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all">{res.block}</div>
                      <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{res.isHome ? 'DI UNIT' : 'LUAR AREA'}</span>
                   </div>
                   <h4 className="font-black text-xl text-slate-900 mb-1 leading-tight">{res.name}</h4>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Unit: <span className="text-slate-900">{res.houseNumber}</span></p>
                </div>
                <div className="mt-8 flex gap-3">
                   <a href={`tel:${res.phoneNumber}`} className="flex-1 py-4 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all hover:bg-green-600"><PhoneCall size={22}/></a>
                   {currentUser.role === 'ADMIN' && <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-amber-500 hover:bg-amber-50 transition-all"><Edit2 size={20}/></button>}
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
                     <div className={`max-w-[75%] p-5 rounded-[2rem] shadow-sm ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                        <div className="flex justify-between items-center gap-6 mb-2">
                           <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                           <span className="text-[8px] font-bold px-2 py-0.5 bg-white/10 rounded-full uppercase tracking-tighter">{msg.senderRole}</span>
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
                className="flex-1 px-8 py-4 rounded-3xl bg-slate-50 border-2 border-slate-50 outline-none font-bold text-base focus:border-amber-500 transition-all shadow-inner" 
                value={chatInput} onChange={e => setChatInput(e.target.value)} 
              />
              <button type="submit" className="bg-slate-900 text-white p-4 rounded-3xl active:scale-95 transition-all shadow-xl hover:bg-slate-800"><Send size={24}/></button>
           </form>
        </div>
      )}

      {/* SETTINGS / CLOUD SYNC TAB */}
      {activeTab === 'settings' && (
        <div className="max-w-3xl mx-auto space-y-10 animate-slide-up pb-24">
          <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 blur-[100px] rounded-full"></div>
             <h3 className="text-3xl font-black text-slate-900 mb-12 relative z-10 tracking-tight">Akun & Sinkronisasi Master</h3>
             <div className="space-y-10 relative z-10">
                <div className="flex items-center gap-8 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner">
                   <div className="w-24 h-24 rounded-[2rem] bg-slate-900 text-white flex items-center justify-center text-4xl font-black shadow-2xl">{currentUser.name.charAt(0)}</div>
                   <div>
                      <h4 className="text-2xl font-black text-slate-900">{currentUser.name}</h4>
                      <p className="text-xs font-black text-amber-600 uppercase tracking-widest mt-1">Akses: {currentUser.role} Perumahan</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <div className="flex items-center gap-4 mb-4 text-amber-600"><Database size={24}/><h5 className="font-black text-sm uppercase tracking-widest">Master Cloud Export</h5></div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-6 leading-relaxed italic">Salin kode ini di laptop dan tempel di HP Anda agar data tersinkron sempurna.</p>
                      <button onClick={() => { setSyncInput(DatabaseService.exportSyncCode()); setIsModalOpen('SYNC_MODAL'); }} className="w-full py-4 bg-white border-2 border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-sm">SALIN KODE MASTER</button>
                   </div>
                   <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <div className="flex items-center gap-4 mb-4 text-blue-600"><RefreshCw size={24}/><h5 className="font-black text-sm uppercase tracking-widest">Master Cloud Import</h5></div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-6 leading-relaxed italic">Tempel kode master dari laptop untuk memperbarui seluruh data di perangkat ini.</p>
                      <button onClick={() => { setSyncInput(''); setIsModalOpen('SYNC_MODAL'); }} className="w-full py-4 bg-white border-2 border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-sm">TEMPEL KODE MASTER</button>
                   </div>
                </div>

                <div className="pt-10 border-t border-slate-100">
                   <button onClick={handleLogout} className="w-full py-5 bg-red-50 text-red-600 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all hover:bg-red-100 shadow-md"><LogOut size={20}/> KELUAR APLIKASI</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* SYNC MODAL */}
      {isModalOpen === 'SYNC_MODAL' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <div><h3 className="text-2xl font-black">TKA Cloud Sync</h3><p className="text-[10px] font-bold uppercase text-slate-400 mt-1">Cross-Device Synchronizer</p></div>
              <button onClick={() => setIsModalOpen(null)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={28}/></button>
            </div>
            <div className="p-10 space-y-8">
               <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Kode Master Sinkronisasi:</label>
                  <textarea 
                    className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[10px] font-mono break-all outline-none focus:border-amber-500 transition-all min-h-[150px] shadow-inner" 
                    value={syncInput} onChange={e => setSyncInput(e.target.value)} placeholder="Kode enkripsi database akan muncul di sini..."
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => { navigator.clipboard.writeText(syncInput); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }} className="py-4 bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-100 transition-all">
                    {isCopied ? <Check size={18} className="text-green-500"/> : <Copy size={18}/>} {isCopied ? 'TERSALIN KE CLIPBOARD' : 'SALIN KODE MASTER'}
                  </button>
                  <button onClick={importData} className="py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-slate-800 active:scale-95 transition-all">APLIKASIKAN KE PERANGKAT</button>
               </div>
               <div className="flex gap-3 bg-amber-50 p-5 rounded-2xl border border-amber-100 items-start">
                  <Info size={20} className="text-amber-600 mt-1 flex-shrink-0" />
                  <p className="text-[9px] font-bold text-amber-700 leading-relaxed uppercase">Peringatan Penting: Mengaplikasikan kode master akan menghapus seluruh data di perangkat ini dan menggantinya dengan data dari kode tersebut secara permanen.</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESIDENT */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center rounded-t-[3rem]">
              <h3 className="text-2xl font-black tracking-tight">Data Warga Baru</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={addResident} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Warga..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-amber-500 transition-all" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={resForm.block} onChange={e => setResForm({...resForm, block: e.target.value})}>
                  {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <input type="text" required placeholder="No. Unit" className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={resForm.houseNumber} onChange={e => setResForm({...resForm, houseNumber: e.target.value})} />
              </div>
              <input type="tel" required placeholder="WhatsApp (Aktif)..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-amber-500 transition-all" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
                 <p className="text-[10px] font-black text-amber-600 uppercase mb-2 tracking-widest">Akses Login Warga:</p>
                 <p className="text-xs font-bold text-slate-700">User: <span className="font-black">{resForm.name || '...'}</span></p>
                 <p className="text-xs font-bold text-slate-700">PIN Login: <span className="font-black text-slate-900 tracking-widest">wargatka123456</span></p>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">SIMPAN KE DATABASE</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GUEST */}
      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up">
            <div className="p-10 bg-blue-600 text-white flex justify-between items-center rounded-t-[3rem]">
              <h3 className="text-2xl font-black tracking-tight">Tamu Masuk Baru</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={addGuest} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-blue-500 transition-all" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                  <option value="">-- Pilih Tujuan Hunian --</option>
                  {db.residents.map(r => <option key={r.id} value={r.id}>Blok {r.block} No. {r.houseNumber} ({r.name})</option>)}
              </select>
              <textarea required placeholder="Keperluan Berkunjung..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[120px] text-base focus:border-blue-500 transition-all" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">KONFIRMASI PENDAFTARAN</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INCIDENT */}
      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up">
            <div className="p-10 bg-red-600 text-white flex justify-between items-center rounded-t-[3rem]">
              <h3 className="text-2xl font-black tracking-tight">Lapor Kejadian</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={addIncident} className="p-10 space-y-5">
              <select required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-red-500 transition-all" value={incForm.type} onChange={e => setIncForm({...incForm, type: e.target.value})}>
                <option value="Kriminalitas">Kriminalitas / Pencurian</option>
                <option value="Kebakaran">Kebakaran / Asap</option>
                <option value="Kecurigaan">Aktifitas Mencurigakan</option>
                <option value="Fasilitas">Fasilitas Umum Rusak</option>
              </select>
              <input type="text" required placeholder="Lokasi Spesifik (Misal: Belakang Lapangan)..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-red-500 transition-all" value={incForm.location} onChange={e => setIncForm({...incForm, location: e.target.value})} />
              <textarea required placeholder="Jelaskan kronologi singkat..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[150px] text-base focus:border-red-500 transition-all" value={incForm.description} onChange={e => setIncForm({...incForm, description: e.target.value})} />
              <button type="submit" disabled={isAnalyzing} className="w-full py-5 bg-red-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                {isAnalyzing ? <Clock size={20} className="animate-spin" /> : <Send size={20}/>} {isAnalyzing ? 'MENGANALISIS...' : 'KIRIM LAPORAN'}
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
              <div><h3 className="text-2xl font-black tracking-tight">{patrolAction.cp}</h3><p className="text-[10px] font-black uppercase opacity-80 mt-1">Status Keamanan Area</p></div>
              <button onClick={() => setPatrolAction(null)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={24}/></button>
            </div>
            <div className="p-10 space-y-8">
               <p className="text-slate-600 font-medium text-center leading-relaxed">Anda menyatakan bahwa area <span className="font-black">{patrolAction.cp}</span> dalam kondisi <span className={`font-black ${patrolAction.status === 'OK' ? 'text-green-600' : 'text-red-600'}`}>{patrolAction.status === 'OK' ? 'AMAN & TERKONTROL' : 'MEMBUTUHKAN TINDAKAN'}</span>.</p>
               <button onClick={() => submitPatrol(patrolAction.status)} className={`w-full py-5 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl transition-all active:scale-95 ${patrolAction.status === 'OK' ? 'bg-green-600 shadow-green-600/20' : 'bg-red-600 shadow-red-600/20'}`}>KONFIRMASI STATUS</button>
            </div>
          </div>
        </div>
      )}

      {/* SOS MODAL */}
      {isModalOpen === 'SOS_MODAL' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-600 animate-pulse">
           <div className="text-center text-white p-16">
              <div className="bg-white text-red-600 w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-10 shadow-[0_0_80px_rgba(255,255,255,0.6)]">
                 <BellRing size={64} className="animate-bounce" />
              </div>
              <h1 className="text-5xl font-black mb-6 tracking-tighter uppercase">SOS TERKIRIM!</h1>
              <p className="text-xl font-bold opacity-90 leading-tight">Seluruh petugas keamanan Kawasan TKA<br/>sedang menuju lokasi Anda sekarang.</p>
           </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
