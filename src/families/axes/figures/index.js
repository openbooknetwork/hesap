// The scenes a page of the axes family can name. Node reads them to check a page, the browser to draw it.
import distance from './distance.js';
import distance3d from './distance-3d.js';
import numberLine from './number-line.js';
import point from './point.js';
import point3d from './point-3d.js';
import polarPoint from './polar-point.js';
import { cylinder, sphere } from './polar-space.js';
import { rose, spiral } from './polar-curve.js';
import quadrants from './quadrants.js';
import radians from './radians.js';
import * as solids from './solids.js';
import toPolar from './to-polar.js';

export default { 'number-line': numberLine, point, quadrants, distance, 'point-3d': point3d, 'distance-3d': distance3d,
  'polar-point': polarPoint, 'to-polar': toPolar, radians, spiral, rose, cylinder, sphere,
  cube: solids.cube, cuboid: solids.cuboid, prism: solids.prism, pyramid: solids.pyramid, 'solid-cylinder': solids.cylinder, cone: solids.cone, ball: solids.sphere, net: solids.net };
