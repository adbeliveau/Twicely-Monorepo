'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useCallback } from 'react';
import type * as LeafletModule from 'leaflet';

interface ListingAreaMapProps {
  /** Seller city-level latitude (approximate). */
  lat: number;
  /** Seller city-level longitude (approximate). */
  lng: number;
  /** Label shown on the marker tooltip (e.g. seller city). */
  label?: string;
}

/**
 * Shows an approximate seller location on a Leaflet map with a shaded circle
 * to indicate city-level precision (not exact address).
 * Uses free OpenStreetMap tiles — no API key required.
 */
export function ListingAreaMap({ lat, lng, label }: ListingAreaMapProps) {
  const mapRef = useRef<LeafletModule.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const initMap = useCallback(async () => {
    if (!containerRef.current || mapRef.current) return;

    const L = await import('leaflet');

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
      dragging: true,
      doubleClickZoom: false,
    });

    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Approximate area circle (~2 mi radius = ~3219 m)
    L.circle([lat, lng], {
      radius: 3219,
      color: '#2563EB',
      fillColor: '#2563EB',
      fillOpacity: 0.1,
      weight: 2,
    }).addTo(map);

    // Center pin
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([lat, lng], { icon }).addTo(map);
    if (label) {
      marker.bindTooltip(label, { permanent: false, direction: 'top' });
    }

    map.setView([lat, lng], 12);
  }, [lat, lng, label]);

  useEffect(() => {
    void initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initMap]);

  return (
    <div className="relative overflow-hidden rounded-lg border">
      <div ref={containerRef} className="h-[250px]" />
      <div className="absolute bottom-2 left-2 z-[1000] rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
        Approximate area
      </div>
    </div>
  );
}
