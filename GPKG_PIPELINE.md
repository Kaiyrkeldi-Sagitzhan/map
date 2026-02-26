# Работа с kazakhstan-260225-free.gpkg.zip — Полный пайплайн

Пошаговое руководство: от распаковки GeoPackage (OSM Казахстан) до быстрой интерактивной веб-карты с редактированием через leaflet-geoman.

---

## Шаг 1: Распаковка

```bash
# Linux / macOS
cd /home/ask/Documents/GitHub/map
unzip kazakhstan-260225-free.gpkg.zip -d gpkg_data/

# Результат: gpkg_data/gis_osm_*.gpkg (~455 МБ)
ls -lh gpkg_data/
```

> [!NOTE]
> Файл содержит один `.gpkg` файл — это SQLite база с PostGIS-подобными таблицами.

---

## Шаг 2: Анализ содержимого в QGIS

### Как открыть
1. QGIS → Layer → Add Layer → Add Vector Layer → выбрать `.gpkg`
2. Появится список всех таблиц — выбрать все (Ctrl+A) → OK

### Или через CLI (ogrinfo)

```bash
# Список слоёв
ogrinfo gpkg_data/kazakhstan-260225-free.gpkg

# Детали одного слоя
ogrinfo -so gpkg_data/kazakhstan-260225-free.gpkg gis_osm_roads_free_1
```

### Типичные слои Geofabrik experimental GeoPackage

| Слой                          | Геометрия    | ~Объектов  | Ключевые атрибуты                    |
|-------------------------------|-------------|-----------|--------------------------------------|
| `gis_osm_buildings_a_free_1`  | Polygon     | ~500K     | osm_id, name, type                   |
| `gis_osm_roads_free_1`       | LineString  | ~1.2M     | osm_id, fclass, name, ref, maxspeed  |
| `gis_osm_waterways_free_1`   | LineString  | ~80K      | osm_id, fclass, name, width          |
| `gis_osm_water_a_free_1`     | Polygon     | ~30K      | osm_id, fclass, name                 |
| `gis_osm_railways_free_1`    | LineString  | ~20K      | osm_id, fclass, name                 |
| `gis_osm_natural_free_1`     | Point       | ~50K      | osm_id, fclass, name                 |
| `gis_osm_natural_a_free_1`   | Polygon     | ~40K      | osm_id, fclass, name                 |
| `gis_osm_places_free_1`      | Point       | ~25K      | osm_id, fclass, name, population     |
| `gis_osm_pois_free_1`        | Point       | ~150K     | osm_id, fclass, name                 |
| `gis_osm_pois_a_free_1`      | Polygon     | ~30K      | osm_id, fclass, name                 |
| `gis_osm_landuse_a_free_1`   | Polygon     | ~60K      | osm_id, fclass, name                 |
| `gis_osm_transport_free_1`   | Point       | ~15K      | osm_id, fclass, name                 |
| `gis_osm_traffic_free_1`     | Point       | ~80K      | osm_id, fclass                       |
| `gis_osm_traffic_a_free_1`   | Polygon     | ~5K       | osm_id, fclass                       |
| `gis_osm_pofw_free_1`        | Point       | ~3K       | osm_id, fclass, name                 |

> `fclass` — это ключевой атрибут OSM (residential, primary, river, lake и т.д.)

### Рекомендуемые стили QGIS

| Слой       | Цвет обводки | Цвет заливки | Толщина |
|-----------|-------------|-------------|---------|
| buildings | `#6b21a8`   | `#c084fc40` | 0.5     |
| roads     | `#374151`   | —           | 1-3     |
| water     | `#0284c7`   | `#38bdf860` | 1       |
| waterways | `#0369a1`   | —           | 2       |
| natural   | `#15803d`   | `#4ade8050` | 1       |
| landuse   | `#92400e`   | `#fbbf2430` | 0.5     |

---

## Шаг 3: Конвертация в PMTiles (Vector Tiles)

### Почему НЕ GeoJSON?

- 1.2M дорог = ~2 ГБ GeoJSON → Leaflet не потянет
- Браузер замёрзнет при загрузке даже 100K объектов
- Отрисовка SVG на каждый зум — слишком медленно

### Вариант 1 (Рекомендуемый): Planetiler из .osm.pbf

```bash
# 1. Скачать PBF (маленький, ~250 МБ)
wget https://download.geofabrik.de/asia/kazakhstan-latest.osm.pbf

# 2. Запустить Planetiler через Docker
docker run -e JAVA_TOOL_OPTIONS="-Xmx4g" \
  -v "$(pwd):/data" \
  ghcr.io/onthegomap/planetiler:latest \
  --osm-path=/data/kazakhstan-latest.osm.pbf \
  --output=/data/kazakhstan.pmtiles \
  --maxzoom=14 \
  --nodemap-type=array \
  --download

# Результат: kazakhstan.pmtiles (~200-400 МБ)
ls -lh kazakhstan.pmtiles
```

### Вариант 2: Из .gpkg через tippecanoe

