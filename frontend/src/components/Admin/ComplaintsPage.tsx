import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, ChevronLeft, ChevronRight, Clock, Check, X, Eye } from 'lucide-react'
import { useAdminStore } from '../../store/adminStore'
import type { Complaint } from '../../types'

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending: { label: 'Ожидает', class: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  in_review: { label: 'На рассмотрении', class: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  resolved: { label: 'Решено', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  dismissed: { label: 'Отклонено', class: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
}

const FILTER_TABS = [
  { value: '', label: 'Все' },
  { value: 'pending', label: 'Ожидает' },
  { value: 'in_review', label: 'Рассмотрение' },
  { value: 'resolved', label: 'Решено' },
  { value: 'dismissed', label: 'Отклонено' },
]

const TYPE_LABELS: Record<string, string> = {
  lake: 'Озеро', river: 'Река', forest: 'Лес', road: 'Дорога',
  building: 'Здание', city: 'Нас. пункт', mountain: 'Гора',
  boundary: 'Граница', other: 'Другое',
}

const ComplaintsPage = () => {
  const navigate = useNavigate()
  const {
    complaints, totalComplaints, complaintsPage, complaintsStatus, complaintsLoading,
    fetchComplaints, setComplaintsStatus, setComplaintsPage, updateComplaint
  } = useAdminStore()

  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [newStatus, setNewStatus] = useState('')

  useEffect(() => {
    fetchComplaints()
  }, [fetchComplaints])

  const totalPages = Math.ceil(totalComplaints / 20)

  const openDetail = (c: Complaint) => {
    setSelectedComplaint(c)
    setAdminNotes(c.admin_notes || '')
    setNewStatus(c.status)
  }

  const handleUpdate = async () => {
    if (!selectedComplaint) return
    await updateComplaint(selectedComplaint.id, { status: newStatus, admin_notes: adminNotes })
    setSelectedComplaint(null)
  }

  const navigateToObject = (c: Complaint) => {
    if (c.object_id) {
      navigate(`/editor?objectId=${c.object_id}`)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white mb-1">Жалобы</h1>
        <p className="text-xs text-slate-500">{totalComplaints} жалоб всего</p>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-white/[0.03] border border-white/5 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setComplaintsStatus(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              complaintsStatus === tab.value
                ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Complaints List */}
      {complaintsLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : complaints.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{
            background: 'rgba(10, 25, 47, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <p className="text-xs text-slate-500">Жалоб не найдено</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => {
            const statusConf = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending
            return (
              <div
                key={c.id}
                className="rounded-xl p-4 transition-all hover:bg-white/[0.02] cursor-pointer group"
                style={{
                  background: 'rgba(10, 25, 47, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
                onClick={() => openDetail(c)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${statusConf.class}`}>
                        {statusConf.label}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase">
                        {TYPE_LABELS[c.object_type] || c.object_type}
                      </span>
                      {c.object_name && (
                        <span className="text-[10px] text-slate-400">- {c.object_name}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2 mb-1.5">{c.description}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500">{c.user_email}</span>
                      <span className="text-[10px] text-slate-600 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(c.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
                    {c.object_id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigateToObject(c) }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#10B981] hover:bg-[#10B981]/10 transition-colors"
                        title="Показать на карте"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                      title="Подробнее"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3">
              <button
                onClick={() => setComplaintsPage(complaintsPage - 1)}
                disabled={complaintsPage <= 1}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] text-slate-400">{complaintsPage} / {totalPages}</span>
              <button
                onClick={() => setComplaintsPage(complaintsPage + 1)}
                disabled={complaintsPage >= totalPages}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center" onClick={() => setSelectedComplaint(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(10, 25, 47, 0.95)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">Детали жалобы</h2>
              <button onClick={() => setSelectedComplaint(null)} className="p-1 rounded-md hover:bg-white/5 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Описание</label>
                <p className="text-xs text-slate-300 bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  {selectedComplaint.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Отправитель</label>
                  <p className="text-xs text-slate-300">{selectedComplaint.user_email}</p>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Тип объекта</label>
                  <p className="text-xs text-slate-300">{TYPE_LABELS[selectedComplaint.object_type] || selectedComplaint.object_type}</p>
                </div>
              </div>

              {selectedComplaint.object_name && (
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Объект</label>
                  <p className="text-xs text-slate-300">{selectedComplaint.object_name}</p>
                </div>
              )}

              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Статус</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#10B981]/50 transition-colors appearance-none"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="pending" className="bg-[#0A192F]">Ожидает</option>
                  <option value="in_review" className="bg-[#0A192F]">На рассмотрении</option>
                  <option value="resolved" className="bg-[#0A192F]">Решено</option>
                  <option value="dismissed" className="bg-[#0A192F]">Отклонено</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Заметки администратора</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors resize-none"
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Добавьте заметку..."
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleUpdate}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#10B981] hover:bg-[#0d9668] text-white transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Сохранить
                </button>
                {selectedComplaint.object_id && (
                  <button
                    onClick={() => navigateToObject(selectedComplaint)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-white/10"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Показать на карте
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComplaintsPage
