'use client';

import { useEffect, useState } from 'react';
import { Coordinates, PrayerTimes, CalculationMethod } from 'adhan';
import { FaMapMarkerAlt, FaCalendarAlt, FaMosque, FaClock, FaQuran, FaSun, FaMoon, FaCompass } from 'react-icons/fa';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';

export default function Home() {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [cityName, setCityName] = useState<string>('');
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: Date } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { theme } = useTheme();

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 dark:border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* En-tête avec la date actuelle et l'emplacement */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center text-gray-600 dark:text-gray-300">
          <FaCalendarAlt className="mr-2" />
          <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
        {cityName && (
          <div className="flex items-center text-gray-600 dark:text-gray-300">
            <FaMapMarkerAlt className="mr-1" />
            <span>{cityName}</span>
          </div>
        )}
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 shadow-sm">
          <p>{error}</p>
          <button className="mt-2 bg-red-100 hover:bg-red-200 dark:bg-red-800/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Définir manuellement
          </button>
        </div>
      )}

      {/* Widgets de navigation */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link href="/quran">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm dark:shadow-gray-950/50 h-full flex flex-col items-center justify-center text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div className="mb-3 w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <FaQuran className="text-lg text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="font-medium text-gray-700 dark:text-gray-200">Coran</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Lire et écouter le Coran</p>
          </div>
        </Link>
        <Link href="/qibla">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm dark:shadow-gray-950/50 h-full flex flex-col items-center justify-center text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div className="mb-3 w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <FaCompass className="text-lg text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="font-medium text-gray-700 dark:text-gray-200">Qibla</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Direction de la prière</p>
          </div>
        </Link>
      </div>

      {nextPrayer && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 shadow-sm dark:shadow-gray-950/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-gray-700 dark:text-gray-200">Prochaine prière</h2>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <FaClock className="mr-1" />
              <span>{timeRemaining}</span>
            </div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{nextPrayer.name}</p>
              <p className="text-gray-500 dark:text-gray-400">{formatTime(nextPrayer.time)}</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center">
              <FaMosque className="text-xl text-emerald-600 dark:text-emerald-400" />
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
