'use client';

import { useEffect, useState } from 'react';
import { Coordinates } from 'adhan';
import { FaCompass, FaLocationArrow, FaMountain } from 'react-icons/fa';

// Coordonnées de la Kaaba
const MECCA_COORDS = new Coordinates(21.4225, 39.8262);

export default function QiblaPage() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    // Demander la localisation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = new Coordinates(position.coords.latitude, position.coords.longitude);
          setLocation(coords);
          calculateQiblaAngle(coords);
          calculateDistance(coords);
          setLoading(false);
        },
        () => {
          setError("Impossible d'accéder à votre localisation. Veuillez la saisir manuellement.");
          setLoading(false);
        }
      );
    } else {
      setError("La géolocalisation n'est pas supportée par votre navigateur.");
      setLoading(false);
    }

    // Demander l'accès à la boussole
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    } else {
      setError("La boussole n'est pas supportée par votre navigateur.");
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha !== null) {
      setCompassHeading(event.alpha);
    }
  };

  const calculateQiblaAngle = (coords: Coordinates) => {
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

  const calculateDistance = (coords: Coordinates) => {
    const lat1 = coords.latitude * (Math.PI / 180);
    const lon1 = coords.longitude * (Math.PI / 180);
    const lat2 = MECCA_COORDS.latitude * (Math.PI / 180);
    const lon2 = MECCA_COORDS.longitude * (Math.PI / 180);

    const R = 6371; // Rayon de la Terre en km
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Direction de la Qibla</h1>
        <p className="text-gray-600">Tournez-vous vers la Kaaba pour prier</p>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 shadow-sm">
          <p>{error}</p>
          <button className="mt-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Définir manuellement
          </button>
        </div>
      )}

      {qiblaAngle !== null && (
        <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
          <div className="flex items-center justify-center">
            <div className="relative w-72 h-72">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200 overflow-hidden">
                <div className="h-full w-full flex items-center justify-center">
                  <div 
                    className="relative w-full h-full"
                    style={{
                      transform: `rotate(${compassHeading || 0}deg)`,
                      transition: 'transform 0.3s ease-out'
                    }}
                  >
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                      <div className="text-emerald-600 font-semibold">N</div>
                    </div>
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                      <div className="text-emerald-600 font-semibold">S</div>
                    </div>
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <div className="text-emerald-600 font-semibold">O</div>
                    </div>
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <div className="text-emerald-600 font-semibold">E</div>
                    </div>
                    
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FaCompass className="text-4xl text-gray-600" />
                    </div>
                    
                    <div 
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10"
                      style={{
                        transform: `translate(-50%, -50%) rotate(${qiblaAngle - (compassHeading || 0)}deg)`,
                        transition: 'transform 0.3s ease-out'
                      }}
                    >
                      <div className="relative">
                        <div className="h-40 w-1 bg-emerald-500 absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full origin-bottom" />
                        <div className="p-1 rounded-full bg-emerald-600 text-white">
                          <FaLocationArrow className="text-xl" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mt-4">
            <div className="bg-gray-100 rounded-lg px-4 py-2 text-center mr-4">
              <p className="text-xs text-gray-500 mb-1">Direction</p>
              <p className="text-lg font-semibold text-gray-700">{Math.round(qiblaAngle)}°</p>
            </div>
            {distance && (
              <div className="bg-gray-100 rounded-lg px-4 py-2 text-center">
                <p className="text-xs text-gray-500 mb-1">Distance</p>
                <p className="text-lg font-semibold text-gray-700">{distance} km</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="bg-emerald-50 p-5 rounded-xl shadow-sm">
        <div className="flex items-start">
          <div className="bg-emerald-100 p-3 rounded-lg mr-4">
            <FaMountain className="text-xl text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">La Kaaba (الكعبة)</h3>
            <p className="text-gray-600 text-sm">
              La Kaaba est une construction cubique située dans la cour de la Grande Mosquée de La Mecque en Arabie saoudite. C'est le lieu le plus sacré de l'islam et c'est vers la Kaaba que tous les musulmans se tournent pour prier cinq fois par jour.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 