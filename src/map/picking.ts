import type { Map as MlMap, MapMouseEvent, MapGeoJSONFeature } from 'maplibre-gl';
import type { Feature, Geometry, LineString, MultiLineString } from 'geojson';
import { ROAD_CLASS_RU, POI_CLASS_RU, asNumber, asString } from '../core/format';
import type { PickedFeature } from '../core/store';
import { LINE_TYPE_RU, type LineType } from '../core/types';
import { USER_PICK_LAYERS } from './userLayers';
import { formatMeters, lineLength, ringArea } from '../core/geo';

const POI_LAYERS = ['poi'];
const BUILDING_LAYERS = ['building-3d'];
const ROAD_LAYERS = ['road-main', 'road-secondary', 'road-minor', 'rail'];
const HOUSE_LAYERS = ['house-number'];
const STREET_LABEL_LAYERS = ['road-main-label', 'road-minor-label'];

function box(x: number, y: number, r: number): [[number, number], [number, number]] {
  return [
    [x - r, y - r],
    [x + r, y + r],
  ];
}

function nearestFromSet(
  map: MlMap,
  e: MapMouseEvent,
  radius: number,
  layers: string[],
): MapGeoJSONFeature[] {
  const { x, y } = e.point;
  return map.queryRenderedFeatures(box(x, y, radius), { layers });
}

/** Collect every rendered fragment of the same named road (tiles split lines) → one MultiLineString. */
function roadGeometry(map: MlMap, f: MapGeoJSONFeature): Feature<Geometry> {
  const name = asString(f.properties?.name);
  const cls = asString(f.properties?.class);
  const frags = name
    ? map
        .queryRenderedFeatures({ layers: ROAD_LAYERS })
        .filter((g) => asString(g.properties?.name) === name && asString(g.properties?.class) === cls)
    : [f];
  const lines: number[][][] = [];
  for (const g of frags) {
    const geom = g.geometry as LineString | MultiLineString;
    if (geom.type === 'LineString') lines.push(geom.coordinates);
    else if (geom.type === 'MultiLineString') lines.push(...geom.coordinates);
  }
  if (lines.length === 0) {
    return { type: 'Feature', properties: {}, geometry: f.geometry };
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: lines.length === 1 ? { type: 'LineString', coordinates: lines[0] } : { type: 'MultiLineString', coordinates: lines },
  };
}

/** Pick the most relevant object under the cursor: POI > building > road. */
export function pickAt(map: MlMap, e: MapMouseEvent): PickedFeature | null {
  const { lng, lat } = e.lngLat;
  const lngLat = { lng, lat };
  const { x, y } = e.point;
  const hit = (layers: string[]) => map.queryRenderedFeatures(box(x, y, 12), { layers });

  const own = hit(USER_PICK_LAYERS)[0];
  if (own) {
    const kind = own.properties?.kind as string;
    const fid = String(own.properties?.fid ?? '');
    const name = asString(own.properties?.name);
    const geom = own.geometry;
    let sub = kind === 'poi' ? 'POI' : kind === 'polygon' ? 'Зона' : 'Линия';
    if (kind === 'line') {
      const lt = (own.properties?.lineType as LineType) ?? 'trail';
      sub = `${LINE_TYPE_RU[lt] ?? 'Линия'} · ${formatMeters(lineLength((geom as GeoJSON.LineString).coordinates as [number, number][]))}`;
    } else if (kind === 'polygon') {
      sub = `Зона · ${Math.round(ringArea((geom as GeoJSON.Polygon).coordinates[0] as [number, number][]))} м²`;
    }
    return {
      kind: 'user',
      userFeatureId: fid,
      title: name ?? 'Без названия',
      subtitle: sub,
      address: null,
      heightM: null,
      lngLat,
      highlight: { type: 'Feature', properties: {}, geometry: geom },
    };
  }

  const poi = hit(POI_LAYERS)[0];
  if (poi) {
    const cls = asString(poi.properties?.class) ?? 'poi';
    const name = asString(poi.properties?.['name:ru']) ?? asString(poi.properties?.name) ?? POI_CLASS_RU[cls] ?? 'Объект';
    return {
      kind: 'poi',
      title: name,
      subtitle: POI_CLASS_RU[cls] ?? cls,
      address: null,
      heightM: null,
      lngLat,
      highlight: { type: 'Feature', properties: {}, geometry: poi.geometry },
    };
  }

  const building = hit(BUILDING_LAYERS)[0];
  if (building) {
    const height = asNumber(building.properties?.render_height);
    const house = nearestFromSet(map, e, 40, HOUSE_LAYERS)[0];
    const hn = asString(house?.properties?.housenumber);
    const street = nearestFromSet(map, e, 60, STREET_LABEL_LAYERS).map((f) => asString(f.properties?.name)).find(Boolean) ?? null;
    const name = asString(building.properties?.['name:ru']) ?? asString(building.properties?.name);
    return {
      kind: 'building',
      title: name ?? (hn ? `Здание ${hn}` : 'Здание'),
      subtitle: 'Здание',
      address: [street, hn].filter(Boolean).join(', ') || null,
      heightM: height,
      lngLat,
      highlight: { type: 'Feature', properties: { render_height: height ?? 6 }, geometry: building.geometry },
    };
  }

  const road = hit(ROAD_LAYERS)[0];
  if (road) {
    const cls = asString(road.properties?.class) ?? '';
    const name = asString(road.properties?.['name:ru']) ?? asString(road.properties?.name);
    const ref = asString(road.properties?.ref);
    return {
      kind: 'road',
      title: name ?? ref ?? 'Дорога без названия',
      subtitle: [ROAD_CLASS_RU[cls] ?? cls, ref && name ? `· ${ref}` : null].filter(Boolean).join(' '),
      address: null,
      heightM: null,
      lngLat,
      highlight: roadGeometry(map, road),
    };
  }

  return null;
}
