
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  SECURITY_USERS as INITIAL_SECURITY, 
  ADMIN_USERS, 
  BLOCKS,
  CHECKPOINTS as INITIAL_CHECKPOINTS,
  MOCK_RESIDENTS,
  MOCK_INCIDENTS,
  MOCK_GUESTS
} from './constants.tsx';
import { User, PatrolLog, IncidentReport, Resident, GuestLog, ChatMessage, UserRole } from './types.ts';
import Layout from './components/Layout.tsx';
import { 
  Shield, Search, Send, Users, MapPin, X, AlertTriangle, 
  UserPlus, ArrowRight, CheckCircle, Edit2, Plus, Home, 
  Activity, MessageSquare, Radio, LogOut, Camera, Trash2, UserCheck, RefreshCw, Ghost, PhoneCall, ArrowLeftRight, ClipboardCheck, BookOpen, Settings, Filter, Clock
} from 'lucide-react';
import { getSecurityBriefing } from './services/geminiService.ts';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { db } from './lib/db.ts';

const App: React.FC = () => {
  // --- DATABASE STATES ---
  const [residents, setResidents] = useState<Resident[]>([]);
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [guests, setGuests] = useState<GuestLog[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [staff] = useState<User[]>(INITIAL_SECURITY);

  // --- UI STATES ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginTab, setLoginTab] = useState<'SECURITY' | 'ADMIN' | 'RESIDENT'>('SECURITY');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginSearch, setLoginSearch] = useState('');
  const [loginError, setLoginError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'syncing' | 'offline'>('syncing');
  const [isModalOpen, setIsModalOpen] = useState<'RESIDENT' | 'GUEST' | 'INCIDENT' | 'PATROL_REPORT' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [securityBriefing, setSecurityBriefing] = useState<string>('');

  // --- FORM STATES ---
  const [resForm, setResForm] = useState<Partial<Resident>>({ name: '', houseNumber: '', block: BLOCKS[0], phoneNumber: '', isHome: true });
  const [guestForm, setGuestForm] = useState<Partial<GuestLog>>({ name: '', visitToId: '', purpose: '' });
  const [incForm, setIncForm] = useState<Partial<IncidentReport>>({ type: 'Pencurian', location: '', description: '', severity: 'MEDIUM' });
  const [patrolAction, setPatrolAction] = useState<{cp: string, status: 'OK' | 'WARNING' | 'DANGER'}>({ cp: '', status: 'OK' });
  const [patrolReportData, setPatrolReportData] = useState({ note: '', photo: '' });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- DATA LOADING ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setCloudStatus('syncing');
        const [r, p, i, g, c] = await Promise.all([
          db.resident.findMany(),
          db.patrol.findMany(),
          db.incident.findMany(),
          db.guest.findMany(),
          db.chat.findMany()
        ]);
        
        setResidents(r.length > 0 ? r : MOCK_RESIDENTS);
        setPatrolLogs(p);
        setIncidents(i.length > 0 ? i : MOCK_INCIDENTS);
        setGuests(g.length > 0 ? g : MOCK_GUESTS);
        setChatMessages(c);
        setCloudStatus('connected');
      } catch (err) {
        console.error("Cloud Error:", err);
        setCloudStatus('offline');
        // Fallback to Mocks if cloud is dead
        setResidents(MOCK_RESIDENTS);
        setIncidents(MOCK_INCIDENTS);
        setGuests(MOCK_GUESTS);
      }
    };

    fetchData();

    // CLOUD-ONLY REALTIME SUBSCRIPTIONS
    const subscriptions = [
      db.resident.subscribe(p => {
        if (p.eventType === 'INSERT') setResidents(prev => [p.new as Resident, ...prev]);
        if (p.eventType === 'UPDATE') setResidents(prev => prev.map(r => r.id === p.new.id ? p.new as Resident : r));
        if (p.eventType === 'DELETE') setResidents(prev => prev.filter(r => r.id !== p.old.id));
      }),
      db.chat.subscribe(p => {
        if (p.eventType === 'INSERT') setChatMessages(prev => [...prev, p.new as ChatMessage]);
      }),
      db.incident.subscribe(p => {
        if (p.eventType === 'INSERT') setIncidents(prev => [p.new as IncidentReport, ...prev]);
        if (p.eventType === 'UPDATE') setIncidents(prev => prev.map(i => i.id === p.new.id ? p.new as IncidentReport : i));
      }),
      db.patrol.subscribe(p => {
        if (p.eventType === 'INSERT') setPatrolLogs(prev => [p.new as PatrolLog, ...prev]);
      }),
      db.guest.subscribe(p => {
        if (p.eventType === 'INSERT') setGuests(prev => [p.new as GuestLog, ...prev]);
        if (p.eventType === 'UPDATE') setGuests(prev => prev.map(g => g.id === p.new.id ? p.new as GuestLog : g));
      })
    ];

    return () => subscriptions.forEach(s => s.unsubscribe());
  }, []);

  useEffect(() => {
    if (currentUser) {
      const hour = new Date().getHours();
      const shiftName = hour >= 7 && hour < 19 ? 'Pagi' : 'Malam';
      getSecurityBriefing(shiftName).then(setSecurityBriefing);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // --- HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const isAdmin = loginTab === 'ADMIN';
    const isValid = isAdmin ? passwordInput === 'admin123' : passwordInput === '1234';
    if (isValid) {
      setCurrentUser({ ...selectedUser, role: loginTab as UserRole });
      setPasswordInput('');
    } else {
      setLoginError(isAdmin ? 'PIN Admin: admin123' : 'PIN Petugas: 1234');
    }
  };

  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await db.resident.update(editingItem.id, resForm);
      } else {
        await db.resident.create({ ...resForm, id: `r-${Date.now()}` });
      }
      setIsModalOpen(null);
      setEditingItem(null);
    } catch (err) {
      alert("Database Error: Gagal menyimpan ke Prisma Cloud.");
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    const chatText = chatInput;
    setChatInput('');
    try {
      await db.chat.create({
        id: `msg-${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        text: chatText,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      alert("Database Error: Gagal mengirim pesan ke Cloud.");
    }
  };

  const handlePatrolLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !patrolReportData.photo) return;
    try {
      await db.patrol.create({
        id: `p-${Date.now()}`,
        securityId: currentUser.id,
        securityName: currentUser.name,
        timestamp: new Date().toISOString(),
        checkpoint: patrolAction.cp,
        status: patrolAction.status,
        note: patrolReportData.note,
        photo: patrolReportData.photo
      });
      setIsModalOpen(null);
      setPatrolReportData({ note: '', photo: '' });
    } catch (err) {
      alert("Database Error: Gagal menyimpan log patroli.");
    }
  };

  const handleGuestLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestForm.name || !guestForm.visitToId) return;
    try {
      const target = residents.find(r => r.id === guestForm.visitToId);
      await db.guest.create({
        id: `g-${Date.now()}`,
        name: guestForm.name,
        visitToId: guestForm.visitToId,
        visitToName: target ? `${target.name} (${target.block}-${target.houseNumber})` : 'Unit',
        purpose: guestForm.purpose || 'Kunjungan',
        entryTime: new Date().toISOString(),
        status: 'IN'
      });
      setIsModalOpen(null);
      setGuestForm({ name: '', visitToId: '', purpose: '' });
    } catch (err) {
      alert("Database Error: Gagal menyimpan data tamu.");
    }
  };

  // --- STATS ---
  const timelineFeed = useMemo(() => {
    const combined = [
      ...patrolLogs.map(p => ({ ...p, type: 'PATROL', time: p.timestamp })),
      ...incidents.map(i => ({ ...i, type: 'INCIDENT', time: i.timestamp })),
      ...guests.map(g => ({ ...g, type: 'GUEST', time: g.entryTime }))
    ];
    return combined.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);
  }, [patrolLogs, incidents, guests]);

  const chartData = [
    { name: 'Patroli', val: patrolLogs.length },
    { name: 'Tamu', val: guests.length },
    { name: 'Insiden', val: incidents.length }
  ];

  if (!currentUser) {
    const pool = loginTab === 'SECURITY' ? staff : loginTab === 'ADMIN' ? ADMIN_USERS : residents.map(r => ({ id: r.id, name: r.name, sub: `${r.block}-${r.houseNumber}` }));
    const filtered = pool.filter((u: any) => u.name.toLowerCase().includes(loginSearch.toLowerCase()));

    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-[950px] flex flex-col md:flex-row rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up">
          <div className="w-full md:w-5/12 bg-slate-900 p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="bg-amber-500 w-16 h-16 rounded-3xl flex items-center justify-center mb-10 shadow-2xl shadow-amber-500/20">
                <Shield size={32} className="text-slate-900" />
              </div>
              <h1 className="text-3xl lg:text-4xl font-black mb-4 tracking-tighter italic uppercase leading-none">TKA SECURE <br/><span className="text-amber-500 not-italic text-2xl font-light tracking-widest leading-none">Prisma Cloud</span></h1>
              <p className="text-slate-400 text-sm italic leading-relaxed font-medium">Sistem manajemen keamanan perumahan berbasis database cloud real-time.</p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3 relative z-10 backdrop-blur-sm">
               <div className={`w-2 h-2 rounded-full animate-pulse ${cloudStatus === 'connected' ? 'bg-green-500' : cloudStatus === 'syncing' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">
                 {cloudStatus === 'connected' ? 'Prisma Online' : cloudStatus === 'syncing' ? 'Connecting Engine...' : 'Cloud Connection Failed'}
               </span>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-8 lg:p-14 h-[650px] lg:h-[750px] flex flex-col bg-white overflow-y-auto no-scrollbar">
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight italic uppercase leading-none">Portal Akses</h2>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
              {(['SECURITY', 'ADMIN', 'RESIDENT'] as const).map(t => (
                <button key={t} onClick={() => { setLoginTab(t); setSelectedUser(null); setLoginSearch(''); }}
                  className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${loginTab === t ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder={`Cari nama ${loginTab.toLowerCase()}...`}
                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-500 outline-none font-bold text-sm shadow-inner transition-all"
                value={loginSearch} onChange={e => setLoginSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto pr-1 mb-6 space-y-3 no-scrollbar min-h-[200px]">
              {filtered.map((u: any) => (
                <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setLoginError(''); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${selectedUser?.id === u.id ? 'border-amber-500 bg-amber-50 shadow-lg' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl transition-colors ${selectedUser?.id === u.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-white'}`}>{u.name.charAt(0)}</div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-900 text-base truncate uppercase leading-none mb-1">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{u.sub || 'Authorized Personal'}</p>
                  </div>
                </button>
              ))}
            </div>

            {selectedUser && (
              <form onSubmit={handleLogin} className="pt-8 border-t border-slate-100 space-y-5 animate-slide-up">
                <input type="password" required placeholder="PIN"
                  className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-black text-2xl tracking-[0.6em] text-center" 
                  value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                {loginError && <p className="text-red-500 text-[10px] font-black text-center uppercase italic">{loginError}</p>}
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all hover:bg-slate-800">
                  LOGIN KE SISTEM <ArrowRight size={20} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={() => setCurrentUser(null)} activeTab={activeTab} setActiveTab={setActiveTab}>
      
      {/* RENDER LOGIC PER TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-slide-up pb-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[
              { label: 'Satpam Aktif', val: staff.length, icon: <UserCheck size={24}/>, color: 'blue' },
              { label: 'Lapor Terbuka', val: incidents.filter(i => i.status !== 'RESOLVED').length, icon: <AlertTriangle size={24}/>, color: 'red' },
              { label: 'Tamu Hari Ini', val: guests.length, icon: <Users size={24}/>, color: 'amber' },
              { label: 'Total Unit', val: residents.length, icon: <Home size={24}/>, color: 'green' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-xl transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${s.color === 'amber' ? 'bg-amber-50 text-amber-600' : s.color === 'red' ? 'bg-red-50 text-red-600' : s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {s.icon}
                </div>
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 lg:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[400px]">
               <h3 className="text-xl font-black text-slate-900 mb-10 flex items-center gap-4 uppercase italic leading-none"><Activity size={24} className="text-amber-500 animate-pulse"/> Analisis Aktivitas Prisma</h3>
               <div className="h-[250px] lg:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="val" radius={[8, 8, 8, 8]} barSize={55}>
                        {chartData.map((_, index) => (<Cell key={index} fill={['#F59E0B', '#3B82F6', '#EF4444'][index % 3]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-slate-900 text-white p-8 lg:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <Radio size={32} className="text-amber-500 animate-pulse"/>
                    <h3 className="font-black text-2xl uppercase italic leading-none">AI Briefing</h3>
                  </div>
                  <p className="text-slate-400 text-sm italic leading-relaxed font-medium">"{securityBriefing || 'Menghubungkan asisten cerdas...'}"</p>
               </div>
               <button onClick={() => setActiveTab('chat')} className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all mt-10">PANGGIL BANTUAN <ArrowRight size={20}/></button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="max-w-4xl mx-auto h-[calc(100vh-220px)] flex flex-col animate-slide-up pb-10">
           <div className="flex-1 bg-white rounded-t-[3rem] shadow-sm border border-slate-100 overflow-y-auto p-6 lg:p-10 space-y-8 no-scrollbar relative">
              <div className="sticky top-0 z-10 text-center mb-10">
                 <span className="bg-slate-50 text-slate-400 text-[8px] font-black uppercase px-6 py-2 rounded-full border border-slate-100 tracking-widest italic backdrop-blur-md">Pusat Koordinasi Digital Prisma</span>
              </div>
              {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                   <div className={`max-w-[85%] p-6 rounded-[2.5rem] relative shadow-sm transition-transform hover:scale-[1.01] ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-100'}`}>
                      <div className="flex justify-between items-center gap-6 mb-2">
                         <span className={`text-[10px] font-black uppercase tracking-widest ${msg.senderId === currentUser.id ? 'text-amber-500' : 'text-slate-400'}`}>{msg.senderName}</span>
                         <span className="text-[8px] font-bold px-2 py-0.5 bg-white/10 rounded-full uppercase opacity-40 italic">{msg.senderRole}</span>
                      </div>
                      <p className="text-sm lg:text-base font-medium leading-relaxed">{msg.text}</p>
                      <p className={`text-[8px] mt-3 opacity-30 text-right font-black uppercase tracking-widest`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center py-32 opacity-20 grayscale italic">
                   <MessageSquare size={64} className="mb-6" />
                   <p className="font-black uppercase tracking-[0.4em] text-[10px]">Belum Ada Pesan Cloud</p>
                </div>
              )}
              <div ref={chatEndRef} />
           </div>
           <form onSubmit={handleSendChat} className="bg-white p-6 rounded-b-[3rem] border-t border-slate-100 flex gap-4 shadow-2xl items-center sticky bottom-0">
              <input type="text" placeholder="Ketik instruksi tim..." 
                className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-sm lg:text-base focus:border-amber-500 transition-all shadow-inner" 
                value={chatInput} onChange={e => setChatInput(e.target.value)} />
              <button type="submit" className="bg-slate-900 text-white p-5 rounded-2xl active:scale-95 shadow-2xl hover:bg-slate-800 transition-all duration-300">
                <Send size={26}/>
              </button>
           </form>
        </div>
      )}

      {/* RENDER FALLBACK UNTUK TAB LAINNYA */}
      {(activeTab === 'log_resident' || activeTab === 'patrol' || activeTab === 'reports' || activeTab === 'incident' || activeTab === 'guests' || activeTab === 'residents' || activeTab === 'settings') && (
        <div className="animate-slide-up space-y-8 pb-20">
           <div className="flex justify-between items-center">
             <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none">{activeTab.replace('_', ' ')}</h3>
             {['residents', 'incident', 'guests'].includes(activeTab) && (
               <button onClick={() => setIsModalOpen(activeTab.toUpperCase() as any)} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl active:scale-95"><Plus size={24}/></button>
             )}
           </div>
           <div className="bg-white p-24 rounded-[3rem] text-center border border-slate-100">
              <Ghost size={64} className="mx-auto text-slate-100 mb-6" />
              <p className="font-black text-slate-300 uppercase tracking-widest italic">Halaman Ini Memerlukan Koneksi Prisma Cloud Aktif</p>
              {cloudStatus === 'offline' && <p className="text-[10px] text-red-400 font-black mt-4 uppercase">Mode Offline Aktif - Data Disimpan Sesuai Mocks</p>}
           </div>
        </div>
      )}

      {/* MODAL GUEST */}
      {isModalOpen === 'GUEST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-8 lg:p-10 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-xl lg:text-2xl font-black uppercase italic leading-none">Registrasi Tamu Cloud</h3>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handleGuestLog} className="p-8 lg:p-12 space-y-6">
              <input type="text" required placeholder="Nama Lengkap Tamu..." className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none font-bold text-sm shadow-inner transition-all" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
              <select required className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 outline-none font-bold text-sm" value={guestForm.visitToId} onChange={e => setGuestForm({...guestForm, visitToId: e.target.value})}>
                 <option value="">-- Pilih Unit Tujuan --</option>
                 {residents.sort((a,b) => a.block.localeCompare(b.block)).map(r => <option key={r.id} value={r.id}>{r.block}-{r.houseNumber} ({r.name})</option>)}
              </select>
              <textarea required placeholder="Keperluan Kunjungan..." className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 outline-none font-bold text-sm min-h-[140px] shadow-inner transition-all" value={guestForm.purpose} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">DAFTARKAN TAMU MASUK</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PATROL */}
      {isModalOpen === 'PATROL_REPORT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-slide-up overflow-hidden">
            <div className={`p-8 lg:p-10 text-white flex justify-between items-center ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h3 className="text-xl lg:text-2xl font-black uppercase leading-none italic">{patrolAction.cp}</h3>
                <p className="text-[10px] font-black uppercase opacity-70 mt-1 tracking-widest italic">Digital Patrol Log</p>
              </div>
              <button onClick={() => setIsModalOpen(null)}><X size={28}/></button>
            </div>
            <form onSubmit={handlePatrolLog} className="p-8 lg:p-12 space-y-8">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Ambil Foto (Wajib):</label>
                 <div className="flex flex-col gap-4">
                    {patrolReportData.photo ? (
                      <div className="relative group">
                         <img src={patrolReportData.photo} alt="Preview" className="w-full h-48 lg:h-56 object-cover rounded-[2rem] border-2 border-slate-100 shadow-inner" />
                         <button type="button" onClick={() => setPatrolReportData(prev => ({ ...prev, photo: '' }))} className="absolute top-4 right-4 p-3 bg-red-600 text-white rounded-2xl shadow-2xl active:scale-95 transition-all"><Trash2 size={20}/></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-48 lg:h-56 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-slate-400 transition-all group">
                         <Camera size={48} className="group-hover:scale-110 transition-transform" />
                         <span className="font-black text-[10px] uppercase tracking-widest italic">AKTIFKAN KAMERA LAPANGAN</span>
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const reader = new FileReader();
                         reader.onloadend = () => setPatrolReportData(p => ({ ...p, photo: reader.result as string }));
                         reader.readAsDataURL(file);
                       }
                    }} />
                 </div>
              </div>
              <textarea required placeholder="Jelaskan kondisi detail area..." className="w-full px-8 py-5 rounded-[1.5rem] bg-slate-50 border-2 border-transparent outline-none font-bold text-sm min-h-[140px] focus:border-slate-900 transition-all shadow-inner" value={patrolReportData.note} onChange={e => setPatrolReportData({...patrolReportData, note: e.target.value})} />
              <button type="submit" className={`w-full py-5 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all ${patrolAction.status === 'OK' ? 'bg-green-600' : 'bg-red-600'}`}>KIRIM LAPORAN CLOUD</button>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
