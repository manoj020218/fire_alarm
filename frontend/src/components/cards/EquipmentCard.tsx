import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/status/StatusBadge';
import type { EquipmentStatus } from '@/types';

interface Props {
  label: string;
  icon: ReactNode;
  status?: EquipmentStatus;
  value?: string;
  online: boolean;
  highlight?: boolean;
}

export function EquipmentCard({ label, icon, status, value, online, highlight }: Props) {
  const borderClass = !online
    ? 'border-slate-200 opacity-60'
    : status === 'FAULT' || status === 'ALARM'
    ? 'border-red-300 ring-1 ring-red-200'
    : highlight
    ? 'border-brand-blue ring-1 ring-blue-100'
    : 'border-slate-200';

  const iconClass = !online
    ? 'text-slate-300'
    : status === 'FAULT' || status === 'ALARM'
    ? 'text-brand-red'
    : status === 'ON' || status === 'NORMAL'
    ? 'text-brand-green'
    : 'text-slate-400';

  return (
    <div className={`equipment-card border ${borderClass}`}>
      <div className={`text-3xl ${iconClass}`}>{icon}</div>
      <p className="text-xs font-semibold text-slate-600 text-center leading-tight">{label}</p>
      {status && <StatusBadge status={status} size="sm" />}
      {value && <p className="text-sm font-bold text-slate-700">{value}</p>}
      {!online && <span className="text-xs text-slate-400">Offline</span>}
    </div>
  );
}
