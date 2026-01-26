
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
  BookOpen
} from 'lucide-react';
import { User, ShiftType } from '../types';

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
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={20} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'patrol', label: 'Patroli', icon: <ClipboardCheck size={20} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'incident', label: 'Insiden', icon: <AlertTriangle size={20} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'guests', label: 'Daftar Tamu', icon: <BookOpen size={20} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'residents', label: 'Monitoring', icon: <MapPin size={20} />, roles: ['SECURITY', 'ADMIN'] },
    { id: 'chat', label: 'Chat Warga', icon: <MessageSquare size={20} />, roles: ['SECURITY', 'ADMIN', 'RESIDENT'] },
    { id: 'security-config', label: 'Manajemen Keamanan', icon: <Shield size={20} />, roles: ['ADMIN'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-amber-500 p-2 rounded-lg">
            <Shield className="text-slate-900" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">TKA Security</h1>
            <span className="text-xs text-slate-400">Integrated System</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className="bg-slate-800/50 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Clock size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Shift Active</span>
            </div>
            <p className="text-sm font-medium">{currentShift === ShiftType.MORNING ? 'Pagi (07.00 - 19.00)' : 'Malam (19.00 - 07.00)'}</p>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800 capitalize">{activeTab.replace('-', ' ')}</h2>
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
               <Clock size={14} />
               {currentTime.toLocaleTimeString('id-ID')}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none">{user.name}</p>
              <p className="text-xs text-slate-500 uppercase font-medium">{user.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-500 font-bold">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
