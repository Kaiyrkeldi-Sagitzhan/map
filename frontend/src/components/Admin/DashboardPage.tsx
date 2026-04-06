import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, Users, AlertTriangle, TrendingUp } from 'lucide-react'
import { useAdminStore } from '../../store/adminStore'
import { ObjectPieChart, ObjectBarChart, ObjectRadarChart, getTypeColor, getTypeLabel } from './charts/StatsCharts'

// Animated counter component
const AnimatedCount = ({ value }: { value: number }) => {
  const [display, setDisplay] = useState(0)
  const ref = useRef<any>(null)

  useEffect(() => {
    const start = display
    const diff = value - start
    if (diff === 0) return
    const duration = 800
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + diff * eased))
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate)
      }
    }
    ref.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(ref.current)
  }, [value])

  return <>{display.toLocaleString()}</>
}

const DashboardPage = () => {
  const navigate = useNavigate()
  const { stats, statsLoading, fetchStats, pendingCount, fetchPendingCount, totalUsers, fetchUsers } = useAdminStore()

  useEffect(() => {
    fetchStats()
    fetchPendingCount()
    fetchUsers('', 1)
  }, [fetchStats, fetchPendingCount, fetchUsers])

  const chartData = (stats?.stats || []).map((s) => ({
    name: s.type,
    nameRu: getTypeLabel(s.type),
    count: s.count,
    color: getTypeColor(s.type),
    centroid: s.centroid,
  }))
  const hasChartData = chartData.length > 0

  const handleChartClick = (item: any) => {
    if (item.centroid) {
      navigate(`/editor?lat=${item.centroid[0]}&lng=${item.centroid[1]}&zoom=8&type=${item.name}`)
    }
  }

  const summaryCards = [
    { icon: Database, label: 'Всего объектов', value: stats?.total || 0, color: '#10B981' },
    { icon: Users, label: 'Пользователей', value: totalUsers, color: '#3b82f6' },
    { icon: AlertTriangle, label: 'Ожидающих жалоб', value: pendingCount, color: '#f59e0b' },
    { icon: TrendingUp, label: 'Типов объектов', value: stats?.stats?.length || 0, color: '#8b5cf6' },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white mb-1">Дашборд</h1>
        <p className="text-xs text-slate-500">Общая статистика по объектам и активности</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-5 transition-all hover:scale-[1.02] hover:shadow-lg"
            style={{
              background: 'rgba(10, 25, 47, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${card.color}15` }}
              >
                <card.icon className="w-4.5 h-4.5" style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mb-0.5">
              <AnimatedCount value={card.value} />
            </p>
            <p className="text-[11px] text-slate-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      {statsLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasChartData ? (
        <div
          className="rounded-xl p-8 text-center mb-8"
          style={{
            background: 'rgba(10, 25, 47, 0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Пока нет данных для диаграмм</h3>
          <p className="text-xs text-slate-500">Статистика появится после загрузки объектов на карту.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Pie Chart */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'rgba(10, 25, 47, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <h3 className="text-xs font-semibold text-slate-300 mb-4 uppercase tracking-wider">
              Распределение по типам
            </h3>
            <ObjectPieChart data={chartData} onItemClick={handleChartClick} />
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {chartData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-[10px] text-slate-400">{d.nameRu}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bar Chart */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'rgba(10, 25, 47, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <h3 className="text-xs font-semibold text-slate-300 mb-4 uppercase tracking-wider">
              Количество объектов
            </h3>
            <ObjectBarChart data={chartData} onItemClick={handleChartClick} />
          </div>

          {/* Radar Chart */}
          <div
            className="rounded-xl p-5 col-span-2"
            style={{
              background: 'rgba(10, 25, 47, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <h3 className="text-xs font-semibold text-slate-300 mb-4 uppercase tracking-wider">
              Радарный анализ
            </h3>
            <div className="max-w-xl mx-auto">
              <ObjectRadarChart data={chartData} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
