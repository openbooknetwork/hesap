// The scenes a page of the geo family can name. Node reads them to check a page, the browser to draw it.
import circle from './circle.js';
import quadrilateral from './quadrilateral.js';
import rectangle from './rectangle.js';
import regularPolygon from './regular-polygon.js';
import triangle from './triangle.js';

export default { circle, triangle, rectangle, quadrilateral, 'regular-polygon': regularPolygon };
