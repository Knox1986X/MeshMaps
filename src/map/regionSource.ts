import type { Map as MlMap, StyleSpecification } from 'maplibre-gl';
import { PMTiles } from 'pmtiles';
import type { RegionRecord } from '../storage/db';
import { openRegionFile } from '../storage/opfs';
import { LocalFileSource } from '../storage/pmtilesLocal';
import { getBaseStyle, ONLINE_TILES_URL, pmtilesProtocol } from './createMap';

const ATTRIBUTION = '© OpenStreetMap contributors';

function applySource(style: StyleSpecification, url: string): void {
  style.sources.openmaptiles = { type: 'vector', url, attribution: ATTRIBUTION };
}

/** Switches the basemap to a locally stored region archive (works fully offline). */
export async function useRegion(map: MlMap, rec: RegionRecord): Promise<void> {
  const file = await openRegionFile(rec.fileName ?? '');
  const key = `region-${rec.id}`;
  // Re-register: an archive may have been re-imported under the same id.
  pmtilesProtocol.tiles.delete(key);
  pmtilesProtocol.add(new PMTiles(new LocalFileSource(file, key)));

  const style = await getBaseStyle();
  applySource(style, `pmtiles://${key}`);
  map.setStyle(style, { diff: false });
  const [w, s, e, n] = rec.bbox;
  map.fitBounds(
    [
      [w, s],
      [e, n],
    ],
    { padding: 40, duration: 800, maxZoom: 14 },
  );
}

/** Back to the online OpenFreeMap basemap. */
export async function useOnline(map: MlMap): Promise<void> {
  const style = await getBaseStyle();
  applySource(style, ONLINE_TILES_URL);
  map.setStyle(style, { diff: false });
}
