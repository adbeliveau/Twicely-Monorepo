'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type * as LeafletModule from 'leaflet';

export interface MeetupMapProps {
  buyerLat: number;
  buyerLng: number;
  sellerLat: number;
  sellerLng: number;
  safeSpot?: {
    lat: number;
    lng: number;
    name: string;
    verified: boolean;
  } | null;
  distanceMiles: number;
}

function createColoredIcon(L: typeof LeafletModule, color: string): LeafletModule.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function getMidpoint(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): [number, number] {
  return [(lat1 + lat2) / 2, (lng1 + lng2) / 2];
}

export function MeetupMap({
  buyerLat,
  buyerLng,
  sellerLat,
  sellerLng,
  safeSpot,
  distanceMiles,
}: MeetupMapProps) {
  const mapRef = useRef<LeafletModule.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    void (async () => {
      const L = await import('leaflet');

      const map = L.map(containerRef.current!, {
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
      });

      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const buyerMarker = L.marker([buyerLat, buyerLng], {
        icon: createColoredIcon(L, '#7C3AED'),
      }).addTo(map);

      const sellerMarker = L.marker([sellerLat, sellerLng], {
        icon: createColoredIcon(L, '#2563EB'),
      }).addTo(map);

      L.polyline(
        [
          [buyerLat, buyerLng],
          [sellerLat, sellerLng],
        ],
        { color: '#6B7280', dashArray: '6 6', weight: 2 }
      ).addTo(map);

      const allMarkers: LeafletModule.Marker[] = [buyerMarker, sellerMarker];

      if (safeSpot) {
        const spotMarker = L.marker([safeSpot.lat, safeSpot.lng], {
          icon: createColoredIcon(L, '#059669'),
        }).addTo(map);
        allMarkers.push(spotMarker);
      }

      const group = L.featureGroup(allMarkers);
      map.fitBounds(group.getBounds(), { padding: [24, 24] });
    })();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const directionsLat = safeSpot ? safeSpot.lat : getMidpoint(buyerLat, buyerLng, sellerLat, sellerLng)[0];
  const directionsLng = safeSpot ? safeSpot.lng : getMidpoint(buyerLat, buyerLng, sellerLat, sellerLng)[1];
  const directionsUrl = `https://maps.google.com/?q=${directionsLat},${directionsLng}`;

  return (
    <div className="space-y-2">
      <div className="relative">
        <div ref={containerRef} className="h-48 rounded-lg" />
        <div className="absolute top-2 left-2 z-[1000] rounded-full bg-white px-3 py-1 text-xs font-medium shadow-sm">
          {distanceMiles.toFixed(1)} mi away
        </div>
        {safeSpot && (
          <div className="absolute top-2 right-2 z-[1000] rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 shadow-sm">
            Safe Spot Nearby
          </div>
        )}
      </div>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-md border border-input bg-background px-3 py-2 text-center text-sm font-medium hover:bg-accent"
      >
        Get Directions
      </a>
    </div>
  );
}
