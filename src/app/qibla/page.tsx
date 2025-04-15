'use client';

import { useEffect, useState, useRef } from 'react';
import { Coordinates } from 'adhan';
import { FaCompass, FaLocationArrow, FaMountain, FaExclamationTriangle, FaRedo } from 'react-icons/fa';
import Image from 'next/image';

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
  const [direction, setDirection] = useState<string>('N');
  const [isAligned, setIsAligned] = useState<boolean>(false);
  
  const compassRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

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

  // Mettre à jour la rotation de la boussole et de la flèche quand les valeurs changent
  useEffect(() => {
    if (compassHeading !== null && compassRef.current) {
      // Rotate la boussole dans le sens opposé de la direction
      compassRef.current.style.transform = `rotate(${-compassHeading}deg)`;
    }
    
    if (qiblaAngle !== null && compassHeading !== null && arrowRef.current) {
      // Calculer l'angle relatif entre la direction de la boussole et la Qibla
      const relativeAngle = qiblaAngle - compassHeading;
      arrowRef.current.style.transform = `rotate(${relativeAngle}deg)`;
      
      // Mettre à jour la direction cardinale
      updateDirection(compassHeading);
      
      // Vérifier si l'utilisateur est aligné avec la Qibla (à 5 degrés près)
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
    // Vérifier si l'API DeviceOrientationEvent est disponible
    if (typeof window === 'undefined') return;
    
    if (!window.DeviceOrientationEvent) {
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
          window.addEventListener('deviceorientation', handleOrientation);
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
      if ('ondeviceorientationabsolute' in window) {
        (window as any).addEventListener('deviceorientationabsolute', handleAbsoluteOrientation as EventListener);
      } else {
        // Sinon utiliser deviceorientation standard
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
          // Effacer d'abord l'erreur
          setError(null);
          // iOS utilise deviceorientation
          window.addEventListener('deviceorientation', handleOrientation);
          
          // Attendre un peu pour que les événements commencent à arriver
          setTimeout(() => {
            // Si après 1,5 seconde nous n'avons toujours pas de données, afficher un message
            if (compassHeading === null) {
              setError("La boussole ne semble pas envoyer de données. Essayez de bouger votre appareil ou de le calibrer.");
            }
          }, 1500);
        } else {
          setError("L'autorisation pour la boussole a été refusée.");
        }
      } catch (err) {
        console.error("Erreur lors de la demande d'autorisation:", err);
        setError("Erreur lors de la demande d'autorisation pour la boussole.");
      }
    } else {
      // Pour les autres navigateurs, réessayer directement
      setupDeviceOrientation();
    }
  };

  // Réinitialiser la boussole
  const reinitCompass = () => {
    setupDeviceOrientation();
  };

  // Les gestionnaires d'événements pour l'orientation
  const handleAbsoluteOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha !== null) {
      setCompassHeading(event.alpha);
      // Effacer le message d'erreur si les données sont reçues
      if (error) setError(null);
    }
  };

  const handleOrientation = (event: ExtendedDeviceOrientationEvent) => {
    if (event.webkitCompassHeading) {
      // Safari iOS utilise webkitCompassHeading (0-360)
      setCompassHeading(event.webkitCompassHeading);
      // Effacer le message d'erreur si les données sont reçues
      if (error) setError(null);
    } else if (event.alpha !== null) {
      // Android et autres navigateurs utilisent alpha (0-360)
      // On convertit pour avoir la même référence que webkitCompassHeading
      setCompassHeading(360 - event.alpha);
      // Effacer le message d'erreur si les données sont reçues
      if (error) setError(null);
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
            <div className="relative w-80 h-80">
              {/* Cercle de la boussole */}
              <div 
                className={`absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700 transition-all duration-500 flex items-center justify-center ${
                  isAligned 
                    ? 'bg-gradient-to-br from-emerald-400 to-teal-500 dark:from-emerald-500 dark:to-teal-700 animate-pulse-slow shadow-lg' 
                    : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-inner'
                }`}
              >
                {/* Boussole rotative */}
                <div 
                  ref={compassRef} 
                  className="w-full h-full relative transition-transform duration-200 ease-linear"
                >
                  {/* Image de la boussole */}
                  <div className="absolute inset-0 flex justify-center items-center">
                    <div className="relative w-64 h-64">
                      <img 
                        src="/compass-rose.png" 
                        alt="Compass Rose"
                        className="w-full h-full object-contain drop-shadow-md"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Direction textuelle actuelle */}
                <div className="absolute top-4 flex justify-center w-full z-10">
                  <div className="rounded-lg px-4 py-1.5 text-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-md backdrop-blur-sm">
                    <p className="text-sm font-medium">{direction} <span className="text-xs ml-1 opacity-75">• {Math.round(compassHeading || 0)}°</span></p>
                  </div>
                </div>
                
                {/* Flèche d'indication de la Qibla fixe (masquée mais gardée pour la rotation) */}
                <div 
                  ref={arrowRef}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 transition-transform duration-200 ease-linear opacity-0"
                >
                  <div className="absolute inset-0 w-full h-full flex justify-center">
                    <div className="relative">
                      <img 
                        src="/kaaba-icon.png" 
                        alt="Kaaba Direction"
                        className="absolute w-12 h-12 -top-30 left-1/2 transform -translate-x-1/2"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Bouton de réinitialisation */}
                <button 
                  onClick={reinitCompass}
                  className="absolute right-2 bottom-2 w-10 h-10 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors z-10 shadow-md"
                >
                  <FaRedo size={16} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mt-8 gap-6">
            <div className="rounded-xl px-5 py-3 text-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 shadow-sm">
              <p className="text-xs opacity-75 mb-1">Direction de la Qibla</p>
              <p className="text-xl font-semibold">{Math.round(qiblaAngle)}°</p>
            </div>
            
            {distance !== null && (
              <div className="rounded-xl px-5 py-3 text-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 shadow-sm">
                <p className="text-xs opacity-75 mb-1">Distance</p>
                <p className="text-xl font-semibold">{distance} km</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 p-5 rounded-xl shadow-sm text-white">
        <div className="flex items-start">
          <div className="bg-white/20 p-3 rounded-lg mr-4 backdrop-blur-sm">
            <FaMountain className="text-xl" />
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