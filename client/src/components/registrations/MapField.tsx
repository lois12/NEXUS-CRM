import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2 } from 'lucide-react';

interface MapFieldProps {
  value: string;
  onChange?: (value: string) => void;
  label?: string;
}

const DEFAULT_LAT = 69.35;
const DEFAULT_LNG = 88.20;
const DEFAULT_ZOOM = 12;

// Free tile layers — no API keys needed
const TILES = {
  standard: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; OpenStreetMap',
    label: 'Стандарт',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr: '&copy; OpenTopoMap',
    label: 'Рельеф',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: '&copy; Esri',
    label: 'Спутник',
  },
};

export default function MapField({ value, onChange, label }: MapFieldProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const [tileLayer, setTileLayer] = useState<keyof typeof TILES>('satellite');
  const [expanded, setExpanded] = useState(false);
  const isInteractive = !!onChange;

  const parseValue = () => {
    try {
      if (value) {
        const parsed = JSON.parse(value);
        return { lat: parsed.lat || DEFAULT_LAT, lng: parsed.lng || DEFAULT_LNG, zoom: parsed.zoom || DEFAULT_ZOOM };
      }
    } catch {}
    return { lat: DEFAULT_LAT, lng: DEFAULT_LNG, zoom: DEFAULT_ZOOM };
  };

  const initMap = async () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = (await import('leaflet')).default;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const { lat, lng, zoom } = parseValue();
    const tile = TILES[tileLayer];

    const map = L.map(mapRef.current!, {
      center: [lat, lng],
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    const tl = L.tileLayer(tile.url, { attribution: tile.attr, maxZoom: 18 }).addTo(map);
    tileLayerRef.current = tl;

    const neonIcon = L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;border-radius:50%;background:var(--color-primary,#00ff88);border:3px solid rgba(0,0,0,0.3);box-shadow:0 0 12px var(--color-glow,rgba(0,255,136,0.5));transform:translate(-12px,-12px);"></div>`,
      iconSize: [0, 0],
    });

    const marker = L.marker([lat, lng], { icon: neonIcon, draggable: isInteractive }).addTo(map);
    markerRef.current = marker;

    if (isInteractive) {
      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng);
        onChange!(JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng, zoom: map.getZoom() }));
      });
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange!(JSON.stringify({ lat: pos.lat, lng: pos.lng, zoom: map.getZoom() }));
      });
      map.on('zoomend', () => {
        const pos = marker.getLatLng();
        onChange!(JSON.stringify({ lat: pos.lat, lng: pos.lng, zoom: map.getZoom() }));
      });
    }

    if (label) {
      const infoDiv = document.createElement('div');
      infoDiv.style.cssText = 'position:absolute;bottom:8px;left:8px;z-index:1000;font-family:JetBrains Mono,monospace;font-size:10px;color:#8888a0;background:rgba(10,10,15,0.8);padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(8px);pointer-events:none;';
      infoDiv.textContent = label;
      mapRef.current!.appendChild(infoDiv);
    }

    mapInstanceRef.current = map;
  };

  // Init on mount
  useEffect(() => {
    initMap();
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  // Update tile layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const L = (window as any).L;
    if (!L) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const tile = TILES[tileLayer];
    const tl = L.tileLayer(tile.url, { attribution: tile.attr, maxZoom: 18 }).addTo(map);
    tileLayerRef.current = tl;
  }, [tileLayer]);

  // Resize map when expanded/collapsed
  useEffect(() => {
    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 350);
  }, [expanded]);

  // Sync marker position when value changes externally (e.g. on load)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const { lat, lng, zoom } = parseValue();
    const currentPos = marker.getLatLng();
    // Only update if position actually changed
    if (Math.abs(currentPos.lat - lat) > 0.0001 || Math.abs(currentPos.lng - lng) > 0.0001) {
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], zoom);
    }
  }, [value]);

  const mapHeight = expanded ? 'calc(100vh - 8rem)' : 280;

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {(Object.keys(TILES) as Array<keyof typeof TILES>).map(key => (
            <button key={key} type="button" onClick={() => setTileLayer(key)}
              className="px-2 py-1 rounded text-[10px] font-mono transition-all"
              style={tileLayer === key
                ? { background: 'var(--color-primary)', color: '#000' }
                : { color: '#5a5a70', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {TILES[key].label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          title={expanded ? 'Свернуть' : 'Развернуть'}>
          {expanded ? <Minimize2 className="w-4 h-4 text-gray-400" /> : <Maximize2 className="w-4 h-4 text-gray-400" />}
        </button>
      </div>
      {/* Map container */}
      <div ref={mapRef} className="w-full rounded-xl overflow-hidden relative transition-all duration-300"
        style={{ height: mapHeight, border: '1px solid rgba(0,255,136,0.12)' }} />
      {isInteractive && !expanded && (
        <p className="font-mono text-[10px] text-gray-500">Кликните по карте чтобы установить метку • Нажмите ⤢ чтобы развернуть</p>
      )}
      {/* Coordinates */}
      {(() => {
        const { lat, lng } = parseValue();
        return (
          <div className="flex gap-3">
            <span className="font-mono text-[10px] text-gray-500">Широта: <span className="text-gray-300">{lat.toFixed(4)}</span></span>
            <span className="font-mono text-[10px] text-gray-500">Долгота: <span className="text-gray-300">{lng.toFixed(4)}</span></span>
          </div>
        );
      })()}
    </div>
  );
}
