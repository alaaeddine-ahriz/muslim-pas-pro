'use client';

import { useEffect, useState } from 'react';
import { Coordinates } from 'adhan';
import { FaCompass, FaLocationArrow, FaMountain, FaExclamationTriangle } from 'react-icons/fa';

// Coordonnées de la Kaaba
const MECCA_COORDS = new Coordinates(21.4225, 39.8262);

// Extension de l'interface DeviceOrientationEvent pour Safari
interface ExtendedDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

export default function QiblaPage() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<string | null>(null);
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
        (err) => {
          console.error("Erreur de géolocalisation:", err);
          setError("Impossible d'accéder à votre localisation. Veuillez la saisir manuellement.");
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setError("La géolocalisation n'est pas supportée par votre navigateur.");
      setLoading(false);
    }

    setupDeviceOrientation();

    // Nettoyage des écouteurs d'événements
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation);
        if (typeof window.DeviceOrientationEvent !== 'undefined' && 'ondeviceorientationabsolute' in window) {
          window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation as EventListener);
        }
      }
    };
  }, []);

  const setupDeviceOrientation = async () => {
    // Vérifier si l'API DeviceOrientationEvent est disponible
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) {
      setError("Votre appareil ne supporte pas la boussole.");
      return;
    }

    // Pour iOS 13+ qui nécessite une demande d'autorisation explicite
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        setPermissionState('requesting');
        const response = await (DeviceOrientationEvent as any).requestPermission();
        setPermissionState(response);
        
        if (response === 'granted') {
          // iOS utilise deviceorientation
          (window as Window).addEventListener('deviceorientation', handleOrientation);
        } else {
          setError("L'autorisation pour la boussole a été refusée.");
        }
      } catch (err) {
        console.error("Erreur lors de la demande d'autorisation:", err);
        setError("Erreur lors de la demande d'autorisation pour la boussole.");
      }
    } else {
      // Pour les autres navigateurs
      // Essayer d'abord deviceorientationabsolute qui est plus précis
      if (typeof window !== 'undefined' && 'ondeviceorientationabsolute' in window) {
        (window as Window).addEventListener('deviceorientationabsolute', handleAbsoluteOrientation as EventListener);
      } else if (typeof window !== 'undefined') {
        // Sinon utiliser deviceorientation standard
        (window as Window).addEventListener('deviceorientation', handleOrientation);
      }
    }
  };

  const requestOrientationPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        setPermissionState(response);
        
        if (response === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        } else {
          setError("L'autorisation pour la boussole a été refusée.");
        }
      } catch (err) {
        console.error("Erreur lors de la demande d'autorisation:", err);
        setError("Erreur lors de la demande d'autorisation pour la boussole.");
      }
    }
  };

  // Les gestionnaires d'événements pour l'orientation
  const handleAbsoluteOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha !== null) {
      setCompassHeading(event.alpha);
    }
  };

  const handleOrientation = (event: ExtendedDeviceOrientationEvent) => {
    if (event.webkitCompassHeading) {
      // Safari iOS utilise webkitCompassHeading (0-360)
      setCompassHeading(event.webkitCompassHeading);
    } else if (event.alpha !== null) {
      // Android et autres navigateurs utilisent alpha (0-360)
      // On convertit pour avoir la même référence que webkitCompassHeading
      setCompassHeading(360 - event.alpha);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 dark:border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="text-center mb-5">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">Direction de la Qibla</h1>
        <p className="text-gray-600 dark:text-gray-400">Tournez-vous vers la Kaaba pour prier</p>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 shadow-sm">
          <div className="flex items-start">
            <FaExclamationTriangle className="text-red-500 mt-1 mr-2 flex-shrink-0" />
            <div>
              <p>{error}</p>
              {permissionState !== 'granted' && (
                <button 
                  onClick={requestOrientationPermission}
                  className="mt-2 bg-red-100 hover:bg-red-200 dark:bg-red-800/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Autoriser l'accès à la boussole
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {compassHeading === null && !error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 p-4 rounded-xl mb-6 shadow-sm">
          <div className="flex items-start">
            <FaExclamationTriangle className="text-yellow-500 mt-1 mr-2 flex-shrink-0" />
            <div>
              <p>La boussole n'est pas accessible. Sur certains appareils, vous devez activer la boussole dans les paramètres ou autoriser l'accès.</p>
              <button 
                onClick={requestOrientationPermission}
                className="mt-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800/30 dark:hover:bg-yellow-800/50 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Autoriser l'accès à la boussole
              </button>
            </div>
          </div>
        </div>
      )}

      {qiblaAngle !== null && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm dark:shadow-gray-950/50 mb-6">
          <div className="flex items-center justify-center">
            <div className="relative w-72 h-72">
              {/* Cercle de la boussole qui change de couleur quand aligné */}
              <div 
                className={`absolute inset-0 rounded-full border-4 ${Math.abs((qiblaAngle - (compassHeading || 0)) % 360) < 5 || Math.abs((qiblaAngle - (compassHeading || 0)) % 360) > 355 ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}
              >
                {/* Lignes de repère Nord-Sud Est-Ouest */}
                <div className="absolute h-full w-0.5 left-1/2 transform -translate-x-1/2 bg-gray-200 dark:bg-gray-700"></div>
                <div className="absolute w-full h-0.5 top-1/2 transform -translate-y-1/2 bg-gray-200 dark:bg-gray-700"></div>
                
                {/* Points cardinaux */}
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                  <div className="text-gray-600 dark:text-gray-400 font-semibold">N</div>
                </div>
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                  <div className="text-gray-600 dark:text-gray-400 font-semibold">S</div>
                </div>
                <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                  <div className="text-gray-600 dark:text-gray-400 font-semibold">O</div>
                </div>
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <div className="text-gray-600 dark:text-gray-400 font-semibold">E</div>
                </div>
                
                {/* Indicateur fixe de la Kaaba */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                  <div 
                    className={`w-6 h-6 -mt-3 ${Math.abs((qiblaAngle - (compassHeading || 0)) % 360) < 5 || Math.abs((qiblaAngle - (compassHeading || 0)) % 360) > 355 ? 'bg-green-500' : 'bg-black'}`}
                    style={{
                      transform: `rotate(${qiblaAngle - (compassHeading || 0)}deg)`,
                      clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mt-4">
            <div className={`rounded-lg px-4 py-2 text-center ${Math.abs((qiblaAngle - (compassHeading || 0)) % 360) < 5 || Math.abs((qiblaAngle - (compassHeading || 0)) % 360) > 355 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
              <p className="text-xs opacity-75 mb-1">Direction de la Qibla</p>
              <p className="text-lg font-semibold">{Math.abs((qiblaAngle - (compassHeading || 0)) % 360) < 5 || Math.abs((qiblaAngle - (compassHeading || 0)) % 360) > 355 ? 'Aligné' : `${Math.round(qiblaAngle)}°`}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-xl shadow-sm dark:shadow-gray-950/50">
        <div className="flex items-start">
          <div className="bg-emerald-100 dark:bg-emerald-800/40 p-3 rounded-lg mr-4">
            <FaMountain className="text-xl text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">La Kaaba (الكعبة)</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              La Kaaba est une construction cubique située dans la cour de la Grande Mosquée de La Mecque en Arabie saoudite. C'est le lieu le plus sacré de l'islam et c'est vers la Kaaba que tous les musulmans se tournent pour prier cinq fois par jour.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 