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
5. **Свои объекты** (готово): линии (тропа / грунтовка / дорога, пешком / вело / авто, привязка к дорогам), зоны-полигоны с площадью, POI с иконкой, цветом и фото, редактирование вершин, слои (создание, имя, цвет, видимость, порядок, удаление), запись GPS-трека, импорт и экспорт GeoJSON и GPX, бэкап в `.zip` (Dexie + свой ZIP без зависимостей). Экспорт на Android идёт через системное «Поделиться» (Capacitor Filesystem + Share).
6. **Маршрут** (готово): A* по времени в Web Worker (`src/workers/router.worker.ts`). Граф строится из слоя `transportation` выбранного офлайн-региона (zoom 14) или из онлайн-тайлов OpenFreeMap, если регион не выбран, плюс из собственных линий. Профили: пешком, вело, авто; учитываются oneway, access-теги, ступеньки и проходимость собственных троп. Старт и финиш привязываются к дороге не дальше 120 м. Панель «Маршрут»: откуда (GPS или точка из карточки «Маршрут отсюда»), куда («Маршрут сюда»), профиль, сводка, остаток пути. При отклонении более 50 м от маршрута в режиме следования или навигации маршрут пересчитывается. Пошаговых поворотных подсказок пока нет.
7. **Поиск и Dropbox** (готово):
   - Поиск над картой по названиям мест (`place`), POI (`poi`), улиц (`transportation_name`) из загруженных тайлов текущей карты (офлайн, если регион уже открыт и просмотрен) и по своим объектам. Ввод «55.44, 37.61» переходит к координатам. Результат: метка на карте, карточка с «Маршрут сюда» и «Маршрут отсюда». Ограничение: поиск видит только уже загруженные тайлы, полного адресного индекса региона пока нет.
   - Бэкап в Dropbox (необязательно), вкладка «Настройки». Авторизация OAuth 2.0 PKCE без секрета. Дополнительная настройка в Dropbox: см. ниже.

### Dropbox: настройка (один раз)
1. Откройте https://www.dropbox.com/developers/apps и создайте приложение: Scoped access, тип доступа App folder (бэкапы попадут в `Приложения/<имя приложения>`) или Full Dropbox (папка `/MeshMaps`).
2. В разделе Permissions включите `files.content.read` и `files.content.write`, нажмите Submit.
3. Скопируйте App Key (не App Secret, он не нужен).
4. В MeshMaps: «Настройки» → Dropbox → введите App Key → «Подключить Dropbox» → подтвердите доступ в открывшейся вкладке → скопируйте код и вставьте в приложение.
Редирект не используется, поэтому тот же поток работает в браузере, Tauri и Android. Ограничение: бэкап больше 150 МБ отклоняется (сессии загрузки не реализованы). Refresh-токен хранится в локальной базе устройства.
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
