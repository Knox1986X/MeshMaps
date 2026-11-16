import maplibregl from 'maplibre-gl';
import type { Map as MlMap, StyleSpecification } from 'maplibre-gl';
import { registerIcons } from './icons';
import { addHighlightLayers } from './highlight';

export const MOSCOW: [number, number] = [37.6173, 55.7558];

/** Loads our neon style and points glyphs at the locally bundled PBF packs. */
export async function loadStyle(): Promise<StyleSpecification> {
  const styleUrl = new URL('style/style.json', document.baseURI).toString();
  const res = await fetch(styleUrl);
  if (!res.ok) throw new Error(`style.json HTTP ${res.status}`);
  const style = (await res.json()) as StyleSpecification;
  // NOTE: maplibre substitutes {fontstack}/{range} itself; do not run through URL (it would encode braces).
  style.glyphs = `${new URL('fonts/', document.baseURI).toString()}{fontstack}/{range}.pbf`;
  return style;
}

export async function createMap(container: HTMLElement): Promise<MlMap> {
  const style = await loadStyle();
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
  map.on('load', () => {
    registerIcons(map);
    addHighlightLayers(map);
  });
  map.on('error', (e) => console.error('[MeshMaps] map error', e.error));
  return map;
}
