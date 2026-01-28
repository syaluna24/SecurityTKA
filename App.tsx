
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  SECURITY_USERS, 
  ADMIN_USERS, 
  RESIDENT_USERS, 
  MOCK_RESIDENTS,
  BLOCKS,
  CHECKPOINTS as INITIAL_CHECKPOINTS 
} from './constants.tsx';
import { User, PatrolLog, IncidentReport, Resident, GuestLog, ChatMessage, SecurityLocation } from './types.ts';
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
  Camera,
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
  Download,
  Navigation,
  PhoneCall,
  BellRing,
  MoreVertical,
  ChevronRight,
  Map as MapIcon,
  Settings2
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing, generateWeeklySummary } from './services/geminiService.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  
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
  const [securityLocations, setSecurityLocations] = useState<SecurityLocation[]>(() => {
    const saved = localStorage.getItem('tka_security_locations');
    return saved ? JSON.parse(saved) : [];
  });

  // UI States
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'GUEST' | 'INCIDENT' | 'CHECKPOINT_MGR' | 'WEEKLY_REPORT' | 'SOS_MODAL' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [residentForm, setResidentForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '', photo: '' });
  const [incidentForm, setIncidentForm] = useState({ type: 'Kriminalitas', location: '', description: '', photo: '' });
  const [checkpointForm, setCheckpointForm] = useState({ name: '', oldName: '' });
  const [patrolActionState, setPatrolActionState] = useState<{checkpoint: string, status: 'OK' | 'WARNING' | 'DANGER'} | null>(null);
  const [patrolActionPhoto, setPatrolActionPhoto] = useState<string>('');
  const [patrolActionNote, setPatrolActionNote] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [weeklyReportContent, setWeeklyReportContent] = useState<string>('');
  const [securityBriefing, setSecurityBriefing] = useState<string>('');
  const [residentSearch, setResidentSearch] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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

  // GPS Tracking Logic
  useEffect(() => {
    let watchId: number | null = null;
    if (isGpsEnabled && currentUser?.role === 'SECURITY') {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const newLoc: SecurityLocation = {
              userId: currentUser.id,
              userName: currentUser.name,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              lastUpdated: new Date().toISOString()
            };
            setSecurityLocations(prev => {
              const others = prev.filter(l => l.userId !== currentUser.id);
              return [...others, newLoc];
            });
          },
          (err) => console.error("GPS Error:", err),
          { enableHighAccuracy: true }
        );
      }
    } else if (currentUser?.role === 'SECURITY') {
      setSecurityLocations(prev => prev.filter(l => l.userId !== currentUser.id));
    }
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [isGpsEnabled, currentUser]);

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

  // Handlers
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
    const isValid = (selectedUser.role === 'SECURITY' && pass === '123456') || 
                  (selectedUser.role === 'ADMIN' && pass === 'admin123') ||
                  (selectedUser.role === 'RESIDENT' && pass === 'wargatka123456');

    if (isValid) {
      setCurrentUser(selectedUser);
      setActiveTab('dashboard');
      setLoginError('');
      setPasswordInput('');
    } else {
      setLoginError('PIN Keamanan Salah!');
    }
  };

  const handleSaveCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkpointForm.oldName) {
      // Edit mode
      setCheckpoints(prev => prev.map(cp => cp === checkpointForm.oldName ? checkpointForm.name : cp));
    } else {
      // Add mode
      if (!checkpoints.includes(checkpointForm.name)) {
        setCheckpoints(prev => [...prev, checkpointForm.name]);
      }
    }
    setIsModalOpen(null);
    setCheckpointForm({ name: '', oldName: '' });
  };

  const handleDeleteCheckpoint = (name: string) => {
    if (confirm(`Hapus pos patroli "${name}"?`)) {
      setCheckpoints(prev => prev.filter(cp => cp !== name));
    }
  };

  const handleSaveResident = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      setResidents(prev => prev.map(r => r.id === editingItem.id ? { ...r, ...residentForm } as Resident : r));
    } else {
      const newResident: Resident = {
        id: Date.now().toString(),
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
      status: 'IN',
      photo: guestForm.photo
    };
    setGuests(prev => [newGuest, ...prev]);
    setIsModalOpen(null);
    setGuestForm({ name: '', visitToId: '', purpose: '', photo: '' });
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsAnalyzing(true);
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    try {
      const analysis = await analyzeIncident(incidentForm.description);
      if (analysis?.severity) severity = analysis.severity;
    } catch (err) { console.error(err); }
    const newIncident: IncidentReport = {
      id: Date.now().toString(),
      reporterId: currentUser.id,
      reporterName: currentUser.name,
      timestamp: new Date().toISOString(),
      type: incidentForm.type,
      location: incidentForm.location,
      description: incidentForm.description,
      status: 'PENDING',
      severity,
      photo: incidentForm.photo
    };
    setIncidents(prev => [newIncident, ...prev]);
    setIsAnalyzing(false);
    setIsModalOpen(null);
    setIncidentForm({ type: 'Kriminalitas', location: '', description: '', photo: '' });
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
      note: patrolActionNote || 'Area aman terkendali.',
      photo: patrolActionPhoto
    };
    setPatrolLogs(prev => [newLog, ...prev]);
    setPatrolActionState(null);
    setPatrolActionPhoto('');
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
      description: `SINYAL DARURAT DIKIRIM OLEH ${currentUser.name.toUpperCase()}. MEMBUTUHKAN BANTUAN SEGERA!`,
      status: 'PENDING',
      severity: 'HIGH'
    };
    setIncidents(prev => [sosIncident, ...prev]);
    setIsModalOpen('SOS_MODAL');
    setTimeout(() => setIsModalOpen(null), 3000);
  };

  // Views rendering
  if (!currentUser) {
    const userPool = loginTab === 'SECURITY' ? SECURITY_USERS : loginTab === 'ADMIN' ? ADMIN_USERS : RESIDENT_USERS;
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[1000px] flex flex-col md:flex-row rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
          <div className="w-full md:w-5/12 bg-[#0F172A] p-10 flex flex-col justify-between text-white">
            <div>
              <div className="bg-amber-500 w-16 h-16 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-amber-500/20">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-4xl font-black leading-tight mb-6">TKA SECURE<br/>SYSTEM</h1>
              <p className="text-slate-400 text-sm leading-relaxed opacity-80">
                Sistem Keamanan Terintegrasi Kawasan TKA.<br/>Layanan Shift 24 Jam Pagi & Malam.
              </p>
            </div>
            <div className="pt-8 border-t border-slate-800 flex items-center gap-3">
               <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Server Connected</span>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 md:p-12 bg-white">
            <h2 className="text-3xl font-black text-slate-900 mb-2">Portal Login</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">Pilih identitas untuk mengakses sistem</p>

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
              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto no-scrollbar pr-1">
                {userPool.map((u) => (
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
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{u.role}</p>
                    </div>
                    {selectedUser?.id === u.id && <CheckCircle size={20} className="text-amber-500"/>}
                  </button>
                ))}
              </div>

              {selectedUser && (
                <div className="space-y-4 pt-4 animate-slide-up">
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    <input 
                      type="password" 
                      required 
                      placeholder="Input PIN Keamanan"
                      className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-lg tracking-widest" 
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
      
      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-slide-up">
          {currentUser.role === 'RESIDENT' && (
            <div className="bg-red-600 p-6 md:p-8 rounded-[2rem] text-white shadow-xl shadow-red-200 flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
               <div className="flex items-center gap-6">
                 <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-sm"><BellRing size={32} className="animate-bounce" /></div>
                 <div>
                    <h3 className="text-xl font-black mb-1">Butuh Bantuan Mendesak?</h3>
                    <p className="text-xs text-red-100 font-medium opacity-90">Tekan tombol SOS untuk memanggil tim keamanan terdekat ke lokasi Anda.</p>
                 </div>
               </div>
               <button 
                onClick={handleEmergencySOS}
                className="bg-white text-red-600 px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-transform whitespace-nowrap"
               >
                 Panggil SOS
               </button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { label: 'Total Patroli', val: patrolLogs.length, icon: <Activity size={24}/>, color: 'amber' },
              { label: 'Insiden Aktif', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Terdaftar', val: guests.filter(g => g.status === 'IN').length, icon: <Users size={24}/>, color: 'blue' },
              { label: 'Warga Di Unit', val: residents.filter(r => r.isHome).length, icon: <Home size={24}/>, color: 'green' }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-5 md:p-7 rounded-3xl shadow-sm border border-slate-100">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-4 ${
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
            <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-3">
                <TrendingUp size={22} className="text-amber-500"/> Tren Keamanan Blok
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 10}} />
                    <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="incidents" radius={[6, 6, 6, 6]} barSize={35}>
                      {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#10B981'][index % 3]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-8 md:p-10 rounded-[2.5rem] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Shield size={28} className="text-amber-500"/>
                  <h3 className="font-black text-xl">Briefing</h3>
                </div>
                <p className="text-slate-400 text-sm italic font-medium">"{securityBriefing || 'Mengambil data briefing...'}"</p>
              </div>
              <button 
                onClick={() => setActiveTab(currentUser?.role === 'RESIDENT' ? 'incident' : 'patrol')} 
                className="w-full bg-amber-500 text-slate-900 font-black py-4 rounded-xl mt-8 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {currentUser?.role === 'RESIDENT' ? 'Lapor Kejadian' : 'Mulai Tugas'} <ArrowRight size={18}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PATROL TAB */}
      {activeTab === 'patrol' && (
        <div className="space-y-6 animate-slide-up pb-20">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-black text-slate-900">Kendali Patroli</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manajemen Pos Keamanan</p>
            </div>
            {currentUser.role === 'ADMIN' && (
              <button 
                onClick={() => { setCheckpointForm({ name: '', oldName: '' }); setIsModalOpen('CHECKPOINT_MGR'); }}
                className="bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 active:scale-95 shadow-lg transition-all"
              >
                <Plus size={18}/> TAMBAH POS
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {checkpoints.map((cp, idx) => {
              const lastLog = patrolLogs.filter(log => log.checkpoint === cp)[0];
              return (
                <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg group-hover:scale-110 transition-transform">
                      {idx + 1}
                    </div>
                    <div className="flex gap-2">
                       {currentUser.role === 'ADMIN' && (
                         <>
                            <button onClick={() => { setCheckpointForm({ name: cp, oldName: cp }); setIsModalOpen('CHECKPOINT_MGR'); }} className="p-2 text-slate-300 hover:text-blue-500 transition-colors"><Edit2 size={16}/></button>
                            <button onClick={() => handleDeleteCheckpoint(cp)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                         </>
                       )}
                       {lastLog && (
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${lastLog.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {lastLog.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <h4 className="text-lg font-black text-slate-900 mb-8">{cp}</h4>
                  
                  {currentUser.role === 'SECURITY' && (
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setPatrolActionState({ checkpoint: cp, status: 'OK' })}
                        className="py-3 bg-green-500 text-white rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                      >
                        <CheckCircle size={16}/> Aman
                      </button>
                      <button 
                        onClick={() => setPatrolActionState({ checkpoint: cp, status: 'WARNING' })}
                        className="py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                      >
                        <AlertTriangle size={16}/> Bahaya
                      </button>
                    </div>
                  )}
                  {currentUser.role === 'ADMIN' && lastLog && (
                    <div className="pt-4 border-t border-slate-50">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Update Terakhir:</p>
                       <p className="text-[9px] font-black text-slate-700">{lastLog.securityName} - {new Date(lastLog.timestamp).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REPORTS TAB (Resident Specific) */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-slide-up pb-20">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Laporan Kawasan</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Informasi Keamanan untuk Warga</p>
            
            <div className="space-y-8">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity size={18} className="text-blue-500"/> Status Patroli Terakhir
                </h4>
                <div className="space-y-3">
                  {patrolLogs.slice(0, 3).map(log => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <MapPin size={14} className="text-slate-400"/>
                        <span className="text-xs font-bold text-slate-700">{log.checkpoint}</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500"/> Ringkasan Keamanan (AI)
                </h4>
                <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-medium italic">
                  "Sistem mendeteksi aktivitas patroli berjalan normal. Area gerbang utama dipantau lebih ketat karena volume tamu yang meningkat hari ini. Tetap waspada dan pastikan pagar terkunci saat malam hari."
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INCIDENT TAB */}
      {activeTab === 'incident' && (
        <div className="space-y-6 animate-slide-up pb-20">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-black text-slate-900">Log Insiden</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pantau & Lapor Kejadian</p>
            </div>
            <button 
              onClick={() => setIsModalOpen('INCIDENT')}
              className="bg-red-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 active:scale-95 shadow-xl transition-all"
            >
              <AlertTriangle size={18}/> LAPOR KEJADIAN
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {incidents.length > 0 ? incidents.map(inc => (
              <div key={inc.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-lg transition-all">
                <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 ${inc.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${inc.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      {inc.severity} Severity
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(inc.timestamp).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-2">{inc.type}</h4>
                  <p className="text-xs text-slate-400 font-bold mb-4 flex items-center gap-1"><MapPin size={12}/> {inc.location}</p>
                  <p className="text-sm text-slate-600 leading-relaxed mb-8 italic">"{inc.description}"</p>
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-[10px] uppercase">{inc.reporterName.charAt(0)}</div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 leading-none mb-1">{inc.reporterName}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">Pelapor</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Status:</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${inc.status === 'RESOLVED' ? 'text-green-500' : 'text-amber-500'}`}>{inc.status}</span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="lg:col-span-2 py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                <Activity size={48} className="mb-4 opacity-20"/>
                <p className="font-bold text-sm uppercase tracking-widest">Belum ada laporan insiden hari ini</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB WARGA (DATABASE) */}
      {activeTab === 'residents' && (
        <div className="space-y-6 animate-slide-up pb-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-slate-900">Database Warga</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Informasi Hunian Area TKA</p>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input 
                  type="text" 
                  placeholder="Cari..." 
                  className="pl-12 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm focus:border-amber-500 outline-none" 
                  value={residentSearch} 
                  onChange={e => setResidentSearch(e.target.value)} 
                />
              </div>
              {currentUser.role === 'ADMIN' && (
                <button 
                  onClick={() => { setEditingItem(null); setIsModalOpen('RESIDENT'); }}
                  className="bg-slate-900 text-white p-3 rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  <Plus size={24}/>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {residents
              .filter(r => r.name.toLowerCase().includes(residentSearch.toLowerCase()) || r.houseNumber.includes(residentSearch))
              .map(res => (
                <div key={res.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-900 flex items-center justify-center font-black text-sm border border-slate-100">{res.block}</div>
                      <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                        {res.isHome ? 'DI UNIT' : 'LUAR AREA'}
                      </span>
                    </div>
                    <h4 className="font-black text-slate-900 leading-tight">{res.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Unit: <span className="text-slate-900">{res.houseNumber}</span></p>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <a href={`tel:${res.phoneNumber}`} className="flex-1 py-3 bg-green-500 text-white rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-all">
                      <Phone size={18}/>
                    </a>
                    {currentUser.role === 'ADMIN' && (
                      <button 
                        onClick={() => { setEditingItem(res); setResidentForm(res); setIsModalOpen('RESIDENT'); }}
                        className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:text-amber-500 transition-colors"
                      >
                        <Edit2 size={18}/>
                      </button>
                    )}
                  </div>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB TAMU */}
      {activeTab === 'guests' && (
        <div className="space-y-6 animate-slide-up pb-20">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-slate-900">Log Buku Tamu</h3>
            <button 
              onClick={() => setIsModalOpen('GUEST')}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 active:scale-95 transition-transform"
            >
              <UserPlus size={18}/> REGISTRASI
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Tamu</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Tujuan</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {guests.length > 0 ? guests.map(g => (
                  <tr key={g.id} className="hover:bg-slate-50/30">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">{g.name.charAt(0)}</div>
                        <span className="font-bold text-slate-900 text-sm">{g.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-600">{g.visitToName}</td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                          {g.status === 'IN' ? 'DI DALAM' : 'OUT'}
                        </span>
                        {g.status === 'IN' && (
                          <button 
                            onClick={() => setGuests(prev => prev.map(item => item.id === g.id ? {...item, status: 'OUT', exitTime: new Date().toISOString()} : item))}
                            className="text-slate-300 hover:text-amber-500"
                          >
                            <LogOut size={16}/>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase">
                      {new Date(g.entryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-8 py-12 text-center text-slate-300 italic text-sm">Belum ada kunjungan tamu hari ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CHAT */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-250px)] md:h-[calc(100vh-220px)] flex flex-col animate-slide-up pb-10">
           <div className="flex-1 bg-white rounded-t-[2.5rem] shadow-sm border border-slate-100 overflow-y-auto p-6 md:p-10 space-y-6 no-scrollbar shadow-inner">
              {chatMessages.length > 0 ? chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-5 rounded-[1.8rem] ${msg.senderId === currentUser?.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-4 mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{msg.senderName}</span>
                        <span className="text-[8px] font-bold px-2 py-0.5 bg-white/10 rounded-full">{msg.senderRole}</span>
                      </div>
                      <p className="text-xs md:text-sm font-medium leading-relaxed">{msg.text}</p>
                      <p className="text-[8px] mt-2 opacity-40 text-right">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : <div className="h-full flex items-center justify-center text-slate-300 italic font-bold">Kirim pesan koordinasi...</div>}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={handleSendChat} className="bg-white p-4 md:p-6 rounded-b-[2.5rem] border-t border-slate-100 flex gap-3 flex-shrink-0 mb-16 md:mb-0">
              <input type="text" placeholder="Ketik pesan..." className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-bold text-sm" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-4 rounded-2xl active:scale-95 transition-all"><Send size={22}/></button>
           </form>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-slide-up pb-20">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <h3 className="text-2xl font-black text-slate-900 mb-10 flex items-center gap-3">
              <Settings size={28} className="text-slate-400"/> Pengaturan Akun
            </h3>
            
            <div className="space-y-12">
              <div className="flex items-center gap-8 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-3xl font-black shadow-xl">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-xl font-black text-slate-900">{currentUser.name}</h4>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{currentUser.role} Kawasan TKA</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">ID Sistem: {currentUser.id}</p>
                </div>
              </div>

              {currentUser.role === 'SECURITY' && (
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <h5 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-1 flex items-center gap-2">
                      <Navigation size={16} className="text-blue-500"/> Bagikan Lokasi GPS
                    </h5>
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed max-w-md uppercase tracking-wider">Berbagi lokasi real-time dengan Admin untuk koordinasi tugas.</p>
                  </div>
                  <button 
                    onClick={() => setIsGpsEnabled(!isGpsEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 p-1 flex items-center ${isGpsEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform transform ${isGpsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>
              )}

              <div className="pt-10 border-t border-slate-100">
                <button 
                  onClick={handleLogout}
                  className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm"
                >
                  <LogOut size={18}/> Keluar Aplikasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}

      {/* Modal Checkpoint Manager (Admin Only) */}
      {isModalOpen === 'CHECKPOINT_MGR' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black">{checkpointForm.oldName ? 'Edit Pos' : 'Tambah Pos Patroli'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveCheckpoint} className="p-8 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nama Pos / Lokasi</label>
                <input 
                  type="text" 
                  required 
                  autoFocus
                  placeholder="Contoh: Pos Gerbang Utara..." 
                  className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" 
                  value={checkpointForm.name} 
                  onChange={e => setCheckpointForm({...checkpointForm, name: e.target.value})} 
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(null)} className="flex-1 font-black text-slate-400 uppercase text-[10px] tracking-widest">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">SIMPAN POS</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Warga */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-8 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-xl font-black">{editingItem ? 'Edit Data Warga' : 'Warga Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveResident} className="p-8 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nama Lengkap</label>
                <input type="text" required placeholder="Nama..." className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.name} onChange={e => setResidentForm({...residentForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Blok</label>
                  <select required className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.block} onChange={e => setResidentForm({...residentForm, block: e.target.value})}>
                    {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">No. Rumah</label>
                  <input type="text" required placeholder="00" className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.houseNumber} onChange={e => setResidentForm({...residentForm, houseNumber: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">No. Telp</label>
                <input type="tel" required placeholder="08..." className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.phoneNumber} onChange={e => setResidentForm({...residentForm, phoneNumber: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(null)} className="flex-1 font-black text-slate-400 uppercase text-[10px] tracking-widest">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">SIMPAN DATA</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tamu */}
      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black">Registrasi Tamu</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveGuest} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nama Tamu</label>
                <input type="text" required placeholder="Nama Lengkap..." className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tujuan (Warga)</label>
                <select required className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                   <option value="">-- Pilih Warga --</option>
                   {residents.map(r => <option key={r.id} value={r.id}>Blok {r.block} No. {r.houseNumber} - {r.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Keperluan</label>
                <textarea required placeholder="Keperluan kunjungan..." className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[80px] text-sm" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(null)} className="flex-1 font-black text-slate-400 uppercase text-[10px] tracking-widest">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">DAFTAR MASUK</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INSIDEN */}
      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-8 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black">Lapor Kejadian</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={handleIncidentSubmit} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Jenis Insiden</label>
                <select required className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value})}>
                  <option value="Kriminalitas">Kriminalitas / Pencurian</option>
                  <option value="Kebakaran">Kebakaran / Asap</option>
                  <option value="Kerusakan">Fasilitas Umum Rusak</option>
                  <option value="Kecurigaan">Orang / Aktivitas Mencurigakan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Lokasi Detail</label>
                <input type="text" required placeholder="Contoh: Depan Taman Blok A..." className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={incidentForm.location} onChange={e => setIncidentForm({...incidentForm, location: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Deskripsi Kejadian</label>
                <textarea required placeholder="Jelaskan kronologi singkat..." className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[100px] text-sm" value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(null)} className="flex-1 font-black text-slate-400 uppercase text-[10px] tracking-widest">Batal</button>
                <button type="submit" disabled={isAnalyzing} className="flex-[2] py-4 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2">
                  {isAnalyzing ? <Clock size={16} className="animate-spin"/> : <Send size={16}/>} KIRIM LAPORAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PATROL ACTION MODAL */}
      {patrolActionState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className={`p-8 text-white flex justify-between items-center ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-xl font-black">{patrolActionState.checkpoint}</h3>
                <p className="text-[10px] font-bold uppercase opacity-80 tracking-widest">Status: {patrolActionState.status}</p>
              </div>
              <button onClick={() => setPatrolActionState(null)}><X size={24}/></button>
            </div>
            <div className="p-8 space-y-6">
              <textarea placeholder="Tambah catatan patroli (opsional)..." className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[100px] text-sm" value={patrolActionNote} onChange={e => setPatrolActionNote(e.target.value)} />
              <div className="flex gap-4 pt-4">
                <button onClick={() => setPatrolActionState(null)} className="flex-1 font-black text-slate-400 uppercase text-[10px] tracking-widest">Batal</button>
                <button onClick={handleSavePatrol} className={`flex-[2] py-4 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>SIMPAN STATUS</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SOS MODAL */}
      {isModalOpen === 'SOS_MODAL' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-600 animate-pulse">
           <div className="text-center text-white px-10">
              <div className="bg-white text-red-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl">
                 <BellRing size={48} />
              </div>
              <h1 className="text-4xl font-black mb-4 uppercase tracking-tighter">DARURAT SOS!</h1>
              <p className="text-lg font-bold opacity-90">Sinyal bantuan telah disiarkan.<br/>Petugas keamanan terdekat segera meluncur.</p>
           </div>
        </div>
      )}

      {/* Global Preview Image */}
      {previewImage && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full">
            <img src={previewImage} className="w-full h-auto max-h-[85vh] object-contain rounded-3xl" />
            <button className="absolute -top-12 right-0 p-3 text-white"><X size={28}/></button>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
