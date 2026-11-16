import { distanceM } from './graph';
import type { RouteProgress, RouteResult } from './types';

type LngLat = [number, number];

/** Metres from the route start to the nearest point of the route, plus remaining distance and time. */
export function routeProgress(route: RouteResult, pos: LngLat, arriveM = 25): RouteProgress {
  const coords = route.coords;
  const cosLat = Math.cos((pos[1] * Math.PI) / 180);
  const kx = 111320 * cosLat;
  const ky = 110574;
  // Length of every segment and the total, to compute what is left after the projection.
  const segLen: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const l = distanceM(coords[i - 1], coords[i]);
    segLen.push(l);
    total += l;
  }
  let bestOff = Infinity;
  let remaining = total;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const ax = (a[0] - pos[0]) * kx;
    const ay = (a[1] - pos[1]) * ky;
    const vx = (b[0] - a[0]) * kx;
    const vy = (b[1] - a[1]) * ky;
    const vv = vx * vx + vy * vy;
    const t = vv === 0 ? 0 : Math.max(0, Math.min(1, -(ax * vx + ay * vy) / vv));
    const off = Math.hypot(ax + vx * t, ay + vy * t);
    if (off < bestOff) {
      bestOff = off;
      // Distance left: the rest of this segment plus every segment after it.
      let after = 0;
      for (let j = i; j < segLen.length; j++) after += segLen[j];
      remaining = segLen[i - 1] * (1 - t) + after;
    }
  }
  const avgMps = route.distance > 0 && route.duration > 0 ? route.distance / route.duration : 4.5 / 3.6;
  const endDist = distanceM(pos, coords[coords.length - 1]);
  const arrived = endDist <= arriveM;
  return {
    offM: bestOff,
    remainingM: arrived ? 0 : remaining,
    remainingS: arrived ? 0 : remaining / avgMps,
    arrived,
  };
}
