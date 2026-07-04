import type { EquipmentStatus, AlarmSeverity, ConnStatus } from '@/types';
import { STATUS_BG } from '@/utils/constants';

type BadgeStatus = EquipmentStatus | AlarmSeverity | ConnStatus | 'ok' | 'error' | 'connected' | 'disconnected';

interface Props {
  status: BadgeStatus;
  label?: string;
  size?: 'sm' | 'md';
}

const STATUS_MAP: Record<string, string> = {
  ...STATUS_BG,
  connected: STATUS_BG.online,
  disconnected: STATUS_BG.offline,
  ok: STATUS_BG.online,
  error: STATUS_BG.offline,
};

export function StatusBadge({ status, label, size = 'md' }: Props) {
  const cls = STATUS_MAP[status] ?? 'bg-slate-100 text-slate-500';
  const text = size === 'sm' ? 'text-xs' : 'text-xs';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${text} ${cls}`}>
      {label ?? status}
    </span>
  );
}
