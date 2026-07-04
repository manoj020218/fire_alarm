import { useState, useEffect } from 'react';
import { MdNotifications, MdAccountCircle, MdLogout, MdMenu } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/app/store';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/utils/constants';

interface Props {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: Props) {
  const [now, setNow] = useState(new Date());
  const [showUser, setShowUser] = useState(false);
  const sites = useStore((s) => s.sites);
  const activeSiteId = useStore((s) => s.activeSiteId);
  const setActiveSite = useStore((s) => s.setActiveSite);
  const alarms = useStore((s) => s.alarms);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const unackCount = alarms.filter((a) => a.siteId === activeSiteId && !a.acknowledged).length;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function handleLogout() {
    logout();
    navigate(ROUTES.LOGIN);
  }

  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <header className="bg-white border-b border-slate-200 h-14 flex items-center px-4 gap-4 flex-shrink-0">
      <button onClick={onToggleSidebar} className="text-slate-500 hover:text-slate-700 text-xl p-1 rounded-lg hover:bg-slate-100">
        <MdMenu />
      </button>

      {/* Site selector */}
      <select
        value={activeSiteId}
        onChange={(e) => setActiveSite(e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue"
        aria-label="Select site"
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>{s.name} — {s.location}</option>
        ))}
      </select>

      <div className="flex-1" />

      {/* Clock */}
      <div className="text-right hidden sm:block">
        <p className="text-sm font-semibold text-slate-700 font-mono">{timeStr}</p>
        <p className="text-xs text-slate-400">{dateStr}</p>
      </div>

      {/* Notification bell */}
      <button
        onClick={() => navigate(ROUTES.ALARMS)}
        className="relative text-slate-500 hover:text-slate-700 text-xl p-2 rounded-lg hover:bg-slate-100"
        aria-label="View alarms"
      >
        <MdNotifications />
        {unackCount > 0 && (
          <span className="absolute top-1 right-1 bg-brand-red text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {unackCount > 9 ? '9+' : unackCount}
          </span>
        )}
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setShowUser((v) => !v)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium p-1.5 rounded-lg hover:bg-slate-100"
          aria-label="User menu"
        >
          <MdAccountCircle className="text-2xl text-slate-400" />
          <span className="hidden md:block">{user?.name ?? 'Guest'}</span>
        </button>
        {showUser && (
          <div className="absolute right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-lg w-52 z-50 py-2">
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <MdLogout /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
