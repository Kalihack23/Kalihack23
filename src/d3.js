// Seuls les modules D3 réellement utilisés (au lieu du paquet "d3" complet) → bundle plus léger.
export { select, pointer } from 'd3-selection';
export { drag } from 'd3-drag';
export { forceSimulation, forceCollide } from 'd3-force';
export { hierarchy, pack } from 'd3-hierarchy';
export { scaleLinear, scaleSqrt } from 'd3-scale';
export { line, area, curveMonotoneX } from 'd3-shape';
export { interpolateRgb } from 'd3-interpolate';
export { max, min, sum, mean } from 'd3-array';
