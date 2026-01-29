
import React from 'react';
import { 
  Shield, 
  MapPin, 
  AlertTriangle, 
  ClipboardCheck, 
  LogOut, 
  Home,
  Clock,
  MessageSquare,
  BookOpen,
  FileText,
  Settings,
  ArrowLeftRight
} from 'lucide-react';
import { User, ShiftType } from '../types.ts';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, activeTab, setActiveTab, children }) => {
  const [currentShift, setCurrentShift] = React.useState<ShiftType>(ShiftType.MORNING);
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const hour = now.getHours();
      if (hour >= 7 && hour < 19) {
        setCurrentShift(ShiftType.MORNING);
      } else {
        setCurrentShift(ShiftType.NIGHT);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Beranda', icon: <Home size={18} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'log_resident', label: 'Keluar Masuk', icon: <ArrowLeftRight size={18} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'patrol', label: 'Patroli', icon: <ClipboardCheck size={18} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'reports', label: 'Laporan', icon: <FileText size={18} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'incident', label: 'Insiden', icon: <AlertTriangle size={18} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'guests', label: 'Tamu', icon: <BookOpen size={18} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'residents', label: 'Warga', icon: <MapPin size={18} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'chat', label: 'Chat', icon: <MessageSquare size={18} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'settings', label: 'Setelan', icon: <Settings size={18} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="w-72 bg-[#0F172A] text-white flex flex-col hidden lg:flex border-r border-slate-800">
        <div className="p-8 flex items-center gap-4">
          <div className="bg-amber-500 p-2.5 rounded-2xl shadow-lg">
            <Shield className="text-slate-900" size={24} />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight leading-none italic">TKA SECURE</h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Command Center</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${
                activeTab === item.id 
                  ? 'bg-amber-500 text-slate-900 font-black shadow-2xl' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="text-sm font-bold uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800 space-y-4">
          <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Clock size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Tugas Sekarang</span>
            </div>
            <p className="text-[10px] font-bold text-slate-200 uppercase tracking-tighter italic">
              {currentShift === ShiftType.MORNING ? 'SHIFT PAGI (07.00 - 19.00)' : 'SHIFT MALAM (19.00 - 07.00)'}
            </p>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-5 py-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all font-black text-sm uppercase tracking-widest">
            <LogOut size={18} /> Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="lg:hidden bg-amber-500 p-2 rounded-xl" onClick={() => setActiveTab('dashboard')}>
              <Shield className="text-slate-900" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">
                {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-900 mb-0.5">{user.name}</p>
              <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{user.role}</p>
            </div>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-12 h-12 rounded-[1rem] border-2 flex items-center justify-center font-black transition-all ${
                activeTab === 'settings' ? 'bg-amber-100 border-amber-500 text-amber-600' : 'bg-slate-100 border-white text-slate-700'
              }`}
            >
              {user.name.charAt(0)}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-10 pb-32 no-scrollbar">
          {children}
        </main>

        {/* Mobile Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] px-2">
          <div className="flex items-center justify-between py-3">
            {filteredMenu.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center flex-1 transition-all ${
                  activeTab === item.id ? 'text-amber-600' : 'text-slate-400'
                }`}
              >
                <div className={`p-2.5 rounded-2xl transition-all ${activeTab === item.id ? 'bg-amber-50' : ''}`}>
                  {React.cloneElement(item.icon as React.ReactElement<any>, { size: 20 })}
                </div>
                <span className="text-[9px] font-black uppercase mt-1 tracking-tighter">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
