import type { GatewaySystem } from '@/types';

interface DotProps { label: string; active: boolean; color?: string; }

function Dot({ label, active, color }: DotProps) {
  const bg = color ?? (active ? 'bg-brand-green' : 'bg-brand-red');
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${bg}`} />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

interface Props { system: GatewaySystem; }

export function ConnectionDots({ system }: Props) {
  return (
    <div className="space-y-0.5">
      <Dot label="WiFi"  active={system.wifi === 'online'} />
      <Dot label="MQTT"  active={system.mqtt === 'connected'} />
      <Dot label="Cloud" active={system.cloud === 'online'} />
      <Dot label="RS485" active={system.rs485 === 'ok'} />
    </div>
  );
}
