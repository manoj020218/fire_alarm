import { useState, type ReactNode } from 'react'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'
import StatusDot from '../components/ui/StatusDot'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Tabs from '../components/ui/Tabs'
import Toggle from '../components/ui/Toggle'
import Dropdown from '../components/ui/Dropdown'
import KpiTile from '../components/ui/KpiTile'
import EquipmentCard from '../components/ui/EquipmentCard'
import RadialGauge from '../components/ui/RadialGauge'
import TankGauge from '../components/ui/TankGauge'
import AiInsightCard from '../components/ui/AiInsightCard'
import ConnectionStrip from '../components/ui/ConnectionStrip'
import RefreshCountdown from '../components/ui/RefreshCountdown'
import AlarmTable from '../components/ui/AlarmTable'
import TrendChart from '../components/ui/TrendChart'
import {
  PumpIcon, PressureIcon, TankIcon, FuelIcon, BatteryIcon,
  FirePanelIcon, PaSystemIcon, VentilationIcon, ValveIcon,
  GatewayIcon, Signal4GIcon, LanIcon, WifiIcon, AlarmIcon,
  NavDashboardIcon, NavKitIcon, NavAlarmsIcon, NavSettingsIcon,
} from '../components/icons'
import { initialAlarms, trendSeries, connections } from '../data/mockData'
import type { AlarmItem } from '../components/ui/AlarmRow'

function GallerySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-slate-200" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 px-3">{title}</h2>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      {children}
    </section>
  )
}

function StateLabel({ label }: { label: string }) {
  return <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-center mt-2">{label}</p>
}

