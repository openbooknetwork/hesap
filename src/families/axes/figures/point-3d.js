// A point in space, three numbers from the origin: along x, along y, then up z.
import { space } from './space.js';

export default { controls: { x: 'slider', y: 'slider', z: 'slider' }, annotations: [], measures: {}, formulas: {}, draw: ctx => { space(ctx); } };
