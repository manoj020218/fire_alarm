import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  accent?: 'green' | 'red' | 'amber' | 'blue' | 'slate';
}

const ACCENT_MAP = {
  green: { ring: 'ring-green-100', iconBg: 'bg-green-50', iconText: 'text-brand-green', text: 'text-brand-green' },
  red:   { ring: 'ring-red-100',   iconBg: 'bg-red-50',   iconText: 'text-brand-red',   text: 'text-brand-red'   },
  amber: { ring: 'ring-amber-100', iconBg: 'bg-amber-50', iconText: 'text-brand-amber', text: 'text-brand-amber' },
  blue:  { ring: 'ring-blue-100',  iconBg: 'bg-blue-50',  iconText: 'text-brand-blue',  text: 'text-brand-blue'  },
  slate: { ring: 'ring-slate-100', iconBg: 'bg-slate-50', iconText: 'text-slate-500',   text: 'text-slate-700'   },
};

export function StatusCard({ label, value, sub, icon, accent = 'slate' }: Props) {
  const c = ACCENT_MAP[accent];
  return (
    <div className={`status-card ring-1 ${c.ring}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${c.text}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${c.iconBg} ${c.iconText} text-xl flex-shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
