import { RoadGraph, planRoute, distanceM } from '/home/user/MeshMaps/.cache/rt/graph.ts';
import { routeProgress } from '/home/user/MeshMaps/.cache/rt/progress.ts';
let fails = 0;
const ok = (c: boolean, msg: string) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
const L = (coords: any, o: any = {}) => ({ coords, cls: 'primary', sub: '', oneway: 0, access: {}, user: null, ...o });
// Grid of roads around (37.6, 55.4). 0.001 deg lng ~ 70 m, lat ~111 m.
const x0 = 37.6, y0 = 55.4;
const P = (i: number, j: number): [number, number] => [x0 + i * 0.001, y0 + j * 0.001];
// Main east-west primary road at j=0 from i=0..10
const main = L([P(0, 0), P(10, 0)]);
// Path (foot only) north from (5,0) to (5,5)
const trail = L([P(5, 0), P(5, 5)], { cls: 'path', sub: 'footway' });
// Two-way road south from (0,0) to (0,5) and back to main at (10,5)->(10,0)
const south = L([P(0, 0), P(0, -5), P(10, -5), P(10, 0)], { cls: 'secondary' });
// Oneway (forward = west->east) at j=-5 bypass is oneway already above; a one-way link (2,-5)->(8,-5) reversed direction test:
// Island: separate road with no connection
const island = L([P(20, 20), P(21, 20)]);

// 1) Car route A->B along main road
let r = planRoute([main, south], [x0 + 0.0005, y0 + 0.0002], [x0 + 0.0095, y0 - 0.0002], 'car');
ok(r.distance > 540 && r.distance < 700, `car straight distance ~ 0.009 deg lng: ${r.distance.toFixed(0)} m`);
ok(r.duration > 0, `duration ${r.duration.toFixed(0)} s`);

// 2) Foot can use trail; car cannot. Route from (5,1) to (5,4): foot uses trail, car must detour.
const rf = planRoute([main, south, trail], P(5, 1), P(5, 4), 'foot');
ok(rf.distance < 360, `foot shortcut via trail: ${rf.distance.toFixed(0)} m`);
let rcErr=''; try { planRoute([main, south, trail], P(5, 1), P(5, 4), 'car'); } catch (e) { rcErr = String(e); }
ok(rcErr.includes('не на дороге'), `car: destination 444 m from any car road is rejected: ${rcErr.slice(0,60)}`);

// 3) Unreachable: island
let err = '';
try { planRoute([main], P(0, 0), P(20, 20), 'foot'); } catch (e) { err = String(e); }
ok(err.includes('не на дороге') || err.includes('не найден'), `island: ${err.slice(0, 80)}`);

// 4) Oneway: road from A to B only forward
const ow = L([P(0, 10), P(10, 10)], { oneway: 1, cls: 'tertiary' });
const back = L([P(10, 10), P(0, 10)].map((p) => p), { oneway: 0, cls: 'path', sub: 'footway' });
let e2 = '';
let dOk = false;
try { planRoute([ow], P(0, 10), P(10, 10), 'car'); dOk = true; } catch (e) { e2 = String(e); }
ok(dOk, 'car forward on oneway works');
let rev = true;
try { planRoute([ow], P(10, 10), P(0, 10), 'car'); } catch (e) { rev = false; }
ok(!rev, 'car against oneway is rejected');
let footRev = true;
try { planRoute([ow], P(10, 10), P(0, 10), 'foot'); } catch (e) { footRev = false; }
ok(footRev, 'foot may walk against oneway');

// 5) Access tags: motor_vehicle=no blocks car
const noCar = L([P(0, 20), P(10, 20)], { access: { motor_vehicle: 'no' }, cls: 'primary' });
let carBlocked = false;
try { planRoute([noCar], P(0, 20), P(10, 20), 'car'); } catch { carBlocked = true; }
ok(carBlocked, 'motor_vehicle=no blocks car');

// 6) User lines respect passability: trail (foot only) blocks bike
const userTrail = { coords: [P(0, 30), P(10, 30)] as [number, number][], cls: '', sub: '', oneway: 0 as const, access: {}, user: { lineType: 'trail' as const, passability: 'foot' as const } };
let bikeBlocked = false;
try { planRoute([userTrail], P(0, 30), P(10, 30), 'bike'); } catch { bikeBlocked = true; }
ok(bikeBlocked, 'foot-only user trail blocks bike');
const rf2 = planRoute([userTrail], P(0, 30), P(10, 30), 'foot');
ok(rf2.distance > 600 && rf2.distance < 660, `foot on user trail ${rf2.distance.toFixed(0)} m`);

// 7) Motorway not for foot/bike
const mw = L([P(0, 40), P(10, 40)], { cls: 'motorway' });
let footMw = false;
try { planRoute([mw], P(0, 40), P(10, 40), 'foot'); } catch { footMw = true; }
ok(footMw, 'foot blocked on motorway');

// 8) Snap splits edge: start in middle of main road
const g = new RoadGraph(); g.addLine(main);
const s = g.snap([x0 + 0.0035, y0 + 0.00005], 'car');
ok(g.lng[s] > x0 + 0.003 && g.lng[s] < x0 + 0.004, 'snap projects to road midpoint');

// 9) Progress
const route = planRoute([main], P(0, 0), P(10, 0), 'car');
const rr = { coords: route.coords, distance: route.distance, duration: route.duration, profile: 'car' as const, from: P(0, 0), to: P(10, 0) };
const pr = routeProgress(rr, P(5, 0.0001));
ok(Math.abs(pr.remainingM - route.distance / 2) < 30, `progress remaining ${pr.remainingM.toFixed(0)} of ${route.distance.toFixed(0)}`);
ok(pr.offM < 15, `progress off ${pr.offM.toFixed(1)} m`);
const pr2 = routeProgress(rr, [P(5,0)[0], y0 + 0.001]);
ok(pr2.offM > 105 && pr2.offM < 120, `offroute ${pr2.offM.toFixed(0)} m`);
ok(routeProgress(rr, P(10, 0)).arrived, 'arrived at finish');

// 10) Bigger grid performance: 300x300 grid nodes
const lines: any[] = [];
for (let i = 0; i < 300; i++) { const v=[]; const h=[]; for (let k=0;k<=300;k++){ v.push(P(i,k)); h.push(P(k,i)); } lines.push(L(v,{cls:'minor'})); lines.push(L(h,{cls:'minor'})); }
const t0 = Date.now();
const big = planRoute(lines, P(0, 0), P(299, 299), 'bike');
ok(big.distance > 40000 && big.distance < 52000, `grid ${big.distance.toFixed(0)} m in ${Date.now() - t0} ms`);
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`);
