'use client';

import { useEffect, useState, useRef } from 'react';
import { Compass, MapPin, Loader2, RotateCw } from 'lucide-react';

// Coordinates of Kaaba
const MECCA_COORDS = {
  latitude: 21.4225,
  longitude: 39.8262
};

// Extended interface for Safari's DeviceOrientation
interface ExtendedDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

export default function QiblaPage() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [distance, setDistance] = useState<number | null>(null);
  const [direction, setDirection] = useState<string>('N');
  const [isAligned, setIsAligned] = useState<boolean>(false);
  
  const compassRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Request location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setLocation(coords);
          calculateQiblaAngle(coords);
          calculateDistance(coords);
          setLoading(false);
        },
        (err) => {
          console.error("Geolocation error:", err);
          setError("Impossible d'accéder à votre position. Veuillez l'activer dans les paramètres de votre appareil.");
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setError("La géolocalisation n'est pas supportée par votre navigateur.");
      setLoading(false);
    }

    setupDeviceOrientation();

    // Clean up event listeners
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation);
        if (typeof window.DeviceOrientationEvent !== 'undefined' && 'ondeviceorientationabsolute' in window) {
          window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation as EventListener);
        }
      }
    };
  }, []);

  // Update compass rotation and arrow when values change
  useEffect(() => {
    if (compassHeading !== null && compassRef.current) {
      // Rotate compass in opposite direction
      compassRef.current.style.transform = `rotate(${-compassHeading}deg)`;
    }
    
    if (qiblaAngle !== null && compassHeading !== null && arrowRef.current) {
      // Calculate relative angle between compass heading and Qibla
      const relativeAngle = qiblaAngle - compassHeading;
      arrowRef.current.style.transform = `rotate(${relativeAngle}deg)`;
      
      // Update cardinal direction
      updateDirection(compassHeading);
      
      // Check if user is aligned with Qibla (within 5 degrees)
      const alignmentDiff = Math.abs(relativeAngle % 360);
      const isNowAligned = alignmentDiff < 5 || alignmentDiff > 355;
      setIsAligned(isNowAligned);
    }
  }, [compassHeading, qiblaAngle]);

  const updateDirection = (heading: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const index = Math.round(heading / 45) % 8;
    setDirection(directions[index]);
  };

  const setupDeviceOrientation = async () => {
    // Check if DeviceOrientationEvent API is available
    if (typeof window === 'undefined') return;
    
    if (!window.DeviceOrientationEvent) {
      setError("Votre appareil ne supporte pas la boussole.");
      return;
    }

    // For iOS 13+ requiring explicit permission
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        setPermissionState('requesting');
        const response = await (DeviceOrientationEvent as any).requestPermission();
        setPermissionState(response);
        
        if (response === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        } else {
          setError("L'autorisation pour la boussole a été refusée.");
        }
      } catch (err) {
        console.error("Permission request error:", err);
        setError("Erreur lors de la demande d'autorisation pour la boussole.");
      }
    } else {
      // For other browsers
      if ('ondeviceorientationabsolute' in window) {
        (window as any).addEventListener('deviceorientationabsolute', handleAbsoluteOrientation as EventListener);
      } else {
        (window as any).addEventListener('deviceorientation', handleOrientation);
      }
    }
  };

  const requestOrientationPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        setPermissionState(response);
        
        if (response === 'granted') {
          setError(null);
          window.addEventListener('deviceorientation', handleOrientation);
          
          // Wait a bit for events to start arriving
          setTimeout(() => {
            if (compassHeading === null) {
              setError("La boussole ne semble pas envoyer de données. Essayez de bouger votre appareil ou de le calibrer.");
            }
          }, 1500);
        } else {
          setError("L'autorisation pour la boussole a été refusée.");
        }
      } catch (err) {
        console.error("Permission request error:", err);
        setError("Erreur lors de la demande d'autorisation pour la boussole.");
      }
    } else {
      setupDeviceOrientation();
    }
  };

  // Reset compass
  const reinitCompass = () => {
    setupDeviceOrientation();
  };

  // Event handlers for orientation
  const handleAbsoluteOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha !== null) {
      setCompassHeading(event.alpha);
      if (error) setError(null);
    }
  };

  const handleOrientation = (event: ExtendedDeviceOrientationEvent) => {
    if (event.webkitCompassHeading) {
      // Safari iOS uses webkitCompassHeading (0-360)
      setCompassHeading(event.webkitCompassHeading);
      if (error) setError(null);
    } else if (event.alpha !== null) {
      // Android and other browsers use alpha (0-360)
      // Convert to have same reference as webkitCompassHeading
      setCompassHeading(360 - event.alpha);
      if (error) setError(null);
    }
  };

  const calculateQiblaAngle = (coords: { latitude: number; longitude: number }) => {
    const lat1 = coords.latitude * (Math.PI / 180);
    const lon1 = coords.longitude * (Math.PI / 180);
    const lat2 = MECCA_COORDS.latitude * (Math.PI / 180);
    const lon2 = MECCA_COORDS.longitude * (Math.PI / 180);

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    angle = (angle + 360) % 360;
    setQiblaAngle(angle);
  };

  const calculateDistance = (coords: { latitude: number; longitude: number }) => {
    const lat1 = coords.latitude * (Math.PI / 180);
    const lon1 = coords.longitude * (Math.PI / 180);
    const lat2 = MECCA_COORDS.latitude * (Math.PI / 180);
    const lon2 = MECCA_COORDS.longitude * (Math.PI / 180);

    const R = 6371; // Earth's radius in km
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    setDistance(Math.round(distance));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-center mb-2">Direction de la Qibla</h1>
      <p className="text-center text-gray-600 mb-6">Tournez-vous vers la Kaaba pour prier</p>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 shadow-sm">
          <div className="flex items-start">
            <div className="text-red-500 mt-1 mr-2">⚠️</div>
            <div>
              <p>{error}</p>
              {permissionState !== 'granted' && (
                <button 
                  onClick={requestOrientationPermission}
                  className="mt-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Autoriser l'accès à la boussole
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {compassHeading === null && !error && (
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg mb-6 shadow-sm">
          <div className="flex items-start">
            <div className="text-yellow-500 mt-1 mr-2">⚠️</div>
            <div>
              <p>La boussole n'est pas accessible. Sur certains appareils, vous devez activer la boussole dans les paramètres ou autoriser l'accès.</p>
              <button 
                onClick={requestOrientationPermission}
                className="mt-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-4 py-2 rounded-lg text-sm font-medium"
              >
                Autoriser l'accès à la boussole
              </button>
            </div>
          </div>
        </div>
      )}

      {location && (
        <div className="text-center text-sm text-gray-600 mb-4">
          Position actuelle: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          <button 
            onClick={() => {
              setLoading(true);
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const coords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                  };
                  setLocation(coords);
                  calculateQiblaAngle(coords);
                  calculateDistance(coords);
                  setLoading(false);
                },
                () => {
                  setLoading(false);
                }
              );
            }}
            className="ml-2 text-green-600 hover:text-green-700 inline-flex items-center"
          >
            <MapPin className="w-3 h-3 mr-1" />
            <span>Actualiser</span>
          </button>
        </div>
      )}

      {qiblaAngle !== null && (
        <div className="bg-white rounded-lg p-5 shadow-sm mb-6">
          <div className="flex items-center justify-center">
            <div className="relative w-72 h-72">
              {/* Compass circle */}
              <div 
                className={`absolute inset-0 rounded-full border-4 border-gray-200 flex items-center justify-center ${
                  isAligned 
                    ? 'bg-gradient-to-br from-green-400 to-teal-500 animate-pulse' 
                    : 'bg-gradient-to-br from-gray-50 to-gray-100'
                }`}
              >
                {/* Rotating compass */}
                <div 
                  ref={compassRef} 
                  className="w-full h-full relative transition-transform duration-200 ease-linear"
                >
                  {/* Compass image */}
                  <div className="absolute inset-0 flex justify-center items-center">
                    <img 
                      src="/compass-rose.svg" 
                      alt="Compass Rose"
                      className="w-56 h-56 drop-shadow-md"
                    />
                  </div>
                </div>
                
                {/* Current direction text */}
                <div className="absolute top-4 flex justify-center w-full z-10">
                  <div className="rounded-lg px-4 py-1.5 text-center bg-white text-gray-700 shadow-md">
                    <p className="text-sm font-medium">{direction} <span className="text-xs ml-1 opacity-75">• {Math.round(compassHeading || 0)}°</span></p>
                  </div>
                </div>
                
                {/* Qibla direction arrow */}
                <div 
                  ref={arrowRef}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 transition-transform duration-200 ease-linear"
                >
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-[5.5rem]">
                    <img 
                      src="/kaaba-icon.svg" 
                      alt="Kaaba Direction"
                      className="h-12 w-12 drop-shadow-md"
                    />
                  </div>
                </div>
                
                {/* Reset button */}
                <button 
                  onClick={reinitCompass}
                  className="absolute right-2 bottom-2 w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 z-10 shadow-md"
                >
                  <RotateCw size={16} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mt-6 gap-6">
            <div className="rounded-lg px-5 py-3 text-center bg-green-50 text-green-700 shadow-sm">
              <p className="text-xs opacity-75 mb-1">Direction de la Qibla</p>
              <p className="text-xl font-semibold">{Math.round(qiblaAngle)}°</p>
            </div>
            
            {distance !== null && (
              <div className="rounded-lg px-5 py-3 text-center bg-green-50 text-green-700 shadow-sm">
                <p className="text-xs opacity-75 mb-1">Distance</p>
                <p className="text-xl font-semibold">{distance} km</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="bg-gradient-to-r from-green-500 to-teal-500 p-5 rounded-lg shadow-sm text-white">
        <div className="flex items-start">
          <div className="bg-white/20 p-3 rounded-lg mr-4">
            <Compass className="text-xl" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">La Kaaba (الكعبة)</h3>
            <p className="text-sm text-white/80">
              La Kaaba est une construction cubique située dans la cour de la Grande Mosquée de La Mecque en Arabie saoudite. C'est le lieu le plus sacré de l'islam et c'est vers la Kaaba que tous les musulmans se tournent pour prier cinq fois par jour.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 