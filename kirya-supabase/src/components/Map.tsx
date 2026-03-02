import { MapContainer, TileLayer, Marker, Circle, useMap, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

// Fix for default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom Icons
const createRiderIcon = (rotation: number) => {
  // Normalize rotation to 0-360
  const normRotation = (rotation + 360) % 360;
  
  // If moving Westward (180 to 360), flip the icon horizontally
  const isWest = normRotation > 180 && normRotation < 360;
  
  // The icon faces Right (90 deg) by default.
  // For Eastward (0-180): Rotation = normRotation - 90
  // For Westward (180-360): Rotation = normRotation - 270 (since it's flipped)
  const finalRotation = isWest ? normRotation - 270 : normRotation - 90;
  const flipScale = isWest ? -1 : 1;

  return new L.DivIcon({
    html: `<div style="transform: rotate(${finalRotation}deg) scaleX(${flipScale}); transition: transform 0.1s linear; display: flex; align-items: center; justify-content: center;">
            <img src="https://cdn-icons-png.flaticon.com/512/9561/9561688.png" class="w-12 h-12 drop-shadow-2xl" style="display: block; min-width: 48px;" />
          </div>`,
    className: 'bg-transparent border-none',
    iconSize: [48, 48],
    iconAnchor: [24, 42], // Anchor at the tires (bottom)
  });
};

const hubIcon = new L.DivIcon({
  html: `<div style="width: 30px; height: 30px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#EF4444"/>
          </svg>
        </div>`,
  className: 'bg-transparent border-none',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const shopIcon = new L.DivIcon({
  html: `<div>
          <img src="https://img.icons8.com/3d-fluency/100/shop.png" class="w-10 h-10 drop-shadow-lg" />
        </div>`,
  className: 'bg-transparent border-none',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const homeIcon = new L.DivIcon({
  html: `<div>
          <img src="https://img.icons8.com/3d-fluency/100/home.png" class="w-10 h-10 drop-shadow-lg" />
        </div>`,
  className: 'bg-transparent border-none',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

interface MapProps {
  center: [number, number];
  radius?: number;
  onLocationChange?: (latlng: L.LatLng) => void;
  markerPos?: [number, number];
  trackingData?: {
    riderPos: [number, number];
    riderRotation: number;
    shopPos: [number, number];
    hubPos: [number, number];
    deliveryPos: [number, number];
    hubToShopPath: [number, number][];
    shopToDeliveryPath: [number, number][];
    currentStage: 'to_shop' | 'to_delivery' | 'completed';
    progress: number;
  };
  allHubs?: [number, number][];
  allShops?: [number, number][];
  theme?: 'light' | 'dark' | 'minimal';
  weather?: 'clear' | 'rain' | 'cloudy';
}

function MapUpdater({ center, zoom = 14 }: { center: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function Map({ center, radius, onLocationChange, markerPos, trackingData, allHubs = [], allShops = [], theme = 'light', weather = 'clear' }: MapProps) {
  const isTracking = !!trackingData;

  const getTileUrl = () => {
    switch (theme) {
      case 'dark':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      case 'minimal':
        return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner relative">
      {/* Weather Overlay */}
      {weather === 'rain' && (
        <div className="absolute inset-0 z-[1000] pointer-events-none overflow-hidden">
          <div className="absolute inset-0 animate-rain opacity-30 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        </div>
      )}
      
      <MapContainer
        center={center}
        zoom={isTracking ? 16 : 14}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={getTileUrl()}
        />
        
        {/* Static Hubs and Shops - Always show them for better context */}
        {allHubs.map((pos, i) => (
          <Marker key={`hub-${i}`} position={pos} icon={hubIcon} />
        ))}
        {allShops.map((pos, i) => (
          <Marker key={`shop-${i}`} position={pos} icon={shopIcon} />
        ))}

        {!isTracking && (
          <>
            <Circle
              center={center}
              radius={radius || 5000}
              pathOptions={{ color: '#FF7A00', fillColor: '#FF7A00', fillOpacity: 0.1 }}
            />
            {markerPos && (
              <Marker
                position={markerPos}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    onLocationChange?.(marker.getLatLng());
                  },
                }}
              />
            )}
            <MapUpdater center={markerPos || center} />
          </>
        )}

        {isTracking && trackingData && (
          <>
            {/* Hub to Shop Path (Blue) */}
            <Polyline 
              positions={trackingData.hubToShopPath} 
              pathOptions={{ 
                color: '#3B82F6', 
                weight: trackingData.currentStage === 'to_shop' ? 8 : 4, 
                opacity: trackingData.currentStage === 'to_shop' ? 1 : 0.4, 
                lineCap: 'round',
                dashArray: trackingData.currentStage === 'to_shop' ? undefined : '10, 10'
              }} 
            />
            
            {/* Shop to Delivery Path (Orange) */}
            <Polyline 
              positions={trackingData.shopToDeliveryPath} 
              pathOptions={{ 
                color: '#FF7A00', 
                weight: trackingData.currentStage === 'to_delivery' ? 8 : 4, 
                opacity: trackingData.currentStage === 'to_delivery' ? 1 : 0.4, 
                lineCap: 'round',
                dashArray: trackingData.currentStage === 'to_delivery' ? undefined : '10, 10'
              }} 
            />
            
            {/* Markers */}
            <Marker position={trackingData.hubPos} icon={hubIcon}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                <span className="font-bold text-xs">Stage Hub</span>
              </Tooltip>
            </Marker>

            <Marker position={trackingData.shopPos} icon={shopIcon}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                <span className="font-bold text-xs">Shop</span>
              </Tooltip>
            </Marker>
            
            <Marker position={trackingData.deliveryPos} icon={homeIcon}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                <span className="font-bold text-xs">You</span>
              </Tooltip>
            </Marker>

            <Marker 
              position={trackingData.riderPos} 
              icon={createRiderIcon(trackingData.riderRotation)} 
              zIndexOffset={1000} 
            />
            
            <MapUpdater center={trackingData.riderPos} zoom={16} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
