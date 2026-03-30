'use client';

import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { useState, useCallback, useRef, useEffect } from 'react';

const containerStyle = {
  width: '100%',
  height: '100%',
};

// Center of Prince Edward Island adjusted for better framing
const center = {
  lat: 46.35,
  lng: -63.2,
};

interface GuessMapProps {
  onGuess: (guess: { lat: number; lng: number }) => void;
  guessLocation?: { lat: number; lng: number } | null;
  actualLocation?: { lat: number; lng: number } | null;
  gamePhase: 'guessing' | 'result';
}

export default function GuessMap({ onGuess, guessLocation, actualLocation, gamePhase }: GuessMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (gamePhase === 'result' && guessLocation && actualLocation && mapRef.current && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(guessLocation);
      bounds.extend(actualLocation);
      mapRef.current.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
      
      const listener = window.google.maps.event.addListener(mapRef.current, "idle", () => {
        if (mapRef.current && mapRef.current.getZoom() && mapRef.current.getZoom()! > 14) {
          mapRef.current.setZoom(14);
        }
        window.google.maps.event.removeListener(listener);
      });
    }
  }, [gamePhase, guessLocation, actualLocation]);
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);

  const onClickMap = useCallback((e: google.maps.MapMouseEvent) => {
    if (gamePhase === 'result' || !e.latLng) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPosition({ lat, lng });
  }, [gamePhase]);

  const handleConfirmGuess = () => {
    if (markerPosition) {
      onGuess(markerPosition);
    }
  };

  return isLoaded ? (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border-4 border-white">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={9}
        onLoad={(map) => { mapRef.current = map; }}
        onClick={onClickMap}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          styles: [
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#00a1e4" }]
            },
            {
              featureType: "landscape",
              elementType: "geometry",
              stylers: [{ color: "#fef3c7" }]
            }
          ]
        }}
      >
        {markerPosition && <Marker position={markerPosition} />}
        {gamePhase === 'result' && actualLocation && (
          <Marker 
            position={actualLocation} 
            icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png" 
          />
        )}
        {gamePhase === 'result' && actualLocation && guessLocation && (
          <Polyline 
            path={[guessLocation, actualLocation]} 
            options={{ 
              strokeColor: '#000000', 
              strokeOpacity: 0.8, 
              strokeWeight: 3, 
              geodesic: true 
            }} 
          />
        )}
      </GoogleMap>
      
      {gamePhase === 'guessing' && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none w-[90%] md:w-auto text-center">
          <div className="inline-block bg-blue-900/95 text-white px-6 py-3 rounded-full shadow-xl font-bold border-2 border-blue-400 text-sm md:text-base animate-pulse">
            Zoom in and tap the map to place your guess!
          </div>
        </div>
      )}
      
      {gamePhase === 'guessing' && markerPosition && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <button 
            onClick={handleConfirmGuess}
            className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-black text-xl rounded-full shadow-2xl transition-transform hover:scale-105"
          >
            Makin' My Guess!
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-amber-50">
      <div className="animate-pulse text-amber-800 font-bold">Unfurling the Map...</div>
    </div>
  );
}
