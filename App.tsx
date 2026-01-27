
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
    } else if (currentUser?.role === 'SECURITY') {
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
      
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-slide-up">
          {currentUser.role === 'ADMIN' && (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-3"><Navigation size={24} className="text-blue-500"/> Live GPS Monitor</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tracking Satpam</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SECURITY_USERS.map(sec => {
                  const loc = securityLocations.find(l => l.userId === sec.id);
                  return (
                    <div key={sec.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">{sec.name.charAt(0)}</div>
                        <div>
                          <p className="text-xs font-black text-slate-900 leading-none mb-1">{sec.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{loc ? 'Sinyal Aktif' : 'Sinyal Off'}</p>
                        </div>
                      </div>
                      {loc && <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { label: 'Total Patroli', val: patrolLogs.length, icon: <Activity size={24}/>, color: 'amber' },
              { label: 'Insiden Aktif', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Hari Ini', val: guests.filter(g => g.status === 'IN').length, icon: <Users size={24}/>, color: 'blue' },
              { label: 'Warga Di Area', val: residents.filter(r => r.isHome).length, icon: <Home size={24}/>, color: 'green' }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-5 md:p-7 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 transition-all hover:shadow-lg">
                <div className={`w-10 h-10 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-3 md:mb-5 ${
                  stat.color === 'amber' ? 'bg-amber-50 text-amber-600' : 
                  stat.color === 'red' ? 'bg-red-50 text-red-600' : 
                  stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}>{stat.icon}</div>
                <h3 className="text-slate-400 text-[9px] md:text-[11px] font-black uppercase tracking-widest mb-1">{stat.label}</h3>
                <p className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100 flex flex-col">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <TrendingUp size={24} className="text-amber-500"/> Ringkasan Area
                </h3>
              </div>
              <div className="h-[250px] md:h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 800}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 800}} />
                    <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="incidents" radius={[8, 8, 8, 8]} barSize={35}>
                      {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#10B981'][index % 3]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-8 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[80px] -mr-24 -mt-24"></div>
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <Shield size={32} className="text-amber-500"/>
                  <h3 className="font-black text-xl md:text-2xl tracking-tight">Status Shift</h3>
                </div>
                <p className="text-slate-400 text-sm md:text-base italic leading-relaxed font-medium">"{securityBriefing || 'Menyiapkan briefing untuk petugas...'}"</p>
              </div>
              <button 
                onClick={() => setActiveTab(currentUser?.role === 'RESIDENT' ? 'reports' : 'patrol')} 
                className="w-full bg-amber-500 text-slate-900 font-black py-4 rounded-2xl mt-8 shadow-xl text-sm flex items-center justify-center gap-3 active:scale-95 transition-transform"
              >
                {currentUser?.role === 'RESIDENT' ? 'Lihat Laporan' : 'Mulai Tugas'} <ArrowRight size={22}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-slide-up pb-32">
          <div className="bg-white p-8 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
            <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-8 flex items-center gap-3"><Settings size={28} className="text-slate-400"/> Pengaturan Sistem</h3>
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start text-center md:text-left">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-[1.5rem] bg-slate-900 text-white flex items-center justify-center text-3xl font-black shadow-xl">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="text-xl font-black text-slate-900 leading-none">{currentUser.name}</h4>
                  <p className="text-xs font-black text-amber-600 uppercase tracking-widest">{currentUser.role} AREA TKA</p>
                  <p className="text-xs text-slate-400 font-medium">ID: {currentUser.id}</p>
                </div>
              </div>

              {currentUser.role === 'SECURITY' && (
                <div className="p-6 md:p-8 bg-slate-50 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-1.5 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                        <Navigation size={20} className="text-blue-500"/>
                        <h5 className="font-black text-slate-900 uppercase text-xs tracking-widest">Aktivasi GPS Petugas</h5>
                      </div>
                      <p className="text-xs md:text-sm text-slate-500 font-medium max-w-md leading-relaxed">Nyalakan fitur ini agar Admin dapat melihat lokasi Anda di dashboard secara real-time.</p>
                    </div>
                    <button 
                      onClick={() => setIsGpsEnabled(!isGpsEnabled)}
                      className={`relative w-14 h-8 md:w-16 md:h-10 rounded-full transition-all duration-300 p-1.5 flex items-center flex-shrink-0 ${isGpsEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
                    >
                      <div className={`w-5 h-5 md:w-7 md:h-7 bg-white rounded-full shadow-lg transition-transform duration-300 transform ${isGpsEnabled ? 'translate-x-6 md:translate-x-7' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-8 border-t border-slate-100 flex flex-col gap-4">
                <button onClick={handleLogout} className="w-full py-4 bg-red-50 text-red-600 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-sm">
                  <LogOut size={18}/> Keluar Aplikasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-250px)] md:h-[calc(100vh-220px)] flex flex-col animate-slide-up pb-10">
           <div className="flex-1 bg-white rounded-t-[2rem] md:rounded-t-[3rem] shadow-sm border border-slate-100 overflow-y-auto p-5 md:p-12 space-y-6 no-scrollbar shadow-inner">
              {chatMessages.length > 0 ? chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[85%] md:max-w-[75%] p-5 rounded-[1.8rem] md:rounded-[2rem] shadow-sm ${msg.senderId === currentUser?.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-4 mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{msg.senderName}</span>
                      </div>
                      <p className="text-xs md:text-sm font-medium leading-relaxed">{msg.text}</p>
                      <p className="text-[8px] mt-2 opacity-40 text-right">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : <div className="h-full flex items-center justify-center text-slate-300 italic font-bold">Belum ada percakapan...</div>}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={handleSendChat} className="bg-white p-4 md:p-6 rounded-b-[2.5rem] md:rounded-b-[3rem] border-t border-slate-100 shadow-md flex gap-3 flex-shrink-0 mb-16 md:mb-0">
              <input type="text" placeholder="Tulis pesan..." className="flex-1 px-5 py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-bold transition-all shadow-inner text-sm" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] shadow-xl hover:scale-105 active:scale-95 transition-all"><Send size={20}/></button>
           </form>
        </div>
      )}

      {/* Tab Warga */}
      {activeTab === 'residents' && (
        <div className="max-w-7xl mx-auto space-y-8 animate-slide-up pb-32">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Database Warga</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Daftar Hunian Kawasan TKA</p>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input 
                  type="text" 
                  placeholder="Cari..." 
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 outline-none font-medium text-sm shadow-sm" 
                  value={residentSearch} 
                  onChange={e => setResidentSearch(e.target.value)} 
                />
              </div>
              {currentUser.role === 'ADMIN' && (
                <button 
                  onClick={() => { setEditingItem(null); setIsModalOpen('RESIDENT'); }}
                  className="bg-slate-900 text-white p-3 rounded-xl shadow-lg active:scale-95 transition-transform"
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
                <div key={res.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-900 border border-slate-100 flex items-center justify-center font-black text-lg">
                      {res.block}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                      {res.isHome ? 'DI UNIT' : 'Luar Area'}
                    </span>
                  </div>
                  <h4 className="font-black text-slate-900 text-base leading-tight">{res.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Unit: <span className="text-slate-900">{res.houseNumber}</span></p>
                  
                  <div className="mt-6 flex gap-2">
                    <a href={`tel:${res.phoneNumber}`} className="flex-1 py-3 bg-green-500 text-white rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-transform">
                      <Phone size={18}/>
                    </a>
                    {currentUser.role === 'ADMIN' && (
                      <button 
                        onClick={() => { setEditingItem(res); setResidentForm(res); setIsModalOpen('RESIDENT'); }}
                        className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-amber-500 transition-colors"
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

      {/* Tab Tamu */}
      {activeTab === 'guests' && (
        <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-32">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Log Buku Tamu</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Monitoring Kunjungan Luar</p>
            </div>
            <button 
              onClick={() => setIsModalOpen('GUEST')}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-transform"
            >
              <UserPlus size={18}/> REGISTRASI
            </button>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tamu</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tujuan / Keperluan</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {guests.length > 0 ? guests.map(g => (
                  <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm">{g.name.charAt(0)}</div>
                        <span className="font-bold text-slate-900 text-sm">{g.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-bold text-slate-700">{g.visitToName}</p>
                      <p className="text-[10px] text-slate-400 italic">"{g.purpose}"</p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
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
                    <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">
                      {new Date(g.entryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-16 text-center text-slate-300 italic">Belum ada data kunjungan hari ini.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Patroli */}
      {activeTab === 'patrol' && (
        <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-32">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Status Patroli</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {checkpoints.map((cp, idx) => (
              <div key={idx} className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between group transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-base">{idx + 1}</div>
                  <h4 className="font-black text-slate-900 text-sm md:text-base">{cp}</h4>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'OK' })} className="p-3 bg-green-50 text-green-600 rounded-xl md:rounded-2xl hover:bg-green-100"><CheckCircle size={20}/></button>
                  <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'WARNING' })} className="p-3 bg-amber-50 text-amber-600 rounded-xl md:rounded-2xl hover:bg-amber-100"><AlertTriangle size={20}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Insiden */}
      {activeTab === 'incident' && (
        <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-32">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Daftar Insiden</h3>
            <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-6 py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-transform"><AlertTriangle size={18}/> LAPOR</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {incidents.map(inc => (
              <div key={inc.id} className="bg-white p-8 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between relative hover:shadow-lg transition-all">
                {currentUser?.role === 'ADMIN' && (
                  <button onClick={() => setIncidents(prev => prev.filter(i => i.id !== inc.id))} className="absolute top-6 right-8 p-2 text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                )}
                <div>
                   <div className="flex justify-between items-start mb-6">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${inc.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{inc.severity}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(inc.timestamp).toLocaleDateString()}</span>
                   </div>
                   <h4 className="text-xl font-black text-slate-900 mb-2">{inc.type}</h4>
                   <p className="text-slate-500 text-xs md:text-sm leading-relaxed mb-6 italic">"{inc.description}"</p>
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">{inc.reporterName.charAt(0)}</div>
                      <span className="text-[10px] font-black text-slate-900">{inc.reporterName}</span>
                   </div>
                   <span className={`text-[10px] font-black uppercase tracking-widest ${inc.status === 'RESOLVED' ? 'text-green-500' : 'text-amber-500'}`}>{inc.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS RENDERER */}
      
      {/* Modal Warga */}
      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-8 md:p-10 bg-[#0F172A] text-white flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-black">{editingItem ? 'Edit Warga' : 'Warga Baru'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveResident} className="p-8 md:p-10 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nama Warga</label>
                <input type="text" required placeholder="Nama Lengkap..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.name} onChange={e => setResidentForm({...residentForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Blok</label>
                  <select required className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.block} onChange={e => setResidentForm({...residentForm, block: e.target.value})}>
                    {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">No. Rumah</label>
                  <input type="text" required placeholder="00" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.houseNumber} onChange={e => setResidentForm({...residentForm, houseNumber: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">No. Telp</label>
                <input type="tel" required placeholder="08..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={residentForm.phoneNumber} onChange={e => setResidentForm({...residentForm, phoneNumber: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(null)} className="flex-1 font-black text-slate-400 uppercase text-[10px] tracking-widest">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">SIMPAN DATA</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tamu */}
      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-8 md:p-10 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-black">Registrasi Tamu</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleSaveGuest} className="p-8 md:p-10 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nama Tamu</label>
                <input type="text" required placeholder="Nama Lengkap..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tujuan (Warga)</label>
                <select required className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                   <option value="">-- Pilih Warga --</option>
                   {residents.map(r => <option key={r.id} value={r.id}>Blok {r.block} No. {r.houseNumber} - {r.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Keperluan</label>
                <textarea required placeholder="Keperluan kunjungan..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[100px] text-sm" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(null)} className="flex-1 font-black text-slate-400 uppercase text-[10px] tracking-widest">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">DAFTAR MASUK</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patrol Action Modal */}
      {patrolActionState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className={`p-8 md:p-10 text-white flex justify-between items-center ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-amber-600'}`}>
              <h3 className="text-xl md:text-2xl font-black">{patrolActionState.checkpoint}</h3>
              <button onClick={() => setPatrolActionState(null)} className="p-2 hover:bg-white/10 rounded-lg"><X size={28}/></button>
            </div>
            <div className="p-8 md:p-10 space-y-6">
              <textarea placeholder="Tambahkan catatan (opsional)..." className="w-full px-6 py-4 rounded-[1.5rem] bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[100px] text-sm" value={patrolActionNote} onChange={e => setPatrolActionNote(e.target.value)} />
              <label className="flex flex-col items-center justify-center p-6 border-3 border-dashed border-slate-100 rounded-[1.5rem] cursor-pointer hover:bg-slate-50 transition-all h-[150px] relative overflow-hidden">
                {patrolActionPhoto ? <img src={patrolActionPhoto} className="w-full h-full object-cover rounded-xl" /> : <div className="text-center"><Camera className="text-slate-200 mx-auto" size={48}/><span className="text-[9px] font-black text-slate-300 uppercase mt-2 block tracking-widest">Lampirkan Foto</span></div>}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setPatrolActionPhoto(r.result as string); r.readAsDataURL(f); } }}/>
              </label>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setPatrolActionState(null)} className="flex-1 font-black text-slate-400 uppercase text-[10px] tracking-widest">Batal</button>
                <button onClick={handleSavePatrol} className={`flex-[2] py-4 text-white font-black rounded-[1.5rem] shadow-xl uppercase tracking-widest text-xs transition-all active:scale-95 ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-amber-600'}`}>KIRIM UPDATE</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INCIDENT MODAL */}
      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-8 md:p-10 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-black">Lapor Insiden</h3>
              <button onClick={() => setIsModalOpen(null)} className="p-2 hover:bg-red-700 rounded-lg"><X size={28}/></button>
            </div>
            <form onSubmit={handleIncidentSubmit} className="p-8 md:p-10 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tipe</label>
                <select required className="w-full px-6 py-4 rounded-[1.5rem] bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value})}>
                  <option value="Kriminalitas">Kriminalitas</option>
                  <option value="Gangguan">Gangguan Keamanan</option>
                  <option value="Kebakaran">Kebakaran</option>
                  <option value="Fasilitas">Fasilitas Rusak</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Lokasi</label>
                <input type="text" required placeholder="Blok / No. Rumah..." className="w-full px-6 py-4 rounded-[1.5rem] bg-slate-50 border-2 border-slate-100 outline-none font-bold text-sm" value={incidentForm.location} onChange={e => setIncidentForm({...incidentForm, location: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Kronologi</label>
                <textarea required placeholder="Jelaskan kejadian secara singkat..." className="w-full px-6 py-4 rounded-[1.5rem] bg-slate-50 border-2 border-slate-100 outline-none font-bold min-h-[100px] text-sm" value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(null)} className="flex-1 font-black text-slate-400 uppercase text-[10px] tracking-widest">Batal</button>
                <button type="submit" disabled={isAnalyzing} className="flex-[2] py-4 bg-red-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2">
                  {isAnalyzing ? <Clock className="animate-spin" size={16}/> : <Send size={16}/>} KIRIM LAPORAN
                </button>
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
