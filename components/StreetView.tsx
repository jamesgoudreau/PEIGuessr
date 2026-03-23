'use client';

import { GoogleMap, StreetViewPanorama, useJsApiLoader } from '@react-google-maps/api';
import { useMemo, useState, useEffect } from 'react';

const containerStyle = {
  width: '100%',
  height: '100%',
};

interface StreetViewProps {
  position: { lat: number; lng: number };
  onLocationSnapped?: (snapped: { lat: number; lng: number } | null) => void;
}

export default function StreetView({ position, onLocationSnapped }: StreetViewProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [panorama, setPanorama] = useState<google.maps.StreetViewPanorama | null>(null);
  const [snappedPosition, setSnappedPosition] = useState<{ lat: number, lng: number } | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    if (isLoaded && position) {
      setIsValidating(true);
      const svf = new window.google.maps.StreetViewService();
      svf.getPanorama({ location: position, radius: 500 }, (data, status) => {
        if (status === window.google.maps.StreetViewStatus.OK && data?.location?.latLng) {
          const snapped = {
            lat: data.location.latLng.lat(),
            lng: data.location.latLng.lng()
          };
          setSnappedPosition(snapped);
          setIsValidating(false);
          if (onLocationSnapped) onLocationSnapped(snapped);
        } else {
          // Tell the parent to retry!
          if (onLocationSnapped) onLocationSnapped(null);
        }
      });
    }
  }, [isLoaded, position.lat, position.lng]);

  const streetViewOptions: google.maps.StreetViewPanoramaOptions = useMemo(
    () => ({
      position: snappedPosition || position,
      addressControl: false,
      showRoadLabels: false,
      linksControl: false,
      panControl: true,
      enableCloseButton: false,
      clickToGo: false, // "No-Move" Rule
      disableDefaultUI: true,
      zoomControl: true,
      visible: true,
    }),
    [snappedPosition?.lat, snappedPosition?.lng, position.lat, position.lng]
  );

  return (isLoaded && !isValidating) ? (
    <GoogleMap mapContainerStyle={containerStyle} center={snappedPosition || position} zoom={14}>
      <StreetViewPanorama
        options={streetViewOptions}
        onLoad={setPanorama}
      />
    </GoogleMap>
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-blue-50">
      <div className="text-3xl font-black text-blue-900 animate-pulse">Dropping you in PEI...</div>
    </div>
  );
}
