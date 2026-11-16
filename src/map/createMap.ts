import maplibregl, { type Map as MlMap, type StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { registerIcons } from './icons';
import { addHighlightLayers, addOverlayLayers, setBboxDraft, setHighlight } from './highlight';
import { appState } from '../core/store';
import { draftRect } from '../core/geo';

export const MOSCOW: [number, number] = [37.6173, 55.7558];
/** Online fallback: OpenFreeMap serves OpenMapTiles-schema vector tiles. */
export const ONLINE_TILES_URL = 'https://tiles.openfreemap.org/planet';

/** One PMTiles protocol for the whole app; region archives are registered here by key. */
export const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

let baseStyle: StyleSpecification | null = null;

/** Loads our neon style and points glyphs at the locally bundled PBF packs. */
async function loadStyle(): Promise<StyleSpecification> {
  const styleUrl = new URL('style/style.json', document.baseURI).toString();
  const res = await fetch(styleUrl);
  if (!res.ok) throw new Error(`style.json HTTP ${res.status}`);
  const style = (await res.json()) as StyleSpecification;
  // maplibre substitutes {fontstack}/{range} itself; do not pass through URL (it would encode braces).
  style.glyphs = `${new URL('fonts/', document.baseURI).toString()}{fontstack}/{range}.pbf`;
  return style;
}

/** A fresh copy of the base style (we mutate the source per region). */
export async function getBaseStyle(): Promise<StyleSpecification> {
  if (!baseStyle) baseStyle = await loadStyle();
  return structuredClone(baseStyle);
}

export async function createMap(container: HTMLElement): Promise<MlMap> {
  const style = await getBaseStyle();
  const map = new maplibregl.Map({
    container,
    style,
    center: MOSCOW,
    zoom: 16,
    pitch: 55,
    bearing: 0,
    maxPitch: 70,
    attributionControl: { compact: true },
    maplibreLogo: false,
    dragRotate: true,
    pitchWithRotate: true,
    touchPitch: true,
  });

  // style.load fires on the first load and after every setStyle (region switch).
  map.on('style.load', () => {
    registerIcons(map);
    addHighlightLayers(map);
    addOverlayLayers(map);
    const s = appState.get();
    setHighlight(map, s.selected?.highlight ?? null);
    setBboxDraft(map, draftRect(s.bboxDraft));
  });
  map.on('error', (e) => console.error('[MeshMaps] map error', e.error));

  await new Promise<void>((resolve) => map.once('load', () => resolve()));
  return map;
}
