
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  SECURITY_USERS, 
  ADMIN_USERS, 
  RESIDENT_USERS, 
  MOCK_RESIDENTS,
  CHECKPOINTS as INITIAL_CHECKPOINTS 
} from './constants.tsx';
import { User, PatrolLog, IncidentReport, Resident, AuditLog, ChatMessage, SecurityLocation, GuestLog } from './types.ts';
import Layout from './components/Layout.tsx';
import { 
  Shield, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  User as UserIcon,
  Send,
  Loader2,
  Activity,
  Navigation,
  Users,
  MapPin,
  Plus,
  Trash2,
  Map,
  Edit2,
  X,
  Filter,
  Lock,
  ChevronLeft,
  FileText,
  TrendingUp,
  Download,
  MessageSquare,
  Locate,
  AlertTriangle,
  Info,
  BookOpen,
  UserPlus,
  ArrowRight,
  Camera,
  CheckCircle,
  Clock,
  Eye,
  Calendar,
  Home
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing, generateWeeklySummary } from './services/geminiService.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
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
  const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false);
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '', photo: '' });

  const [selectedResidentInfo, setSelectedResidentInfo] = useState<Resident | null>(null);

  const [patrolActionState, setPatrolActionState] = useState<{checkpoint: string, status: 'OK' | 'WARNING' | 'DANGER'} | null>(null);
  const [patrolActionPhoto, setPatrolActionPhoto] = useState<string>('');
  const [patrolActionNote, setPatrolActionNote] = useState<string>('');

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('tka_messages');
    return saved ? JSON.parse(saved) : [];
  });
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [residents, setResidents] = useState<Resident[]>(() => {
    const saved = localStorage.getItem('tka_residents');
    return saved ? JSON.parse(saved) : MOCK_RESIDENTS;
  });
  const [checkpoints] = useState<string[]>(INITIAL_CHECKPOINTS);
  
  const [incidentForm, setIncidentForm] = useState({ type: 'Kriminalitas', location: '', description: '', photo: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');

  const [incidentFilterStatus, setIncidentFilterStatus] = useState<string>('ALL');
  const [residentSearch, setResidentSearch] = useState('');

  // Sync with Local Storage
  useEffect(() => { localStorage.setItem('tka_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem('tka_guests', JSON.stringify(guests)); }, [guests]);
  useEffect(() => { localStorage.setItem('tka_incidents', JSON.stringify(incidents)); }, [incidents]);
  useEffect(() => { localStorage.setItem('tka_residents', JSON.stringify(residents)); }, [residents]);
  useEffect(() => { localStorage.setItem('tka_patrol_logs', JSON.stringify(patrolLogs)); }, [patrolLogs]);

  useEffect(() => {
    if (currentUser?.role === 'SECURITY' || currentUser?.role === 'ADMIN') {
      getSecurityBriefing(new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Pagi' : 'Malam')
        .then(setSecurityBriefing);
    }
  }, [currentUser]);

  const filteredIncidents = useMemo(() => {
    if (incidentFilterStatus === 'ALL') return incidents;
    return incidents.filter(inc => inc.status === incidentFilterStatus);
  }, [incidents, incidentFilterStatus]);

  const filteredResidents = useMemo(() => {
    if (!residentSearch) return residents;
    return residents.filter(r => 
      r.name.toLowerCase().includes(residentSearch.toLowerCase()) || 
      r.houseNumber.toLowerCase().includes(residentSearch.toLowerCase())
    );
  }, [residents, residentSearch]);

  const chartData = useMemo(() => {
    const blocks = ['A', 'B', 'C', 'D'];
    return blocks.map(block => ({
      name: `Blok ${block}`,
      incidents: incidents.filter(inc => inc.location.toUpperCase().includes(`BLOK ${block}`)).length
    }));
  }, [incidents]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAttemptLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    let isValid = false;
    if (selectedUser.role === 'SECURITY' && passwordInput === '123456') isValid = true;
    else if (selectedUser.role === 'ADMIN' && passwordInput === 'admin123') isValid = true;
    else if (selectedUser.role === 'RESIDENT' && passwordInput === 'wargatka123456') isValid = true;

    if (isValid) {
      setCurrentUser(selectedUser);
      setActiveTab('dashboard');
      setLoginError('');
      setPasswordInput('');
    } else {
      setLoginError('Password salah.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedUser(null);
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsAnalyzing(true);
    const analysis = await analyzeIncident(incidentForm.description);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);

    const newIncident: IncidentReport = {
      id: Date.now().toString(),
      reporterId: currentUser.id,
      reporterName: currentUser.name,
      timestamp: new Date().toISOString(),
      type: incidentForm.type,
      description: incidentForm.description,
      location: incidentForm.location,
      status: 'PENDING',
      severity: (analysis?.severity as any) || 'MEDIUM',
      photo: incidentForm.photo
    };
    
    setIncidents([newIncident, ...incidents]);
    setIncidentForm({ type: 'Kriminalitas', location: '', description: '', photo: '' });
  };

  const handleGuestExit = (id: string) => {
    setGuests(prev => prev.map(g => 
      g.id === id ? { ...g, status: 'OUT', exitTime: new Date().toISOString() } : g
    ));
  };

  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !guestForm.name || !guestForm.visitToId) return;
    
    const resident = residents.find(r => r.id === guestForm.visitToId);
    const newGuest: GuestLog = {
      id: Date.now().toString(),
      name: guestForm.name!,
      visitToId: guestForm.visitToId!,
      visitToName: resident ? `${resident.name} (${resident.houseNumber})` : 'Unknown',
      purpose: guestForm.purpose || 'Kunjungan',
      entryTime: new Date().toISOString(),
      status: 'IN',
      photo: guestForm.photo
    };
    
    setGuests([newGuest, ...guests]);
    setGuestForm({ name: '', visitToId: '', purpose: '', photo: '' });
    setIsAddGuestModalOpen(false);
  };

  const updateIncidentStatus = (id: string, newStatus: IncidentReport['status']) => {
    const updated = incidents.map(inc => 
      inc.id === id ? { ...inc, status: newStatus } : inc
    );
    setIncidents(updated as IncidentReport[]);
  };

  const handlePatrolSubmit = () => {
    if (!currentUser || !patrolActionState) return;
    const newLog: PatrolLog = {
      id: Date.now().toString(),
      securityId: currentUser.id,
      securityName: currentUser.name,
      timestamp: new Date().toISOString(),
      checkpoint: patrolActionState.checkpoint,
      status: patrolActionState.status,
      photo: patrolActionPhoto,
      note: patrolActionNote
    };
    setPatrolLogs([newLog, ...patrolLogs]);
    setPatrolActionState(null);
    setPatrolActionPhoto('');
    setPatrolActionNote('');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>
          
          <div className="flex flex-col items-center mb-10 mt-4">
            <div className="bg-amber-500 p-5 rounded-3xl shadow-xl shadow-amber-500/30 mb-6">
              <Shield size={48} className="text-slate-900" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">TKA Secure</h1>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-2">Integrated Security System</p>
          </div>
          
          <form onSubmit={handleAttemptLogin} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pilih Akun Bertugas</label>
              <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                {[...SECURITY_USERS, ...ADMIN_USERS, ...RESIDENT_USERS].map(u => (
                  <button 
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUser(u)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${
                      selectedUser?.id === u.id 
                        ? 'border-amber-500 bg-amber-50/50 ring-4 ring-amber-500/10' 
                        : 'border-slate-50 hover:border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-700 font-black border border-slate-100 uppercase">
                      {u.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-slate-900">{u.name}</p>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black tracking-tighter uppercase ${
                        u.role === 'ADMIN' ? 'bg-purple-100 text-purple-600' : 
                        u.role === 'SECURITY' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedUser && (
              <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Autentikasi Keamanan</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors">
                    <Lock size={20} />
                  </div>
                  <input 
                    type="password" 
                    required
                    placeholder="Masukkan Password..."
                    className="w-full pl-12 pr-4 py-4 md:py-5 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 focus:bg-white outline-none transition-all font-bold text-slate-900"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                  />
                </div>
                {loginError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest px-1 text-center">{loginError}</p>}
              </div>
            )}

            <button 
              type="submit" 
              disabled={!selectedUser}
              className="w-full bg-slate-900 text-white font-black py-4 md:py-5 rounded-2xl shadow-2xl shadow-slate-900/30 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-3 tracking-tight"
            >
              Masuk Dashboard <ArrowRight size={20} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser!} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { label: 'Patroli Hari Ini', val: patrolLogs.length, icon: <CheckCircle2 size={24}/>, color: 'amber' },
              { label: 'Insiden Aktif', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertCircle size={24}/>, color: 'red' },
              { label: 'Tamu Terdaftar', val: guests.filter(g => g.status === 'IN').length, icon: <Users size={24}/>, color: 'blue' },
              { label: 'Status Area', val: 'Aman', icon: <Activity size={24}/>, color: 'green' }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${
                  stat.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                  stat.color === 'red' ? 'bg-red-50 text-red-600' :
                  stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}>
                  {stat.icon}
                </div>
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{stat.label}</h3>
                <p className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            <div className="lg:col-span-2 space-y-6 md:space-y-8">
              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Grafik Insiden</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Per Blok Perumahan</p>
                  </div>
                  <TrendingUp className="text-slate-200" size={32} />
                </div>
                <div className="h-[250px] md:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 800}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 800}} />
                      <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 800}} />
                      <Bar dataKey="incidents" radius={[8, 8, 8, 8]} barSize={40}>
                        {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#10B981', '#EF4444'][index % 4]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="hidden md:block bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Log Aktivitas Terbaru</h3>
                  <button onClick={() => setActiveTab('patrol')} className="text-xs font-black text-amber-600 uppercase tracking-widest hover:underline">Lihat Semua</button>
                </div>
                <div className="space-y-4">
                  {patrolLogs.slice(0, 3).map((log, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md transition-all">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                        <MapPin size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-900">{log.checkpoint}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{log.securityName} • {new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${log.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {log.status}
                      </span>
                    </div>
                  ))}
                  {patrolLogs.length === 0 && <p className="text-center py-6 text-slate-400 font-bold text-sm italic">Belum ada data patroli hari ini</p>}
                </div>
              </div>
            </div>

            <div className="space-y-6 md:space-y-8">
              <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-amber-500 rounded-xl shadow-lg shadow-amber-500/20">
                    <Shield size={20} className="text-slate-900" />
                  </div>
                  <h3 className="font-black text-lg tracking-tight">AI Security Briefing</h3>
                </div>
                <p className="text-slate-300 text-sm italic leading-relaxed font-medium">"{securityBriefing || 'Menghubungkan ke pusat intelijen...'}"</p>
                <button onClick={() => setActiveTab('patrol')} className="w-full bg-amber-500 text-slate-900 font-black py-4 rounded-2xl mt-8 hover:bg-amber-400 active:scale-[0.98] transition-all shadow-xl shadow-amber-500/20 text-sm tracking-tight flex items-center justify-center gap-2">
                  Mulai Patroli <ChevronLeft size={18} className="rotate-180" />
                </button>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <Users className="text-slate-300" size={24} />
                  <h3 className="font-black text-slate-900 tracking-tight">Hunian Warga</h3>
                </div>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">{residents.filter(r => r.isHome).length}</span>
                  <span className="text-slate-400 font-bold text-sm mb-1.5">/ {residents.length} Rumah</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-6">
                  <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(residents.filter(r => r.isHome).length / residents.length) * 100}%` }}></div>
                </div>
                <button onClick={() => setActiveTab('residents')} className="w-full py-3.5 border-2 border-slate-100 text-slate-600 font-black rounded-2xl text-xs uppercase tracking-widest">Detail Warga</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'patrol' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700 max-w-6xl mx-auto pb-24">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500"><MapPin size={28}/></div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Cek Lokasi Checkpoint</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Konfirmasi Kehadiran & Kondisi Area</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {checkpoints.map((cp, idx) => (
                <div key={idx} className="flex items-center justify-between p-6 border-2 border-slate-50 rounded-3xl hover:border-amber-500/30 hover:bg-amber-50/10 transition-all group">
                  <div className="flex items-center gap-4">
                    <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black">{idx + 1}</span>
                    <span className="font-black text-slate-700 tracking-tight">{cp}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'OK' })} className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors"><CheckCircle size={20}/></button>
                    <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'WARNING' })} className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"><AlertTriangle size={20}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-xl font-black text-slate-900 mb-6">Riwayat Patroli Terkini</h3>
            <div className="space-y-4">
              {patrolLogs.map((log) => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-6 rounded-[2rem] bg-slate-50 border border-slate-100">
                   <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-white border flex items-center justify-center text-slate-400"><Clock size={20}/></div>
                      <div>
                        <p className="font-black text-slate-900">{log.checkpoint}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{log.securityName} • {new Date(log.timestamp).toLocaleString('id-ID')}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      {log.photo && <button onClick={() => setPreviewImage(log.photo!)} className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm"><img src={log.photo} className="w-full h-full object-cover" /></button>}
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${log.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{log.status}</span>
                   </div>
                </div>
              ))}
              {patrolLogs.length === 0 && <p className="text-center py-10 text-slate-400 font-bold italic">Belum ada log patroli.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'residents' && (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Database Warga</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Status Keberadaan & Kontak Darurat</p>
              </div>
              <div className="relative w-full md:w-80 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={20}/>
                <input 
                  type="text" 
                  placeholder="Cari Nama / No. Rumah..." 
                  className="w-full pl-12 pr-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 focus:bg-white outline-none font-bold text-slate-800 transition-all shadow-inner" 
                  value={residentSearch}
                  onChange={e => setResidentSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredResidents.map(res => (
                <div key={res.id} className="p-6 bg-slate-50/50 border border-slate-100 rounded-[2rem] hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner border-2 border-white ${res.isHome ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                      {res.houseNumber}
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${res.isHome ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {res.isHome ? 'Ada di Rumah' : 'Sedang Luar'}
                    </div>
                  </div>
                  <h4 className="font-black text-slate-900 text-xl tracking-tight mb-6">{res.name}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setSelectedResidentInfo(res)} className="py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm">Info Detail</button>
                    <a href={`tel:${res.phoneNumber}`} className="py-3.5 bg-green-500 text-white rounded-2xl flex items-center justify-center gap-2 hover:bg-green-600 transition-all shadow-lg shadow-green-500/20"><Phone size={16}/></a>
                  </div>
                </div>
              ))}
              {filteredResidents.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <Users size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Warga tidak ditemukan</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tetap sertakan blok Tab lainnya sesuai kode sebelumnya... */}
      {activeTab === 'incident' && (
        <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-top-4 duration-700 pb-20">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center gap-5 mb-10">
              <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-red-500 shadow-inner"><AlertTriangle size={32} /></div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Formulir Laporan Insiden</h3>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Sistem Pelaporan Darurat Terpadu</p>
              </div>
            </div>
            <form onSubmit={handleIncidentSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
              <div className="lg:col-span-2 space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kategori Laporan</label>
                    <select required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 focus:bg-white outline-none font-bold text-slate-800 transition-all appearance-none" value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value})}>
                      <option value="Kriminalitas">Kriminalitas</option><option value="Gangguan">Gangguan Ketertiban</option><option value="Kebakaran">Kebakaran / Darurat</option><option value="Kerusakan">Kerusakan Fasilitas</option><option value="Darurat Medis">Darurat Medis</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lokasi Detail</label>
                    <input type="text" required placeholder="Cth: Depan Blok A12" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 focus:bg-white outline-none font-bold text-slate-800 transition-all" value={incidentForm.location} onChange={e => setIncidentForm({...incidentForm, location: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kronologi Kejadian</label>
                  <textarea required placeholder="Jelaskan secara rinci..." className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 focus:bg-white outline-none font-bold text-slate-800 transition-all min-h-[150px]" value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} />
                </div>
              </div>
              <div className="space-y-6">
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-[2rem] hover:bg-slate-50 cursor-pointer min-h-[220px] relative overflow-hidden group">
                  {incidentForm.photo ? <img src={incidentForm.photo} className="w-full h-full object-cover" /> : <><Camera size={40} className="text-slate-300"/><span className="text-xs text-slate-500 font-black uppercase mt-4">Klik Ambil Foto</span></>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, b => setIncidentForm({...incidentForm, photo: b}))} />
                </label>
                <button type="submit" disabled={isAnalyzing} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl disabled:opacity-50">{isAnalyzing ? 'Menganalisis...' : 'Kirim Laporan'}</button>
              </div>
            </form>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredIncidents.map(inc => (
              <div key={inc.id} className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm group">
                <div className="flex justify-between mb-6">
                   <div className="flex gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${inc.severity === 'HIGH' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}><AlertTriangle size={28}/></div>
                      <div><h4 className="font-black text-xl tracking-tight">{inc.type}</h4><p className="text-[10px] text-slate-400 font-bold uppercase">{inc.location}</p></div>
                   </div>
                   <span className="px-4 py-1.5 bg-slate-50 rounded-full text-[10px] font-black uppercase tracking-widest">{inc.status}</span>
                </div>
                <p className="text-slate-600 italic mb-6">"{inc.description}"</p>
                <div className="flex justify-between items-center border-t pt-6">
                   <p className="text-[10px] font-black text-slate-400 uppercase">Pelapor: {inc.reporterName}</p>
                   {(currentUser.role === 'ADMIN' || currentUser.role === 'SECURITY') && inc.status !== 'RESOLVED' && (
                     <button onClick={() => updateIncidentStatus(inc.id, 'RESOLVED')} className="p-3 bg-green-500 text-white rounded-xl shadow-lg shadow-green-500/20"><CheckCircle size={20}/></button>
                   )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'guests' && (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-6xl mx-auto pb-24">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Buku Tamu Digital</h3>
              <button onClick={() => setIsAddGuestModalOpen(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-black shadow-xl"><UserPlus size={20}/> Catat Tamu</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {guests.map(g => (
                <div key={g.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <div className="flex gap-4 mb-4">
                     <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center font-black text-slate-400 border">{g.name.charAt(0)}</div>
                     <div><p className="font-black text-slate-900">{g.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{g.purpose}</p></div>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border mb-4">
                     <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Tujuan: {g.visitToName}</p>
                     <p className="text-[9px] font-black text-slate-400 uppercase">Masuk: {new Date(g.entryTime).toLocaleTimeString()}</p>
                  </div>
                  {g.status === 'IN' ? <button onClick={() => handleGuestExit(g.id)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-xs uppercase">Tamu Keluar</button> : <p className="text-center text-[10px] font-black text-slate-300 uppercase">Selesai Berkunjung</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-180px)] lg:h-[calc(100vh-150px)] bg-white rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-500 pb-16 lg:pb-0">
          <div className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between"><h3 className="font-black text-lg tracking-tight">Kanal Komunikasi</h3></div>
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50/30">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderId === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl ${msg.senderId === currentUser?.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border rounded-tl-none shadow-sm'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{msg.senderName}</p>
                  <p className="text-sm font-medium">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (!chatInput.trim()) return; setMessages([...messages, {id: Date.now().toString(), senderId: currentUser.id, senderName: currentUser.name, senderRole: currentUser.role, text: chatInput, timestamp: new Date().toISOString()}]); setChatInput(''); }} className="p-4 md:p-6 bg-white border-t flex gap-3">
            <input type="text" placeholder="Ketik pesan..." className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 outline-none font-bold" value={chatInput} onChange={e => setChatInput(e.target.value)} />
            <button type="submit" className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl"><Send size={24}/></button>
          </form>
        </div>
      )}

      {/* Modals & Previews */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-8 right-8 p-4 bg-white/10 text-white rounded-full"><X size={28}/></button>
          <img src={previewImage} className="max-w-full max-h-[85vh] object-contain rounded-[2rem] shadow-2xl border-4 border-white/10" />
        </div>
      )}

      {patrolActionState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className={`p-8 text-white flex justify-between items-center ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-amber-500'}`}><h3 className="text-xl font-black tracking-tight">{patrolActionState.checkpoint}</h3><button onClick={() => setPatrolActionState(null)}><X size={24}/></button></div>
            <div className="p-8 space-y-6">
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Catatan Kondisi</label><textarea placeholder="Area aman..." className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-slate-300 outline-none font-bold min-h-[120px]" value={patrolActionNote} onChange={e => setPatrolActionNote(e.target.value)} /></div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Foto Area</label>
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:bg-slate-50 h-[140px] relative overflow-hidden">
                  {patrolActionPhoto ? <img src={patrolActionPhoto} className="w-full h-full object-cover" /> : <><Camera className="text-slate-400" size={24}/><span className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">Klik Ambil Foto</span></>}
                  <input type="file" className="hidden" onChange={e => handleImageUpload(e, setPatrolActionPhoto)}/>
                </label>
              </div>
            </div>
            <div className="p-8 bg-slate-50 flex gap-4"><button onClick={() => setPatrolActionState(null)} className="flex-1 font-black text-slate-400 uppercase tracking-widest text-xs">Batal</button><button onClick={handlePatrolSubmit} className={`flex-1 py-4 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-xs ${patrolActionState.status === 'OK' ? 'bg-green-600 shadow-green-500/20' : 'bg-amber-600 shadow-amber-500/20'}`}>Simpan Status</button></div>
          </div>
        </div>
      )}

      {isAddGuestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
            <form onSubmit={handleAddGuest}>
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><h3 className="text-xl font-black tracking-tight">Catat Tamu Masuk</h3><button type="button" onClick={() => setIsAddGuestModalOpen(false)}><X size={24}/></button></div>
              <div className="p-8 space-y-6">
                <input type="text" required placeholder="Nama Lengkap Tamu" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 outline-none font-bold" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
                <select required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 outline-none font-bold" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                  <option value="">Warga Tujuan</option>{residents.map(r => (<option key={r.id} value={r.id}>{r.name} ({r.houseNumber})</option>))}
                </select>
                <input type="text" required placeholder="Tujuan / Keperluan" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 outline-none font-bold" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
                <label className="flex items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer h-[100px] overflow-hidden">
                  {guestForm.photo ? <img src={guestForm.photo} className="h-full rounded-xl" /> : <><Camera size={20} className="mr-3 text-slate-400"/> <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto ID / KTP Tamu</span></>}
                  <input type="file" className="hidden" onChange={e => handleImageUpload(e, b => setGuestForm({...guestForm, photo: b}))} />
                </label>
              </div>
              <div className="p-8 bg-slate-50 flex gap-4"><button type="button" onClick={() => setIsAddGuestModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase tracking-widest text-xs">Batal</button><button type="submit" className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-xs shadow-slate-900/20">Simpan Tamu</button></div>
            </form>
          </div>
        </div>
      )}

      {selectedResidentInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><h3 className="text-xl font-black">Detail Warga</h3><button onClick={() => setSelectedResidentInfo(null)}><X size={24}/></button></div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-[2rem] flex items-center justify-center font-black text-3xl border-4 border-white shadow-xl">{selectedResidentInfo.houseNumber}</div>
                <div><h4 className="text-2xl font-black tracking-tight">{selectedResidentInfo.name}</h4><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Blok {selectedResidentInfo.block}</p></div>
              </div>
              <div className="space-y-4">
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Status Keberadaan</p><p className="font-black text-slate-900">{selectedResidentInfo.isHome ? 'Ada di Rumah' : 'Sedang Keluar Area'}</p></div>
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Kontak WhatsApp</p><div className="flex justify-between items-center font-black text-slate-900">{selectedResidentInfo.phoneNumber}<a href={`https://wa.me/${selectedResidentInfo.phoneNumber.replace(/[^0-9]/g, '')}`} target="_blank" className="p-3 bg-green-500 text-white rounded-2xl shadow-lg shadow-green-500/20"><Phone size={16}/></a></div></div>
              </div>
            </div>
            <div className="p-8 bg-slate-50"><button onClick={() => setSelectedResidentInfo(null)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl">Tutup Detail</button></div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
