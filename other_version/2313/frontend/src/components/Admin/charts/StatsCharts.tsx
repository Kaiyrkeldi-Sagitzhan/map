import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'

interface ChartItem {
  name: string
  nameRu: string
  count: number
  color: string
  centroid?: [number, number]
}

interface ChartProps {
  data: ChartItem[]
  onItemClick?: (item: ChartItem) => void
}

const TYPE_COLORS: Record<string, string> = {
  lake: '#0ea5e9',
  river: '#38bdf8',
  forest: '#22c55e',
  road: '#334155',
  building: '#8b5cf6',
  city: '#f59e0b',
  mountain: '#94a3b8',
  boundary: '#f43f5e',
  other: '#818cf8',
}

const TYPE_LABELS: Record<string, string> = {
  lake: 'Озёра',
  river: 'Реки',
  forest: 'Леса',
  road: 'Дороги',
  building: 'Здания',
  city: 'Нас. пункты',
  mountain: 'Горы',
  boundary: 'Границы',
  other: 'Другое',
}

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || '#818cf8'
}

export function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{
      background: 'rgba(10, 25, 47, 0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(20px)',
    }}>
      <p className="text-white font-medium">{d.nameRu || d.name}</p>
      <p className="text-slate-400">{d.count} объектов</p>
    </div>
  )
}

const EmptyChartState = ({ label }: { label: string }) => (
  <div className="w-full h-[280px] flex items-center justify-center text-slate-500 text-xs">
    {label}
  </div>
)

export const ObjectPieChart = ({ data, onItemClick }: ChartProps) => {
  if (!data.length) return <EmptyChartState label="Нет данных для круговой диаграммы" />

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="count"
          nameKey="nameRu"
          animationBegin={0}
          animationDuration={1200}
          onClick={(_, idx) => onItemClick?.(data[idx])}
          style={{ cursor: 'pointer' }}
        >
          {data.map((entry, idx) => (
            <Cell
              key={idx}
              fill={entry.color}
              stroke="transparent"
              className="transition-opacity hover:opacity-80"
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export const ObjectBarChart = ({ data, onItemClick }: ChartProps) => {
  if (!data.length) return <EmptyChartState label="Нет данных для столбчатой диаграммы" />

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="nameRu"
          tick={{ fontSize: 10, fill: '#8892B0' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#8892B0' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="count"
          radius={[6, 6, 0, 0]}
          animationDuration={1200}
          onClick={(_, idx) => onItemClick?.(data[idx])}
          style={{ cursor: 'pointer' }}
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} className="transition-opacity hover:opacity-70" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export const ObjectRadarChart = ({ data }: ChartProps) => {
  if (!data.length) return <EmptyChartState label="Нет данных для радарного анализа" />

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis
          dataKey="nameRu"
          tick={{ fontSize: 9, fill: '#8892B0' }}
        />
        <PolarRadiusAxis
          tick={{ fontSize: 8, fill: '#8892B0' }}
          axisLine={false}
        />
        <Radar
          name="Объекты"
          dataKey="count"
          stroke="#10B981"
          fill="#10B981"
          fillOpacity={0.25}
          animationDuration={1500}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
