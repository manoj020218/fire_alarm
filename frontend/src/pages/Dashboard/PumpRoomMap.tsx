import { EquipmentCard } from '@/components/cards/EquipmentCard';
import { PumpIcon } from '@/components/icons/PumpIcon';
import { PressureIcon } from '@/components/icons/PressureIcon';
import { TankIcon } from '@/components/icons/TankIcon';
import { BatteryIcon } from '@/components/icons/BatteryIcon';
import { FuelIcon } from '@/components/icons/FuelIcon';
import { FirePanelIcon } from '@/components/icons/FirePanelIcon';
import { PASystemIcon } from '@/components/icons/PASystemIcon';
import { VentilationIcon } from '@/components/icons/VentilationIcon';
import type { EquipmentDevices } from '@/types';
import { formatValue } from '@/utils/formatters';

interface Props { devices: EquipmentDevices; }

export function PumpRoomMap({ devices }: Props) {
  const d = devices;
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Fire Pump Room Overview</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <EquipmentCard
          label="Jockey Pump"
          icon={<PumpIcon />}
          status={d.jockeyPump.status}
          online={d.jockeyPump.online}
          highlight={d.jockeyPump.status === 'ON'}
        />
        <EquipmentCard
          label="Main Pump 1"
          icon={<PumpIcon />}
          status={d.mainPump1.status}
          online={d.mainPump1.online}
          highlight={d.mainPump1.status === 'ON'}
        />
        <EquipmentCard
          label="Main Pump 2"
          icon={<PumpIcon />}
          status={d.mainPump2.status}
          online={d.mainPump2.online}
          highlight={d.mainPump2.status === 'ON'}
        />
        <EquipmentCard
          label="Diesel Pump"
          icon={<PumpIcon />}
          status={d.dieselPump.status}
          online={d.dieselPump.online}
          highlight={d.dieselPump.status === 'ON'}
        />
        <EquipmentCard
          label="Sprinkler Line"
          icon={<PressureIcon />}
          value={formatValue(d.sprinklerPressure.value, d.sprinklerPressure.unit)}
          online={d.sprinklerPressure.online}
        />
        <EquipmentCard
          label="Hydrant Line"
          icon={<PressureIcon />}
          value={formatValue(d.hydrantPressure.value, d.hydrantPressure.unit)}
          online={d.hydrantPressure.online}
        />
        <EquipmentCard
          label="Water Tank"
          icon={<TankIcon level={d.waterTankLevel.value} />}
          value={formatValue(d.waterTankLevel.value, d.waterTankLevel.unit)}
          online={d.waterTankLevel.online}
        />
        <EquipmentCard
          label="DG Fuel"
          icon={<FuelIcon />}
          value={formatValue(d.dgFuelLevel.value, d.dgFuelLevel.unit)}
          online={d.dgFuelLevel.online}
        />
        <EquipmentCard
          label="DG Battery"
          icon={<BatteryIcon level={((d.dgBattery.value - 10) / 4) * 100} />}
          value={formatValue(d.dgBattery.value, d.dgBattery.unit)}
          online={d.dgBattery.online}
        />
        <EquipmentCard
          label="Fire Panel"
          icon={<FirePanelIcon />}
          status={d.fireAlarmPanel.status}
          online={d.fireAlarmPanel.online}
        />
        <EquipmentCard
          label="PA System"
          icon={<PASystemIcon />}
          status={d.paSystem.status}
          online={d.paSystem.online}
        />
        <EquipmentCard
          label="Ventilation"
          icon={<VentilationIcon />}
          status={d.ventilation.status}
          online={d.ventilation.online}
          highlight={d.ventilation.status === 'ON'}
        />
      </div>
    </div>
  );
}
