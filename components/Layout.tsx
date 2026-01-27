
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
  Menu,
  X,
  FileText
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
    { id: 'dashboard', label: 'Home', icon: <Home size={20} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'patrol', label: 'Patroli', icon: <ClipboardCheck size={20} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'reports', label: 'Laporan', icon: <FileText size={20} />, roles: ['RESIDENT'] },
    { id: 'incident', label: 'Insiden', icon: <AlertTriangle size={20} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'guests', label: 'Tamu', icon: <BookOpen size={20} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'residents', label: 'Warga', icon: <MapPin size={20} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'chat', label: 'Chat', icon: <MessageSquare size={20} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="w-72 bg-[#0F172A] text-white flex flex-col hidden lg:flex border-r border-slate-800">
        <div className="p-8 flex items-center gap-4">
          <div className="bg-amber-500 p-2.5 rounded-2xl shadow-lg shadow-amber-500/20">
            <Shield className="text-slate-900" size={28} />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight leading-none text-white">TKA SECURE</h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Integrated System</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 group ${
                activeTab === item.id 
                  ? 'bg-amber-500 text-slate-900 font-bold shadow-xl shadow-amber-500/10' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <span className={`${activeTab === item.id ? 'scale-110 transition-transform' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800 space-y-4 bg-slate-900/50">
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <Clock size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Shift Aktif</span>
            </div>
            <p className="text-xs font-bold text-slate-200">
              {currentShift === ShiftType.MORNING ? 'PAGI (07.00 - 19.00)' : 'MALAM (19.00 - 07.00)'}
            </p>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-5 py-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all font-bold text-sm"
          >
            <LogOut size={20} />
            Keluar Sistem
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header - Fixed Top */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="lg:hidden bg-amber-500 p-2 rounded-xl shadow-lg shadow-amber-500/20">
              <Shield className="text-slate-900" size={20} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900 capitalize tracking-tight">
                {activeTab === 'dashboard' ? 'Overview' : activeTab.replace('-', ' ')}
              </h2>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-5">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-slate-900 leading-none mb-1">{user.name}</p>
              <div className="flex items-center justify-end gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">{user.role}</p>
              </div>
            </div>
            <div className="relative group cursor-pointer">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-700 font-black text-lg transition-transform group-hover:scale-105">
                {user.name.charAt(0)}
              </div>
              <button 
                onClick={onLogout}
                className="sm:hidden absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full border-2 border-white shadow-md"
              >
                <LogOut size={12} />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Content Scrollable */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 lg:pb-8">
          {children}
        </main>

        {/* Bottom Navigation for Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2 py-3 flex justify-around items-center z-50 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
          {filteredMenu.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 transition-all duration-300 min-w-[64px] ${
                activeTab === item.id ? 'text-amber-600 scale-110' : 'text-slate-400'
              }`}
            >
              <div className={`p-1 rounded-xl transition-colors ${activeTab === item.id ? 'bg-amber-50' : ''}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-bold ${activeTab === item.id ? 'opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Layout;
