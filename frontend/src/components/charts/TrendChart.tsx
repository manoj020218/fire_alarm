import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import type { TrendPoint } from '@/types';
import { formatTime } from '@/utils/formatters';

interface Props {
  data: TrendPoint[];
  unit: string;
  color?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  height?: number;
}

export function TrendChart({ data, unit, color = '#1D4ED8', warningThreshold, criticalThreshold, height = 200 }: Props) {
  const formatted = data.map((p) => ({ ...p, time: formatTime(p.ts) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: '#94A3B8' }}
          interval="preserveStartEnd"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#94A3B8' }}
          tickLine={false}
          axisLine={false}
          unit={` ${unit}`}
          width={52}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#E2E8F0' }}
          formatter={(v: number) => [`${v.toFixed(2)} ${unit}`, 'Value']}
        />
        {warningThreshold && (
          <ReferenceLine y={warningThreshold} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Warn', fill: '#F59E0B', fontSize: 10 }} />
        )}
        {criticalThreshold && (
          <ReferenceLine y={criticalThreshold} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Crit', fill: '#EF4444', fontSize: 10 }} />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
