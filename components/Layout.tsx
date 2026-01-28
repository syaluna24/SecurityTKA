
import React from 'react';
import { 
  Shield, 
  MapPin, 
  AlertTriangle, 
  ClipboardCheck, 
  LogOut, 
  Home,
  Users,
  Clock,
  MessageSquare,
  BookOpen,
  FileText,
  Settings
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
    { id: 'dashboard', label: 'Home', icon: <Home size={18} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'patrol', label: 'Patroli', icon: <ClipboardCheck size={18} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'reports', label: 'Laporan', icon: <FileText size={18} />, roles: ['RESIDENT'] },
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
            <h1 className="font-black text-xl tracking-tight leading-none">TKA SECURE</h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Integrated System</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 ${
                activeTab === item.id 
                  ? 'bg-amber-500 text-slate-900 font-bold shadow-xl' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800 space-y-4">
          <div className="bg-slate-800/50 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Clock size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Shift Saat Ini</span>
            </div>
            <p className="text-xs font-bold text-slate-200">
              {currentShift === ShiftType.MORNING ? 'PAGI (07.00 - 19.00)' : 'MALAM (19.00 - 07.00)'}
            </p>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-5 py-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all font-bold text-sm">
            <LogOut size={18} /> Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="lg:hidden bg-amber-500 p-2 rounded-xl">
              <Shield className="text-slate-900" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 capitalize">
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
              className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black transition-all ${
                activeTab === 'settings' ? 'bg-amber-100 border-amber-500 text-amber-600' : 'bg-slate-100 border-white text-slate-700'
              }`}
            >
              {user.name.charAt(0)}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 no-scrollbar">
          {children}
        </main>

        {/* Mobile Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar items-center px-4 py-3 gap-2">
            {filteredMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center min-w-[65px] flex-shrink-0 py-1 transition-all ${
                  activeTab === item.id ? 'text-amber-600 scale-105' : 'text-slate-400'
                }`}
              >
                {/* Fix: Added explicit casting to any for React.cloneElement to allow 'size' property override on Lucide icon components */}
                <div className={`p-2 rounded-xl transition-all ${activeTab === item.id ? 'bg-amber-50' : ''}`}>
                  {React.cloneElement(item.icon as React.ReactElement<any>, { size: 20 })}
                </div>
                <span className="text-[9px] font-bold uppercase mt-1 tracking-tighter">
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
