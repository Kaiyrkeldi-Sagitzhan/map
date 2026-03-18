import { Layers, Mountain, Waves, School, Activity, Info, Calendar, Home, Navigation, MapPin, Droplets, Ruler, Clock, Users } from 'lucide-react'

export type FieldType = 'number' | 'text' | 'select' | 'toggle'

export interface PropertyField {
    key: string
    label: string
    type: FieldType
    icon: any
    options?: string[] // For 'select' type
    unit?: string     // For 'number' type (e.g., "м", "этаж")
}

export interface FeatureSchema {
    label: string
    icon: any
    fields: PropertyField[]
}

export const FEATURE_SCHEMAS: Record<string, FeatureSchema> = {
    // Городская среда (Здания)
    'building': {
        label: 'Здание',
        icon: Home,
        fields: [
            { key: 'levels', label: 'Этажность', type: 'number', icon: Layers, unit: 'эт.' },
            { key: 'material', label: 'Материал', type: 'select', icon: Info, options: ['Кирпич', 'Монолит', 'Панель', 'Дерево', 'Металл'] },
            { key: 'build_year', label: 'Год постройки', type: 'number', icon: Calendar },
            { key: 'condition', label: 'Состояние', type: 'select', icon: Activity, options: ['Новое', 'Хорошее', 'Удовлетворительное', 'Ветхое', 'Аварийное'] }
        ]
    },
    // Рельеф (Горы)
    'peak': {
        label: 'Вершина',
        icon: Mountain,
        fields: [
            { key: 'elevation', label: 'Высота', type: 'number', icon: Navigation, unit: 'м' },
            { key: 'difficulty', label: 'Сложность', type: 'select', icon: Activity, options: ['Легко', 'Средне', 'Сложно', 'Экстрим'] },
            { key: 'rock_type', label: 'Тип породы', type: 'text', icon: MapPin }
        ]
    },
    // Водные ресурсы
    'water': {
        label: 'Водоем',
        icon: Waves,
        fields: [
            { key: 'max_depth', label: 'Макс. глубина', type: 'number', icon: Droplets, unit: 'м' },
            { key: 'water_quality', label: 'Качество воды', type: 'select', icon: Droplets, options: ['Пресная', 'Соленая', 'Питьевая', 'Техническая'] },
            { key: 'transparency', label: 'Прозрачность', type: 'number', icon: Waves, unit: 'м' }
        ]
    },
    'reservoir': {
        label: 'Водохранилище',
        icon: Droplets,
        fields: [
            { key: 'max_depth', label: 'Макс. глубина', type: 'number', icon: Droplets, unit: 'м' },
            { key: 'volume', label: 'Объем', type: 'number', icon: Waves, unit: 'млн м³' }
        ]
    },
    'river': {
        label: 'Река',
        icon: Waves,
        fields: [
            { key: 'width', label: 'Ширина', type: 'number', icon: Ruler, unit: 'м' },
            { key: 'flow_speed', label: 'Скорость течения', type: 'number', icon: Activity, unit: 'м/с' },
            { key: 'navigable', label: 'Судоходность', type: 'toggle', icon: Navigation }
        ]
    },
    // Социальные объекты
    'school': {
        label: 'Школа',
        icon: School,
        fields: [
            { key: 'capacity', label: 'Вместимость', type: 'number', icon: Users, unit: 'чел.' },
            { key: 'working_hours', label: 'Часы работы', type: 'text', icon: Clock },
            { key: 'contact_phone', label: 'Телефон', type: 'text', icon: Info }
        ]
    },
    'hospital': {
        label: 'Больница',
        icon: Activity,
        fields: [
            { key: 'beds_count', label: 'Кол-во койко-мест', type: 'number', icon: Users, unit: 'мест' },
            { key: 'emergency', label: 'Экстренная помощь', type: 'toggle', icon: Activity }
        ]
    },
    // Промышленность
    'quarry': {
        label: 'Карьер',
        icon: Layers,
        fields: [
            { key: 'resource', label: 'Ископаемое', type: 'text', icon: MapPin },
            { key: 'depth', label: 'Глубина карьера', type: 'number', icon: Droplets, unit: 'м' }
        ]
    },
    // Базовые маппинги для обратной совместимости
    'lake': {
        label: 'Озеро',
        icon: Waves,
        fields: [
            { key: 'max_depth', label: 'Макс. глубина', type: 'number', icon: Droplets, unit: 'м' },
            { key: 'water_quality', label: 'Качество воды', type: 'select', icon: Droplets, options: ['Пресная', 'Соленая', 'Питьевая', 'Техническая'] }
        ]
    },
    'forest': {
        label: 'Лес',
        icon: Info,
        fields: [
            { key: 'tree_type', label: 'Тип деревьев', type: 'select', icon: Info, options: ['Хвойный', 'Лиственный', 'Смешанный'] },
            { key: 'density', label: 'Плотность', type: 'number', icon: Layers, unit: '%' }
        ]
    },
    'road': {
        label: 'Дорога',
        icon: Navigation,
        fields: [
            { key: 'maxspeed', label: 'Макс. скорость', type: 'number', icon: Activity, unit: 'км/ч' },
            { key: 'surface', label: 'Покрытие', type: 'select', icon: Layers, options: ['Асфальт', 'Грунт', 'Гравий', 'Бетон'] },
            { key: 'oneway', label: 'Одностороннее', type: 'toggle', icon: Navigation }
        ]
    },
    'city': {
        label: 'Населенный пункт',
        icon: MapPin,
        fields: [
            { key: 'population', label: 'Население', type: 'number', icon: Users, unit: 'чел.' },
            { key: 'status', label: 'Статус', type: 'text', icon: Info }
        ]
    },
    'other': {
        label: 'Объект',
        icon: Info,
        fields: [
            { key: 'custom_type', label: 'Тип объекта', type: 'text', icon: Layers },
            { key: 'notes', label: 'Заметки', type: 'text', icon: Info }
        ]
    },
    'custom': {
        label: 'Пользовательский объект',
        icon: Info,
        fields: [
            { key: 'category', label: 'Категория', type: 'text', icon: Layers },
            { key: 'importance', label: 'Важность', type: 'select', icon: Activity, options: ['Низкая', 'Средняя', 'Высокая', 'Критическая'] }
        ]
    },
    'mountain': {
        label: 'Гора',
        icon: Mountain,
        fields: [
            { key: 'elevation', label: 'Высота', type: 'number', icon: Navigation, unit: 'м' },
            { key: 'type', label: 'Тип вершины', type: 'text', icon: Info }
        ]
    }
}

export const getFieldIcon = (fclass: string, fieldKey: string) => {
    const schema = FEATURE_SCHEMAS[fclass] || FEATURE_SCHEMAS['building']
    const field = schema.fields.find(f => f.key === fieldKey)
    return field?.icon || Info
}
