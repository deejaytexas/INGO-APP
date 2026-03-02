// ─── Role ────────────────────────────────────────────────────────────────────
export type UserRole = 'user' | 'admin' | 'driver';

// ─── Location ────────────────────────────────────────────────────────────────
export interface DeliveryLocation {
  lat: number;
  lng: number;
  address: string;
}

// ─── Rider ───────────────────────────────────────────────────────────────────
export type RiderTaskStatus = 'idle' | 'to_shop' | 'at_shop' | 'to_delivery' | 'delivered';

export interface RiderLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'online' | 'offline' | 'busy';
  lastSeen: number;
  taskStatus?: RiderTaskStatus;
}

// ─── Nominatim ───────────────────────────────────────────────────────────────
export interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
}

// ─── Restaurant / Menu ───────────────────────────────────────────────────────
export interface MenuItem {
  id: number;
  name: string;
  price: string;
  description: string;
  image: string;
}

export interface Restaurant {
  name: string;
  rating: number;
  time: string;
  image: string;
  tags: string[];
  priceRange: string;
}

// ─── Cart ────────────────────────────────────────────────────────────────────
export interface CartItem extends MenuItem {
  qty: number;
}

// ─── Chat ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'rider' | 'user';
  text: string;
}

// ─── Task Status (localStorage sync) ────────────────────────────────────────
export interface TaskStatusPayload {
  riderId: string;
  status: RiderTaskStatus;
  timestamp: number;
}
