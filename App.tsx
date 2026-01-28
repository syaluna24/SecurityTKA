
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  SECURITY_USERS, 
  ADMIN_USERS, 
  MOCK_RESIDENTS,
  BLOCKS,
  CHECKPOINTS as INITIAL_CHECKPOINTS 
} from './constants.tsx';
import { User, PatrolLog, IncidentReport, Resident, GuestLog, ChatMessage, SecurityLocation, UserRole } from './types.ts';
import Layout from './components/Layout.tsx';
import { 
  Shield, 
  Search, 
  Phone, 
  Send,
  Users,
  MapPin,
  X,
  Lock,
  TrendingUp,
  AlertTriangle,
  UserPlus,
  ArrowRight,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  Plus,
  Home,
  Settings,
  LogOut,
  Activity,
  MessageSquare,
  FileText,
  BellRing,
  CloudOff,
  Database,
  Download,
  Upload,
  Copy,
  Check
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  // Persistence States
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>(() => {
    const saved = localStorage.getItem('tka_patrol_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [incidents, setIncidents] = useState<IncidentReport[]>(() => {
    const saved = localStorage.getItem('tka_incidents');
    return saved ? JSON.parse(saved) : [];
  });
  const [guests, setGuests] = useState<GuestLog[]>(() => {
    const saved = localStorage.getItem('tka_guests');
    return saved ? JSON.parse(saved) : [];
  });
  const [residents, setResidents] = useState<Resident[]>(() => {
    const saved = localStorage.getItem('tka_residents_db');
    return saved ? JSON.parse(saved) : MOCK_RESIDENTS;
  });
  const [checkpoints, setCheckpoints] = useState<string[]>(() => {
    const saved = localStorage.getItem('tka_checkpoints');
    return saved ? JSON.parse(saved) : INITIAL_CHECKPOINTS;
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('tka_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [isGpsEnabled, setIsGpsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('tka_gps_enabled');
    return saved === 'true';
  });

  // UI States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'GUEST' | 'INCIDENT' | 'CHECKPOINT_MGR' | 'SOS_MODAL' | 'SYNC_MODAL' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [residentForm, setResidentForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '' });
  const [incidentForm, setIncidentForm] = useState({ type: 'Kriminalitas', location: '', description: '' });
  const [checkpointForm, setCheckpointForm] = useState({ name: '', oldName: '' });
  const [patrolActionState, setPatrolActionState] = useState<{checkpoint: string, status: 'OK' | 'WARNING' | 'DANGER'} | null>(null);
  const [patrolActionNote, setPatrolActionNote] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');
  const [residentSearch, setResidentSearch] = useState('');
  const [syncCode, setSyncCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync Persistence to LocalStorage
  useEffect(() => {
    localStorage.setItem('tka_guests', JSON.stringify(guests));
    localStorage.setItem('tka_incidents', JSON.stringify(incidents));
    localStorage.setItem('tka_patrol_logs', JSON.stringify(patrolLogs));
    localStorage.setItem('tka_residents_db', JSON.stringify(residents));
    localStorage.setItem('tka_checkpoints', JSON.stringify(checkpoints));
    localStorage.setItem('tka_chats', JSON.stringify(chatMessages));
    localStorage.setItem('tka_gps_enabled', String(isGpsEnabled));
  }, [guests, incidents, patrolLogs, residents, checkpoints, chatMessages, isGpsEnabled]);

  // Briefing AI
  useEffect(() => {
    if (currentUser) {
      const isMorning = new Date().getHours() >= 7 && new Date().getHours() < 19;
      getSecurityBriefing(isMorning ? 'Pagi' : 'Malam').then(setSecurityBriefing);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const chartData = useMemo(() => {
    const activeBlocks = ['A1', 'A2', 'B1', 'C1'];
    return activeBlocks.map(block => ({
      name: `Blok ${block}`,
      incidents: incidents.filter(inc => inc.location.toUpperCase().includes(`${block}`)).length
    }));
  }, [incidents]);

  // Auth Handlers
  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedUser(null);
    setPasswordInput('');
    setActiveTab('dashboard');
  };

  const handleAttemptLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const pass = passwordInput.trim();
    
    const isSecurity = SECURITY_USERS.some(u => u.id === selectedUser.id) && pass === '123456';
    const isAdmin = ADMIN_USERS.some(u => u.id === selectedUser.id) && pass === 'admin123';
    const isResident = residents.some(r => r.id === selectedUser.id) && pass === 'wargatka123456';

    if (isSecurity || isAdmin || isResident) {
      setCurrentUser({
        id: selectedUser.id,
        name: selectedUser.name,
        role: loginTab as UserRole
      });
      setActiveTab('dashboard');
      setLoginError('');
      setPasswordInput('');
    } else {
      setLoginError('PIN Keamanan Salah!');
    }
  };

  // Data Handlers
  const handleSaveResident = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      setResidents(prev => prev.map(r => r.id === editingItem.id ? { ...r, ...residentForm } as Resident : r));
    } else {
      const newResident: Resident = {
        id: `res-dyn-${Date.now()}`,
        name: residentForm.name || '',
        houseNumber: residentForm.houseNumber || '',
        block: residentForm.block || BLOCKS[0],
        phoneNumber: residentForm.phoneNumber || '',
        isHome: residentForm.isHome ?? true
      };
      setResidents(prev => [newResident, ...prev]);
    }
    setIsModalOpen(null);
    setEditingItem(null);
    setResidentForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  };

  const handleSaveGuest = (e: React.FormEvent) => {
    e.preventDefault();
    const targetResident = residents.find(r => r.id === guestForm.visitToId);
    const newGuest: GuestLog = {
      id: Date.now().toString(),
      name: guestForm.name || '',
      visitToId: guestForm.visitToId || '',
      visitToName: targetResident ? `Blok ${targetResident.block} No. ${targetResident.houseNumber} (${targetResident.name})` : 'Umum',
      purpose: guestForm.purpose || '',
      entryTime: new Date().toISOString(),
      status: 'IN'
    };
    setGuests(prev => [newGuest, ...prev]);
    setIsModalOpen(null);
    setGuestForm({ name: '', visitToId: '', purpose: '' });
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsAnalyzing(true);
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    try {
      const analysis = await analyzeIncident(incidentForm.description);
      if (analysis?.severity) severity = analysis.severity;
    } catch (err) {}
    const newIncident: IncidentReport = {
      id: Date.now().toString(),
      reporterId: currentUser.id,
      reporterName: currentUser.name,
      timestamp: new Date().toISOString(),
      type: incidentForm.type,
      location: incidentForm.location,
      description: incidentForm.description,
      status: 'PENDING',
      severity
    };
    setIncidents(prev => [newIncident, ...prev]);
    setIsAnalyzing(false);
    setIsModalOpen(null);
    setIncidentForm({ type: 'Kriminalitas', location: '', description: '' });
  };

  const handleSavePatrol = () => {
    if (!patrolActionState || !currentUser) return;
    const newLog: PatrolLog = {
      id: Date.now().toString(),
      securityId: currentUser.id,
      securityName: currentUser.name,
      timestamp: new Date().toISOString(),
      checkpoint: patrolActionState.checkpoint,
      status: patrolActionState.status,
      note: patrolActionNote || 'Area aman terkendali.'
    };
    setPatrolLogs(prev => [newLog, ...prev]);
    setPatrolActionState(null);
    setPatrolActionNote('');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: chatInput,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
  };

  const handleEmergencySOS = () => {
    if (!currentUser) return;
    const sosIncident: IncidentReport = {
      id: `SOS-${Date.now()}`,
      reporterId: currentUser.id,
      reporterName: currentUser.name,
      timestamp: new Date().toISOString(),
      type: 'EMERGENCY / SOS',
      location: 'Sesuai Data Warga',
      description: `DARURAT! ${currentUser.name.toUpperCase()} MEMBUTUHKAN BANTUAN SEGERA!`,
      status: 'PENDING',
      severity: 'HIGH'
    };
    setIncidents(prev => [sosIncident, ...prev]);
    setIsModalOpen('SOS_MODAL');
    setTimeout(() => setIsModalOpen(null), 3000);
  };

  // Database Sync Handlers
  const handleExportData = () => {
    const data = { residents, guests, incidents, patrolLogs, checkpoints, chatMessages };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    setSyncCode(encoded);
    setIsModalOpen('SYNC_MODAL');
  };

  const handleImportData = (code: string) => {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(code))));
      if (decoded.residents) setResidents(decoded.residents);
      if (decoded.guests) setGuests(decoded.guests);
      if (decoded.incidents) setIncidents(decoded.incidents);
      if (decoded.patrolLogs) setPatrolLogs(decoded.patrolLogs);
      if (decoded.checkpoints) setCheckpoints(decoded.checkpoints);
      if (decoded.chatMessages) setChatMessages(decoded.chatMessages);
      alert('Data Berhasil Disinkronkan!');
      setIsModalOpen(null);
    } catch (err) {
      alert('Kode Sinkronisasi Tidak Valid!');
    }
  };

  if (!currentUser) {
    const userPool = loginTab === 'SECURITY' 
      ? SECURITY_USERS 
      : loginTab === 'ADMIN' 
        ? ADMIN_USERS 
        : residents.map(r => ({ id: r.id, name: r.name, role: 'RESIDENT' as UserRole, sub: `Blok ${r.block} No. ${r.houseNumber}` }));

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[1100px] flex flex-col md:flex-row rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
          <div className="w-full md:w-5/12 bg-[#0F172A] p-12 flex flex-col justify-between text-white relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full"></div>
            <div>
              <div className="bg-amber-500 w-20 h-20 rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl shadow-amber-500/20">
                <Shield size={40} className="text-slate-900" />
              </div>
              <h1 className="text-5xl font-black leading-tight mb-6 tracking-tighter">TKA SECURE</h1>
              <p className="text-slate-400 text-base leading-relaxed opacity-80">
                Sistem Keamanan Terintegrasi Perumahan TKA.<br/>Layanan Keamanan 24 Jam dengan AI Grounding.
              </p>
            </div>
            <div className="pt-10 border-t border-slate-800 space-y-6">
               <div className="flex items-center gap-4">
                 <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Sistem Operasional</span>
               </div>
               <div className="p-6 bg-slate-800/40 rounded-3xl border border-slate-800">
                  <CloudOff size={20} className="text-amber-500 mb-2" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
                    Sinkronisasi Perangkat Aktif. Gunakan Menu Setelan Untuk Pindah Data ke HP.
                  </p>
               </div>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-10 md:p-16 bg-white">
            <h2 className="text-4xl font-black text-slate-900 mb-10 tracking-tight">Portal Login</h2>
            
            <div className="flex bg-slate-100 p-2 rounded-3xl mb-12">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => { setLoginTab(tab); setSelectedUser(null); setLoginError(''); }}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-2xl transition-all duration-300 ${
                    loginTab === tab ? 'bg-white text-slate-900 shadow-xl scale-[1.02]' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'SECURITY' ? 'Satpam' : tab === 'ADMIN' ? 'Admin' : 'Warga'}
                </button>
              ))}
            </div>

            <form onSubmit={handleAttemptLogin} className="space-y-8">
              <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto no-scrollbar pr-2">
                {userPool.length > 0 ? userPool.map((u: any) => (
                  <button 
                    key={u.id}
                    type="button"
                    onClick={() => { setSelectedUser(u); setLoginError(''); }}
                    className={`flex items-center gap-5 p-5 rounded-3xl border-2 transition-all duration-300 text-left ${
                      selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50 shadow-lg shadow-amber-500/5 translate-x-1' : 'border-slate-50 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-slate-900 text-base">{u.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{u.sub || u.role}</p>
                    </div>
                    {selectedUser?.id === u.id && <div className="bg-amber-500 p-1.5 rounded-full text-white"><CheckCircle size={20}/></div>}
                  </button>
                )) : (
                  <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem] text-slate-300 font-black uppercase italic tracking-widest">Database Kosong</div>
                )}
              </div>

              {selectedUser && (
                <div className="space-y-6 pt-6 animate-slide-up">
                  <div className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-colors">
                        <Lock size={22}/>
                    </div>
                    <input 
                      type="password" 
                      required 
                      placeholder="Masukkan PIN Keamanan"
                      className="w-full pl-16 pr-8 py-5 rounded-3xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-xl tracking-[0.5em] transition-all" 
                      value={passwordInput} 
                      onChange={e => setPasswordInput(e.target.value)} 
                    />
                  </div>
                  {loginError && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-center border border-red-100">{loginError}</div>}
                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl hover:bg-slate-800 hover:shadow-2xl hover:shadow-slate-900/20 transition-all flex items-center justify-center gap-4 text-xs uppercase tracking-widest active:scale-95"
                  >
                    Masuk Ke Sistem <ArrowRight size={20} />
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
        <div className="space-y-8 animate-slide-up">
          {currentUser.role === 'RESIDENT' && (
            <div className="bg-red-600 p-10 rounded-[3rem] text-white shadow-2xl shadow-red-200 flex flex-col md:flex-row justify-between items-center gap-8 mb-10 overflow-hidden relative">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
               <div className="flex items-center gap-8 relative z-10">
                 <div className="bg-white/20 p-5 rounded-[2rem] backdrop-blur-md border border-white/30"><BellRing size={40} className="animate-bounce" /></div>
                 <div>
                    <h3 className="text-3xl font-black mb-2 uppercase tracking-tighter">Situasi Darurat?</h3>
                    <p className="text-sm text-red-100 font-semibold opacity-90 max-w-md">Klik tombol SOS untuk mengirimkan sinyal bahaya ke seluruh pos satpam dan admin perumahan.</p>
                 </div>
               </div>
               <button onClick={handleEmergencySOS} className="bg-white text-red-600 px-12 py-5 rounded-3xl font-black uppercase text-sm shadow-2xl hover:scale-105 active:scale-95 transition-all relative z-10">KIRIM SOS</button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Aktivitas Patroli', val: patrolLogs.length, icon: <Activity size={28}/>, color: 'amber' },
              { label: 'Laporan Insiden', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={28}/>, color: 'red' },
              { label: 'Tamu Hari Ini', val: guests.filter(g => g.status === 'IN').length, icon: <Users size={28}/>, color: 'blue' },
              { label: 'Hunian Aktif', val: residents.filter(r => r.isHome).length, icon: <Home size={28}/>, color: 'green' }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300 group">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 ${
                  stat.color === 'amber' ? 'bg-amber-50 text-amber-600' : 
                  stat.color === 'red' ? 'bg-red-50 text-red-600' : 
                  stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}>{stat.icon}</div>
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">{stat.label}</h3>
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <TrendingUp size={24} className="text-amber-500"/> Statistik Keamanan Area
                </h3>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px'}} />
                    <Bar dataKey="incidents" radius={[10, 10, 10, 10]} barSize={45}>
                      {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#10B981'][index % 3]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-10 rounded-[3rem] flex flex-col justify-between shadow-2xl shadow-slate-900/40 relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <Shield size={32} className="text-amber-500"/>
                  <h3 className="font-black text-2xl tracking-tighter">AI Briefing</h3>
                </div>
                <p className="text-slate-300 text-base italic leading-relaxed font-medium">"{securityBriefing || 'Menghubungkan ke server TKA...'}"</p>
              </div>
              <button 
                onClick={() => setActiveTab(currentUser.role === 'RESIDENT' ? 'incident' : 'patrol')} 
                className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-[1.5rem] mt-10 text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-amber-400 active:scale-95 transition-all relative z-10 shadow-xl shadow-amber-500/20"
              >
                {currentUser.role === 'RESIDENT' ? 'LAPOR KEJADIAN' : 'MULAI TUGAS'} <ArrowRight size={20}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PATROL TAB */}
      {activeTab === 'patrol' && (
        <div className="space-y-8 animate-slide-up pb-20">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div>
              <h3 className="text-2xl font-black text-slate-900">Kendali Patroli</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manajemen Pos Keamanan</p>
            </div>
            {currentUser.role === 'ADMIN' && (
              <button onClick={() => setIsModalOpen('CHECKPOINT_MGR')} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-3 shadow-xl active:scale-95 transition-all"><Plus size={20}/> POS BARU</button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {checkpoints.map((cp, idx) => {
              const lastLog = patrolLogs.filter(log => log.checkpoint === cp)[0];
              return (
                <div key={idx} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-start mb-8">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-slate-900 text-white flex items-center justify-center font-black text-2xl group-hover:scale-110 transition-transform duration-300">{idx + 1}</div>
                    {lastLog && <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${lastLog.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{lastLog.status}</div>}
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-10 tracking-tight">{cp}</h4>
                  {currentUser.role === 'SECURITY' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'OK' })} className="py-5 bg-green-500 text-white rounded-2xl font-black text-xs uppercase active:scale-95 transition-all shadow-lg shadow-green-500/10">AMAN</button>
                      <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'DANGER' })} className="py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase active:scale-95 transition-all shadow-lg shadow-red-500/10">BAHAYA</button>
                    </div>
                  ) : (
                    <div className="pt-6 border-t border-slate-50">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Terakhir Diperiksa:</p>
                       <p className="text-xs font-black text-slate-800">{lastLog ? `${lastLog.securityName} - ${new Date(lastLog.timestamp).toLocaleTimeString()}` : 'Belum Ada Aktivitas'}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INCIDENT TAB */}
      {activeTab === 'incident' && (
        <div className="space-y-8 animate-slide-up pb-20">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900">Log Kejadian</h3>
            <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-3 active:scale-95 shadow-xl transition-all shadow-red-600/20"><AlertTriangle size={20}/> LAPOR BARU</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {incidents.length > 0 ? incidents.map(inc => (
              <div key={inc.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
                <div className={`absolute top-0 right-0 w-48 h-48 blur-[80px] opacity-10 ${inc.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                <div>
                  <div className="flex justify-between items-start mb-8">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${inc.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{inc.severity} Severity</span>
                    <span className="text-xs font-black text-slate-400 uppercase">{new Date(inc.timestamp).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{inc.type}</h4>
                  <p className="text-sm text-slate-400 font-bold mb-6 flex items-center gap-2"><MapPin size={16} className="text-amber-500"/> {inc.location}</p>
                  <p className="text-base text-slate-600 leading-relaxed italic mb-10">"{inc.description}"</p>
                </div>
                <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1rem] bg-slate-900 text-white flex items-center justify-center font-black text-sm">{inc.reporterName.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-black text-slate-900 leading-none mb-1">{inc.reporterName}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pelapor</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className={`w-2 h-2 rounded-full ${inc.status === 'RESOLVED' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                     <span className={`text-[10px] font-black uppercase tracking-widest ${inc.status === 'RESOLVED' ? 'text-green-500' : 'text-amber-500'}`}>{inc.status}</span>
                  </div>
                </div>
              </div>
            )) : <div className="lg:col-span-2 py-32 bg-white rounded-[3rem] border-4 border-dashed border-slate-50 text-center text-slate-300 font-black uppercase italic tracking-[0.2em]">Semua Area Kondusif</div>}
          </div>
        </div>
      )}

      {/* RESIDENTS TAB */}
      {activeTab === 'residents' && (
        <div className="space-y-8 animate-slide-up pb-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900">Database Warga</h3>
            <div className="flex gap-4">
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-colors" size={20}/>
                <input type="text" placeholder="Cari warga..." className="pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 outline-none text-sm font-bold transition-all w-full md:w-[300px]" value={residentSearch} onChange={e => setResidentSearch(e.target.value)} />
              </div>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => { setEditingItem(null); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all"><Plus size={28}/></button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {residents.filter(r => r.name.toLowerCase().includes(residentSearch.toLowerCase())).map(res => (
              <div key={res.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-2xl hover:border-amber-100 transition-all duration-300 group">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-900 flex items-center justify-center font-black text-lg border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">{res.block}</div>
                    <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{res.isHome ? 'DI UNIT' : 'LUAR AREA'}</span>
                  </div>
                  <h4 className="font-black text-xl text-slate-900 leading-tight mb-2">{res.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nomor Unit: <span className="text-slate-900 font-black">{res.houseNumber}</span></p>
                </div>
                <div className="mt-10 flex gap-3">
                  <a href={`tel:${res.phoneNumber}`} className="flex-1 py-5 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/10 active:scale-95 transition-all hover:bg-green-600"><Phone size={22}/></a>
                  {currentUser.role === 'ADMIN' && (
                    <button onClick={() => { setEditingItem(res); setResidentForm(res); setIsModalOpen('RESIDENT'); }} className="p-5 bg-slate-50 text-slate-400 rounded-2xl hover:text-amber-500 hover:bg-amber-50 transition-all"><Edit2 size={22}/></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GUESTS TAB */}
      {activeTab === 'guests' && (
        <div className="space-y-8 animate-slide-up pb-20">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900">Buku Tamu</h3>
            <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-3 active:scale-95 shadow-xl transition-all shadow-blue-600/20"><UserPlus size={20}/> DAFTAR TAMU</button>
          </div>
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-10 py-7 text-[10px] font-black uppercase text-slate-400 tracking-widest">Identitas Tamu</th>
                  <th className="px-10 py-7 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tujuan Unit</th>
                  <th className="px-10 py-7 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                  <th className="px-10 py-7 text-[10px] font-black uppercase text-slate-400 tracking-widest">Waktu Masuk</th>
                  <th className="px-10 py-7"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {guests.map(g => (
                  <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-10 py-6 font-black text-slate-900 text-base">{g.name}</td>
                    <td className="px-10 py-6 text-sm font-bold text-slate-500">{g.visitToName}</td>
                    <td className="px-10 py-6"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{g.status}</span></td>
                    <td className="px-10 py-6 text-xs font-black text-slate-400 tracking-tighter">{new Date(g.entryTime).toLocaleString()}</td>
                    <td className="px-10 py-6 text-right">
                       {g.status === 'IN' && (
                         <button onClick={() => setGuests(prev => prev.map(item => item.id === g.id ? {...item, status: 'OUT'} : item))} className="p-3 text-slate-400 hover:text-red-500 transition-all hover:bg-red-50 rounded-xl"><LogOut size={20}/></button>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-280px)] flex flex-col animate-slide-up pb-20">
           <div className="flex-1 bg-white rounded-t-[3rem] shadow-sm border border-slate-100 overflow-y-auto p-10 space-y-6 no-scrollbar">
              {chatMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
                   <MessageSquare size={64}/>
                   <p className="font-black uppercase tracking-widest text-xs italic">Mulai koordinasi keamanan...</p>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[75%] p-6 rounded-[2rem] shadow-sm ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-6 mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                        <span className="text-[9px] font-bold px-3 py-1 bg-white/10 rounded-full">{msg.senderRole}</span>
                      </div>
                      <p className="text-base font-medium leading-relaxed">{msg.text}</p>
                      <p className="text-[9px] mt-3 opacity-40 text-right font-black tracking-widest uppercase">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              ))}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={handleSendChat} className="bg-white p-6 rounded-b-[3rem] border-t border-slate-100 flex gap-4 shadow-sm">
              <input type="text" placeholder="Tulis pesan koordinasi..." className="flex-1 px-8 py-5 rounded-3xl bg-slate-50 border-2 border-slate-50 outline-none font-bold text-base focus:border-amber-500 transition-all" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-5 rounded-3xl active:scale-95 transition-all shadow-xl hover:bg-slate-800"><Send size={28}/></button>
           </form>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="max-w-3xl mx-auto space-y-10 animate-slide-up pb-20">
          <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 blur-[100px] rounded-full"></div>
            <h3 className="text-3xl font-black text-slate-900 mb-12 relative z-10 tracking-tight">Setelan Akun & Data</h3>
            <div className="space-y-10 relative z-10">
              <div className="flex items-center gap-8 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                <div className="w-24 h-24 rounded-[2rem] bg-slate-900 text-white flex items-center justify-center text-4xl font-black shadow-2xl">{currentUser.name.charAt(0)}</div>
                <div>
                  <h4 className="text-2xl font-black text-slate-900 tracking-tight">{currentUser.name}</h4>
                  <p className="text-xs font-black text-amber-600 uppercase tracking-[0.2em] mt-1">{currentUser.role} AREA TKA</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                  <div className="flex items-center gap-4 mb-4 text-amber-600">
                    <Database size={24}/>
                    <h5 className="font-black text-sm uppercase tracking-widest">Database Sync</h5>
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed mb-6">Pindahkan data warga dari laptop ke HP Anda secara instan.</p>
                  <button onClick={handleExportData} className="w-full py-4 bg-white border-2 border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-slate-900 hover:text-white transition-all">
                    <Download size={18}/> Export Data
                  </button>
                </div>
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                  <div className="flex items-center gap-4 mb-4 text-blue-600">
                    <Upload size={24}/>
                    <h5 className="font-black text-sm uppercase tracking-widest">Restore Data</h5>
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed mb-6">Tempel kode sinkronisasi untuk memperbarui data perangkat ini.</p>
                  <button onClick={() => { setSyncCode(''); setIsModalOpen('SYNC_MODAL'); }} className="w-full py-4 bg-white border-2 border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-slate-900 hover:text-white transition-all">
                    <Upload size={18}/> Import Data
                  </button>
                </div>
              </div>

              <div className="pt-10 border-t border-slate-100">
                <button onClick={handleLogout} className="w-full py-5 bg-red-50 text-red-600 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-4 active:scale-95 transition-all hover:bg-red-100">
                    <LogOut size={20}/> KELUAR APLIKASI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {isModalOpen === 'SYNC_MODAL' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">Sinkronisasi Database</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Cross-Device Data Transfer</p>
              </div>
              <button onClick={() => setIsModalOpen(null)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={28}/></button>
            </div>
            <div className="p-10 space-y-8">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Kode Sinkronisasi:</p>
                <textarea 
                  className="w-full p-6 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-mono break-all outline-none focus:border-amber-500 transition-all min-h-[150px]" 
                  value={syncCode} 
                  onChange={(e) => setSyncCode(e.target.value)}
                  placeholder="Tempel kode sinkronisasi di sini..."
                />
                <div className="flex gap-4 mt-6">
                   <button 
                     onClick={() => {
                        navigator.clipboard.writeText(syncCode);
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                     }}
                     className="flex-1 py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-3 transition-all hover:bg-slate-50"
                   >
                     {isCopied ? <Check size={18} className="text-green-500"/> : <Copy size={18}/>}
                     {isCopied ? 'TERSALIN' : 'SALIN KODE'}
                   </button>
                   <button 
                    onClick={() => handleImportData(syncCode)}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-3 transition-all active:scale-95"
                   >
                     APLIKASIKAN DATA
                   </button>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase text-center leading-relaxed">
                Peringatan: Mengaplikasikan data akan menimpa data warga saat ini di perangkat ini.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESIDENT */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center rounded-t-[3rem]">
              <h3 className="text-2xl font-black tracking-tight">{editingItem ? 'Edit Data Warga' : 'Registrasi Hunian'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveResident} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Warga..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-amber-500 transition-all" value={residentForm.name} onChange={e => setResidentForm({...residentForm, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm focus:border-amber-500 transition-all" value={residentForm.block} onChange={e => setResidentForm({...residentForm, block: e.target.value})}>
                  {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <input type="text" required placeholder="No. Unit" className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm focus:border-amber-500 transition-all" value={residentForm.houseNumber} onChange={e => setResidentForm({...residentForm, houseNumber: e.target.value})} />
              </div>
              <input type="tel" required placeholder="WhatsApp (Aktif)..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-amber-500 transition-all" value={residentForm.phoneNumber} onChange={e => setResidentForm({...residentForm, phoneNumber: e.target.value})} />
              <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
                 <div className="flex items-center gap-3 mb-3">
                    <Shield size={18} className="text-amber-600"/>
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">Otomatis Berikan Akses Login:</p>
                 </div>
                 <p className="text-xs font-bold text-slate-700">User: <span className="font-black">{residentForm.name || '(Nama)'}</span></p>
                 <p className="text-xs font-bold text-slate-700">PIN Login: <span className="font-black text-slate-900 tracking-widest">wargatka123456</span></p>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-slate-900/20 active:scale-95 transition-all">SIMPAN DATABASE</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GUEST */}
      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up">
            <div className="p-10 bg-blue-600 text-white flex justify-between items-center rounded-t-[3rem]">
              <h3 className="text-2xl font-black tracking-tight">Pendaftaran Tamu</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveGuest} className="p-10 space-y-5">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-blue-500 transition-all" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm focus:border-blue-500 transition-all" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                  <option value="">-- Cari Tujuan (Unit Warga) --</option>
                  {residents.map(r => <option key={r.id} value={r.id}>{r.block} No. {r.houseNumber} - {r.name}</option>)}
              </select>
              <textarea required placeholder="Tujuan / Keperluan Berkunjung..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[120px] text-base focus:border-blue-500 transition-all" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-blue-600/20 active:scale-95 transition-all">DAFTARKAN MASUK</button>
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
            <form onSubmit={handleIncidentSubmit} className="p-10 space-y-5">
              <select required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-red-500 transition-all" value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value})}>
                <option value="Kriminalitas">Kriminalitas / Pencurian</option>
                <option value="Kebakaran">Kebakaran / Korsleting</option>
                <option value="Kecurigaan">Aktifitas Mencurigakan</option>
                <option value="Fasilitas">Fasilitas Umum Rusak</option>
                <option value="Lainnya">Lain-lain</option>
              </select>
              <input type="text" required placeholder="Lokasi Kejadian (Cth: Dekat Lapangan)..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-base focus:border-red-500 transition-all" value={incidentForm.location} onChange={e => setIncidentForm({...incidentForm, location: e.target.value})} />
              <textarea required placeholder="Jelaskan kronologi secara singkat..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[150px] text-base focus:border-red-500 transition-all" value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} />
              <button type="submit" disabled={isAnalyzing} className="w-full py-5 bg-red-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                {isAnalyzing ? <Clock size={20} className="animate-spin" /> : <Send size={20}/>} 
                {isAnalyzing ? 'MENGANALISIS...' : 'KIRIM LAPORAN'}
              </button>
            </form>
          </div>
        </div>
      )}

      {patrolActionState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-10 text-white flex justify-between items-center ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-2xl font-black tracking-tight">{patrolActionState.checkpoint}</h3>
                <p className="text-[10px] font-black uppercase opacity-80 tracking-[0.2em] mt-1">STATUS: {patrolActionState.status}</p>
              </div>
              <button onClick={() => setPatrolActionState(null)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={24}/></button>
            </div>
            <div className="p-10 space-y-8">
              <textarea placeholder="Tambah catatan patroli (opsional)..." className="w-full px-8 py-6 rounded-[2rem] bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[120px] text-base focus:border-slate-300 transition-all" value={patrolActionNote} onChange={e => setPatrolActionNote(e.target.value)} />
              <button onClick={handleSavePatrol} className={`w-full py-5 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl transition-all active:scale-95 ${patrolActionState.status === 'OK' ? 'bg-green-600 shadow-green-600/20' : 'bg-red-600 shadow-red-600/20'}`}>SUBMIT STATUS</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen === 'SOS_MODAL' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-600 animate-pulse">
           <div className="text-center text-white p-16">
              <div className="bg-white text-red-600 w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-10 shadow-[0_0_80px_rgba(255,255,255,0.6)]">
                 <BellRing size={64} className="animate-bounce" />
              </div>
              <h1 className="text-6xl font-black mb-6 uppercase tracking-tighter">SINYAL SOS DIKIRIM!</h1>
              <p className="text-2xl font-bold opacity-95 leading-tight">Seluruh petugas keamanan dan penghuni<br/>telah mendapatkan notifikasi darurat.<br/>Bantuan segera tiba.</p>
           </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
