
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
  BookOpen,
  FileText,
  Sparkles,
  Navigation,
  BellRing,
  CloudOff,
  PhoneCall
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  // Persistence States (Database Lokal)
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
  const [securityLocations, setSecurityLocations] = useState<SecurityLocation[]>(() => {
    const saved = localStorage.getItem('tka_security_locations');
    return saved ? JSON.parse(saved) : [];
  });

  // UI States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'GUEST' | 'INCIDENT' | 'CHECKPOINT_MGR' | 'SOS_MODAL' | null>(null);
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
    localStorage.setItem('tka_security_locations', JSON.stringify(securityLocations));
  }, [guests, incidents, patrolLogs, residents, checkpoints, chatMessages, isGpsEnabled, securityLocations]);

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
    
    // Logic: Admin (admin123), Security (123456), Residents (wargatka123456)
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

  if (!currentUser) {
    const userPool = loginTab === 'SECURITY' 
      ? SECURITY_USERS 
      : loginTab === 'ADMIN' 
        ? ADMIN_USERS 
        : residents.map(r => ({ id: r.id, name: r.name, role: 'RESIDENT' as UserRole, sub: `Blok ${r.block} No. ${r.houseNumber}` }));

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[1000px] flex flex-col md:flex-row rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
          <div className="w-full md:w-5/12 bg-[#0F172A] p-10 flex flex-col justify-between text-white">
            <div>
              <div className="bg-amber-500 w-16 h-16 rounded-3xl flex items-center justify-center mb-8 shadow-xl">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-4xl font-black leading-tight mb-6 tracking-tighter">TKA SECURE<br/>SYSTEM</h1>
              <p className="text-slate-400 text-sm leading-relaxed opacity-80">
                Layanan Keamanan Shift 24 Jam Kawasan TKA.<br/>Login menggunakan PIN yang diberikan admin.
              </p>
            </div>
            <div className="pt-8 border-t border-slate-800">
               <div className="flex items-center gap-3 mb-4">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-[10px] font-black uppercase text-slate-500">Database Status: Active</span>
               </div>
               <div className="p-4 bg-slate-800/50 rounded-2xl flex items-start gap-3">
                  <CloudOff size={16} className="text-amber-500 mt-1" />
                  <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed">Peringatan: Data tersimpan secara lokal di browser ini. Gunakan satu perangkat utama.</p>
               </div>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 md:p-12 bg-white">
            <h2 className="text-3xl font-black text-slate-900 mb-8">Portal Login</h2>
            
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => { setLoginTab(tab); setSelectedUser(null); setLoginError(''); }}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    loginTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'SECURITY' ? 'Satpam' : tab === 'ADMIN' ? 'Admin' : 'Warga'}
                </button>
              ))}
            </div>

            <form onSubmit={handleAttemptLogin} className="space-y-6">
              <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                {userPool.length > 0 ? userPool.map((u: any) => (
                  <button 
                    key={u.id}
                    type="button"
                    onClick={() => { setSelectedUser(u); setLoginError(''); }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                      selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50' : 'border-slate-50 bg-slate-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-slate-900 text-sm">{u.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{u.sub || u.role}</p>
                    </div>
                    {selectedUser?.id === u.id && <CheckCircle size={20} className="text-amber-500"/>}
                  </button>
                )) : (
                  <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 font-bold text-xs uppercase italic">Belum ada data terdaftar</div>
                )}
              </div>

              {selectedUser && (
                <div className="space-y-4 pt-4 animate-slide-up">
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    <input 
                      type="password" 
                      required 
                      placeholder="Input PIN Keamanan"
                      className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-lg" 
                      value={passwordInput} 
                      onChange={e => setPasswordInput(e.target.value)} 
                    />
                  </div>
                  {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center">{loginError}</p>}
                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
                  >
                    Masuk Sekarang <ArrowRight size={18} />
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
      
      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-slide-up">
          {currentUser.role === 'RESIDENT' && (
            <div className="bg-red-600 p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
               <div className="flex items-center gap-6">
                 <div className="bg-white/20 p-4 rounded-3xl"><BellRing size={32} className="animate-bounce" /></div>
                 <div>
                    <h3 className="text-xl font-black mb-1 uppercase tracking-tighter">Bantuan SOS Mendadak?</h3>
                    <p className="text-xs text-red-100 font-medium opacity-90">Tekan tombol untuk memanggil petugas ke lokasi Anda sekarang.</p>
                 </div>
               </div>
               <button onClick={handleEmergencySOS} className="bg-white text-red-600 px-10 py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">PANGGIL SOS</button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { label: 'Total Patroli', val: patrolLogs.length, icon: <Activity size={24}/>, color: 'amber' },
              { label: 'Insiden Aktif', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Terdaftar', val: guests.filter(g => g.status === 'IN').length, icon: <Users size={24}/>, color: 'blue' },
              { label: 'Hunian Unit', val: residents.filter(r => r.isHome).length, icon: <Home size={24}/>, color: 'green' }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  stat.color === 'amber' ? 'bg-amber-50 text-amber-600' : 
                  stat.color === 'red' ? 'bg-red-50 text-red-600' : 
                  stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}>{stat.icon}</div>
                <h3 className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">{stat.label}</h3>
                <p className="text-2xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-3">
                <TrendingUp size={22} className="text-amber-500"/> Statistik Keamanan
              </h3>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="incidents" radius={[6, 6, 6, 6]} barSize={40}>
                      {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#10B981'][index % 3]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] flex flex-col justify-between">
              <div>
                <h3 className="font-black text-xl mb-6 flex items-center gap-3"><Shield size={28} className="text-amber-500"/> Briefing Hari Ini</h3>
                <p className="text-slate-400 text-sm italic leading-relaxed">"{securityBriefing || 'Tetap waspada dan layani warga dengan sepenuh hati.'}"</p>
              </div>
              <button 
                onClick={() => setActiveTab(currentUser.role === 'RESIDENT' ? 'incident' : 'patrol')} 
                className="w-full bg-amber-500 text-slate-900 font-black py-4 rounded-xl mt-8 text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                Mulai Tugas <ArrowRight size={18}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PATROL TAB */}
      {activeTab === 'patrol' && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-slate-900">Kendali Patroli</h3>
            {currentUser.role === 'ADMIN' && (
              <button onClick={() => setIsModalOpen('CHECKPOINT_MGR')} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2"><Plus size={18}/> POS BARU</button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {checkpoints.map((cp, idx) => {
              const lastLog = patrolLogs.filter(log => log.checkpoint === cp)[0];
              return (
                <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">{idx + 1}</div>
                    {lastLog && <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${lastLog.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{lastLog.status}</span>}
                  </div>
                  <h4 className="text-lg font-black text-slate-900 mb-8">{cp}</h4>
                  {currentUser.role === 'SECURITY' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'OK' })} className="py-4 bg-green-500 text-white rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all">AMAN</button>
                      <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'DANGER' })} className="py-4 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all">BAHAYA</button>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                      Update: {lastLog ? `${lastLog.securityName} (${new Date(lastLog.timestamp).toLocaleTimeString()})` : 'Belum Ada Data'}
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
        <div className="space-y-6 animate-slide-up">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-slate-900">Laporan Insiden</h3>
            <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 active:scale-95 transition-all"><AlertTriangle size={18}/> LAPOR BARU</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
            {incidents.length > 0 ? incidents.map(inc => (
              <div key={inc.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 ${inc.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${inc.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{inc.severity} Severity</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(inc.timestamp).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-2">{inc.type}</h4>
                  <p className="text-xs text-slate-400 font-bold mb-4 flex items-center gap-1"><MapPin size={12}/> {inc.location}</p>
                  <p className="text-sm text-slate-600 leading-relaxed italic mb-8">"{inc.description}"</p>
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">{inc.reporterName.charAt(0)}</div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 leading-none mb-1">{inc.reporterName}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">Pelapor</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase ${inc.status === 'RESOLVED' ? 'text-green-500' : 'text-amber-500'}`}>{inc.status}</span>
                </div>
              </div>
            )) : <div className="lg:col-span-2 py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-center text-slate-300 font-black uppercase italic tracking-widest">Aman Terkendali, Tidak Ada Laporan</div>}
          </div>
        </div>
      )}

      {/* RESIDENTS TAB */}
      {activeTab === 'residents' && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-2xl font-black text-slate-900">Database Warga</h3>
            <div className="flex gap-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input type="text" placeholder="Cari..." className="pl-12 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm outline-none focus:border-amber-500" value={residentSearch} onChange={e => setResidentSearch(e.target.value)} />
              </div>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => { setEditingItem(null); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white p-3 rounded-xl shadow-lg active:scale-95 transition-all"><Plus size={24}/></button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
            {residents.filter(r => r.name.toLowerCase().includes(residentSearch.toLowerCase())).map(res => (
              <div key={res.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-900 flex items-center justify-center font-black text-sm border border-slate-100">{res.block}</div>
                    <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{res.isHome ? 'DI UNIT' : 'LUAR AREA'}</span>
                  </div>
                  <h4 className="font-black text-slate-900 leading-tight mb-1">{res.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Unit: <span className="text-slate-900">{res.houseNumber}</span></p>
                </div>
                <div className="mt-6 flex gap-2">
                  <a href={`tel:${res.phoneNumber}`} className="flex-1 py-3 bg-green-500 text-white rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-all"><Phone size={18}/></a>
                  {currentUser.role === 'ADMIN' && (
                    <button onClick={() => { setEditingItem(res); setResidentForm(res); setIsModalOpen('RESIDENT'); }} className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:text-amber-500 transition-colors"><Edit2 size={18}/></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GUESTS TAB */}
      {activeTab === 'guests' && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-slate-900">Buku Tamu</h3>
            <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 active:scale-95 transition-all"><UserPlus size={18}/> DAFTAR TAMU</button>
          </div>
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto pb-20">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Nama Tamu</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Tujuan</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Waktu Masuk</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {guests.map(g => (
                  <tr key={g.id}>
                    <td className="px-8 py-4 font-bold text-slate-900">{g.name}</td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-500">{g.visitToName}</td>
                    <td className="px-8 py-4"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{g.status}</span></td>
                    <td className="px-8 py-4 text-[10px] font-black text-slate-400">{new Date(g.entryTime).toLocaleTimeString()}</td>
                    <td className="px-8 py-4 text-right">
                       {g.status === 'IN' && (
                         <button onClick={() => setGuests(prev => prev.map(item => item.id === g.id ? {...item, status: 'OUT'} : item))} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={16}/></button>
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
        <div className="max-w-4xl mx-auto h-[calc(100vh-250px)] flex flex-col animate-slide-up pb-20">
           <div className="flex-1 bg-white rounded-t-[2.5rem] shadow-sm border border-slate-100 overflow-y-auto p-6 space-y-4 no-scrollbar">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-4 rounded-[1.5rem] ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-4 mb-1">
                        <span className="text-[9px] font-black uppercase opacity-60">{msg.senderName}</span>
                        <span className="text-[8px] font-bold px-2 py-0.5 bg-white/10 rounded-full">{msg.senderRole}</span>
                      </div>
                      <p className="text-sm font-medium">{msg.text}</p>
                      <p className="text-[8px] mt-2 opacity-40 text-right">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              ))}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={handleSendChat} className="bg-white p-4 rounded-b-[2.5rem] border-t border-slate-100 flex gap-3">
              <input type="text" placeholder="Ketik pesan koordinasi..." className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-4 rounded-2xl active:scale-95 transition-all"><Send size={22}/></button>
           </form>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto space-y-6 animate-slide-up pb-20">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900 mb-10">Setelan Akun</h3>
            <div className="space-y-10">
              <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-3xl font-black">{currentUser.name.charAt(0)}</div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">{currentUser.name}</h4>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{currentUser.role} Kawasan TKA</p>
                </div>
              </div>
              {currentUser.role === 'SECURITY' && (
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <h5 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-1">Berbagi Lokasi GPS</h5>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Aktifkan agar admin dapat memantau posisi patroli.</p>
                  </div>
                  <button onClick={() => setIsGpsEnabled(!isGpsEnabled)} className={`w-12 h-6 rounded-full p-1 transition-all ${isGpsEnabled ? 'bg-green-500' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isGpsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>
              )}
              <div className="pt-10 border-t border-slate-100">
                <button onClick={handleLogout} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all"><LogOut size={18}/> Keluar Aplikasi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up">
            <div className="p-8 bg-[#0F172A] text-white flex justify-between items-center rounded-t-[2.5rem]">
              <h3 className="text-xl font-black">{editingItem ? 'Edit Warga' : 'Registrasi Warga'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveResident} className="p-8 space-y-5">
              <input type="text" required placeholder="Nama Lengkap..." className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.name} onChange={e => setResidentForm({...residentForm, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.block} onChange={e => setResidentForm({...residentForm, block: e.target.value})}>
                  {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <input type="text" required placeholder="No. Rumah" className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.houseNumber} onChange={e => setResidentForm({...residentForm, houseNumber: e.target.value})} />
              </div>
              <input type="tel" required placeholder="WhatsApp (Contoh: 0812...)" className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.phoneNumber} onChange={e => setResidentForm({...residentForm, phoneNumber: e.target.value})} />
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                 <p className="text-[10px] font-black text-amber-600 uppercase mb-2">Login Credentials:</p>
                 <p className="text-xs font-bold text-slate-700">User: <span className="font-black">{residentForm.name || '...'}</span></p>
                 <p className="text-xs font-bold text-slate-700">PIN Default: <span className="font-black">wargatka123456</span></p>
              </div>
              <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] shadow-lg">SIMPAN DATA</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up">
            <div className="p-8 bg-blue-600 text-white flex justify-between items-center rounded-t-[2.5rem]">
              <h3 className="text-xl font-black">Registrasi Tamu</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveGuest} className="p-8 space-y-4">
              <input type="text" required placeholder="Nama Tamu..." className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                  <option value="">-- Pilih Tujuan (Warga) --</option>
                  {residents.map(r => <option key={r.id} value={r.id}>Blok {r.block} No. {r.houseNumber} - {r.name}</option>)}
              </select>
              <textarea required placeholder="Keperluan Kunjungan..." className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[100px] text-sm" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg">KONFIRMASI MASUK</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up">
            <div className="p-8 bg-red-600 text-white flex justify-between items-center rounded-t-[2.5rem]">
              <h3 className="text-xl font-black">Lapor Kejadian</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={handleIncidentSubmit} className="p-8 space-y-4">
              <select required className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value})}>
                <option value="Kriminalitas">Kriminalitas / Pencurian</option>
                <option value="Kebakaran">Kebakaran / Korsleting</option>
                <option value="Kecurigaan">Orang Mencurigakan</option>
                <option value="Fasilitas">Fasilitas Rusak</option>
              </select>
              <input type="text" required placeholder="Lokasi Spesifik..." className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={incidentForm.location} onChange={e => setIncidentForm({...incidentForm, location: e.target.value})} />
              <textarea required placeholder="Jelaskan detail kejadian..." className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[120px] text-sm" value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} />
              <button type="submit" disabled={isAnalyzing} className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2">
                {isAnalyzing ? <Clock size={16} className="animate-spin" /> : <Send size={16}/>} KIRIM LAPORAN
              </button>
            </form>
          </div>
        </div>
      )}

      {patrolActionState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up">
            <div className={`p-8 text-white flex justify-between items-center rounded-t-[2.5rem] ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-xl font-black">{patrolActionState.checkpoint}</h3>
                <p className="text-[10px] font-bold uppercase opacity-80 tracking-widest">Status: {patrolActionState.status}</p>
              </div>
              <button onClick={() => setPatrolActionState(null)}><X size={24}/></button>
            </div>
            <div className="p-8 space-y-6">
              <textarea placeholder="Tambah catatan patroli (opsional)..." className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[100px] text-sm" value={patrolActionNote} onChange={e => setPatrolActionNote(e.target.value)} />
              <button onClick={handleSavePatrol} className={`w-full py-4 text-white rounded-xl font-black uppercase text-[10px] shadow-lg ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>SIMPAN STATUS</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen === 'SOS_MODAL' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-600 animate-pulse">
           <div className="text-center text-white px-10">
              <div className="bg-white text-red-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl">
                 <BellRing size={48} />
              </div>
              <h1 className="text-4xl font-black mb-4 uppercase tracking-tighter">SINYAL SOS DIKIRIM!</h1>
              <p className="text-lg font-bold opacity-90 leading-tight">Petugas keamanan segera menuju lokasi Anda.<br/>Harap tetap tenang dan mencari tempat aman.</p>
           </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
