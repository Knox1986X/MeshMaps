# tools

## build-glyphs.py — офлайн-шрифты для подписей
Генерирует SDF glyph PBF (формат MapLibre `glyphs.proto`) из Noto Sans (лицензия OFL)
в `public/fonts/<Name>/<range>.pbf`. Без нативных зависимостей.

```bash
python3 -m venv .venv-tools && . .venv-tools/bin/activate
pip install -r tools/requirements.txt
python tools/build-glyphs.py
```
Исходники TTF скачиваются автоматически из `openmaptiles/fonts` (GitHub) в `tools/fonts-src/`.
