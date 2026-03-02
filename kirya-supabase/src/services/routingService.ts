export interface RouteData {
  coordinates: [number, number][];
  distance: number; // meters
  duration: number; // seconds
}

export async function getRoute(start: [number, number], end: [number, number]): Promise<RouteData> {
  // OSRM Public API (Demo server - use with caution in production, but fine for this applet)
  const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== 'Ok') {
      throw new Error('Could not fetch route');
    }

    const route = data.routes[0];
    return {
      coordinates: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]),
      distance: route.distance,
      duration: route.duration,
    };
  } catch (error) {
    console.error('Routing error:', error);
    // Fallback to straight line if API fails
    return {
      coordinates: [start, end],
      distance: 1000,
      duration: 300,
    };
  }
}
