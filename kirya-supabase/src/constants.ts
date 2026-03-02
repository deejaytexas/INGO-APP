// ─── Shared geographic constants ───────────────────────────────────────────
// All coordinates for Mbale, Uganda. Import from here; never redefine inline.

export const MBALE_CENTER: [number, number] = [1.0821, 34.1750];
export const DELIVERY_RADIUS = 5000; // metres (5 km)

export const HUBS: [number, number][] = [
  [1.0821, 34.1750], // Main Hub
  [1.0750, 34.1800], // South Hub
  [1.0900, 34.1700], // North Hub
];

export const SHOPS: [number, number][] = [
  [1.0850, 34.1800], // Shop A
  [1.0800, 34.1850], // Shop B
  [1.0780, 34.1720], // Shop C
];
