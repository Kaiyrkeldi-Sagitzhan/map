import { useState } from 'react'
import { X, Check, Send, AlertTriangle } from 'lucide-react'
import { apiService } from '../../services/api'

interface ComplaintModalProps {
  onClose: () => void
  initialData?: any
}

const OBJECT_TYPES = [
  { value: 'lake', label: 'Озеро' },
  { value: 'river', label: 'Река' },
  { value: 'forest', label: 'Лес' },
  { value: 'road', label: 'Дорога' },
  { value: 'building', label: 'Здание' },
  { value: 'city', label: 'Населённый пункт' },
  { value: 'mountain', label: 'Гора' },
  { value: 'boundary', label: 'Граница' },
  { value: 'other', label: 'Другое' },
]

const ComplaintModal = ({ onClose, initialData }: ComplaintModalProps) => {
  const [objectType] = useState(initialData?.type || '')
  const [objectId] = useState<string | undefined>(initialData?.id || initialData?.backendId)
  const [objectName] = useState(initialData?.name || '')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!objectType || !description.trim()) {
      setError('Заполните все обязательные поля')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await apiService.createComplaint({
        object_id: objectId,
        object_type: objectType,
        description: description.trim(),
      })
      setSuccess(true)
      setTimeout(onClose, 2000)
    } catch {
      setError('Ошибка при отправке жалобы')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed top-28 right-[340px] z-[6000] w-[420px] max-h-[calc(100vh-160px)] animate-in slide-in-from-right-4 duration-300">
      <div
        className="bg-[#020C1B] border border-white/10 rounded-[24px] overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.6)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Новая жалоба</h2>
                <p className="text-[10px] text-slate-500 uppercase font-medium mt-0.5">Сообщить о проблеме или ошибке</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-[32px] bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <Check className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Отправлено!</h3>
            <p className="text-sm text-slate-400 leading-relaxed max-w-[240px]">Спасибо за обратную связь. Администратор скоро проверит информацию.</p>
          </div>
        ) : (
          <div className="p-8 space-y-6">
            {/* Object Info */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Объект</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] font-mono text-slate-400">{objectId ? objectId.slice(0,8) : 'Без ID'}</span>
                </div>
                
                <div className="space-y-1">
                    <div className="text-sm font-bold text-white">{objectName || 'Выбранный объект'}</div>
                    <div className="text-[10px] text-[#10B981] font-black uppercase tracking-widest opacity-70">
                        {OBJECT_TYPES.find(t => t.value === objectType)?.label || objectType || 'Другое'}
                    </div>
                </div>
            </div>

            {/* Step 2: Description */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Описание проблемы</label>
              <textarea
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 focus:bg-white/[0.05] transition-all resize-none leading-relaxed"
                rows={5}
                placeholder="Опишите, что не так с этим объектом..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 text-center">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !description.trim()}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-400 text-[#020C1B] shadow-xl shadow-amber-500/10"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Отправка...' : 'Отправить жалобу'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ComplaintModal
