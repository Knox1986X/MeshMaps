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
8. **Сборка и выпуск** (готово): GitHub Actions для debug-APK (`android-apk.yml`) и AppImage (`linux-appimage.yml`), иконки из `tools/icon/source.png` (Tauri и Android), разрешения геолокации в манифесте (`tools/android/prepare.mjs`), сохранение файлов через системный диалог в Tauri (плагины dialog и fs с capabilities), инструкции по APK, CachyOS и данным карты. Не проверено локально: сборка Rust и Gradle (в песочнице нет cargo и Java, а хосты Maven/crates.io не разрешены). Первый запуск workflow покажет ошибки сборки, если они есть.

## Разработка
```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build -> dist/
```

## Android APK

### Сборка в GitHub Actions (рекомендуется)
Workflow `.github/workflows/android-apk.yml` запускается при пуше в `main`, при теге `v*` и вручную
(Actions → Android APK → Run workflow). Он собирает **debug-APK** и кладёт его в артефакты запуска.
При теге `v*` APK дополнительно прикрепляется к GitHub Release.

Шаги workflow: `npm ci` → `npm run build` → `npx cap add android` (только если папки `android/` нет) →
`npx cap sync android` → `node tools/android/prepare.mjs` (разрешения геолокации, иконки, тёмный фон
иконки) → `./gradlew assembleDebug`.

Установка на телефон: скачайте `MeshMaps-debug.apk`, разрешите установку из неизвестных источников и
откройте файл. Debug-APK подписан отладочным ключом, для публикации в магазинах понадобится
release-сборка с собственным ключом (пока не настроена).

### Сборка локально
Нужны Node 22, JDK 21 и Android SDK (Android Studio или `sdkmanager`).
```bash
npm ci
npm run build
npx cap add android            # один раз, создаёт папку android/ (в Git она не хранится)
npx cap sync android
node tools/android/prepare.mjs
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
При каждом изменении веб-части достаточно `npm run build && npx cap sync android`.

## Linux (CachyOS / Arch): AppImage

### Готовый AppImage
Workflow `.github/workflows/linux-appimage.yml` собирает `MeshMaps_<версия>_amd64.AppImage` на Ubuntu 22.04
(для совместимости со старой glibc) и выкладывает его в артефакты и в Release при теге `v*`.
Запуск: `chmod +x MeshMaps_*.AppImage && ./MeshMaps_*.AppImage`.

### Сборка на CachyOS
```bash
sudo pacman -S --needed base-devel curl wget file openssl librsvg xdotool \
  libappindicator-gtk3 webkit2gtk-4.1 rustup nodejs npm
rustup default stable
npm ci
npm run tauri dev                              # разработка
npm run tauri build -- --bundles appimage      # AppImage
# результат: src-tauri/target/release/bundle/appimage/MeshMaps_*.AppImage
```
Если AppImage не запускается из-за FUSE: `sudo pacman -S fuse2` либо распакуйте его командой
`./MeshMaps_*.AppImage --appimage-extract` и запустите `squashfs-root/AppRun`.

Сохранение файлов (экспорт GeoJSON/GPX, бэкап .zip) в Linux-сборке использует системный диалог «Сохранить».

## Данные карты

Приложение читает `.pmtiles` со **схемой OpenMapTiles** (слои `transportation`, `place`, `poi`, `building`,
`water`, `landcover` и др.). Данные для регионов можно получить двумя способами.

### Вариант 1. Сборка региона своими силами (Курганская область)
Скрипт `tools/build-region.sh` скачивает OSM-экстракт Geofabrik и planetiler (схема OpenMapTiles):
```bash
tools/build-region.sh kurgan     # создаёт data/kurgan.pmtiles
```
Нужны Java 21+, около 8 ГБ RAM и 10 ГБ диска. Рамка региона: W 61.7, S 54.0, E 68.9, N 57.0.

### Вариант 2. Вырезка из полной планеты OpenFreeMap
OpenFreeMap публикует еженедельные полные планеты, в том числе в PMTiles, в схеме OpenMapTiles.
Файл весит около сотни гигабайт, поэтому регион вырезается без его скачивания целиком утилитой
[pmtiles CLI](https://docs.protomaps.com/pmtiles/cli):
```bash
pmtiles extract https://btrfs.openfreemap.com/areas/planet/<версия>/tiles.pmtiles data/kurgan.pmtiles \
  --bbox=61.7,54.0,68.9,57.0 --maxzoom=14
```
Актуальные версии смотрите в [репозитории OpenFreeMap](https://github.com/hyperknot/openfreemap).
Если вырезка не работает с удалённым файлом, используйте вариант 1.

**Важно:** ежедневные сборки Protomaps используют собственную схему, а не OpenMapTiles, поэтому
приложение с ними не отобразит слои. Не используйте их для регионов.

### Импорт в приложении
Вкладка «Регионы» → «Импорт .pmtiles» → выбрать файл → «Открыть офлайн».

### Онлайн-режим
Без выбранного региона карта берёт тайлы с `tiles.openfreemap.org` (нужен интернет). По правилам OpenFreeMap
массовая загрузка тайлов для офлайн-использования ограничена, поэтому для офлайн используйте регионы.
