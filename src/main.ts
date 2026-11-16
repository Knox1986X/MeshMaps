import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

// Register the pmtiles:// protocol once. Local .pmtiles files are served
// through the same protocol in Stage 3 (storage layer).
const pmtiles = new Protocol();
maplibregl.addProtocol('pmtiles', pmtiles.tile);

const app = document.getElementById('app')!;
const mapEl = document.createElement('div');
mapEl.id = 'map';
app.appendChild(mapEl);

const styleUrl = new URL('style/style.json', document.baseURI).toString();

const map = new maplibregl.Map({
  container: mapEl,
  style: styleUrl,
  center: [37.6173, 55.7558],
  zoom: 15,
  pitch: 55,
  bearing: 0,
  maxPitch: 70,
  attributionControl: { compact: true },
});

map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');
map.on('error', (e) => console.error('[MeshMaps] map error', e.error));
