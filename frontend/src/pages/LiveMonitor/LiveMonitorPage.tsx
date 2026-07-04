import { MdMonitor, MdCircle } from 'react-icons/md';
import { useStore } from '@/app/store';
import { PumpIcon } from '@/components/icons/PumpIcon';
import { PressureIcon } from '@/components/icons/PressureIcon';
import { TankIcon } from '@/components/icons/TankIcon';
import { BatteryIcon } from '@/components/icons/BatteryIcon';
import { FuelIcon } from '@/components/icons/FuelIcon';
import { FirePanelIcon } from '@/components/icons/FirePanelIcon';
import { PASystemIcon } from '@/components/icons/PASystemIcon';
import { VentilationIcon } from '@/components/icons/VentilationIcon';
import { ConnectionDots } from '@/components/status/ConnectionDots';
import { StatusBadge } from '@/components/status/StatusBadge';
import { formatValue, formatUptime } from '@/utils/formatters';
import type { ReactNode } from 'react';
import type { EquipmentStatus } from '@/types';

interface LiveCardProps {
  label: string; icon: ReactNode;
  status?: EquipmentStatus; value?: string; online: boolean;
}

function LiveCard({ label, icon, status, value, online }: LiveCardProps) {
  const pulse = online && (status === 'ON' || status === 'NORMAL');
  return (
    <div className={`bg-white rounded-xl p-4 border shadow-sm flex items-center gap-4 ${
      !online ? 'border-slate-200 opacity-60' : status === 'FAULT' || status === 'ALARM' ? 'border-red-300' : 'border-slate-200'
    }`}>
      <div className={`text-3xl flex-shrink-0 ${
        !online ? 'text-slate-300' : status === 'FAULT' || status === 'ALARM' ? 'text-brand-red'
        : status === 'ON' || status === 'NORMAL' ? 'text-brand-green' : 'text-slate-400'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        {value && <p className="text-lg font-bold text-slate-800 font-mono">{value}</p>}
        {status && <StatusBadge status={status} size="sm" />}
      </div>
      <div className="flex-shrink-0">
        {pulse
          ? <MdCircle className="text-brand-green animate-pulse" />
          : <MdCircle className={online ? 'text-slate-300' : 'text-brand-red'} />}
      </div>
    </div>
  );
}

export function LiveMonitorPage() {
  const { devices, system } = useStore((s) => s.telemetry);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl text-brand-blue text-2xl"><MdMonitor /></div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Live Monitor</h1>
          <p className="text-sm text-slate-500">Real-time RS485 equipment parameters · updates every 10s</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-brand-green font-medium">
          <MdCircle className="animate-pulse" /> LIVE
        </div>
      </div>

      {/* System health */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Gateway Communication</h2>
        <div className="flex flex-wrap gap-6">
          <ConnectionDots system={system} />
          <div className="text-xs text-slate-500 space-y-1">
            <p>Firmware: <span className="font-mono text-slate-700">{system.fw}</span></p>
            <p>Uptime: <span className="text-slate-700">{formatUptime(system.uptime)}</span></p>
            <p>RSSI: <span className="text-slate-700">{system.rssi} dBm</span></p>
          </div>
        </div>
      </div>

      {/* All equipment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <LiveCard label="Jockey Pump"    icon={<PumpIcon />}        status={devices.jockeyPump.status}           online={devices.jockeyPump.online} />
        <LiveCard label="Main Pump 1"    icon={<PumpIcon />}        status={devices.mainPump1.status}            online={devices.mainPump1.online} />
        <LiveCard label="Main Pump 2"    icon={<PumpIcon />}        status={devices.mainPump2.status}            online={devices.mainPump2.online} />
        <LiveCard label="Diesel Pump"    icon={<PumpIcon />}        status={devices.dieselPump.status}           online={devices.dieselPump.online} />
        <LiveCard label="Sprinkler Pressure" icon={<PressureIcon />} value={formatValue(devices.sprinklerPressure.value, devices.sprinklerPressure.unit)} online={devices.sprinklerPressure.online} />
        <LiveCard label="Hydrant Pressure"   icon={<PressureIcon />} value={formatValue(devices.hydrantPressure.value, devices.hydrantPressure.unit)}   online={devices.hydrantPressure.online} />
        <LiveCard label="Water Tank Level"   icon={<TankIcon level={devices.waterTankLevel.value} />} value={formatValue(devices.waterTankLevel.value, devices.waterTankLevel.unit)} online={devices.waterTankLevel.online} />
        <LiveCard label="DG Fuel Level"      icon={<FuelIcon />}      value={formatValue(devices.dgFuelLevel.value, devices.dgFuelLevel.unit)}           online={devices.dgFuelLevel.online} />
        <LiveCard label="DG Battery"         icon={<BatteryIcon level={((devices.dgBattery.value - 10) / 4) * 100} />} value={formatValue(devices.dgBattery.value, devices.dgBattery.unit)} online={devices.dgBattery.online} />
        <LiveCard label="Fire Alarm Panel"   icon={<FirePanelIcon />} status={devices.fireAlarmPanel.status}     online={devices.fireAlarmPanel.online} />
        <LiveCard label="PA System"          icon={<PASystemIcon />}  status={devices.paSystem.status}           online={devices.paSystem.online} />
        <LiveCard label="Ventilation"        icon={<VentilationIcon />} status={devices.ventilation.status}      online={devices.ventilation.online} />
      </div>
    </div>
  );
}
