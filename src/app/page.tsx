'use client';

import { useEffect, useState } from 'react';
import { Coordinates, PrayerTimes, CalculationMethod } from 'adhan';
import { FaMapMarkerAlt, FaCalendarAlt, FaMosque, FaClock, FaQuran, FaSun, FaMoon, FaCompass } from 'react-icons/fa';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { fetchNearbyMosques, Mosque } from '@/services/mawaqitApi';
import { MapPin, Calendar, Clock, Book, Compass, Sun, Moon, X } from 'lucide-react';

export default function Home() {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [cityName, setCityName] = useState<string>('');
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: Date } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hijriDate, setHijriDate] = useState<string>('');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [nearbyMosques, setNearbyMosques] = useState<Mosque[]>([]);
  const [isLoadingMosques, setIsLoadingMosques] = useState<boolean>(false);
  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    // Obtenir la date du calendrier hégirien
    fetchHijriDate();
    
    // Demander la localisation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = new Coordinates(position.coords.latitude, position.coords.longitude);
          setLocation(coords);
          calculatePrayerTimes(coords);
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=10`
            );
            const data = await response.json();
            setCityName(data.address.city || data.address.town || data.address.village || 'Votre position');
            
            // Load nearby mosques in background
            loadNearbyMosques(position.coords.latitude, position.coords.longitude);
          } catch (err) {
            setCityName('Votre position');
          }
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
  }, []);

  useEffect(() => {
    if (prayerTimes) {
      calculateNextPrayer();
      const interval = setInterval(() => {
        calculateNextPrayer();
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [prayerTimes]);

  const calculatePrayerTimes = (coords: Coordinates) => {
    const date = new Date();
    const params = CalculationMethod.MuslimWorldLeague();
    const times = new PrayerTimes(coords, date, params);
    setPrayerTimes(times);
  };

  const calculateNextPrayer = () => {
    if (!prayerTimes) return;
    
    const now = new Date();
    const prayers = [
      { name: 'Fajr', time: prayerTimes.fajr },
      { name: 'Dhuhr', time: prayerTimes.dhuhr },
      { name: 'Asr', time: prayerTimes.asr },
      { name: 'Maghrib', time: prayerTimes.maghrib },
      { name: 'Isha', time: prayerTimes.isha },
    ];
    
    let nextPrayer = null;
    
    for (const prayer of prayers) {
      if (prayer.time > now) {
        nextPrayer = prayer;
        break;
      }
    }
    
    if (!nextPrayer) {
      // Si toutes les prières d'aujourd'hui sont passées, calculer le Fajr de demain
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const params = CalculationMethod.MuslimWorldLeague();
      const tomorrowTimes = new PrayerTimes(location!, tomorrow, params);
      nextPrayer = { name: 'Fajr (demain)', time: tomorrowTimes.fajr };
    }
    
    setNextPrayer(nextPrayer);
    
    // Calculer le temps restant
    const diff = nextPrayer.time.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    setTimeRemaining(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  };

  const isPrayerActive = (prayerTime: Date): boolean => {
    if (!prayerTimes) return false;
    const now = new Date();
    return prayerTime <= now && now < getNextPrayerAfter(prayerTime);
  };

  const getNextPrayerAfter = (prayerTime: Date): Date => {
    if (!prayerTimes) return new Date();
    
    const prayers = [
      prayerTimes.fajr,
      prayerTimes.dhuhr,
      prayerTimes.asr,
      prayerTimes.maghrib,
      prayerTimes.isha,
    ].sort((a, b) => a.getTime() - b.getTime());
    
    const index = prayers.findIndex(time => time === prayerTime);
    
    if (index === prayers.length - 1) {
      // Si c'est la dernière prière, retourner le Fajr du lendemain
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const params = CalculationMethod.MuslimWorldLeague();
      const tomorrowTimes = new PrayerTimes(location!, tomorrow, params);
      return tomorrowTimes.fajr;
    }
    
    return prayers[index + 1];
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Fonction pour obtenir la date hégirienne
  const fetchHijriDate = async () => {
    try {
      const today = new Date();
      const response = await fetch(`https://api.aladhan.com/v1/gToH/${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}`);
      const data = await response.json();
      
      if (data.code === 200 && data.data) {
        const hijri = data.data.hijri;
        // Créer un mapping des mois hijri en français
        const hijriMonths: Record<string, string> = {
          'Muharram': 'Mouharram',
          'Safar': 'Safar',
          'Rabi al-awwal': 'Rabi al-Awwal',
          'Rabi al-thani': 'Rabi al-Thani',
          'Jumada al-awwal': 'Joumada al-Oula',
          'Jumada al-thani': 'Joumada al-Thania',
          'Rajab': 'Rajab',
          'Shaban': 'Chaabane',
          'Ramadan': 'Ramadan',
          'Shawwal': 'Chawwal',
          'Dhu al-Qadah': 'Dhou al-Qida',
          'Dhu al-Hijjah': 'Dhou al-Hijja'
        };
        
        // Utiliser le mapping pour obtenir le nom du mois en français
        const monthName = hijriMonths[hijri.month.en] || hijri.month.en;
        const formattedHijriDate = `${hijri.day} ${monthName} ${hijri.year}`;
        setHijriDate(formattedHijriDate);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération de la date hégirienne:", error);
    }
  };

  // Load nearby mosques
  const loadNearbyMosques = async (latitude: number, longitude: number) => {
    setIsLoadingMosques(true);
    try {
      const mosques = await fetchNearbyMosques(latitude, longitude);
      setNearbyMosques(mosques);
    } catch (error) {
      console.error('Error loading nearby mosques:', error);
    } finally {
      setIsLoadingMosques(false);
    }
  };
  
  // Change location manually
  const openLocationModal = () => {
    setIsLocationModalOpen(true);
    if (location && !nearbyMosques.length) {
      loadNearbyMosques(location.latitude, location.longitude);
    }
  };
  
  // Close location modal
  const closeLocationModal = () => {
    setIsLocationModalOpen(false);
  };
  
  // Handle mosque selection
  const handleMosqueSelect = (mosque: Mosque) => {
    setSelectedMosque(mosque);
    
    // Use Adhan library to calculate prayer times with the mosque location
    const coords = new Coordinates(mosque.latitude, mosque.longitude);
    setLocation(coords);
    calculatePrayerTimes(coords);
    setCityName(mosque.name);
    
    // Close the modal
    closeLocationModal();
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
      {/* En-tête avec la date actuelle, la date hégirienne et l'emplacement */}
      <div className="bg-gray-800 rounded-xl p-4 shadow-md mb-6 text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="mb-2 sm:mb-0">
            <div className="flex items-center mb-1">
              <Calendar className="mr-2 text-green-400" size={20} />
              <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
            {hijriDate && (
              <div className="flex items-center text-gray-300 text-sm">
                <span className="ml-6">{hijriDate} AH</span>
              </div>
            )}
          </div>
          <button 
            onClick={openLocationModal}
            className="flex items-center hover:text-green-400 transition-colors"
          >
            <MapPin className="mr-2 text-green-400" size={20} />
            <span>{cityName || "Définir ma position"}</span>
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 shadow-sm">
          <p>{error}</p>
          <button 
            onClick={openLocationModal}
            className="mt-2 bg-red-100 hover:bg-red-200 dark:bg-red-800/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Définir manuellement
          </button>
        </div>
      )}

      {/* Location selection modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Choisir une localisation</h2>
              <button 
                onClick={closeLocationModal}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <button
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        const coords = new Coordinates(position.coords.latitude, position.coords.longitude);
                        setLocation(coords);
                        calculatePrayerTimes(coords);
                        loadNearbyMosques(position.coords.latitude, position.coords.longitude);
                        fetch(
                          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=10`
                        )
                          .then(response => response.json())
                          .then(data => {
                            setCityName(data.address.city || data.address.town || data.address.village || 'Votre position');
                          })
                          .catch(() => setCityName('Votre position'))
                          .finally(() => closeLocationModal());
                      },
                      (error) => {
                        console.error('Error getting location:', error);
                        setError("Impossible d'accéder à votre localisation. Veuillez sélectionner une mosquée dans la liste.");
                      }
                    );
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg"
              >
                <MapPin size={20} />
                Utiliser ma position actuelle
              </button>
            </div>
            
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Mosquées à proximité</h3>
              
              {isLoadingMosques ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                </div>
              ) : nearbyMosques.length > 0 ? (
                <div className="overflow-y-auto max-h-[40vh] space-y-2">
                  {nearbyMosques.map(mosque => (
                    <button
                      key={mosque.id}
                      onClick={() => handleMosqueSelect(mosque)}
                      className="w-full text-left p-3 rounded-lg flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200">{mosque.name}</div>
                        {mosque.distance !== undefined && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {mosque.distance < 1
                              ? `${(mosque.distance * 1000).toFixed(0)}m`
                              : `${mosque.distance.toFixed(1)}km`}
                            {mosque.address && ` • ${mosque.address}`}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Aucune mosquée trouvée à proximité
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {nextPrayer && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-white">Prochaine prière</h2>
            <div className="flex items-center text-sm text-white/90">
              <FaClock className="mr-1" />
              <span>{timeRemaining}</span>
            </div>
          </div>
          <div className="bg-white/20 dark:bg-black/20 backdrop-blur-sm rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="text-2xl font-bold text-white">{nextPrayer.name}</p>
              <p className="text-white/80">{formatTime(nextPrayer.time)}</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <FaMosque className="text-xl text-white" />
            </div>
          </div>
        </div>
      )}

      {prayerTimes && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-950/50 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <h2 className="font-medium text-gray-700 dark:text-gray-200">Horaires des prières</h2>
            <div className="text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full">
              {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          
          <div className="grid grid-cols-1 divide-y divide-gray-100 dark:divide-gray-700">
            {/* Fajr */}
            <div className={`p-4 ${isPrayerActive(prayerTimes.fajr) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${isPrayerActive(prayerTimes.fajr) ? 'bg-emerald-100 dark:bg-emerald-800/50' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <FaSun className={`h-5 w-5 ${isPrayerActive(prayerTimes.fajr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-200">Fajr</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Prière de l'aube</p>
                  </div>
                </div>
                <div className={`text-right ${isPrayerActive(prayerTimes.fajr) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                  <span className="text-lg">{formatTime(prayerTimes.fajr)}</span>
                  {isPrayerActive(prayerTimes.fajr) && (
                    <div className="text-xs mt-1 bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full inline-block">
                      En cours
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Dhuhr */}
            <div className={`p-4 ${isPrayerActive(prayerTimes.dhuhr) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${isPrayerActive(prayerTimes.dhuhr) ? 'bg-emerald-100 dark:bg-emerald-800/50' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <FaSun className={`h-5 w-5 ${isPrayerActive(prayerTimes.dhuhr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-200">Dhuhr</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Prière de midi</p>
                  </div>
                </div>
                <div className={`text-right ${isPrayerActive(prayerTimes.dhuhr) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                  <span className="text-lg">{formatTime(prayerTimes.dhuhr)}</span>
                  {isPrayerActive(prayerTimes.dhuhr) && (
                    <div className="text-xs mt-1 bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full inline-block">
                      En cours
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Asr */}
            <div className={`p-4 ${isPrayerActive(prayerTimes.asr) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${isPrayerActive(prayerTimes.asr) ? 'bg-emerald-100 dark:bg-emerald-800/50' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <FaSun className={`h-5 w-5 ${isPrayerActive(prayerTimes.asr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-200">Asr</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Prière de l'après-midi</p>
                  </div>
                </div>
                <div className={`text-right ${isPrayerActive(prayerTimes.asr) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                  <span className="text-lg">{formatTime(prayerTimes.asr)}</span>
                  {isPrayerActive(prayerTimes.asr) && (
                    <div className="text-xs mt-1 bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full inline-block">
                      En cours
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Maghrib */}
            <div className={`p-4 ${isPrayerActive(prayerTimes.maghrib) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${isPrayerActive(prayerTimes.maghrib) ? 'bg-emerald-100 dark:bg-emerald-800/50' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <FaMoon className={`h-5 w-5 ${isPrayerActive(prayerTimes.maghrib) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-200">Maghrib</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Prière du coucher du soleil</p>
                  </div>
                </div>
                <div className={`text-right ${isPrayerActive(prayerTimes.maghrib) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                  <span className="text-lg">{formatTime(prayerTimes.maghrib)}</span>
                  {isPrayerActive(prayerTimes.maghrib) && (
                    <div className="text-xs mt-1 bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full inline-block">
                      En cours
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Isha */}
            <div className={`p-4 ${isPrayerActive(prayerTimes.isha) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${isPrayerActive(prayerTimes.isha) ? 'bg-emerald-100 dark:bg-emerald-800/50' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <FaMoon className={`h-5 w-5 ${isPrayerActive(prayerTimes.isha) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-200">Isha</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Prière de la nuit</p>
                  </div>
                </div>
                <div className={`text-right ${isPrayerActive(prayerTimes.isha) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                  <span className="text-lg">{formatTime(prayerTimes.isha)}</span>
                  {isPrayerActive(prayerTimes.isha) && (
                    <div className="text-xs mt-1 bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full inline-block">
                      En cours
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
