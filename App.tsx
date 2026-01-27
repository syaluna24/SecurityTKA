
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  SECURITY_USERS, 
  ADMIN_USERS, 
  RESIDENT_USERS, 
  MOCK_RESIDENTS,
  CHECKPOINTS as INITIAL_CHECKPOINTS 
} from './constants.tsx';
import { User, PatrolLog, IncidentReport, Resident, GuestLog, ChatMessage } from './types.ts';
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
  Eye
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  
  // Persisted States
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
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('tka_messages');
    return saved ? JSON.parse(saved) : [];
  });

  // UI States
  const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false);
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '', photo: '' });
  const [selectedResidentInfo, setSelectedResidentInfo] = useState<Resident | null>(null);
  const [patrolActionState, setPatrolActionState] = useState<{checkpoint: string, status: 'OK' | 'WARNING' | 'DANGER'} | null>(null);
  const [patrolActionPhoto, setPatrolActionPhoto] = useState<string>('');
  const [patrolActionNote, setPatrolActionNote] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [incidentForm, setIncidentForm] = useState({ type: 'Kriminalitas', location: '', description: '', photo: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');
  const [residentSearch, setResidentSearch] = useState('');

  // Persist Data on Change
  useEffect(() => {
    localStorage.setItem('tka_messages', JSON.stringify(messages));
    localStorage.setItem('tka_guests', JSON.stringify(guests));
    localStorage.setItem('tka_incidents', JSON.stringify(incidents));
    localStorage.setItem('tka_patrol_logs', JSON.stringify(patrolLogs));
  }, [messages, guests, incidents, patrolLogs]);

  // AI Briefing
  useEffect(() => {
    if (currentUser && (currentUser.role === 'SECURITY' || currentUser.role === 'ADMIN')) {
      const isMorning = new Date().getHours() >= 7 && new Date().getHours() < 19;
      getSecurityBriefing(isMorning ? 'Pagi' : 'Malam').then(setSecurityBriefing);
    }
  }, [currentUser]);

  // Chat Auto-scroll
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const filteredResidents = useMemo(() => {
    return MOCK_RESIDENTS.filter(r => 
      r.name.toLowerCase().includes(residentSearch.toLowerCase()) || 
      r.houseNumber.toLowerCase().includes(residentSearch.toLowerCase())
    );
  }, [residentSearch]);

  const chartData = useMemo(() => {
    const blocks = ['A', 'B', 'C', 'D'];
    return blocks.map(block => ({
      name: `Blok ${block}`,
      incidents: incidents.filter(inc => inc.location.toUpperCase().includes(`BLOK ${block}`)).length
    }));
  }, [incidents]);

  // Handlers
  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedUser(null);
    setPasswordInput('');
    setActiveTab('dashboard');
  };

  const updateIncidentStatus = (id: string, status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED') => {
    setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, status } : inc));
  };

  const handleGuestExit = (id: string) => {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, status: 'OUT', exitTime: new Date().toISOString() } : g));
  };

  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestForm.name || !guestForm.visitToId) return;
    const resident = MOCK_RESIDENTS.find(r => r.id === guestForm.visitToId);
    const newGuest: GuestLog = {
      id: Date.now().toString(),
      name: guestForm.name!,
      visitToId: guestForm.visitToId!,
      visitToName: resident?.name || 'Unknown',
      purpose: guestForm.purpose || '',
      entryTime: new Date().toISOString(),
      status: 'IN',
      photo: guestForm.photo
    };
    setGuests([newGuest, ...guests]);
    setIsAddGuestModalOpen(false);
    setGuestForm({ name: '', visitToId: '', purpose: '', photo: '' });
  };

  const handleAttemptLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const pass = passwordInput.trim();
    let isValid = false;
    if (selectedUser.role === 'SECURITY' && pass === '123456') isValid = true;
    else if (selectedUser.role === 'ADMIN' && pass === 'admin123') isValid = true;
    else if (selectedUser.role === 'RESIDENT' && pass === 'wargatka123456') isValid = true;

    if (isValid) {
      setCurrentUser(selectedUser);
      setActiveTab('dashboard');
      setLoginError('');
    } else {
      setLoginError('Password salah.');
    }
  };

  const handlePatrolSubmit = () => {
    if (!patrolActionState || !currentUser) return;
    const newLog: PatrolLog = {
      id: Date.now().toString(),
      securityId: currentUser.id,
      securityName: currentUser.name,
      timestamp: new Date().toISOString(),
      checkpoint: patrolActionState.checkpoint,
      status: patrolActionState.status,
      note: patrolActionNote,
      photo: patrolActionPhoto
    };
    setPatrolLogs([newLog, ...patrolLogs]);
    setPatrolActionState(null);
    setPatrolActionPhoto('');
    setPatrolActionNote('');
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
    setIncidents([newIncident, ...incidents]);
    setIncidentForm({ type: 'Kriminalitas', location: '', description: '', photo: '' });
    setIsAnalyzing(false);
  };

  if (!currentUser) {
    const displayUsers = loginTab === 'SECURITY' ? SECURITY_USERS : loginTab === 'ADMIN' ? ADMIN_USERS : RESIDENT_USERS;
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>
          <div className="flex flex-col items-center mb-8">
            <div className="bg-amber-500 p-5 rounded-3xl shadow-xl shadow-amber-500/20 mb-6"><Shield size={48} className="text-slate-900" /></div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">TKA Secure</h1>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-2">Integrated Security Portal</p>
          </div>

          <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-8">
            {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map((tab) => (
              <button key={tab} onClick={() => { setLoginTab(tab); setSelectedUser(null); setLoginError(''); }}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  loginTab === tab ? 'bg-white text-slate-900 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'SECURITY' ? 'Satpam' : tab === 'ADMIN' ? 'Admin' : 'Warga'}
              </button>
            ))}
          </div>
          
          <form onSubmit={handleAttemptLogin} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pilih Akun Bertugas</label>
              <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                {displayUsers.map(u => (
                  <button key={u.id} type="button" onClick={() => setSelectedUser(u)} 
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${
                      selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50/50 ring-4 ring-amber-500/10' : 'border-slate-50 hover:border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-700 font-black border border-slate-100 uppercase text-lg">{u.name.charAt(0)}</div>
                    <div className="text-left">
                      <p className="text-base font-black text-slate-900">{u.name}</p>
                      <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">{u.role}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedUser && (
              <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors"><Lock size={20} /></div>
                  <input type="password" required placeholder={`Password untuk ${selectedUser.name}...`} 
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 focus:bg-white outline-none transition-all font-bold text-slate-900" 
                    value={passwordInput} onChange={e => setPasswordInput(e.target.value)} 
                  />
                </div>
                {loginError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest px-1 text-center">{loginError}</p>}
              </div>
            )}

            <button type="submit" disabled={!selectedUser} 
              className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-2xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-3 tracking-tight"
            >
              Masuk Dashboard <ArrowRight size={22} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-700">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { label: 'Patroli Hari Ini', val: patrolLogs.length, icon: <CheckCircle2 size={24}/>, color: 'amber' },
              { label: 'Insiden Aktif', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Terdaftar', val: guests.filter(g => g.status === 'IN').length, icon: <Users size={24}/>, color: 'blue' },
              { label: 'Shift Aktif', val: new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Pagi' : 'Malam', icon: <Clock size={24}/>, color: 'green' }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 transition-all hover:shadow-xl group">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                  stat.color === 'amber' ? 'bg-amber-50 text-amber-600' : 
                  stat.color === 'red' ? 'bg-red-50 text-red-600' : 
                  stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}>{stat.icon}</div>
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{stat.label}</h3>
                <p className="text-2xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-black text-slate-900">Grafik Insiden Per Blok</h3>
                <TrendingUp className="text-slate-200" size={32} />
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 800}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 800}} />
                    <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="incidents" radius={[12, 12, 12, 12]} barSize={45}>
                      {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#10B981', '#EF4444'][index % 4]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <Shield size={24} className="text-amber-500" />
                  <h3 className="font-black text-xl">AI Briefing</h3>
                </div>
                <p className="text-slate-300 text-sm italic leading-relaxed font-medium">"{securityBriefing || 'Menganalisis situasi keamanan...'}"</p>
                <button onClick={() => setActiveTab('patrol')} className="w-full bg-amber-500 text-slate-900 font-black py-4 rounded-2xl mt-10 shadow-xl text-sm flex items-center justify-center gap-3 transition-transform hover:scale-[1.03] active:scale-95">Mulai Patroli <ArrowRight size={20}/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'patrol' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700 max-w-6xl mx-auto pb-24">
          <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-5 mb-10">
              <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 shadow-inner"><MapPin size={32}/></div>
              <div><h3 className="text-2xl font-black text-slate-900">Checkpoint Patroli</h3><p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Sertifikasi Keamanan Lokasi</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {INITIAL_CHECKPOINTS.map((cp, idx) => (
                <div key={idx} className="flex items-center justify-between p-8 border-2 border-slate-50 rounded-[2.5rem] hover:border-amber-500/40 hover:bg-amber-50/10 transition-all group">
                  <div className="flex items-center gap-5">
                    <span className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-lg">{idx + 1}</span>
                    <span className="font-black text-slate-700 text-lg">{cp}</span>
                  </div>
                  <div className="flex gap-2.5">
                    <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'OK' })} className="p-3.5 bg-green-50 text-green-600 rounded-2xl hover:bg-green-100 transition-colors shadow-sm"><CheckCircle size={22}/></button>
                    <button onClick={() => setPatrolActionState({ checkpoint: cp, status: 'WARNING' })} className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-100 transition-colors shadow-sm"><AlertTriangle size={22}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'incident' && (
        <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-top-4 duration-700 pb-20">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="text-2xl font-black text-slate-900 mb-8">Laporkan Kejadian Baru</h3>
            <form onSubmit={handleIncidentSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <select required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-red-500" value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value})}>
                    <option value="Kriminalitas">Kriminalitas</option>
                    <option value="Kebakaran">Kebakaran</option>
                    <option value="Medis">Darurat Medis</option>
                    <option value="Gangguan">Gangguan Ketertiban</option>
                  </select>
                  <input type="text" required placeholder="Lokasi Detail..." className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none" value={incidentForm.location} onChange={e => setIncidentForm({...incidentForm, location: e.target.value})} />
                </div>
                <textarea required placeholder="Jelaskan kronologi kejadian..." className="w-full px-6 py-5 rounded-[2rem] bg-slate-50 border-2 border-slate-100 font-bold outline-none min-h-[160px]" value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} />
              </div>
              <div className="space-y-6">
                <label className="flex flex-col items-center justify-center p-8 border-3 border-dashed border-slate-100 rounded-[2.5rem] hover:bg-slate-50 cursor-pointer h-[230px] relative overflow-hidden group">
                  {incidentForm.photo ? <img src={incidentForm.photo} className="w-full h-full object-cover rounded-2xl" /> : <><Camera size={48} className="text-slate-200" /><span className="text-[10px] font-black uppercase mt-4 text-slate-300">Ambil Bukti Foto</span></>}
                  <input type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setIncidentForm({...incidentForm, photo: r.result as string}); r.readAsDataURL(f); } }} />
                </label>
                <button type="submit" disabled={isAnalyzing} className="w-full bg-red-600 text-white font-black py-5 rounded-[2rem] shadow-2xl hover:bg-red-700 active:scale-95 transition-all">
                  {isAnalyzing ? 'Menganalisis...' : 'Kirim Laporan'}
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {incidents.length > 0 ? incidents.map(inc => (
              <div key={inc.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-black text-xl text-slate-900 leading-none mb-1">{inc.type}</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{inc.location}</p>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${inc.status === 'RESOLVED' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{inc.status}</span>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed italic mb-8 line-clamp-3">"{inc.description}"</p>
                <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Oleh: {inc.reporterName}</p>
                  <div className="flex gap-2">
                    {inc.photo && <button onClick={() => setPreviewImage(inc.photo!)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><Eye size={18}/></button>}
                    {inc.status !== 'RESOLVED' && (currentUser.role === 'ADMIN' || currentUser.role === 'SECURITY') && (
                      <button onClick={() => updateIncidentStatus(inc.id, 'RESOLVED')} className="p-3 bg-green-500 text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all"><CheckCircle size={18}/></button>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <div className="col-span-full py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                <Shield size={64} className="mb-4 opacity-10" />
                <p className="font-bold italic text-sm">Belum ada riwayat insiden keamanan.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'guests' && (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black text-slate-900">Buku Tamu Digital</h3>
              <button onClick={() => setIsAddGuestModalOpen(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-black shadow-xl hover:scale-105 transition-all">
                <UserPlus size={20}/> Catat Tamu
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {guests.length > 0 ? guests.map(g => (
                <div key={g.id} className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 transition-all hover:bg-white hover:shadow-2xl group">
                  <div className="flex gap-5 mb-6">
                     <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center font-black text-slate-400 border-2 border-slate-100 text-xl shadow-sm">{g.name.charAt(0)}</div>
                     <div><p className="font-black text-slate-900 text-xl tracking-tight leading-none mb-1">{g.name}</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{g.purpose}</p></div>
                  </div>
                  <div className="space-y-3 mb-8">
                    <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tujuan</span>
                      <span className="text-sm font-bold text-slate-900">{g.visitToName}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masuk</span>
                      <span className="text-sm font-bold text-slate-900">{new Date(g.entryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                  {g.status === 'IN' ? (
                    <button onClick={() => handleGuestExit(g.id)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:bg-blue-600 transition-all">
                      Check Out Tamu
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-white border-2 border-dashed border-slate-200 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest rounded-2xl">Selesai Kunjungan</div>
                  )}
                </div>
              )) : (
                <div className="col-span-full py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                  <Users size={64} className="mb-4 opacity-10" />
                  <p className="font-bold italic text-sm">Belum ada tamu terdaftar hari ini.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'residents' && (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
              <h3 className="text-3xl font-black text-slate-900">Database Warga</h3>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={24}/>
                <input type="text" placeholder="Cari Nama / Rumah..." className="w-full pl-14 pr-6 py-5 rounded-[2rem] bg-slate-50 border-2 border-slate-50 focus:border-amber-500 outline-none font-bold" value={residentSearch} onChange={e => setResidentSearch(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredResidents.map(res => (
                <div key={res.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] hover:shadow-2xl transition-all group">
                  <div className="flex justify-between items-start mb-8">
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-xl border-4 border-white ${res.isHome ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{res.houseNumber}</div>
                    <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>{res.isHome ? 'Di Rumah' : 'Di Luar'}</div>
                  </div>
                  <h4 className="font-black text-slate-900 text-2xl tracking-tight mb-8 leading-tight">{res.name}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setSelectedResidentInfo(res)} className="py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">Profil</button>
                    <a href={`tel:${res.phoneNumber}`} className="py-4 bg-green-500 text-white rounded-2xl flex items-center justify-center hover:bg-green-600 transition-all shadow-lg shadow-green-500/20"><Phone size={18}/></a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-200px)] bg-white rounded-[3rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in">
          <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
            <h3 className="font-black text-xl tracking-tight">Komunikasi Warga & Keamanan</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/30 no-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderId === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-6 rounded-[2rem] shadow-sm ${msg.senderId === currentUser?.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border border-slate-100 rounded-tl-none'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${msg.senderId === currentUser?.id ? 'text-amber-400' : 'text-slate-400'}`}>{msg.senderName} • {msg.senderRole}</p>
                  <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (!chatInput.trim()) return; setMessages([...messages, {id: Date.now().toString(), senderId: currentUser!.id, senderName: currentUser!.name, senderRole: currentUser!.role, text: chatInput, timestamp: new Date().toISOString()}]); setChatInput(''); }} className="p-6 bg-white border-t border-slate-100 flex gap-4">
            <input type="text" placeholder="Ketik pesan..." className="flex-1 px-8 py-4 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-amber-500 outline-none font-bold" value={chatInput} onChange={e => setChatInput(e.target.value)} />
            <button type="submit" className="p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl hover:scale-105 transition-all"><Send size={24}/></button>
          </form>
        </div>
      )}

      {/* Modals & Previews */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-[85vh] object-contain rounded-[3rem] shadow-2xl border-4 border-white/10" alt="Full Preview" />
        </div>
      )}

      {patrolActionState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden">
            <div className={`p-10 text-white flex justify-between items-center ${patrolActionState.status === 'OK' ? 'bg-green-600' : 'bg-amber-500'}`}>
              <h3 className="text-2xl font-black tracking-tight">{patrolActionState.checkpoint}</h3>
              <button onClick={() => setPatrolActionState(null)}><X size={28}/></button>
            </div>
            <div className="p-10 space-y-8">
              <textarea placeholder="Catatan kondisi area..." className="w-full px-6 py-5 rounded-[2rem] bg-slate-50 border-2 border-slate-50 outline-none font-bold min-h-[140px] text-lg" value={patrolActionNote} onChange={e => setPatrolActionNote(e.target.value)} />
              <label className="flex flex-col items-center justify-center p-8 border-3 border-dashed border-slate-100 rounded-[2.5rem] cursor-pointer hover:bg-slate-50 h-[180px] relative overflow-hidden transition-colors">
                {patrolActionPhoto ? <img src={patrolActionPhoto} className="w-full h-full object-cover" /> : <><Camera className="text-slate-300" size={40}/><span className="text-xs font-black text-slate-400 uppercase mt-4 tracking-widest">Foto Dokumentasi</span></>}
                <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setPatrolActionPhoto(r.result as string); r.readAsDataURL(f); } }}/>
              </label>
            </div>
            <div className="p-10 bg-slate-50 flex gap-6">
              <button onClick={() => setPatrolActionState(null)} className="flex-1 font-black text-slate-400 uppercase tracking-widest text-sm">Batal</button>
              <button onClick={handlePatrolSubmit} className={`flex-1 py-5 text-white font-black rounded-2xl shadow-2xl uppercase tracking-widest text-sm ${patrolActionState.status === 'OK' ? 'bg-green-600 shadow-green-500/30' : 'bg-amber-600 shadow-amber-500/30'}`}>Kirim Laporan</button>
            </div>
          </div>
        </div>
      )}

      {isAddGuestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden">
            <form onSubmit={handleAddGuest}>
              <div className="p-10 bg-slate-900 text-white flex justify-between items-center"><h3 className="text-2xl font-black tracking-tight">Tamu Baru</h3><button type="button" onClick={() => setIsAddGuestModalOpen(false)}><X size={28}/></button></div>
              <div className="p-10 space-y-6">
                <input type="text" required placeholder="Nama Tamu Lengkap..." className="w-full px-6 py-5 rounded-[2rem] bg-slate-50 border-2 border-slate-50 outline-none font-bold text-lg" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
                <select required className="w-full px-6 py-5 rounded-[2rem] bg-slate-50 border-2 border-slate-50 outline-none font-bold text-lg appearance-none" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                  <option value="">Warga Tujuan...</option>{MOCK_RESIDENTS.map(r => (<option key={r.id} value={r.id}>{r.name} ({r.houseNumber})</option>))}
                </select>
                <input type="text" required placeholder="Keperluan Kunjungan..." className="w-full px-6 py-5 rounded-[2rem] bg-slate-50 border-2 border-slate-50 outline-none font-bold text-lg" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
                <label className="flex items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer h-[100px] overflow-hidden hover:bg-slate-50 transition-colors">
                  {guestForm.photo ? <img src={guestForm.photo} className="h-full rounded-2xl shadow-sm" /> : <><Camera size={24} className="mr-4 text-slate-300"/> <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto ID Tamu</span></>}
                  <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setGuestForm({...guestForm, photo: r.result as string}); r.readAsDataURL(f); } }} />
                </label>
              </div>
              <div className="p-10 bg-slate-50 flex gap-6"><button type="button" onClick={() => setIsAddGuestModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase tracking-widest text-sm">Batal</button><button type="submit" className="flex-1 py-5 bg-slate-900 text-white font-black rounded-2xl shadow-2xl uppercase tracking-widest text-sm">Simpan Data</button></div>
            </form>
          </div>
        </div>
      )}

      {selectedResidentInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><h3 className="text-xl font-black">Profil Hunian</h3><button onClick={() => setSelectedResidentInfo(null)}><X size={24}/></button></div>
            <div className="p-10 space-y-8">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-[2rem] flex items-center justify-center font-black text-4xl border-4 border-white shadow-xl">{selectedResidentInfo.houseNumber}</div>
                <div><h4 className="text-2xl font-black text-slate-900">{selectedResidentInfo.name}</h4><p className="text-xs text-slate-400 font-black uppercase tracking-widest">Blok {selectedResidentInfo.block}</p></div>
              </div>
              <div className="space-y-4">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Kontak Darurat</p><p className="font-black text-slate-900 text-lg">{selectedResidentInfo.phoneNumber}</p></div>
              </div>
            </div>
            <div className="p-10 bg-slate-50"><button onClick={() => setSelectedResidentInfo(null)} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl">Tutup Profil</button></div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
