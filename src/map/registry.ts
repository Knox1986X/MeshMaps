import type { Map as MapLibreMap } from 'maplibre-gl'

/** Shared handles so panels can talk to the active map without prop drilling. */
export const mapRegistry: {
  main: MapLibreMap | null
  pip: MapLibreMap | null
} = { main: null, pip: null }

export function getMainMap(): MapLibreMap | null {
  return mapRegistry.main
}
