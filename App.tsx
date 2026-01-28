
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
  Activity, MessageSquare, BellRing, Database, RefreshCw, 
  PhoneCall, Info, Ghost, Trash2, UserCheck, BookOpen, ClipboardCheck, Radio, Copy, Check
} from 'lucide-react';
import { analyzeIncident, getSecurityBriefing } from './services/geminiService.ts';
import { DatabaseService } from './services/databaseService.ts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

// Saluran untuk sinkronisasi antar tab di perangkat yang sama
const syncChannel = new BroadcastChannel('tka_secure_sync');

const App: React.FC = () => {
  const [db, setDb] = useState<FullDatabase>(() => DatabaseService.getDatabase(INITIAL_DB));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginSearch, setLoginSearch] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'SECURITY' | 'CHECKPOINT' | 'GUEST' | 'INCIDENT' | 'SOS_MODAL' | 'SYNC' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [securityBriefing, setSecurityBriefing] = useState<string>('');
  const [syncCode, setSyncCode] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [secForm, setSecForm] = useState<Partial<User>>({ name: '', role: 'SECURITY', phoneNumber: '' });
  const [cpForm, setCpForm] = useState('');
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '' });
  const [incForm, setIncForm] = useState({ type: 'Kriminalitas', location: '', description: '' });
  const [patrolAction, setPatrolAction] = useState<{cp: string, status: 'OK' | 'WARNING' | 'DANGER'} | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Efek untuk menyimpan dan menyiarkan perubahan data
  useEffect(() => {
    DatabaseService.saveDatabase(db);
    syncChannel.postMessage({ type: 'UPDATE_DB', payload: db });
  }, [db]);

  // Efek untuk menerima update dari tab lain
  useEffect(() => {
    const handleSync = (event: MessageEvent) => {
      if (event.data.type === 'UPDATE_DB') {
        setDb(event.data.payload);
      }
    };
    syncChannel.addEventListener('message', handleSync);
    return () => syncChannel.removeEventListener('message', handleSync);
  }, []);

  useEffect(() => {
    if (currentUser) {
      const shift = new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Pagi' : 'Malam';
      getSecurityBriefing(shift).then(setSecurityBriefing);
    }
  }, [currentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [db.chatMessages]);

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

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
    setSelectedUser(null);
  };

  const liveTimeline = useMemo(() => {
    const combined = [
      ...db.patrolLogs.map(l => ({ ...l, feedType: 'PATROL', sortTime: l.timestamp })),
      ...db.incidents.map(i => ({ ...i, feedType: 'INCIDENT', sortTime: i.timestamp })),
      ...db.guests.map(g => ({ ...g, feedType: 'GUEST', sortTime: g.entryTime }))
    ];
    return combined.sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime()).slice(0, 20);
  }, [db.patrolLogs, db.incidents, db.guests]);

  const submitPatrol = (status: 'OK' | 'WARNING' | 'DANGER') => {
    if (!patrolAction || !currentUser) return;
    const log: PatrolLog = {
      id: `p-${Date.now()}`, securityId: currentUser.id, securityName: currentUser.name, timestamp: new Date().toISOString(),
      checkpoint: patrolAction.cp, status, note: 'Patroli Kawasan rutin dilakukan.'
    };
    setDb(prev => ({ ...prev, patrolLogs: [log, ...prev.patrolLogs] }));
    setPatrolAction(null);
  };

  const handleSyncData = (e: React.FormEvent) => {
    e.preventDefault();
    const success = DatabaseService.importSyncCode(syncCode);
    if (success) {
      setDb(DatabaseService.getDatabase(INITIAL_DB));
      setIsModalOpen(null);
      setSyncCode('');
      alert("Data berhasil disinkronkan dari perangkat lain!");
    } else {
      alert("Kode Sinkronisasi tidak valid.");
    }
  };

  const chartData = useMemo(() => [
    { name: 'Patroli', val: db.patrolLogs.length },
    { name: 'Tamu', val: db.guests.length },
    { name: 'Insiden', val: db.incidents.length }
  ], [db]);

  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? db.securityUsers : loginTab === 'ADMIN' ? ADMIN_USERS : db.residents.map(r => ({ id: r.id, name: r.name, sub: `Blok ${r.block} No. ${r.houseNumber}` }));
    const filteredPool = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()) || (u.sub && u.sub.toLowerCase().includes(loginSearch.toLowerCase())));

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[900px] flex flex-col md:flex-row rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
          <div className="w-full md:w-5/12 bg-slate-900 p-10 text-white flex flex-col justify-between">
            <div>
              <div className="bg-amber-500 w-14 h-14 rounded-2xl flex items-center justify-center mb-8">
                <Shield size={28} className="text-slate-900" />
              </div>
              <h1 className="text-3xl font-black mb-2 tracking-tighter">TKA SECURE</h1>
              <p className="text-slate-400 text-sm">Sistem Keamanan Terintegrasi.</p>
            </div>
            <div className="p-5 bg-slate-800 rounded-2xl border border-slate-700">
               <div className="flex items-center gap-2 mb-2">
                 <RefreshCw size={14} className="text-amber-500 animate-spin-slow"/>
                 <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Sistem Aktif</span>
               </div>
               <p className="text-[9px] text-slate-500 font-bold uppercase">Data tersimpan lokal dan dapat disinkronkan antar perangkat.</p>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 md:p-12 h-[700px] flex flex-col">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Pilih Akun</h2>
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); setLoginSearch(''); }}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all ${loginTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
                  {t === 'SECURITY' ? 'Satpam' : t === 'ADMIN' ? 'Admin' : 'Warga'}
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="text" placeholder={`Cari nama...`}
                className="w-full pl-12 pr-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-50 focus:border-amber-500 focus:bg-white outline-none font-bold text-sm transition-all shadow-inner"
                value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pr-1 mb-6 space-y-2">
              {filteredPool.map((u: any) => (
                <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setLoginError(''); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-sm truncate">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{u.sub || 'Staf Operasional'}</p>
                  </div>
                </button>
              ))}
            </div>

            {selectedUser && (
              <form onSubmit={handleLogin} className="pt-4 border-t border-slate-100 space-y-4">
                <input type="password" required placeholder="PIN (123456 / admin123)"
                  className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-xl tracking-[0.5em] text-center" 
                  value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center">{loginError}</p>}
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95 shadow-xl">
                  MASUK SISTEM <ArrowRight size={16} />
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
        <div className="space-y-6 animate-slide-up pb-20">
          {currentUser.role === 'RESIDENT' && (
            <div className="bg-red-600 p-8 rounded-[2rem] text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[50px] rounded-full"></div>
               <div className="flex items-center gap-6 relative z-10">
                 <div className="bg-white/20 p-4 rounded-2xl animate-pulse"><BellRing size={32} /></div>
                 <div>
                    <h3 className="text-xl font-black mb-1">PANGGILAN DARURAT (SOS)</h3>
                    <p className="text-xs text-red-100 font-medium">Satpam akan segera menuju lokasi Anda jika tombol ditekan.</p>
                 </div>
               </div>
               <button onClick={() => { 
                 const sos: IncidentReport = {
                   id: `sos-${Date.now()}`, reporterId: currentUser.id, reporterName: currentUser.name, timestamp: new Date().toISOString(),
                   type: 'SOS / EMERGENCY', location: 'Unit Warga', description: 'Warga membutuhkan bantuan darurat segera!', status: 'PENDING', severity: 'HIGH'
                 };
                 setDb(prev => ({ ...prev, incidents: [sos, ...prev.incidents] }));
                 setIsModalOpen('SOS_MODAL');
                 setTimeout(() => setIsModalOpen(null), 3000);
               }} className="bg-white text-red-600 px-8 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl relative z-10 active:scale-95">AKTIFKAN SOS SEKARANG</button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Tim Satpam', val: db.securityUsers.length, icon: <UserCheck size={20}/>, color: 'blue' },
              { label: 'Insiden Baru', val: db.incidents.filter(i => i.status === 'PENDING').length, icon: <AlertTriangle size={20}/>, color: 'red' },
              { label: 'Tamu Aktif', val: db.guests.filter(g => g.status === 'IN').length, icon: <Users size={20}/>, color: 'amber' },
              { label: 'Total Warga', val: db.residents.length, icon: <Home size={20}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                <p className="text-xl font-black text-slate-900 tracking-tighter">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 min-h-[300px]">
               <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-3"><Activity size={18} className="text-amber-500"/> Ringkasan Operasional Kawasan</h3>
               <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="val" radius={[6, 6, 6, 6]} barSize={40}>
                        {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#10B981'][index % 3]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col justify-between">
               <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 blur-[60px] rounded-full"></div>
               <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <Radio size={24} className="text-amber-500 animate-pulse"/>
                    <h3 className="font-black text-lg">SECURITY BRIEFING</h3>
                  </div>
                  <p className="text-slate-400 text-xs italic leading-relaxed font-medium">"{securityBriefing || 'Mempersiapkan instruksi harian tim keamanan...'}"</p>
               </div>
               <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-4 rounded-xl mt-6 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 shadow-xl transition-all hover:bg-amber-400">KOORDINASI TIM <ArrowRight size={16}/></button>
            </div>
          </div>
        </div>
      )}

      {/* PATROL */}
      {activeTab === 'patrol' && (
        <div className="space-y-6 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900">Kontrol Patroli Wilayah</h3>
              {currentUser.role === 'ADMIN' && (
                <button onClick={() => { setEditingItem(null); setCpForm(''); setIsModalOpen('CHECKPOINT'); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-black text-[9px] uppercase flex items-center gap-2 active:scale-95">
                  <Plus size={16}/> TAMBAH TITIK
                </button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {db.checkpoints.map((cp, idx) => {
                const last = db.patrolLogs.filter(l => l.checkpoint === cp)[0];
                return (
                  <div key={idx} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl group-hover:bg-amber-500 transition-colors shadow-lg">{idx + 1}</div>
                        <div className="flex gap-1">
                          {currentUser.role === 'ADMIN' && <button onClick={() => { setEditingItem(idx); setCpForm(cp); setIsModalOpen('CHECKPOINT'); }} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-amber-500 transition-all"><Edit2 size={14}/></button>}
                          {last && <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${last.status === 'OK' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{last.status}</span>}
                        </div>
                      </div>
                      <h4 className="text-lg font-black text-slate-900 mb-8 uppercase tracking-tight leading-tight">{cp}</h4>
                    </div>
                    {currentUser.role === 'SECURITY' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setPatrolAction({cp, status: 'OK'})} className="py-4 bg-green-500 text-white rounded-xl font-black text-[9px] uppercase active:scale-95 shadow-md">AREA AMAN</button>
                        <button onClick={() => setPatrolAction({cp, status: 'DANGER'})} className="py-4 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase active:scale-95 shadow-md">ADA BAHAYA</button>
                      </div>
                    ) : (
                      <div className="text-[10px] font-black text-slate-400 uppercase border-t pt-4 italic">Log: {last ? `${last.securityName} (${new Date(last.timestamp).toLocaleTimeString()})` : 'Belum Terdata'}</div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* REPORTS (LIVE FEED) */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900">Live Security Timeline</h3>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Activity</span>
              </div>
           </div>
           
           <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 min-h-[500px]">
              <div className="space-y-8">
                {liveTimeline.length > 0 ? liveTimeline.map((item: any, idx) => (
                  <div key={idx} className="flex gap-6 group">
                     <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${item.feedType === 'PATROL' ? 'bg-slate-900 text-white' : item.feedType === 'INCIDENT' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                           {item.feedType === 'PATROL' ? <ClipboardCheck size={18}/> : item.feedType === 'INCIDENT' ? <AlertTriangle size={18}/> : <BookOpen size={18}/>}
                        </div>
                        <div className="w-0.5 flex-1 bg-slate-50 mt-3"></div>
                     </div>
                     <div className="flex-1 pb-8">
                        <div className="flex justify-between items-center mb-1">
                           <h4 className="font-black text-slate-900 text-sm tracking-tight">{item.feedType === 'PATROL' ? `Petugas mengecek ${item.checkpoint}` : item.feedType === 'INCIDENT' ? `Laporan: ${item.type}` : `Pendaftaran Tamu Baru`}</h4>
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{new Date(item.sortTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mb-3 italic leading-relaxed">
                          {item.feedType === 'PATROL' ? `Area dipastikan dalam kondisi ${item.status} oleh ${item.securityName}.` : item.description || `Menerima kunjungan tamu untuk unit ${item.visitToName}.`}
                        </p>
                        <div className="flex gap-2">
                           <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${item.status === 'OK' || item.status === 'RESOLVED' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{item.status || 'AKTIF'}</span>
                           <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[8px] font-black uppercase tracking-tighter">Oleh: {item.securityName || 'Pos Utama'}</span>
                        </div>
                     </div>
                  </div>
                )) : (
                  <div className="py-32 text-center text-slate-300 italic font-black uppercase text-xs">Belum ada aktivitas terekam hari ini.</div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* GUESTS */}
      {activeTab === 'guests' && (
        <div className="space-y-6 animate-slide-up pb-20">
           <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900">Buku Tamu Kawasan</h3>
              <button onClick={() => setIsModalOpen('GUEST')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase flex items-center gap-2 shadow-lg active:scale-95 shadow-blue-600/20"><UserPlus size={18}/> TAMU BARU</button>
           </div>
           <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">Nama Tamu</th>
                    <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">Tujuan Unit</th>
                    <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">Waktu Masuk</th>
                    <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                    <th className="px-8 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {db.guests.map(g => (
                     <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-8 py-5">
                          <p className="font-black text-slate-900 text-sm">{g.name}</p>
                          <p className="text-[10px] text-slate-400 italic font-medium">{g.purpose}</p>
                       </td>
                       <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase">{g.visitToName}</td>
                       <td className="px-8 py-5 text-[10px] font-black text-slate-400">{new Date(g.entryTime).toLocaleString()}</td>
                       <td className="px-8 py-5">
                          <span className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${g.status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{g.status === 'IN' ? 'DI AREA' : 'KELUAR'}</span>
                       </td>
                       <td className="px-8 py-5 text-right">
                          {g.status === 'IN' && <button onClick={() => setDb(prev => ({...prev, guests: prev.guests.map(item => item.id === g.id ? {...item, status: 'OUT'} : item)}))} className="p-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"><LogOut size={16}/></button>}
                       </td>
                     </tr>
                   ))}
                   {db.guests.length === 0 && (
                     <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-black uppercase italic text-xs tracking-widest">Belum ada tamu terdaftar hari ini.</td></tr>
                   )}
                </tbody>
              </table>
           </div>
        </div>
      )}

      {/* INCIDENT */}
      {activeTab === 'incident' && (
        <div className="space-y-6 animate-slide-up pb-20">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-900">Daftar Insiden & SOS</h3>
            <button onClick={() => setIsModalOpen('INCIDENT')} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase flex items-center gap-2 shadow-lg active:scale-95 shadow-red-600/20"><AlertTriangle size={18}/> LAPOR BARU</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {db.incidents.length > 0 ? db.incidents.map(i => (
              <div key={i.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all">
                <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 ${i.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                <div>
                   <div className="flex justify-between items-start mb-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${i.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{i.severity} Priority</span>
                      <span className="text-[10px] font-black text-slate-400">{new Date(i.timestamp).toLocaleDateString()}</span>
                   </div>
                   <h4 className="text-lg font-black text-slate-900 mb-1 leading-none">{i.type}</h4>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin size={12} className="text-amber-500"/> {i.location}</p>
                   <p className="text-xs text-slate-600 leading-relaxed italic mb-8">"{i.description}"</p>
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">{i.reporterName.charAt(0)}</div>
                      <p className="text-[10px] font-black text-slate-900 uppercase">{i.reporterName}</p>
                   </div>
                   <span className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-full ${i.status === 'RESOLVED' ? 'bg-green-50 text-green-500' : 'bg-amber-50 text-amber-500'}`}>{i.status}</span>
                </div>
              </div>
            )) : (
              <div className="col-span-full py-32 text-center bg-white rounded-[2rem] border-4 border-dashed border-slate-100">
                 <Ghost size={48} className="mx-auto text-slate-200 mb-4" />
                 <p className="text-slate-300 font-black uppercase italic text-[10px] tracking-widest">Kawasan terpantau aman. Tidak ada laporan aktif.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESIDENTS */}
      {activeTab === 'residents' && (
        <div className="space-y-6 animate-slide-up pb-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-xl font-black text-slate-900">Manajemen Hunian Warga</h3>
            <div className="flex gap-2">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                <input type="text" placeholder="Cari warga/blok..." className="pl-11 pr-6 py-3 rounded-xl bg-white border border-slate-200 text-xs outline-none focus:border-amber-500 font-bold w-full md:w-[250px] shadow-sm transition-all" 
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              {currentUser.role === 'ADMIN' && <button onClick={() => { setEditingItem(null); setResForm({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true }); setIsModalOpen('RESIDENT'); }} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-[9px] uppercase flex items-center gap-2 active:scale-95 shadow-xl"><Plus size={18}/> TAMBAH</button>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {db.residents.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.block.toLowerCase().includes(searchQuery.toLowerCase())).map(res => (
              <div key={res.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg transition-all group">
                <div>
                  <div className="flex justify-between items-start mb-6">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 text-slate-900 flex items-center justify-center font-black text-sm border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all">{res.block}</div>
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${res.isHome ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>{res.isHome ? 'ADA DI UNIT' : 'KELUAR'}</span>
                  </div>
                  <h4 className="font-black text-lg text-slate-900 mb-1 tracking-tight leading-tight">{res.name}</h4>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">No. Hunian: <span className="text-slate-900">{res.houseNumber}</span></p>
                </div>
                <div className="mt-8 flex gap-2">
                  <a href={`tel:${res.phoneNumber}`} className="flex-1 py-3 bg-green-500 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-green-600 active:scale-95 transition-all"><PhoneCall size={18}/></a>
                  {currentUser.role === 'ADMIN' && <button onClick={() => { setEditingItem(res); setResForm(res); setIsModalOpen('RESIDENT'); }} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-amber-500 hover:bg-amber-50 transition-all"><Edit2 size={16}/></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CHAT */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-220px)] flex flex-col animate-slide-up pb-10">
           <div className="flex-1 bg-white rounded-t-[2.5rem] shadow-sm border border-slate-100 overflow-y-auto p-8 space-y-6 no-scrollbar">
              {db.chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-5 rounded-[1.8rem] shadow-sm ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-6 mb-1.5">
                         <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                         <span className="text-[8px] font-bold px-2 py-0.5 bg-white/10 rounded-full uppercase opacity-50">{msg.senderRole}</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                      <p className="text-[8px] mt-2 opacity-30 text-right font-black uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              ))}
              {db.chatMessages.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-200 italic opacity-50"><Ghost size={48} /><p className="text-[10px] font-black uppercase mt-4">Saluran chat koordinasi sepi...</p></div>}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={(e) => { e.preventDefault(); if (!chatInput.trim()) return; const msg: ChatMessage = { id: `c-${Date.now()}`, senderId: currentUser.id, senderName: currentUser.name, senderRole: currentUser.role, text: chatInput, timestamp: new Date().toISOString() }; setDb(prev => ({ ...prev, chatMessages: [...prev.chatMessages, msg] })); setChatInput(''); }} className="bg-white p-6 rounded-b-[2.5rem] border-t border-slate-100 flex gap-4 shadow-sm">
              <input type="text" placeholder="Ketik pesan koordinasi..." className="flex-1 px-7 py-4 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm focus:border-amber-500 focus:bg-white transition-all shadow-inner" value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-4 rounded-xl active:scale-95 transition-all shadow-xl hover:bg-slate-800"><Send size={22}/></button>
           </form>
        </div>
      )}

      {/* SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-slide-up pb-20">
           <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-8 group">
              <div className="w-20 h-20 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center text-3xl font-black shadow-xl group-hover:bg-amber-500 transition-colors">{currentUser.name.charAt(0)}</div>
              <div className="flex-1">
                 <h4 className="text-2xl font-black text-slate-900 tracking-tight">{currentUser.name}</h4>
                 <p className="text-xs font-black text-amber-600 uppercase tracking-[0.2em] mt-1 italic">Role: {currentUser.role}</p>
              </div>
              <button onClick={handleLogout} className="px-8 py-4 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all flex items-center gap-2"><LogOut size={18}/> KELUAR</button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
                <h3 className="text-lg font-black text-amber-500 uppercase tracking-widest flex items-center gap-3"><RefreshCw size={20}/> Cloud Sync Simulation</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">Hubungkan antar perangkat dengan memindahkan data lokal Anda menggunakan kode enkripsi aman.</p>
                <div className="space-y-4 pt-4">
                   <button onClick={() => { setSyncCode(DatabaseService.exportSyncCode()); setIsModalOpen('SYNC'); }} className="w-full py-4 bg-amber-500 text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20">EKSPOR KODE MASTER</button>
                   <button onClick={() => { setIsModalOpen('SYNC'); setSyncCode(''); }} className="w-full py-4 bg-slate-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-600 transition-all">IMPOR DATA PERANGKAT</button>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest flex items-center gap-3"><Database size={20}/> Status Sistem</h3>
                <div className="space-y-4">
                   <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Warga</span>
                      <span className="text-lg font-black text-slate-900">{db.residents.length}</span>
                   </div>
                   <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Update Terakhir</span>
                      <span className="text-[9px] font-black text-slate-600">{new Date(db.lastUpdated).toLocaleString()}</span>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* MODALS */}
      {isModalOpen === 'SYNC' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight leading-none">Sinkronisasi Data</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <div className="p-8 space-y-6">
               <p className="text-xs text-slate-500 font-medium leading-relaxed italic text-center">Salin kode ini di perangkat tujuan atau tempel kode dari perangkat asal untuk sinkronisasi data.</p>
               <div className="relative">
                  <textarea className="w-full p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-bold text-[10px] break-all min-h-[120px] focus:border-amber-500 transition-all" value={syncCode} onChange={e => setSyncCode(e.target.value)} placeholder="Masukkan Kode Master di sini..."></textarea>
                  {syncCode && (
                    <button onClick={() => { navigator.clipboard.writeText(syncCode); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }} className="absolute bottom-4 right-4 p-3 bg-white text-slate-900 rounded-xl shadow-md hover:bg-slate-50 transition-all border border-slate-100">
                      {copySuccess ? <Check size={18} className="text-green-500"/> : <Copy size={18}/>}
                    </button>
                  )}
               </div>
               <button onClick={handleSyncData} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 shadow-xl">PROSES SINKRONISASI DATA</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">Registrasi Pengunjung</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const res = db.residents.find(r => r.id === guestForm.visitToId); const newG: GuestLog = { id: `g-${Date.now()}`, name: guestForm.name!, visitToId: guestForm.visitToId!, visitToName: res ? `${res.block}-${res.houseNumber}` : 'Umum', purpose: guestForm.purpose!, entryTime: new Date().toISOString(), status: 'IN' }; setDb(prev => ({ ...prev, guests: [newG, ...prev.guests] })); setIsModalOpen(null); setGuestForm({ name: '', visitToId: '', purpose: '' }); }} className="p-8 space-y-5">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-50 outline-none font-bold text-sm focus:border-blue-500 transition-all shadow-inner" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                <option value="">-- Tujuan Unit (Warga) --</option>
                {db.residents.map(r => <option key={r.id} value={r.id}>Blok {r.block} No. {r.houseNumber} - {r.name}</option>)}
              </select>
              <textarea required placeholder="Keperluan/Tujuan..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold min-h-[120px] text-sm focus:border-blue-500 transition-all shadow-inner" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 shadow-blue-600/20">IZINKAN MASUK AREA</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'SOS_MODAL' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-600 animate-pulse">
           <div className="text-center text-white p-10">
              <div className="bg-white text-red-600 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl border-[6px] border-red-200">
                 <BellRing size={50} className="animate-bounce" />
              </div>
              <h1 className="text-5xl font-black mb-4 uppercase italic tracking-tighter">SOS AKTIF!</h1>
              <p className="text-xl font-bold opacity-90 leading-tight">Sinyal bantuan darurat terkirim.<br/>Tim Satpam segera menuju lokasi Anda.</p>
           </div>
        </div>
      )}

      {patrolAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-8 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div><h3 className="text-xl font-black uppercase tracking-tight">{patrolAction.cp}</h3><p className="text-[10px] font-black uppercase opacity-70 mt-1 tracking-widest">Update Laporan Lapangan</p></div>
              <button onClick={() => setPatrolAction(null)} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-6 text-center">
               <div className="p-8 bg-slate-50 rounded-[1.5rem] border border-slate-100 italic font-bold text-slate-600 shadow-inner">
                  "Menyatakan area <span className="font-black text-slate-900">{patrolAction.cp}</span> terpantau dalam kondisi <span className={`font-black uppercase ${patrolAction.status === 'OK' ? 'text-green-600' : 'text-red-600'}`}>{patrolAction.status === 'OK' ? 'AMAN' : 'BERBAHAYA'}</span>"
               </div>
               <button onClick={() => submitPatrol(patrolAction.status)} className={`w-full py-4 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>SIMPAN STATUS LOG</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen === 'CHECKPOINT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">{editingItem !== null ? 'Edit Titik' : 'Tambah Titik'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setDb(prev => { const newCP = [...prev.checkpoints]; if (editingItem !== null) newCP[editingItem] = cpForm; else newCP.push(cpForm); return {...prev, checkpoints: newCP}; }); setIsModalOpen(null); setCpForm(''); }} className="p-8 space-y-5">
              <input type="text" required placeholder="Nama Titik Patroli..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-50 outline-none font-bold text-sm focus:border-amber-500 transition-all shadow-inner" value={cpForm} onChange={e => setCpForm(e.target.value)} />
              <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95">SIMPAN TITIK</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'INCIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">Form Pelaporan</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={async (e) => { e.preventDefault(); if (!currentUser) return; setIsAnalyzing(true); let severity: any = 'MEDIUM'; try { const analysis = await analyzeIncident(incForm.description); if (analysis?.severity) severity = analysis.severity; } catch {} const newI: IncidentReport = { id: `i-${Date.now()}`, reporterId: currentUser.id, reporterName: currentUser.name, timestamp: new Date().toISOString(), type: incForm.type, location: incForm.location, description: incForm.description, status: 'PENDING', severity }; setDb(prev => ({ ...prev, incidents: [newI, ...prev.incidents] })); setIsAnalyzing(false); setIsModalOpen(null); setIncForm({ type: 'Kriminalitas', location: '', description: '' }); }} className="p-8 space-y-5">
              <select className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold text-sm" value={incForm.type} onChange={e => setIncForm({...incForm, type: e.target.value})}>
                <option value="Kriminalitas">Kriminalitas / Pencurian</option>
                <option value="Kebakaran">Kebakaran / Asap</option>
                <option value="Aktivitas">Aktivitas Mencurigakan</option>
                <option value="Fasilitas">Kerusakan Fasilitas</option>
              </select>
              <input type="text" required placeholder="Lokasi Kejadian..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-50 outline-none font-bold text-sm focus:border-red-500 transition-all shadow-inner" value={incForm.location} onChange={e => setIncForm({...incForm, location: e.target.value})} />
              <textarea required placeholder="Deskripsi kejadian singkat..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent outline-none font-bold min-h-[120px] text-sm focus:border-red-500 transition-all shadow-inner" value={incForm.description} onChange={e => setIncForm({...incForm, description: e.target.value})} />
              <button type="submit" disabled={isAnalyzing} className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 flex items-center justify-center gap-2">
                {isAnalyzing ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18}/>} {isAnalyzing ? 'MENGANALISIS AI...' : 'KIRIM LAPORAN'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen === 'RESIDENT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">{editingItem !== null ? 'Edit Warga' : 'Tambah Warga'}</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={24}/></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setDb(prev => { let newRes = [...prev.residents]; if (editingItem) newRes = newRes.map(r => r.id === editingItem.id ? {...r, ...resForm} : r); else newRes.push({ id: `r-${Date.now()}`, ...resForm as Resident }); return {...prev, residents: newRes}; }); setIsModalOpen(null); }} className="p-8 space-y-4">
              <input type="text" required placeholder="Nama Lengkap..." className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-slate-50 outline-none font-bold text-sm" value={resForm.name} onChange={e => setResForm({...resForm, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                 <select className="w-full px-6 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={resForm.block} onChange={e => setResForm({...resForm, block: e.target.value})}>
                    {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                 </select>
                 <input type="text" required placeholder="No. Rumah" className="w-full px-6 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={resForm.houseNumber} onChange={e => setResForm({...resForm, houseNumber: e.target.value})} />
              </div>
              <input type="text" required placeholder="No. Telepon..." className="w-full px-6 py-4 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={resForm.phoneNumber} onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} />
              <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl">SIMPAN DATA WARGA</button>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
