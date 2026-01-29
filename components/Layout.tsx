
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
  ArrowLeftRight,
  Menu,
  X
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
    { id: 'reports', label: 'Feed', icon: <FileText size={18} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'incident', label: 'Insiden', icon: <AlertTriangle size={18} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'guests', label: 'Tamu', icon: <BookOpen size={18} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'residents', label: 'Warga', icon: <MapPin size={18} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'chat', label: 'Chat', icon: <MessageSquare size={18} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'settings', label: 'Setelan', icon: <Settings size={18} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden flex-col lg:flex-row">
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
          <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 text-center">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}</p>
             <p className="text-[9px] font-bold text-amber-500 uppercase tracking-tighter">
               {currentShift === ShiftType.MORNING ? 'SHIFT PAGI' : 'SHIFT MALAM'}
             </p>
          </div>
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 px-5 py-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all font-black text-xs uppercase tracking-widest">
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-3 lg:py-5 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="lg:hidden bg-slate-900 p-2 rounded-xl shadow-lg">
              <Shield className="text-amber-500" size={20} />
            </div>
            <div>
              <h2 className="text-base lg:text-lg font-black text-slate-900 uppercase italic tracking-tight truncate max-w-[150px] lg:max-w-none">
                {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-900 leading-none mb-1">{user.name}</p>
              <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{user.role}</p>
            </div>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl border-2 flex items-center justify-center font-black transition-all ${
                activeTab === 'settings' ? 'bg-amber-100 border-amber-500 text-amber-600' : 'bg-slate-100 border-white text-slate-700'
              }`}
            >
              {user.name.charAt(0)}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-10 pb-28 lg:pb-10 no-scrollbar bg-[#F8FAFC]">
          {children}
        </main>

        {/* Mobile Navigation - Scrollable & Compact */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] overflow-x-auto no-scrollbar">
          <div className="flex items-center min-w-max px-4 py-2 gap-2">
            {filteredMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all ${
                  activeTab === item.id ? 'bg-amber-500 text-slate-900' : 'text-slate-400'
                }`}
              >
                <div className="mb-1">
                  {React.cloneElement(item.icon as React.ReactElement<any>, { size: 18 })}
                </div>
                <span className="text-[9px] font-black uppercase tracking-tighter whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            ))}
            <button onClick={onLogout} className="flex flex-col items-center justify-center px-4 py-2 text-red-500">
               <LogOut size={18} />
               <span className="text-[9px] font-black uppercase mt-1">Keluar</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
