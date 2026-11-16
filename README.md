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
3. Офлайн-регионы: импорт `.pmtiles`, выбор рамкой, менеджер регионов (Dexie + Filesystem / Tauri fs).
4. Геолокация: синяя точка с конусом, режимы «следовать» / «навигация», компас (DeviceOrientation).
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

## Данные карты
Регионы PMTiles: https://maps.protomaps.com/builds/ (бесплатно, схема Protomaps/OpenMapTiles).
Собрать свой регион из Geofabrik: `planetiler` (`java -jar planetiler.jar --osm-path=region.osm.pbf --download`) или `tilemaker`.
