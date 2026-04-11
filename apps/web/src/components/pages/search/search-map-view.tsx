'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useCallback } from 'react';
import type * as LeafletModule from 'leaflet';
import { formatPrice, buildListingUrl } from '@twicely/utils/format';
import type { ListingCardData } from '@/types/listings';

interface SearchMapViewProps {
  listings: ListingCardData[];
  buyerLat?: number;
  buyerLng?: number;
}

function createPinIcon(L: typeof LeafletModule, color: string): LeafletModule.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createBuyerIcon(L: typeof LeafletModule): LeafletModule.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#7C3AED;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function buildPopupHtml(listing: ListingCardData): string {
  const price = formatPrice(listing.priceCents);
  const img = listing.primaryImageUrl
    ? `<img src="${listing.primaryImageUrl}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:6px 6px 0 0;" />`
    : `<div style="width:100%;height:120px;background:#f3f4f6;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">No image</div>`;
  const distance = listing.distanceMiles != null
    ? `<span style="color:#6b7280;font-size:11px;">${listing.distanceMiles < 1 ? '<1' : Math.round(listing.distanceMiles)} mi</span>`
    : '';
  const url = buildListingUrl(listing.slug);

  return `
    <a href="${url}" style="text-decoration:none;color:inherit;display:block;width:180px;">
      ${img}
      <div style="padding:8px;">
        <div style="font-weight:600;font-size:14px;">${price}</div>
        <div style="font-size:12px;color:#374151;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${listing.title}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span style="color:#6b7280;font-size:11px;">${listing.sellerName}</span>
          ${distance}
        </div>
      </div>
    </a>
  `;
}

export function SearchMapView({ listings, buyerLat, buyerLng }: SearchMapViewProps) {
  const mapRef = useRef<LeafletModule.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const initMap = useCallback(async () => {
    if (!containerRef.current || mapRef.current) return;

    const L = await import('leaflet');

    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    });

    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const markers: LeafletModule.Marker[] = [];

    // Buyer location marker
    if (buyerLat !== undefined && buyerLng !== undefined) {
      const buyerMarker = L.marker([buyerLat, buyerLng], {
        icon: createBuyerIcon(L),
        zIndexOffset: -100,
      }).addTo(map);
      buyerMarker.bindTooltip('You', { permanent: false, direction: 'top' });
      markers.push(buyerMarker);
    }

    // Listing pins
    const listingIcon = createPinIcon(L, '#2563EB');
    for (const listing of listings) {
      if (listing.sellerLat == null || listing.sellerLng == null) continue;
      const marker = L.marker([listing.sellerLat, listing.sellerLng], {
        icon: listingIcon,
      }).addTo(map);
      marker.bindPopup(buildPopupHtml(listing), {
        maxWidth: 200,
        minWidth: 180,
        className: 'tw-listing-popup',
      });
      markers.push(marker);
    }

    // Fit bounds to all markers
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 13 });
    } else if (buyerLat !== undefined && buyerLng !== undefined) {
      map.setView([buyerLat, buyerLng], 11);
    } else {
      map.setView([39.8283, -98.5795], 4); // US center
    }
  }, [listings, buyerLat, buyerLng]);

  useEffect(() => {
    void initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initMap]);

  const mappableCount = listings.filter((l) => l.sellerLat != null && l.sellerLng != null).length;

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[500px] rounded-lg border" />
      <div className="absolute bottom-3 left-3 z-[1000] rounded-full bg-white px-3 py-1 text-xs font-medium shadow-sm">
        {mappableCount} of {listings.length} listings on map
      </div>
    </div>
  );
}
