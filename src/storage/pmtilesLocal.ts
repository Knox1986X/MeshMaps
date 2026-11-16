import { PMTiles, FileSource, TileType, type Source, type RangeResponse } from 'pmtiles';
import type { Bbox } from '../core/geo';

/** Reads a PMTiles archive from a local File by byte ranges (no full load into memory). */
export class LocalFileSource implements Source {
  constructor(
    private readonly file: File,
    private readonly key: string,
  ) {}

  getKey(): string {
    return this.key;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const data = await this.file.slice(offset, offset + length).arrayBuffer();
    return { data };
  }
}

export interface ArchiveInfo {
  isMvt: boolean;
  bounds: Bbox;
  minZoom: number;
  maxZoom: number;
  layers: string[];
}

/** Reads the header and vector_layers of a .pmtiles file to validate it. */
export async function inspectArchive(file: File): Promise<ArchiveInfo> {
  const archive = new PMTiles(new FileSource(file));
  const h = await archive.getHeader();
  const meta = (await archive.getMetadata()) as { vector_layers?: { id: string }[] } | null;
  return {
    isMvt: h.tileType === TileType.Mvt,
    bounds: [h.minLon, h.minLat, h.maxLon, h.maxLat],
    minZoom: h.minZoom,
    maxZoom: h.maxZoom,
    layers: (meta?.vector_layers ?? []).map((l) => l.id),
  };
}

/** Our style is written for the OpenMapTiles schema; reject other schemas early. */
export const REQUIRED_OMT_LAYERS = ['transportation', 'building', 'water', 'landcover', 'poi'];

export function missingLayers(layers: string[]): string[] {
  return REQUIRED_OMT_LAYERS.filter((l) => !layers.includes(l));
}