```bash
# 1. Экспорт каждого слоя в GeoJSON (пример для дорог)
ogr2ogr -f GeoJSON roads.geojson \
  gpkg_data/kazakhstan-260225-free.gpkg \
  gis_osm_roads_free_1 \
  -t_srs EPSG:4326

ogr2ogr -f GeoJSON water.geojson \
  gpkg_data/kazakhstan-260225-free.gpkg \
  gis_osm_water_a_free_1

ogr2ogr -f GeoJSON buildings.geojson \
  gpkg_data/kazakhstan-260225-free.gpkg \
  gis_osm_buildings_a_free_1

# 2. Объединить через tippecanoe → PMTiles
tippecanoe \
  -o kazakhstan.pmtiles \
  --force \
  --maximum-zoom=14 \
  --minimum-zoom=0 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --named-layer=roads:roads.geojson \
  --named-layer=water:water.geojson \
  --named-layer=buildings:buildings.geojson

# Можно также установить tippecanoe через Docker:
# docker run -v $(pwd):/data felt/tippecanoe:latest \
#   tippecanoe -o /data/output.pmtiles ...
```

---

## Шаг 4: Интеграция PMTiles в Leaflet

### Установка

```bash
cd frontend
npm install protomaps-leaflet pmtiles
```

### Код подключения (React + react-leaflet)

```tsx
// components/Editor/BaseMapLayer.tsx
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import * as protomapsL from 'protomaps-leaflet'

export default function BaseMapLayer() {
  const map = useMap()

  useEffect(() => {
    // Локальный файл или URL
    const layer = protomapsL.leafletLayer({
      url: '/data/kazakhstan.pmtiles', // в public/ или на сервере
      // Или: url: 'https://your-server.com/kazakhstan.pmtiles'
    })

    layer.addTo(map)

    return () => {
      map.removeLayer(layer)
    }
  }, [map])

  return null
}
```

> Положите `kazakhstan.pmtiles` в `frontend/public/data/` для локальной разработки.

### Использование в MapEditor

```tsx
<MapContainer ...>
  <BaseMapLayer />       {/* PMTiles base: быстро, read-only */}
  <GeomanController />   {/* Editable overlay */}
</MapContainer>
```

---

## Шаг 5: Редактирование и персистентность

### Архитектура: два слоя

```
┌─────────────────────────────────┐
│  PMTiles (read-only, fast)      │ ← Базовая карта OSM
├─────────────────────────────────┤
│  GeoJSON overlay (editable)     │ ← Пользовательские фичи
│  ↕ leaflet-geoman               │   из PostGIS per user_id
└─────────────────────────────────┘
```

1. **Базовая карта** — PMTiles, только для просмотра, мгновенно рендерится
2. **Редактируемый слой** — загружается из `GET /api/map/objects`, рендерится как GeoJSON через leaflet-geoman
3. **При клике на объект PMTiles** → можно скопировать его в editable слой (future feature)
4. **Всё сохраняется** в PostGIS через `POST /api/map/objects` с `user_id`

### API endpoints (уже существуют)

| Method | Path                     | Описание                    |
|--------|--------------------------|----------------------------|
| GET    | `/api/map/objects`       | Загрузить все объекты       |
| POST   | `/api/map/objects`       | Создать новый объект        |
| PUT    | `/api/map/objects/:id`   | Обновить объект             |
| DELETE | `/api/map/objects/:id`   | Удалить объект              |

---

## Шаг 6: Оптимизация

### Lazy loading слоёв
- PMTiles автоматически загружает только нужные тайлы для текущего viewport + zoom
- GeoJSON overlay загружается один раз при входе — обычно < 1000 объектов

### Clustering для точек
```bash
npm install react-leaflet-cluster
```

### Debounce при редактировании
В `useGeoman.ts` уже реализован прямой save-on-edit. Для частых правок:
```ts
const debouncedSave = useMemo(
  () => debounce((feature: EditorFeature) => saveToBackend(feature), 500),
  []
)
```

### Хранение изменений отдельно
- Таблица `geo_objects` с `scope = 'private'` + `owner_id` — изменения каждого пользователя изолированы
- Базовая карта (PMTiles) — общая, статическая, не меняется

---

## Дополнительно: UTM координаты (proj4js)

Казахстан: UTM зоны 40N-44N (EPSG:32640-32644).

```bash
npm install proj4
npm install @types/proj4
```

```tsx
import proj4 from 'proj4'

// Определение зоны по долготе
function getUTMZone(lng: number): number {
  return Math.floor((lng + 180) / 6) + 1
}

// Конвертация WGS84 → UTM
function toUTM(lat: number, lng: number) {
  const zone = getUTMZone(lng)
  const utmProj = `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`
  const [easting, northing] = proj4('EPSG:4326', utmProj, [lng, lat])
  return { zone, easting, northing }
}

// Пример: Астана (51.169, 71.449)
// → Zone 42N, Easting: 373451.23m, Northing: 5672891.45m
```

---

## Заключение: почему это оптимально для дипломной работы

| Критерий                  | Решение                                 |
|--------------------------|----------------------------------------|
| **Скорость**             | PMTiles — векторные тайлы, мгновенный рендер |
| **Редактируемость**      | leaflet-geoman — полные инструменты рисования |
| **Персистентность**      | PostGIS — каждый пользователь хранит свои объекты |
| **Масштабируемость**     | Базовая карта статична, оверлей лёгкий  |
| **Актуальность стека**   | React 18 + Vite + Zustand + Planetiler (2024-2026) |
| **Научная новизна**      | Двухслойная архитектура: static base + editable overlay |
| **Экспорт**              | GeoJSON / SVG / PNG из редактора        |
| **Координатные системы** | WGS84 + UTM зоны 40-44N через proj4js  |