export default function KitGallery() {
  const [toggle1, setToggle1] = useState(true)
  const [toggle2, setToggle2] = useState(false)
  const [activeTab, setActiveTab] = useState('pressure')
  const [dropVal, setDropVal] = useState('site1')
  const [alarms, setAlarms] = useState<AlarmItem[]>(initialAlarms)

  const allStatuses = ['ok', 'warning', 'critical', 'offline', 'idle'] as const

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" /></svg>
            Component Kit
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2">FireGuard UI Kit</h1>
          <p className="text-slate-500 text-lg">Every component in every state — for client approval</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-slate-400">
            <span>by Jenix</span>
            <span>·</span>
            <span>Vite + React 18 + TypeScript + Tailwind CSS</span>
            <span>·</span>
            <span>ABC Towers, Mumbai</span>
          </div>
        </div>

        {/* ── Icons ── */}
        <GallerySection title="SVG Icons">
          <SectionCard title="Equipment & Connectivity Icons (all semantic stroke style)">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-6">
              {[
                { icon: <PumpIcon size={32} />, label: 'Pump' },
                { icon: <PressureIcon size={32} />, label: 'Pressure' },
                { icon: <TankIcon size={32} />, label: 'Tank' },
                { icon: <FuelIcon size={32} />, label: 'Fuel' },
                { icon: <BatteryIcon size={32} />, label: 'Battery' },
                { icon: <FirePanelIcon size={32} />, label: 'FirePanel' },
                { icon: <PaSystemIcon size={32} />, label: 'PA System' },
                { icon: <VentilationIcon size={32} />, label: 'Ventilation' },
                { icon: <ValveIcon size={32} />, label: 'Valve' },
                { icon: <GatewayIcon size={32} />, label: 'Gateway' },
                { icon: <Signal4GIcon size={32} />, label: '4G Signal' },
                { icon: <LanIcon size={32} />, label: 'LAN' },
                { icon: <WifiIcon size={32} />, label: 'WiFi' },
                { icon: <AlarmIcon size={32} badge={3} />, label: 'Alarm +badge' },
                { icon: <NavDashboardIcon size={32} />, label: 'Nav: Dash' },
                { icon: <NavKitIcon size={32} />, label: 'Nav: Kit' },
                { icon: <NavAlarmsIcon size={32} />, label: 'Nav: Alarms' },
                { icon: <NavSettingsIcon size={32} />, label: 'Nav: Settings' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                    {icon}
                  </div>
                  <StateLabel label={label} />
                </div>
              ))}
            </div>
          </SectionCard>
        </GallerySection>

        {/* ── StatusBadge ── */}
        <GallerySection title="StatusBadge">
          <SectionCard title="All status states">
            <div className="flex flex-wrap gap-4 items-center">
              {allStatuses.map(s => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <StatusBadge status={s} />
                  <StateLabel label={s} />
                </div>
              ))}
              <div className="flex flex-col items-center gap-2">
                <StatusBadge status="critical" label="FAULT" />
                <StateLabel label="custom label" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <StatusBadge status="ok" label="RUNNING" />
                <StateLabel label="custom label" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <StatusBadge status="idle" label="STANDBY" />
                <StateLabel label="custom label" />
              </div>
            </div>
          </SectionCard>
        </GallerySection>

        {/* ── StatusDot ── */}
        <GallerySection title="StatusDot">
          <SectionCard title="Sizes + pulse states">
            <div className="flex flex-wrap gap-6 items-center">
              {(['sm', 'md', 'lg'] as const).map(size =>
                allStatuses.map(s => (
                  <div key={`${size}-${s}`} className="flex flex-col items-center gap-2">
                    <StatusDot status={s} size={size} pulse={s === 'critical' || s === 'warning'} />
                    <StateLabel label={`${size} ${s}`} />
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </GallerySection>

        {/* ── Buttons ── */}
        <GallerySection title="Button">
          <SectionCard title="Variants and sizes">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <Button variant="primary" size="sm">Primary SM</Button>
                <Button variant="primary" size="md">Primary MD</Button>
                <Button variant="primary" size="lg">Primary LG</Button>
                <Button variant="primary" loading>Loading</Button>
                <Button variant="primary" disabled>Disabled</Button>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <Button variant="secondary" size="sm">Secondary SM</Button>
                <Button variant="secondary" size="md">Secondary MD</Button>
                <Button variant="secondary" size="lg">Secondary LG</Button>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <Button variant="ghost" size="sm">Ghost SM</Button>
                <Button variant="ghost" size="md">Ghost MD</Button>
                <Button variant="ghost" size="lg">Ghost LG</Button>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <Button variant="danger" size="sm">Danger SM</Button>
                <Button variant="danger" size="md">Danger MD</Button>
                <Button variant="danger" size="lg">Danger LG</Button>
              </div>
            </div>
          </SectionCard>
        </GallerySection>

        {/* ── Input ── */}
        <GallerySection title="Input">
          <SectionCard title="States">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
              <Input label="Normal" placeholder="Enter value" />
              <Input
                label="With icon"
                placeholder="Search..."
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>}
              />
              <Input label="Error state" value="bad@" error="Invalid email address" onChange={() => {}} />
            </div>
          </SectionCard>
        </GallerySection>

        {/* ── Tabs ── */}
        <GallerySection title="Tabs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SectionCard title="Pills variant">
              <Tabs
                items={[{ id: 'pressure', label: 'Pressure' }, { id: 'level', label: 'Level' }, { id: 'power', label: 'Power' }]}
                activeTab={activeTab}
                onChange={setActiveTab}
                variant="pills"
              />
            </SectionCard>
            <SectionCard title="Underline variant + counts">
              <Tabs
                items={[
                  { id: 'all', label: 'All', count: 14 },
                  { id: 'critical', label: 'Critical', count: 1 },
                  { id: 'warning', label: 'Warning', count: 2 },
                ]}
                activeTab="all"
                onChange={() => {}}
                variant="underline"
              />
            </SectionCard>
          </div>
        </GallerySection>

        {/* ── Toggle + Dropdown ── */}
        <GallerySection title="Toggle + Dropdown">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SectionCard title="Toggle">
              <div className="space-y-4">
                <Toggle checked={toggle1} onChange={setToggle1} label="Push notifications enabled" />
                <Toggle checked={toggle2} onChange={setToggle2} label="SMS alerts enabled" />
                <Toggle checked={true} onChange={() => {}} label="Disabled (on)" disabled />
                <Toggle checked={false} onChange={() => {}} label="Disabled (off)" disabled />
              </div>
            </SectionCard>
            <SectionCard title="Dropdown">
              <Dropdown
                label="Select Site"
                options={[
                  { value: 'site1', label: 'ABC Towers, Mumbai' },
                  { value: 'site2', label: 'DEF Complex, Pune' },
                  { value: 'site3', label: 'GHI Mall, Nagpur' },
                ]}
                value={dropVal}
                onChange={setDropVal}
              />
            </SectionCard>
          </div>
        </GallerySection>

        {/* ── KpiTile ── */}
        <GallerySection title="KpiTile">
          <SectionCard title="All status states">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <KpiTile icon={<PumpIcon size={20} />} label="Jockey Pump" value="RUNNING" status="ok" subtext="415V supply" />
              <KpiTile icon={<PressureIcon size={20} />} label="Sprinkler" value={6.5} unit="bar" status="ok" />
              <KpiTile icon={<TankIcon size={20} />} label="Water Tank" value={65} unit="%" status="warning" subtext="Below 70% threshold" />
              <KpiTile icon={<PumpIcon size={20} />} label="Diesel Pump" value="FAULT" status="critical" subtext="0V — no supply" />
              <KpiTile icon={<GatewayIcon size={20} />} label="Gateway" value="Offline" status="offline" />
            </div>
          </SectionCard>
        </GallerySection>

        {/* ── EquipmentCard ── */}
        <GallerySection title="EquipmentCard">
          <SectionCard title="All status states with left accent border">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <EquipmentCard icon={<PumpIcon size={18} />} name="Jockey Pump" status="ok" reading={{ label: 'Voltage', value: 415, unit: 'V' }} onDetail={() => {}} />
              <EquipmentCard icon={<PumpIcon size={18} />} name="Main Pump 1" status="idle" reading={{ label: 'Mode', value: 'STANDBY' }} />
              <EquipmentCard icon={<PressureIcon size={18} />} name="Hydrant" status="warning" reading={{ label: 'Pressure', value: 3.2, unit: 'bar' }} onDetail={() => {}} />
              <EquipmentCard icon={<PumpIcon size={18} />} name="Diesel Pump" status="critical" reading={{ label: 'Voltage', value: '0 V — FAULT' }} onDetail={() => {}} />
              <EquipmentCard icon={<GatewayIcon size={18} />} name="Gateway" status="offline" reading={{ label: 'Last seen', value: '2h ago' }} />
            </div>
          </SectionCard>
        </GallerySection>

        {/* ── RadialGauge ── */}
        <GallerySection title="RadialGauge">
          <SectionCard title="Green / Warning / Critical zones">
            <div className="flex flex-wrap gap-8 justify-center py-4">
              <div className="flex flex-col items-center">
                <RadialGauge value={4.5} max={12} unit="bar" label="Sprinkler OK" warningThreshold={8} criticalThreshold={10} size={160} />
                <StateLabel label="Normal (green)" />
              </div>
              <div className="flex flex-col items-center">
                <RadialGauge value={8.5} max={12} unit="bar" label="Hydrant Warn" warningThreshold={8} criticalThreshold={10} size={160} />
                <StateLabel label="Warning (amber)" />
              </div>
              <div className="flex flex-col items-center">
                <RadialGauge value={10.8} max={12} unit="bar" label="Hydrant Crit" warningThreshold={8} criticalThreshold={10} size={160} />
                <StateLabel label="Critical (red)" />
              </div>
              <div className="flex flex-col items-center">
                <RadialGauge value={12.6} max={16} unit="V" label="DG Battery" warningThreshold={11.5} criticalThreshold={10.5} size={160} />
                <StateLabel label="Voltage OK" />
              </div>
              <div className="flex flex-col items-center">
                <RadialGauge value={10.2} max={16} unit="V" label="DG Battery" warningThreshold={11.5} criticalThreshold={10.5} size={160} />
                <StateLabel label="Voltage Critical" />
              </div>
            </div>
          </SectionCard>
        </GallerySection>

        {/* ── TankGauge ── */}
        <GallerySection title="TankGauge">
          <SectionCard title="Fill levels across water and diesel">
            <div className="flex flex-wrap gap-10 justify-center py-4">
              <div className="flex flex-col items-center">
                <TankGauge percent={90} capacityLabel="500 kL" label="Water — Full" fluidType="water" height={140} />
                <StateLabel label="Full (green)" />
              </div>
              <div className="flex flex-col items-center">
                <TankGauge percent={65} capacityLabel="500 kL" label="Water — Warn" fluidType="water" height={140} />
                <StateLabel label="65% (warning)" />
              </div>
              <div className="flex flex-col items-center">
                <TankGauge percent={18} capacityLabel="500 kL" label="Water — Crit" fluidType="water" height={140} />
                <StateLabel label="18% (critical)" />
              </div>
              <div className="flex flex-col items-center">
                <TankGauge percent={72} capacityLabel="2000 L" label="DG Fuel" fluidType="diesel" height={140} />
                <StateLabel label="Diesel 72%" />
              </div>
              <div className="flex flex-col items-center">
                <TankGauge percent={12} capacityLabel="2000 L" label="DG Fuel Low" fluidType="diesel" height={140} />
                <StateLabel label="Diesel 12% (crit)" />
              </div>
            </div>
          </SectionCard>
        </GallerySection>

        {/* ── AiInsightCard ── */}
        <GallerySection title="AiInsightCard">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <AiInsightCard
                status="ok"
                insight="All fire systems operating normally. Sprinkler and hydrant pressures are within specification. No immediate action required."
                timestamp={new Date()}
              />
              <StateLabel label="Normal" />
            </div>
            <div>
              <AiInsightCard
                status="warning"
                insight="Water tank at 65%, below the 70% alert threshold. At current consumption rate the tank will last approximately 4.2 hours. Schedule a refill."
                deviceName="Water Tank"
                timestamp={new Date(Date.now() - 900000)}
              />
              <StateLabel label="Warning" />
            </div>
            <div>
              <AiInsightCard
                status="critical"
                insight="CRITICAL: Diesel backup pump fault detected. System is running on electric pumps only — fire redundancy is reduced. Immediate inspection required."
                deviceName="Diesel Pump"
                timestamp={new Date(Date.now() - 300000)}
              />
              <StateLabel label="Critical" />
            </div>
          </div>
        </GallerySection>

        {/* ── ConnectionStrip ── */}
        <GallerySection title="ConnectionStrip">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SectionCard title="Row layout">
              <ConnectionStrip connections={connections} layout="row" />
            </SectionCard>
            <SectionCard title="Grid layout (3-col)">
              <ConnectionStrip connections={connections} layout="grid" />
            </SectionCard>
          </div>
        </GallerySection>

        {/* ── RefreshCountdown ── */}
        <GallerySection title="RefreshCountdown">
          <SectionCard title="30s countdown ring (click to reset)">
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <RefreshCountdown totalSeconds={30} size={48} />
                <StateLabel label="Size 48" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <RefreshCountdown totalSeconds={30} size={36} />
                <StateLabel label="Size 36 (topbar)" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <RefreshCountdown totalSeconds={60} size={48} />
                <StateLabel label="60s interval" />
              </div>
            </div>
          </SectionCard>
        </GallerySection>

        {/* ── AlarmTable ── */}
        <GallerySection title="AlarmTable + AlarmRow">
          <AlarmTable
            alarms={alarms}
            onAck={(id) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a))}
          />
        </GallerySection>

        {/* ── TrendChart ── */}
        <GallerySection title="TrendChart">
          <TrendChart
            series={trendSeries}
            tabs={trendSeries.map(s => s.id)}
          />
        </GallerySection>

        {/* ── SectionCard ── */}
        <GallerySection title="SectionCard">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SectionCard title="No accent">
              <p className="text-sm text-slate-600">Content goes here.</p>
            </SectionCard>
            <SectionCard title="With indigo accent" accent="#6366F1">
              <p className="text-sm text-slate-600">Indigo accent bar on title left.</p>
            </SectionCard>
            <SectionCard title="With action slot" accent="#22C55E" action={<Button variant="ghost" size="sm">View All</Button>}>
              <p className="text-sm text-slate-600">Has action button in header.</p>
            </SectionCard>
          </div>
        </GallerySection>

        {/* Footer */}
        <div className="text-center py-8 text-xs text-slate-400 border-t border-slate-200 mt-4">
          FireGuard UI Kit v1.0 · Built with Vite + React 18 + TypeScript + Tailwind CSS v3 + Recharts
          <br />
          by Jenix · ABC Towers, Mumbai · SITE001 · For client approval
        </div>
      </div>
    </div>
  )
}
