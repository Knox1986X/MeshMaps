# MeshMaps

Офлайн 3D-карта: Android (Capacitor, APK) и Linux (Tauri, AppImage) из одной кодовой базы.
Бесплатно, open-source, без API-ключей и аккаунтов.

## Стек
- TypeScript + Vite + MapLibre GL JS (fill-extrusion, pitch, bearing)
- PMTiles (протокол `pmtiles://`), схема OpenMapTiles
- Dexie (IndexedDB) для пользовательских данных
- Capacitor 7 (Android): Geolocation, Filesystem, Preferences, Share
- Tauri 2 (Linux): AppImage / deb
- Routing: A* в Web Worker по графу из слоя `transportation`

## План по этапам
1. **Каркас** (готово): package.json, vite, tsconfig, capacitor.config.ts, src-tauri, `public/style/style.json` в цветах референса, стартовая карта.
2. **Тёмная 3D-карта** (готово): офлайн-шрифты SDF (`tools/build-glyphs.py` → `public/fonts`), процедурные иконки POI (`src/map/icons.ts`), неоновое выделение объектов (`src/map/highlight.ts`), нижняя карточка (адрес, высота, координаты, «Маршрут сюда»), кнопки зума/компаса/2D-3D, нижняя навигация.
3. **Офлайн-регионы** (готово): импорт `.pmtiles` (проверка MVT и схемы OpenMapTiles), выбор рамкой на карте, менеджер регионов, переключение источника карты на локальный файл. Файлы хранятся в OPFS (`/regions`), метаданные в IndexedDB (Dexie). Первый регион: Курганская область (`tools/build-region.sh kurgan`).
4. **Геолокация** (готово): синяя точка с конусом направления и кругом точности (`src/map/location.ts`), режимы «следовать» и «навигация» (карта поворачивается по курсу, жест пальцем выключает режим), курс по GPS на скорости от 1.5 м/с и по компасу (DeviceOrientation) иначе. Нативно — `@capacitor/geolocation`, в браузере/Tauri — `navigator.geolocation`.
5. Свои объекты: рисование троп/дорог/POI/зон, слои, запись GPS-трека, GeoJSON/GPX импорт-экспорт, полный бэкап .zip.
6. Роутинг A* в Worker, профили пешком/вело/авто, oneway, перестроение при сходе с маршрута.
7. Поиск офлайн, UI (нижняя навигация, плавающие кнопки, адаптивность), опционально Dropbox PKCE-бэкап.
8. GitHub Actions (APK + AppImage), инструкции CachyOS/Android, скрипты загрузки регионов.

## Разработка
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build -> dist/
```

## Android
```bash
npm run build
npx cap add android      # один раз
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Linux (CachyOS / Arch)
```bash
sudo pacman -S --needed base-devel curl wget file openssl appmenu-gtk-module \
  libappindicator-gtk3 librsvg xdotool webkit2gtk-4.1 rustup nodejs npm
rustup default stable
npm run tauri dev
npm run tauri build -- --bundles appimage
```

## Данные карты (Курганская область)
Приложение ожидает **схему OpenMapTiles** (слои transportation, building, water, landcover, poi). Протокольные
сборки Protomaps используют другую схему, поэтому регион строится planetiler с профилем OpenMapTiles:

```bash
tools/build-region.sh kurgan     # скачивает Geofabrik ural-fed-district и planetiler, создаёт data/kurgan.pmtiles
```
Затем в приложении: вкладка «Регионы» → «Импорт .pmtiles» → выбрать `data/kurgan.pmtiles`, потом «Открыть офлайн».
Рамка Курганской области: W 61.7, S 54.0, E 68.9, N 57.0. Требования: Java 21+, ~8 ГБ RAM, ~10 ГБ диска.
