
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
  Eye
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing, generateWeeklySummary } from './services/geminiService.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>(() => {
    const saved = localStorage.getItem('tka_incidents');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Guest List States
  const [guests, setGuests] = useState<GuestLog[]>(() => {
    const saved = localStorage.getItem('tka_guests');
    return saved ? JSON.parse(saved) : [];
  });
  const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false);
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '', photo: '' });

  // Resident Detail Modal
  const [selectedResidentInfo, setSelectedResidentInfo] = useState<Resident | null>(null);

  // Patrol Action State
  const [patrolActionState, setPatrolActionState] = useState<{checkpoint: string, status: 'OK' | 'WARNING' | 'DANGER'} | null>(null);
  const [patrolActionPhoto, setPatrolActionPhoto] = useState<string>('');
  const [patrolActionNote, setPatrolActionNote] = useState<string>('');

  // Image Preview State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Chat States
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('tka_messages');
    return saved ? JSON.parse(saved) : [];
  });
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // GPS States
  const [securityLocations, setSecurityLocations] = useState<SecurityLocation[]>(() => {
    const saved = localStorage.getItem('tka_security_locations');
    return saved ? JSON.parse(saved) : [];
  });
  const watchIdRef = useRef<number | null>(null);

  // Login States
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Report States
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [weeklyReportContent, setWeeklyReportContent] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Resident & Config States
  const [residents, setResidents] = useState<Resident[]>(() => {
    const saved = localStorage.getItem('tka_residents');
    return saved ? JSON.parse(saved) : MOCK_RESIDENTS;
  });
  const [checkpoints, setCheckpoints] = useState<string[]>(() => {
    const saved = localStorage.getItem('tka_checkpoints');
    return saved ? JSON.parse(saved) : INITIAL_CHECKPOINTS;
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('tka_audit_logs');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Incident Form States
  const [incidentForm, setIncidentForm] = useState({ type: 'Kriminalitas', location: '', description: '', photo: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');

  // Filters
  const [incidentFilterStatus, setIncidentFilterStatus] = useState<string>('ALL');

  // Sync with Local Storage
  useEffect(() => { localStorage.setItem('tka_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem('tka_guests', JSON.stringify(guests)); }, [guests]);
  useEffect(() => { localStorage.setItem('tka_incidents', JSON.stringify(incidents)); }, [incidents]);
  useEffect(() => { localStorage.setItem('tka_residents', JSON.stringify(residents)); }, [residents]);
  useEffect(() => { localStorage.setItem('tka_checkpoints', JSON.stringify(checkpoints)); }, [checkpoints]);
  useEffect(() => { localStorage.setItem('tka_audit_logs', JSON.stringify(auditLogs)); }, [auditLogs]);

  useEffect(() => {
    if (currentUser?.role === 'SECURITY' || currentUser?.role === 'ADMIN') {
      getSecurityBriefing(new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Pagi' : 'Malam')
        .then(setSecurityBriefing);
    }
  }, [currentUser]);

  // Added chartData to visualize incidents per residential block
  const chartData = useMemo(() => {
    const blocks = ['A', 'B', 'C', 'D'];
    return blocks.map(block => ({
      name: `Blok ${block}`,
      incidents: incidents.filter(inc => inc.location.toUpperCase().includes(`BLOK ${block}`)).length
    }));
  }, [incidents]);

  const addAuditLog = (action: string) => {
    if (!currentUser) return;
    const newLog: AuditLog = {
      id: Date.now().toString(),
      adminId: currentUser.id,
      adminName: currentUser.name,
      action,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

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
      severity: analysis?.severity || 'MEDIUM',
      photo: incidentForm.photo
    };
    
    setIncidents([newIncident, ...incidents]);
    setIncidentForm({ type: 'Kriminalitas', location: '', description: '', photo: '' });
    addAuditLog(`Melaporkan insiden ${newIncident.type} di ${newIncident.location}`);
  };

  const handleGuestExit = (id: string) => {
    setGuests(prev => prev.map(g => 
      g.id === id ? { ...g, status: 'OUT', exitTime: new Date().toISOString() } : g
    ));
    addAuditLog(`Tamu ID: ${id} telah keluar dari area perumahan.`);
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
    addAuditLog(`Mencatat tamu baru: ${newGuest.name} berkunjung ke ${newGuest.visitToName}`);
  };

  const updateIncidentStatus = (id: string, newStatus: IncidentReport['status']) => {
    const updated = incidents.map(inc => 
      inc.id === id ? { ...inc, status: newStatus } as IncidentReport : inc
    );
    setIncidents(updated);
    addAuditLog(`Status insiden ID: ${id} berubah ke ${newStatus}`);
  };

  const filteredIncidents = useMemo(() => {
    if (incidentFilterStatus === 'ALL') return incidents;
    return incidents.filter(inc => inc.status === incidentFilterStatus);
  }, [incidents, incidentFilterStatus]);

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
    addAuditLog(`Menyelesaikan patroli di ${newLog.checkpoint}`);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 w-full max-w-md animate-in fade-in zoom-in duration-300">
          <div className="flex justify-center mb-8">
            <div className="bg-amber-500 p-4 rounded-3xl shadow-lg shadow-amber-500/20">
              <Shield size={40} className="text-slate-900" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 text-center mb-2">TKA Integrated Security</h1>
          <p className="text-slate-500 text-center mb-8 font-medium">Sistem Monitoring Terpadu Perumahan</p>
          
          <form onSubmit={handleAttemptLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Pilih Akun</label>
              <div className="grid grid-cols-1 gap-2">
                {[...SECURITY_USERS, ...ADMIN_USERS, ...RESIDENT_USERS].map(u => (
                  <button 
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUser(u)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                      selectedUser?.id === u.id 
                        ? 'border-amber-500 bg-amber-50' 
                        : 'border-slate-50 hover:border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-600 font-bold border">
                      {u.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-800 leading-none">{u.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black mt-1 tracking-tighter">{u.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedUser && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    required
                    placeholder="Masukkan password..."
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all font-medium"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                  />
                </div>
                {loginError && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wide px-1">{loginError}</p>}
              </div>
            )}

            <button 
              type="submit" 
              disabled={!selectedUser}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              Login Sistem <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser!} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-4"><CheckCircle2 size={24} /></div>
              <h3 className="text-slate-500 text-sm font-medium">Patroli Hari Ini</h3>
              <p className="text-3xl font-bold text-slate-800">{patrolLogs.length}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-4"><AlertCircle size={24} /></div>
              <h3 className="text-slate-500 text-sm font-medium">Insiden Aktif</h3>
              <p className="text-3xl font-bold text-slate-800">{incidents.filter(i => i.status !== 'RESOLVED').length}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-4"><Activity size={24} /></div>
              <h3 className="text-slate-500 text-sm font-medium">Status Keamanan</h3>
              <p className="text-3xl font-bold text-slate-800">Normal</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-4"><Users size={24} /></div>
              <h3 className="text-slate-500 text-sm font-medium">Warga di Rumah</h3>
              <p className="text-3xl font-bold text-slate-800">{residents.filter(r => r.isHome).length}/{residents.length}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold text-slate-800 mb-8">Insiden per Blok</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip cursor={{fill: '#f8fafc'}} />
                      <Bar dataKey="incidents" radius={[8, 8, 0, 0]}>
                        {chartData.map((_, index) => (<Cell key={index} fill={['#f59e0b', '#3b82f6', '#10b981', '#ef4444'][index % 4]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
                <div className="flex items-center gap-3 mb-4"><Shield size={20} className="text-amber-500" /><h3 className="font-bold">AI Security Briefing</h3></div>
                <p className="text-slate-300 text-sm italic">"{securityBriefing}"</p>
                <button onClick={() => setActiveTab('patrol')} className="w-full bg-amber-500 text-slate-900 font-bold py-3 rounded-xl mt-6">Mulai Patroli</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'incident' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-top-4 duration-500 pb-20">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Pelaporan Insiden Terintegrasi</h3>
                <p className="text-slate-500">Laporkan kejadian mencurigakan atau darurat di area perumahan.</p>
              </div>
            </div>

            <form onSubmit={handleIncidentSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Jenis Laporan</label>
                    <select required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-amber-500/20 outline-none" value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value})}>
                      <option value="Kriminalitas">Kriminalitas (Pencurian, dll)</option>
                      <option value="Gangguan">Gangguan Ketertiban</option>
                      <option value="Kebakaran">Kebakaran / Asap</option>
                      <option value="Kerusakan">Kerusakan Fasilitas</option>
                      <option value="Darurat Medis">Darurat Medis</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lokasi Kejadian</label>
                    <input type="text" required placeholder="Contoh: Depan Blok A No. 12" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-amber-500/20 outline-none" value={incidentForm.location} onChange={e => setIncidentForm({...incidentForm, location: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detail Deskripsi</label>
                  <textarea required placeholder="Jelaskan secara rinci apa yang terjadi..." className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-amber-500/20 outline-none min-h-[120px]" value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Foto Bukti (Dianjurkan)</label>
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-slate-50 cursor-pointer transition-all h-[200px] relative overflow-hidden">
                    {incidentForm.photo ? (
                      <div className="w-full h-full">
                        <img src={incidentForm.photo} className="w-full h-full object-cover rounded-xl" alt="Preview" />
                        <button type="button" onClick={(e) => { e.preventDefault(); setIncidentForm({...incidentForm, photo: ''}); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"><X size={14}/></button>
                      </div>
                    ) : (
                      <>
                        <Camera className="text-slate-400 mb-3" size={32} />
                        <span className="text-xs text-slate-500 font-bold text-center">Klik untuk Ambil / Unggah Foto</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, b => setIncidentForm({...incidentForm, photo: b}))} />
                  </label>
                </div>
                <button type="submit" disabled={isAnalyzing} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg shadow-slate-900/20 disabled:opacity-50">
                  {isAnalyzing ? <><Loader2 className="animate-spin" size={20}/> Menganalisis...</> : <><Send size={20}/> Kirim Laporan</>}
                </button>
              </div>
            </form>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-xl font-bold text-slate-800">Daftar Insiden Terkini</h3>
            <div className="flex gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
              {(['ALL', 'PENDING', 'INVESTIGATING', 'RESOLVED'] as const).map(s => (
                <button key={s} onClick={() => setIncidentFilterStatus(s)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${incidentFilterStatus === s ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{s === 'ALL' ? 'Semua' : s}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredIncidents.map(inc => (
              <div key={inc.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${inc.severity === 'HIGH' ? 'bg-red-100 text-red-600' : inc.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg leading-tight">{inc.type}</h4>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1"><MapPin size={12}/> {inc.location}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    inc.status === 'PENDING' ? 'bg-slate-100 text-slate-500' : 
                    inc.status === 'INVESTIGATING' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {inc.status}
                  </div>
                </div>

                <div className="flex gap-4 mb-6">
                  {inc.photo && (
                    <button onClick={() => setPreviewImage(inc.photo!)} className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-100 flex-shrink-0 relative group">
                      <img src={inc.photo} className="w-full h-full object-cover" alt="Evidence" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Eye size={16}/></div>
                    </button>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-2">{inc.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      <Clock size={10}/> {new Date(inc.timestamp).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{inc.reporterName.charAt(0)}</div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pelapor: {inc.reporterName}</span>
                  </div>
                  
                  {(currentUser.role === 'ADMIN' || currentUser.role === 'SECURITY') && inc.status !== 'RESOLVED' && (
                    <div className="flex gap-2">
                      {inc.status === 'PENDING' && (
                        <button onClick={() => updateIncidentStatus(inc.id, 'INVESTIGATING')} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"><Activity size={18}/></button>
                      )}
                      <button onClick={() => updateIncidentStatus(inc.id, 'RESOLVED')} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors"><CheckCircle size={18}/></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredIncidents.length === 0 && (
              <div className="col-span-full py-20 bg-white rounded-3xl border border-slate-100 border-dashed text-center">
                <Search size={48} className="mx-auto mb-4 text-slate-200" />
                <p className="text-slate-400 font-medium">Tidak ada laporan insiden yang ditemukan.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'patrol' && (
        <div className="space-y-6 max-w-6xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-2xl font-bold text-slate-800 mb-8">Pemeriksaan Checkpoint</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {checkpoints.map((cp, idx) => (
                <div key={idx} className="flex items-center justify-between p-6 border border-slate-100 rounded-3xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold">{idx + 1}</span>
                    <span className="font-bold text-slate-700">{cp}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'OK' })} className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-xs font-bold">OK</button>
                    <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'WARNING' })} className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold">WASPADA</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'guests' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-slate-800">Buku Tamu Perumahan</h3>
              <button onClick={() => setIsAddGuestModalOpen(true)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold"><UserPlus size={20}/> Catat Tamu Masuk</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b border-slate-100"><th className="pb-4 font-bold text-slate-400 text-xs tracking-widest uppercase">Tamu</th><th className="pb-4 font-bold text-slate-400 text-xs tracking-widest uppercase">Foto ID</th><th className="pb-4 font-bold text-slate-400 text-xs tracking-widest uppercase">Tujuan</th><th className="pb-4 font-bold text-slate-400 text-xs tracking-widest uppercase">Waktu</th><th className="pb-4 font-bold text-slate-400 text-xs tracking-widest uppercase text-right">Status</th></tr></thead>
                <tbody>
                  {guests.map(g => (
                    <tr key={g.id} className="border-b border-slate-50">
                      <td className="py-4 font-bold text-slate-800">{g.name}<br/><span className="text-[10px] text-slate-400 font-normal">{g.purpose}</span></td>
                      <td className="py-4">{g.photo ? <button onClick={() => setPreviewImage(g.photo!)} className="w-10 h-10 rounded-lg overflow-hidden border"><img src={g.photo} className="w-full h-full object-cover" alt="ID Photo"/></button> : '-'}</td>
                      <td className="py-4 text-sm">{g.visitToName}</td>
                      <td className="py-4 text-xs">{new Date(g.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                      <td className="py-4 text-right">
                        {g.status === 'IN' ? (
                          <button onClick={() => handleGuestExit(g.id)} className="bg-slate-100 px-4 py-1.5 rounded-xl text-[10px] font-bold">KELUAR</button>
                        ) : <span className="text-[10px] text-slate-400 font-bold uppercase">Sudah Keluar</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'residents' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 animate-in fade-in">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-slate-800">Monitoring Warga</h3>
            <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="text" placeholder="Cari warga..." className="pl-12 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-100 w-64"/></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {residents.map(res => (
              <div key={res.id} className="p-6 border border-slate-100 rounded-3xl hover:shadow-lg transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{res.houseNumber}</div>
                  <div className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{res.isHome ? 'Ada' : 'Keluar'}</div>
                </div>
                <h4 className="font-bold text-slate-800 text-lg mb-4">{res.name}</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setSelectedResidentInfo(res)} className="py-2.5 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold">INFO</button>
                  <button className="py-2.5 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold">HUBUNGI</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full"><X size={24}/></button>
          <img src={previewImage} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" alt="Preview" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {selectedResidentInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center"><h3 className="text-xl font-bold">Detail Warga</h3><button onClick={() => setSelectedResidentInfo(null)}><X size={24}/></button></div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4"><div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center font-bold text-2xl">{selectedResidentInfo.houseNumber}</div><div><h4 className="text-xl font-bold">{selectedResidentInfo.name}</h4><p className="text-sm text-slate-500">Blok {selectedResidentInfo.block}</p></div></div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status Keberadaan</p><p className="font-bold text-slate-700">{selectedResidentInfo.isHome ? 'Ada di Rumah' : 'Sedang Tidak di Rumah'}</p></div>
                <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">WhatsApp / Telepon</p><div className="flex justify-between items-center"><p className="font-bold">{selectedResidentInfo.phoneNumber}</p><button className="p-2 bg-green-500 text-white rounded-lg"><Phone size={14}/></button></div></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {aiAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className={`p-6 text-white flex justify-between items-center ${aiAnalysis.severity === 'HIGH' ? 'bg-red-600' : 'bg-amber-500'}`}><div className="flex items-center gap-3"><Shield size={24}/><h3 className="text-xl font-bold">Analisis AI Keamanan</h3></div><button onClick={() => setAiAnalysis(null)}><X size={24}/></button></div>
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-400 uppercase">Tingkat Bahaya:</span><span className={`px-4 py-1.5 rounded-full text-sm font-black tracking-widest ${aiAnalysis.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{aiAnalysis.severity}</span></div>
              <div className="space-y-3"><h4 className="font-bold text-slate-800">Saran Langkah Tindak:</h4><ul className="space-y-2">{aiAnalysis.actionPlan?.map((a: string, i: number) => (<li key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed"><span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5">{i+1}</span>{a}</li>))}</ul></div>
            </div>
            <div className="p-6 bg-slate-50"><button onClick={() => setAiAnalysis(null)} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl">Lanjutkan</button></div>
          </div>
        </div>
      )}

      {patrolActionState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className={`p-6 text-white flex justify-between items-center ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-amber-500'}`}><h3 className="text-xl font-bold">Konfirmasi: {patrolActionState.checkpoint}</h3><button onClick={() => setPatrolActionState(null)}><X size={24}/></button></div>
            <div className="p-8 space-y-4">
              <div className="space-y-1"><label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Catatan Tambahan</label><textarea placeholder="Catatan kondisi area..." className="w-full px-4 py-3 rounded-xl bg-slate-50 border min-h-[100px]" value={patrolActionNote} onChange={e => setPatrolActionNote(e.target.value)} /></div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Foto Bukti</label>
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 h-[120px] relative">
                  {patrolActionPhoto ? <img src={patrolActionPhoto} className="w-full h-full object-cover rounded-xl" alt="Patrol Evidence"/> : <><Camera className="text-slate-400" size={24}/><span className="text-xs font-bold text-slate-500 mt-2">Ambil Foto Area</span></>}
                  <input type="file" className="hidden" onChange={e => handleImageUpload(e, setPatrolActionPhoto)}/>
                </label>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3"><button onClick={() => setPatrolActionState(null)} className="flex-1 font-bold text-slate-500">Batal</button><button onClick={handlePatrolSubmit} className={`flex-1 py-3 text-white font-bold rounded-xl ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-amber-600'}`}>Kirim Status</button></div>
          </div>
        </div>
      )}

      {isAddGuestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <form onSubmit={handleAddGuest}>
              <div className="p-6 bg-amber-500 text-slate-900 flex justify-between items-center"><h3 className="text-xl font-bold">Catat Tamu Masuk</h3><button type="button" onClick={() => setIsAddGuestModalOpen(false)}><X size={24}/></button></div>
              <div className="p-8 space-y-4">
                <input type="text" required placeholder="Nama Tamu" className="w-full px-4 py-3 rounded-xl bg-slate-50 border" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
                <select required className="w-full px-4 py-3 rounded-xl bg-slate-50 border" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                  <option value="">Pilih Warga Tujuan</option>{residents.map(r => (<option key={r.id} value={r.id}>{r.name} ({r.houseNumber})</option>))}
                </select>
                <input type="text" required placeholder="Maksud Kunjungan" className="w-full px-4 py-3 rounded-xl bg-slate-50 border" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
                <label className="flex items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 h-[80px]">
                  {guestForm.photo ? <img src={guestForm.photo} className="h-full rounded-lg" alt="ID Preview"/> : <><Camera size={20} className="mr-2"/> Ambil Foto ID</>}
                  <input type="file" className="hidden" onChange={e => handleImageUpload(e, b => setGuestForm({...guestForm, photo: b}))} />
                </label>
              </div>
              <div className="p-6 bg-slate-50 flex gap-3"><button type="button" onClick={() => setIsAddGuestModalOpen(false)} className="flex-1 font-bold text-slate-500">Batal</button><button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl">Simpan</button></div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-180px)] bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden animate-in fade-in">
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-900"><MessageSquare size={20} /></div><h3 className="font-bold">Chat Keamanan Perumahan</h3></div></div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
            {messages.map((msg) => {
              const isOwn = msg.senderId === currentUser?.id;
              return (
                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl ${isOwn ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border rounded-tl-none shadow-sm'}`}>
                    <div className="text-[10px] font-bold text-slate-400 mb-1">{msg.senderName} ({msg.senderRole})</div>
                    <div className="text-sm leading-relaxed">{msg.text}</div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (!chatInput.trim() || !currentUser) return; setMessages([...messages, {id: Date.now().toString(), senderId: currentUser.id, senderName: currentUser.name, senderRole: currentUser.role, text: chatInput, timestamp: new Date().toISOString()}]); setChatInput(''); }} className="p-6 bg-white border-t flex gap-4">
            <input type="text" placeholder="Ketik pesan..." className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border outline-none" value={chatInput} onChange={e => setChatInput(e.target.value)} />
            <button type="submit" className="p-4 bg-amber-500 text-slate-900 rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"><Send size={20}/></button>
          </form>
        </div>
      )}
    </Layout>
  );
};

export default App;
