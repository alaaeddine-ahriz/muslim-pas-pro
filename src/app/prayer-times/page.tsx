'use client';

import { useState, useEffect } from 'react';
import { Compass, MapPin, Clock, Loader2 } from 'lucide-react';
import { Building as MosqueIcon } from 'lucide-react';
import { getNearestMosques, getMosquePrayerTimes, getUserLocation, savePreferredMosque, getPreferredMosque, Mosque, PrayerTimes } from '@/services/mawaqit-api';

export default function PrayerTimesPage() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [nearbyMosques, setNearbyMosques] = useState<Mosque[]>([]);
  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null);
  const [isLoadingMosques, setIsLoadingMosques] = useState(false);
  const [mosquesError, setMosquesError] = useState<string | null>(null);
  
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [isLoadingPrayers, setIsLoadingPrayers] = useState(false);
  const [prayersError, setPrayersError] = useState<string | null>(null);
  
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Check for saved mosque on initial load
  useEffect(() => {
    const savedMosque = getPreferredMosque();
    if (savedMosque) {
      setSelectedMosque(savedMosque);
      loadPrayerTimes(savedMosque);
    }
  }, []);

  // Get user location
  const detectLocation = () => {
    setIsLoadingLocation(true);
    setLocationError(null);
    
    getUserLocation()
      .then(({ latitude, longitude }) => {
        setLocation({ latitude, longitude });
        setIsLoadingLocation(false);
        
        // Load nearby mosques once we have location
        loadNearbyMosques(latitude, longitude);
      })
      .catch(error => {
        console.error('Geolocation error:', error);
        let errorMessage = "Impossible d'obtenir votre position";
        
        if (error.code) {
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = "Vous avez refusé l'accès à votre position";
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = "Information de position non disponible";
              break;
            case 3: // TIMEOUT
              errorMessage = "La demande de géolocalisation a expiré";
              break;
          }
        }
        
        setLocationError(errorMessage);
        setIsLoadingLocation(false);
      });
  };

  // Load nearby mosques based on location
  const loadNearbyMosques = async (latitude: number, longitude: number) => {
    setIsLoadingMosques(true);
    setMosquesError(null);
    
    try {
      const mosques = await getNearestMosques(latitude, longitude);
      setNearbyMosques(mosques);
      
      // Select first mosque automatically
      if (mosques.length > 0) {
        setSelectedMosque(mosques[0]);
        savePreferredMosque(mosques[0]);
        loadPrayerTimes(mosques[0]);
      } else {
        setMosquesError("Aucune mosquée trouvée à proximité");
      }
    } catch (error) {
      console.error('Error loading nearby mosques:', error);
      setMosquesError("Erreur lors du chargement des mosquées");
    } finally {
      setIsLoadingMosques(false);
    }
  };

  // Load prayer times for selected mosque
  const loadPrayerTimes = async (mosque: Mosque) => {
    setIsLoadingPrayers(true);
    setPrayersError(null);
    
    try {
      const times = await getMosquePrayerTimes(mosque.id);
      setPrayerTimes(times);
    } catch (error) {
      console.error('Error loading prayer times:', error);
      setPrayersError("Erreur lors du chargement des horaires de prière");
    } finally {
      setIsLoadingPrayers(false);
    }
  };

  // Handle mosque selection
  const handleMosqueSelect = (mosque: Mosque) => {
    setSelectedMosque(mosque);
    savePreferredMosque(mosque);
    loadPrayerTimes(mosque);
  };

  // Format time string (12:34) to more readable format
  const formatTime = (timeString: string | undefined): string => {
    if (!timeString) return '-';
    return timeString;
  };

  // Map prayer keys to French names
  const prayerNames: Record<string, string> = {
    fajr: 'Fajr',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
    jumua: 'Jumua'
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-center mb-6">Horaires de prière</h1>
      
      {/* Location detection */}
      <div className="mb-6">
        <div className="flex justify-center mb-4">
          <button
            onClick={detectLocation}
            disabled={isLoadingLocation}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg disabled:opacity-50"
          >
            {isLoadingLocation ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <MapPin className="w-5 h-5" />
            )}
            {location ? 'Actualiser ma position' : 'Détecter ma position'}
          </button>
        </div>
        
        {locationError && (
          <div className="text-red-500 text-center mb-4">{locationError}</div>
        )}
        
        {location && (
          <div className="text-center text-sm text-gray-600 mb-4">
            Position actuelle: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </div>
        )}
      </div>
      
      {/* Mosque selection */}
      {(location || selectedMosque) && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Mosquées à proximité</h2>
          
          {isLoadingMosques ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            </div>
          ) : mosquesError ? (
            <div className="text-red-500 text-center">{mosquesError}</div>
          ) : (
            <div className="space-y-2">
              {nearbyMosques.map((mosque) => (
                <button
                  key={mosque.id}
                  onClick={() => handleMosqueSelect(mosque)}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${
                    selectedMosque?.id === mosque.id
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <MosqueIcon className={`w-5 h-5 ${
                    selectedMosque?.id === mosque.id ? 'text-green-600' : 'text-gray-500'
                  }`} />
                  <div>
                    <div className="font-medium">{mosque.title}</div>
                    {mosque.distance !== undefined && (
                      <div className="text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Compass className="w-3 h-3" />
                          {mosque.distance < 1
                            ? `${(mosque.distance * 1000).toFixed(0)}m`
                            : `${mosque.distance.toFixed(1)}km`}
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {mosque.city}, {mosque.country}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Prayer times display */}
      {selectedMosque && (
        <div>
          <h2 className="text-xl font-semibold mb-3">
            Horaires pour{' '}
            <span className="text-green-600">{selectedMosque.title}</span>
          </h2>
          
          {isLoadingPrayers ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            </div>
          ) : prayersError ? (
            <div className="text-red-500 text-center">{prayersError}</div>
          ) : prayerTimes ? (
            <div>
              {/* Current prayer status */}
              <div className="bg-green-50 p-4 rounded-lg mb-4 text-center">
                <div className="text-sm text-gray-600 mb-1">
                  <Clock className="inline-block w-4 h-4 mr-1" />
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {prayerTimes.date && (
                  <div className="text-sm text-gray-600 mb-2">
                    {prayerTimes.date}
                  </div>
                )}
                {prayerTimes.current && (
                  <div className="mb-1">
                    <span className="font-medium">Prière actuelle:</span>{' '}
                    <span className="text-green-600 font-semibold capitalize">{prayerNames[prayerTimes.current]}</span>
                  </div>
                )}
                {prayerTimes.next && (
                  <div>
                    <span className="font-medium">Prochaine prière:</span>{' '}
                    <span className="text-green-600 font-semibold capitalize">{prayerNames[prayerTimes.next]}</span>{' '}
                    <span className="font-medium">à</span>{' '}
                    <span className="text-green-600 font-semibold">
                      {formatTime(prayerTimes.nextTime)}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Prayer times table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="grid grid-cols-2 text-center border-b">
                  <div className="py-3 font-semibold bg-gray-50">Prière</div>
                  <div className="py-3 font-semibold bg-gray-50">Heure</div>
                </div>
                
                {[
                  { name: 'Fajr', key: 'fajr' },
                  { name: 'Dhuhr', key: 'dhuhr' },
                  { name: 'Asr', key: 'asr' },
                  { name: 'Maghrib', key: 'maghrib' },
                  { name: 'Isha', key: 'isha' },
                  // Include Jumua if available
                  ...(prayerTimes.jumua ? [{ name: 'Jumua', key: 'jumua' }] : []),
                ].map((prayer, index) => {
                  const isCurrentPrayer = prayerTimes.current === prayer.key;
                  
                  return (
                    <div 
                      key={prayer.key}
                      className={`grid grid-cols-2 text-center border-b last:border-0 ${
                        isCurrentPrayer ? 'bg-green-50' : index % 2 === 1 ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className={`py-3 ${isCurrentPrayer ? 'font-semibold text-green-700' : ''}`}>
                        {prayer.name}
                      </div>
                      <div className={`py-3 ${isCurrentPrayer ? 'font-semibold text-green-700' : ''}`}>
                        {formatTime(prayerTimes[prayer.key as keyof PrayerTimes])}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600">
              Aucune donnée disponible
            </div>
          )}
        </div>
      )}
    </div>
  );
} 