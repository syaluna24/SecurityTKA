
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
  CheckCircle2, 
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
  Filter,
  Image as ImageIcon,
  Check,
  Activity,
  MessageSquare,
  BookOpen,
  ChevronRight,
  FileText,
  Sparkles,
  Download,
  ToggleRight,
  ToggleLeft,
  Navigation
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
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'GUEST' | 'INCIDENT' | 'CHECKPOINT_MGR' | 'WEEKLY_REPORT' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [residentForm, setResidentForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '', photo: '' });
  const [incidentForm, setIncidentForm] = useState({ type: 'Kriminalitas', location: '', description: '', photo: '' });
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
  const [newCheckpointName, setNewCheckpointName] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync Persistence
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
    } else if (!isGpsEnabled && currentUser?.role === 'SECURITY') {
      setSecurityLocations(prev => prev.filter(l => l.userId !== currentUser.id));
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isGpsEnabled, currentUser]);

  useEffect(() => {
    if (currentUser) {
      const isMorning = new Date().getHours() >= 7 && new Date().getHours() < 19;
      getSecurityBriefing(isMorning ? 'Pagi' : 'Malam').then(setSecurityBriefing);
    }
  }, [currentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      setLoginError('Akses Ditolak: PIN tidak sesuai.');
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setIsModalOpen('WEEKLY_REPORT');
    const stats = {
      totalPatrols: patrolLogs.length,
      totalIncidents: incidents.length,
      highSeverityIncidents: incidents.filter(i => i.severity === 'HIGH').length,
      averageOccupancy: Math.round((residents.filter(r => r.isHome).length / residents.length) * 100)
    };
    const report = await generateWeeklySummary(stats);
    setWeeklyReportContent(report);
    setIsGeneratingReport(false);
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

  const addCheckpoint = () => {
    if (newCheckpointName.trim() && !checkpoints.includes(newCheckpointName.trim())) {
      setCheckpoints(prev => [...prev, newCheckpointName.trim()]);
      setNewCheckpointName('');
    }
  };

  const deleteCheckpoint = (name: string) => {
    if (confirm(`Hapus checkpoint "${name}"?`)) setCheckpoints(prev => prev.filter(cp => cp !== name));
  };

  // Views
  if (!currentUser) {
    const userPool = loginTab === 'SECURITY' ? SECURITY_USERS : loginTab === 'ADMIN' ? ADMIN_USERS : RESIDENT_USERS;
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 md:p-12">
        <div className="bg-white w-full max-w-[1000px] flex flex-col md:flex-row rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
          <div className="w-full md:w-5/12 bg-[#0F172A] p-10 md:p-16 flex flex-col justify-between text-white relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
            <div>
              <div className="bg-amber-500 w-16 h-16 rounded-3xl flex items-center justify-center mb-10 shadow-xl shadow-amber-500/30">
                <Shield size={36} className="text-slate-900" />
              </div>
              <h1 className="text-4xl lg:text-5xl font-black tracking-tighter leading-none mb-8">TKA SECURE<br/>SYSTEM</h1>
              <p className="text-slate-400 font-medium italic text-sm leading-relaxed opacity-70">
                Solusi Keamanan Terpadu Kawasan TKA.<br/>Shift Kerja 12 Jam (Pagi & Malam).
              </p>
            </div>
            <div className="pt-8 border-t border-slate-800 flex items-center gap-3">
               <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.4)]"></div>
               <span className="text-xs font-black uppercase tracking-widest text-slate-500">System Monitoring Active</span>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 md:p-16 bg-white flex flex-col justify-center">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Login Portal</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Akses Portal Keamanan Perumahan</p>
            </div>

            <div className="flex p-1 bg-slate-100 rounded-2xl mb-10">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => { setLoginTab(tab); setSelectedUser(null); setLoginError(''); }}
                  className={`flex-1 py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                    loginTab === tab ? 'bg-white text-slate-900 shadow-xl scale-[1.02]' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'SECURITY' ? 'Satpam' : tab === 'ADMIN' ? 'Admin' : 'Warga'}
                </button>
              ))}
            </div>

            <form onSubmit={handleAttemptLogin} className="space-y-6">
              <div className="grid grid-cols-1 gap-3 max-h-[250px] overflow-y-auto pr-2 no-scrollbar p-1">
                {userPool.map((u) => (
                  <button 
                    key={u.id}
                    type="button"
                    onClick={() => { setSelectedUser(u); setLoginError(''); }}
                    className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all text-left ${
                      selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50 shadow-lg' : 'border-slate-50 hover:border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-slate-900 text-sm">{u.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{u.role}</p>
                    </div>
                    {selectedUser?.id === u.id && <Check className="text-amber-600" size={20}/>}
                  </button>
                ))}
              </div>

              {selectedUser && (
                <div className="animate-slide-up space-y-6 pt-4 border-t border-slate-50">
                  <div className="relative group">
                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-colors" size={24}/>
                    <input 
                      type="password" 
                      required 
                      autoFocus
                      placeholder="Input PIN Keamanan..."
                      className="w-full pl-16 pr-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-slate-900 text-lg transition-all shadow-inner tracking-[0.3em]" 
                      value={passwordInput} 
                      onChange={e => setPasswordInput(e.target.value)} 
                    />
                  </div>
                  {loginError && <p className="text-red-500 text-xs font-black uppercase text-center bg-red-50 py-3 rounded-xl border border-red-100">{loginError}</p>}
                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl hover:bg-slate-800 hover:-translate-y-1 transition-all active:scale-[0.98] flex items-center justify-center gap-4 text-sm tracking-widest uppercase"
                  >
                    Masuk Sekarang <ArrowRight size={22} />
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
        <div className="space-y-8 animate-slide-up">
          {/* Admin Specific GPS Monitor */}
          {currentUser.role === 'ADMIN' && (
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-3"><Navigation size={24} className="text-blue-500"/> Live Guard Tracking</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Peta Digital (Simulasi)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SECURITY_USERS.map(sec => {
                  const loc = securityLocations.find(l => l.userId === sec.id);
                  return (
                    <div key={sec.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">{sec.name.charAt(0)}</div>
                        <div>
                          <p className="text-xs font-black text-slate-900 leading-none mb-1">{sec.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{loc ? 'Terpantau GPS' : 'GPS Nonaktif'}</p>
                        </div>
                      </div>
                      {loc && <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Patroli', val: patrolLogs.length, icon: <Activity size={24}/>, color: 'amber' },
              { label: 'Insiden Aktif', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Terdaftar', val: guests.filter(g => g.status === 'IN').length, icon: <Users size={24}/>, color: 'blue' },
              { label: 'Warga Di Unit', val: residents.filter(r => r.isHome).length, icon: <Home size={24}/>, color: 'green' }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 transition-all hover:shadow-xl hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
                  stat.color === 'amber' ? 'bg-amber-50 text-amber-600' : 
                  stat.color === 'red' ? 'bg-red-50 text-red-600' : 
                  stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}>{stat.icon}</div>
                <h3 className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1">{stat.label}</h3>
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <TrendingUp size={24} className="text-amber-500"/> Ringkasan Keamanan Area
                </h3>
                {currentUser.role === 'ADMIN' && (
                  <button 
                    onClick={handleGenerateReport}
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
                  >
                    <Sparkles size={14} className="text-amber-400"/> Laporan Mingguan (AI)
                  </button>
                )}
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 800}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 800}} />
                    <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="incidents" radius={[12, 12, 12, 12]} barSize={50}>
                      {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#10B981'][index % 3]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-[80px] -mr-24 -mt-24"></div>
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <Shield size={32} className="text-amber-500"/>
                  <h3 className="font-black text-2xl tracking-tight">Briefing Keamanan</h3>
                </div>
                <p className="text-slate-400 text-base italic leading-relaxed font-medium">"{securityBriefing || 'Menyiapkan instruksi patroli...'}"</p>
              </div>
              <button 
                onClick={() => setActiveTab(currentUser?.role === 'RESIDENT' ? 'reports' : 'patrol')} 
                className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl mt-12 shadow-xl text-sm flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all"
              >
                {currentUser?.role === 'RESIDENT' ? 'Lihat Laporan' : 'Mulai Patroli'} <ArrowRight size={22}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-slide-up pb-20">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
            <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3"><Settings size={28} className="text-slate-400"/> Pengaturan Akun</h3>
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="w-24 h-24 rounded-3xl bg-slate-900 text-white flex items-center justify-center text-4xl font-black shadow-xl shadow-slate-200">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="text-xl font-black text-slate-900 leading-none">{currentUser.name}</h4>
                  <p className="text-xs font-black text-amber-600 uppercase tracking-widest leading-none">{currentUser.role} AREA TKA</p>
                  <p className="text-sm text-slate-400 font-medium">TKA Integrated Security System v1.0.2</p>
                </div>
              </div>

              {/* GPS Settings Card for Satpam */}
              {currentUser.role === 'SECURITY' && (
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner">
                  <div className="flex items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Navigation size={18} className="text-blue-500"/>
                        <h5 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Pelacakan Lokasi (GPS)</h5>
                      </div>
                      <p className="text-sm text-slate-500 font-medium max-w-md">Aktifkan untuk membagikan lokasi Anda kepada Admin selama bertugas untuk koordinasi keamanan yang lebih baik.</p>
                    </div>
                    <button 
                      onClick={() => setIsGpsEnabled(!isGpsEnabled)}
                      className={`relative w-16 h-10 rounded-full transition-all duration-300 p-1.5 flex items-center ${isGpsEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
                    >
                      <div className={`w-7 h-7 bg-white rounded-full shadow-lg transition-transform duration-300 transform ${isGpsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                  {isGpsEnabled && (
                    <div className="mt-6 flex items-center gap-3 text-green-600 bg-green-50 p-4 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-top-2">
                      <CheckCircle size={16}/>
                      <span className="text-[10px] font-black uppercase tracking-widest">Lokasi anda sedang dipantau oleh sistem</span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-8 border-t border-slate-100 flex flex-col gap-4">
                {/* Fixed: Use handleLogout instead of non-existent onLogout */}
                <button onClick={handleLogout} className="w-full py-5 bg-red-50 text-red-600 rounded-[2rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-red-100 transition-all">
                  <LogOut size={18}/> Keluar Dari Sistem
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-220px)] flex flex-col animate-slide-up pb-10">
           <div className="flex-1 bg-white rounded-t-[3rem] shadow-sm border border-slate-100 overflow-y-auto p-8 md:p-12 space-y-6 no-scrollbar shadow-inner">
              {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-6 rounded-[2rem] shadow-sm ${msg.senderId === currentUser?.id ? 'bg-slate-900 text-white rounded-tr-none shadow-slate-200' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100 shadow-slate-100'}`}>
                      <p className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-60 flex justify-between gap-10">
                        <span>{msg.senderName}</span>
                        <span>{msg.senderRole}</span>
                      </p>
                      <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                      <p className="text-[8px] mt-2 opacity-40 text-right">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : <div className="h-full flex items-center justify-center text-slate-300 italic font-bold">Mulai obrolan koordinasi keamanan...</div>}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={handleSendChat} className="bg-white p-6 rounded-b-[3rem] border-t border-slate-100 shadow-md flex gap-4 flex-shrink-0">
              <input type="text" placeholder="Tulis pesan koordinasi..." className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-slate-50 focus:border-amber-500 outline-none font-bold transition-all shadow-inner" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-xl hover:scale-105 active:scale-95 transition-all"><Send size={24}/></button>
           </form>
        </div>
      )}

      {/* OTHER TABS (Patrol, Reports, Guests, Residents, Incident) - Keep existing implementations but ensure they match types/styles */}
      {/* ... keeping the same structure as before for brevity ... */}
      
      {activeTab === 'patrol' && (
        <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-20">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Update Patroli</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Garda Keamanan Kawasan TKA</p>
            </div>
            {currentUser?.role === 'ADMIN' && (
              <button onClick={() => setIsModalOpen('CHECKPOINT_MGR')} className="bg-white text-slate-900 border-2 border-slate-100 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                <Settings size={14}/> Kelola Checkpoint
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {checkpoints.map((cp, idx) => (
              <div key={idx} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:border-amber-500/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-lg group-hover:scale-110 transition-transform">
                    {idx + 1}
                  </div>
                  <h4 className="font-black text-slate-900 text-base">{cp}</h4>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'OK' })} className="p-4 bg-green-50 text-green-600 rounded-2xl hover:bg-green-100 transition-colors">
                    <CheckCircle size={20}/>
                  </button>
                  <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'WARNING' })} className="p-4 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-100 transition-colors">
                    <AlertTriangle size={20}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
             <h4 className="font-black text-slate-900 text-xl mb-8 flex items-center gap-3"><Clock size={24}/> Riwayat Patroli Shift</h4>
             <div className="space-y-4">
                {patrolLogs.length > 0 ? patrolLogs.map(log => (
                   <div key={log.id} className="flex items-center gap-5 p-5 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${log.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                         <Activity size={20}/>
                      </div>
                      <div className="flex-1">
                         <h5 className="font-black text-slate-900">{log.checkpoint}</h5>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(log.timestamp).toLocaleTimeString()} • {log.securityName}</p>
                         <p className="text-xs text-slate-500 mt-1 italic">"{log.note}"</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {log.photo && <button onClick={() => setPreviewImage(log.photo!)} className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-sm"><img src={log.photo} className="w-full h-full object-cover"/></button>}
                        {currentUser?.role === 'ADMIN' && <button onClick={() => setPatrolLogs(prev => prev.filter(l => l.id !== log.id))} className="p-2 bg-white text-slate-300 hover:text-red-500 rounded-xl transition-all shadow-sm"><Trash2 size={18}/></button>}
                      </div>
                   </div>
                )) : <div className="py-20 text-center text-slate-300 font-bold italic">Belum ada aktivitas patroli.</div>}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-20">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Kinerja Security</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Transparansi Kinerja Untuk Warga</p>
            </div>
            <div className="bg-green-50 px-6 py-3 rounded-2xl border border-green-100 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-black text-green-700 uppercase tracking-widest">Kondisi Aman</span>
            </div>
          </div>
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
             <h4 className="font-black text-slate-900 text-xl mb-8 flex items-center gap-3"><Activity size={24} className="text-amber-500"/> Log Aktivitas Patroli Terakhir</h4>
             <div className="space-y-4">
                {patrolLogs.length > 0 ? patrolLogs.slice(0, 15).map(log => (
                  <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-5 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:bg-white transition-all">
                     <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${log.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                        {log.status === 'OK' ? <CheckCircle size={28}/> : <AlertTriangle size={28}/>}
                     </div>
                     <div className="flex-1">
                        <h5 className="font-black text-slate-900 text-lg">{log.checkpoint}</h5>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                           {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • Petugas: {log.securityName}
                        </p>
                        {log.note && <p className="text-sm text-slate-500 mt-2 font-medium italic">"{log.note}"</p>}
                     </div>
                     {log.photo && (
                       <button onClick={() => setPreviewImage(log.photo!)} className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-lg hover:scale-110 transition-transform">
                          <img src={log.photo} className="w-full h-full object-cover" />
                       </button>
                     )}
                  </div>
                )) : <div className="py-24 text-center text-slate-300 italic">Belum ada data patroli hari ini.</div>}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'guests' && (
        <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-20">
          <div className="flex justify-between items-center">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Log Buku Tamu</h3>
            <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-blue-200 hover:scale-105 transition-all">
              <UserPlus size={18}/> Registrasi Tamu
            </button>
          </div>
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
             <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                   <tr>
                      <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Tamu</th>
                      <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tujuan</th>
                      <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                      <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Aksi</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {guests.map(g => (
                     <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-10 py-6">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">{g.name.charAt(0)}</div>
                              <div><p className="font-black text-slate-900 text-sm">{g.name}</p><p className="text-[10px] text-slate-400 font-bold italic">{g.purpose}</p></div>
                           </div>
                        </td>
                        <td className="px-10 py-6"><p className="text-xs font-bold text-slate-500">{g.visitToName}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(g.entryTime).toLocaleTimeString()}</p></td>
                        <td className="px-10 py-6"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{g.status === 'IN' ? 'DI DALAM' : 'SUDAH KELUAR'}</span></td>
                        <td className="px-10 py-6">
                           {g.status === 'IN' && (
                             <button onClick={() => setGuests(prev => prev.map(item => item.id === g.id ? {...item, status: 'OUT', exitTime: new Date().toISOString()} : item))} className="text-slate-400 hover:text-amber-500 transition-colors"><LogOut size={20}/></button>
                           )}
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {activeTab === 'residents' && (
        <div className="max-w-7xl mx-auto space-y-10 animate-slide-up pb-24">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 mb-10">
                <div><h3 className="text-3xl font-black text-slate-900 tracking-tight">Database Warga</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Daftar Hunian Kawasan TKA</p></div>
                <div className="flex gap-4 w-full md:w-auto">
                   <div className="relative flex-1 md:w-80">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={24}/>
                      <input type="text" placeholder="Cari Nama / No. Rumah..." className="w-full pl-16 pr-8 py-5 rounded-[2.5rem] bg-slate-50 border-2 border-slate-50 focus:border-amber-500 outline-none font-bold shadow-inner transition-all" value={residentSearch} onChange={e => setResidentSearch(e.target.value)} />
                   </div>
                   {currentUser?.role === 'ADMIN' && (
                     <button onClick={() => { setEditingItem(null); setResidentForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white px-8 py-5 rounded-[2.5rem] font-black shadow-xl hover:scale-105 transition-all flex items-center gap-2"><Plus size={20}/> Tambah</button>
                   )}
                </div>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {residents.filter(r => r.name.toLowerCase().includes(residentSearch.toLowerCase())).map(res => (
                  <div key={res.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[3.5rem] hover:bg-white hover:shadow-2xl transition-all relative group shadow-sm">
                     {currentUser?.role === 'ADMIN' && (
                       <div className="absolute top-8 right-8 flex gap-2">
                          <button onClick={() => { setEditingItem(res); setResidentForm(res); setIsModalOpen('RESIDENT'); }} className="p-3 bg-white text-slate-300 rounded-2xl hover:text-amber-500 transition-all border border-slate-50 shadow-md"><Edit2 size={16}/></button>
                          <button onClick={() => { if(confirm('Hapus warga?')) setResidents(prev => prev.filter(r => r.id !== res.id)) }} className="p-3 bg-white text-slate-300 rounded-2xl hover:text-red-500 shadow-md transition-all border border-slate-50"><Trash2 size={16}/></button>
                       </div>
                     )}
                     <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-white text-slate-900 flex items-center justify-center font-black text-xl shadow-md border border-slate-100">{res.block}</div>
                        <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>{res.isHome ? 'ADA DI RUMAH' : 'DILUAR'}</span>
                     </div>
                     <h4 className="font-black text-slate-900 text-lg mb-1 leading-tight">{res.name}</h4>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Unit: <span className="text-slate-900">{res.houseNumber}</span></p>
                     <div className="flex gap-2">
                        <a href={`tel:${res.phoneNumber}`} className="flex-1 py-4 bg-green-500 text-white rounded-2xl flex items-center justify-center hover:bg-green-600 shadow-lg"><Phone size={20}/></a>
                        <button className="flex-2 py-4 bg-slate-900 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg">Detail</button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'incident' && (
        <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-20">
          <div className="flex justify-between items-center">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Laporan Insiden</h3>
            <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-red-200 hover:scale-105 transition-all">
              <AlertTriangle size={18}/> Laporkan Insiden
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {incidents.map(inc => (
              <div key={inc.id} className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-all relative">
                {currentUser?.role === 'ADMIN' && (
                  <button onClick={() => setIncidents(prev => prev.filter(i => i.id !== inc.id))} className="absolute top-8 right-10 p-3 bg-white text-slate-300 hover:text-red-500 rounded-xl transition-all shadow-md border border-slate-50"><Trash2 size={16}/></button>
                )}
                <div>
                   <div className="flex justify-between items-start mb-6">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${inc.severity === 'HIGH' ? 'bg-red-100 text-red-600' : inc.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>Status: {inc.severity}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(inc.timestamp).toLocaleDateString()}</span>
                   </div>
                   <h4 className="text-2xl font-black text-slate-900 mb-4">{inc.type}</h4>
                   <p className="text-slate-500 text-sm leading-relaxed mb-8 italic">"{inc.description}"</p>
                   <div className="flex items-center gap-2 text-slate-400 mb-8 bg-slate-50 p-4 rounded-2xl w-fit"><MapPin size={16} /><span className="text-xs font-black uppercase tracking-widest">{inc.location}</span></div>
                </div>
                <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                   <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-md">{inc.reporterName.charAt(0)}</div><span className="text-xs font-black text-slate-900">{inc.reporterName}</span></div>
                   <span className={`text-[10px] font-black uppercase tracking-widest ${inc.status === 'RESOLVED' ? 'text-green-500' : 'text-amber-500'}`}>{inc.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-2xl font-black">{editingItem ? 'Edit Data Warga' : 'Warga Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveResident} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Warga..." className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold" value={residentForm.name} onChange={e => setResidentForm({...residentForm, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                 <select required className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold" value={residentForm.block} onChange={e => setResidentForm({...residentForm, block: e.target.value})}>
                    {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                 </select>
                 <input type="text" required placeholder="No. Rumah" className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold" value={residentForm.houseNumber} onChange={e => setResidentForm({...residentForm, houseNumber: e.target.value})} />
              </div>
              <input type="tel" required placeholder="No. Telepon Aktif..." className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold" value={residentForm.phoneNumber} onChange={e => setResidentForm({...residentForm, phoneNumber: e.target.value})} />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(null)} className="flex-1 font-black text-slate-400 uppercase text-xs tracking-widest">Batal</button>
                <button type="submit" className="flex-2 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl tracking-widest">SIMPAN DATA</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-10 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black">Registrasi Tamu</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveGuest} className="p-10 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                 <option value="">Pilih Warga Tujuan</option>
                 {residents.map(r => <option key={r.id} value={r.id}>Blok {r.block} No. {r.houseNumber} - {r.name}</option>)}
              </select>
              <textarea placeholder="Keperluan..." className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[100px]" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(null)} className="flex-1 font-black text-slate-400 uppercase text-xs tracking-widest">Batal</button>
                <button type="submit" className="flex-2 py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl tracking-widest">Daftar Masuk</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {patrolActionState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className={`p-10 text-white flex justify-between items-center ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-amber-500'}`}>
              <h3 className="text-2xl font-black">{patrolActionState.checkpoint}</h3>
              <button onClick={() => setPatrolActionState(null)}><X size={28}/></button>
            </div>
            <div className="p-10 space-y-6">
              <textarea placeholder="Catatan kondisi (opsional)..." className="w-full px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[120px]" value={patrolActionNote} onChange={e => setPatrolActionNote(e.target.value)} />
              <label className="flex flex-col items-center justify-center p-8 border-3 border-dashed border-slate-100 rounded-[2rem] cursor-pointer hover:bg-slate-50 transition-all h-[180px] relative overflow-hidden">
                {patrolActionPhoto ? <img src={patrolActionPhoto} className="w-full h-full object-cover rounded-2xl" /> : <div className="text-center"><Camera className="text-slate-200 mx-auto" size={56}/><span className="text-[10px] font-black text-slate-300 uppercase mt-3 tracking-widest block">Ambil Foto Area</span></div>}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setPatrolActionPhoto(r.result as string); r.readAsDataURL(f); } }}/>
              </label>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setPatrolActionState(null)} className="flex-1 font-black text-slate-400 uppercase tracking-widest text-[10px]">Batal</button>
                <button onClick={handleSavePatrol} className={`flex-[2] py-5 text-white font-black rounded-[2rem] shadow-xl uppercase tracking-widest text-xs transition-all active:scale-95 ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-amber-600'}`}>Kirim Laporan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen === 'CHECKPOINT_MGR' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-2xl font-black">Kelola Checkpoint</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <div className="p-10 space-y-8">
              <div className="flex gap-4">
                <input type="text" placeholder="Nama checkpoint baru..." className="flex-1 px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold" value={newCheckpointName} onChange={e => setNewCheckpointName(e.target.value)} />
                <button onClick={addCheckpoint} className="p-4 bg-amber-500 text-slate-900 rounded-2xl hover:scale-105 active:scale-95 transition-all"><Plus size={28}/></button>
              </div>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                {checkpoints.map((cp, i) => (
                  <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <span className="font-black text-slate-700">{cp}</span>
                    <button onClick={() => deleteCheckpoint(cp)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setIsModalOpen(null)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Selesai</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen === 'WEEKLY_REPORT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            <div className="p-8 md:p-10 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-amber-500 p-2.5 rounded-2xl"><FileText className="text-slate-900" size={24}/></div>
                <div><h3 className="text-xl md:text-2xl font-black">Laporan Mingguan AI</h3><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Gemini Intelligence</p></div>
              </div>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 md:p-12 no-scrollbar">
              {isGeneratingReport ? (
                <div className="h-full flex flex-col items-center justify-center py-20 space-y-6">
                  <div className="relative"><div className="w-20 h-20 border-4 border-slate-100 border-t-amber-500 rounded-full animate-spin"></div><Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-500 animate-pulse" size={28}/></div>
                  <div className="text-center"><p className="font-black text-slate-900 text-lg">Menganalisis Data Keamanan...</p></div>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none">
                  <div className="bg-slate-50/50 p-8 rounded-[2.5rem] whitespace-pre-wrap font-medium text-slate-700 leading-relaxed text-sm md:text-base italic">{weeklyReportContent}</div>
                  <div className="mt-10 flex flex-col md:flex-row gap-4">
                    <button onClick={() => { const b = new Blob([weeklyReportContent], { type: 'text/plain' }); const url = window.URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = `Report_Security.txt`; a.click(); }} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl"><Download size={18}/> Unduh</button>
                    <button onClick={handleGenerateReport} className="flex-1 border-2 border-slate-100 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3"><Sparkles size={18} className="text-amber-500"/> Regenerate</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-10 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black">Lapor Kejadian</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleIncidentSubmit} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tipe Kejadian</label>
                <select required className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold" value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value})}>
                  <option value="Kriminalitas">Pencurian / Kriminal</option>
                  <option value="Gangguan">Gangguan Keamanan</option>
                  <option value="Kebakaran">Kebakaran / Bencana</option>
                  <option value="Kerusakan">Fasum Rusak</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Lokasi</label>
                <input type="text" required placeholder="Blok / No / Nama Jalan..." className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold" value={incidentForm.location} onChange={e => setIncidentForm({...incidentForm, location: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Keterangan</label>
                <textarea required placeholder="Jelaskan kronologi singkat..." className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[120px]" value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(null)} className="flex-1 font-black text-slate-400 uppercase text-xs tracking-widest">Batal</button>
                <button type="submit" disabled={isAnalyzing} className="flex-2 py-5 bg-red-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl tracking-widest flex items-center justify-center gap-2">{isAnalyzing ? <Clock className="animate-spin" size={16}/> : <Send size={16}/>} KIRIM</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Image Preview */}
      {previewImage && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full">
            <img src={previewImage} className="w-full h-auto max-h-[85vh] object-contain rounded-[2rem] shadow-2xl border-4 border-white/10" />
            <button className="absolute -top-14 right-0 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all backdrop-blur-md"><X size={24}/></button>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
