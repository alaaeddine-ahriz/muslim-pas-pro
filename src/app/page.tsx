'use client';

import { useEffect, useState } from 'react';
import { Coordinates, PrayerTimes, CalculationMethod } from 'adhan';
import { FaMapMarkerAlt, FaCalendarAlt, FaSun, FaMoon } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';

export default function Home() {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [cityName, setCityName] = useState<string>('');
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: Date } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { theme, toggleTheme } = useTheme();

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

  const isDayTime = (): boolean => {
    if (!prayerTimes) return true;
    const now = new Date();
    return now >= prayerTimes.fajr && now < prayerTimes.maghrib;
  };

  const getGreeting = (): string => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) return 'Bonjour';
    if (hours >= 12 && hours < 18) return 'Bon après-midi';
    return 'Bonsoir';
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{getGreeting()}</h1>
          {cityName && (
            <div className="flex items-center mt-1 text-gray-500 dark:text-gray-400">
              <FaMapMarkerAlt className="mr-1 text-sm" />
              <span className="text-sm">{cityName}</span>
            </div>
          )}
        </div>
        <button 
          className="bg-white dark:bg-gray-800 rounded-full p-3 shadow-sm dark:shadow-gray-950/50 transition-colors"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <FaSun className="text-2xl text-amber-400" />
          ) : (
            <FaMoon className="text-2xl text-indigo-500" />
          )}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 shadow-sm">
          <p>{error}</p>
          <button className="mt-2 bg-red-100 hover:bg-red-200 dark:bg-red-800/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Définir manuellement
          </button>
        </div>
      )}

      {nextPrayer && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 shadow-sm dark:shadow-gray-950/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-medium text-gray-700 dark:text-gray-200">Prochaine prière</h2>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <FaCalendarAlt className="mr-1" />
              <span>{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{nextPrayer.name}</p>
              <p className="text-gray-500 dark:text-gray-400">{formatTime(nextPrayer.time)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Temps restant</p>
              <p className="text-xl font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-lg">{timeRemaining}</p>
            </div>
          </div>
        </div>
      )}

      {prayerTimes && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm dark:shadow-gray-950/50">
          <h2 className="text-xl font-medium text-gray-700 dark:text-gray-200 mb-4">Horaires des prières</h2>
          <div className="space-y-4">
            <div className={`flex justify-between items-center p-3 rounded-lg ${isPrayerActive(prayerTimes.fajr) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <div className="flex items-center">
                <div className={`w-10 h-10 flex items-center justify-center rounded-full mr-3 ${isPrayerActive(prayerTimes.fajr) ? 'bg-emerald-100 dark:bg-emerald-800/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <span className={`text-sm font-medium ${isPrayerActive(prayerTimes.fajr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>01</span>
                </div>
                <span className={`font-medium ${isPrayerActive(prayerTimes.fajr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>Fajr</span>
              </div>
              <span className={`text-lg font-medium ${isPrayerActive(prayerTimes.fajr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>{formatTime(prayerTimes.fajr)}</span>
            </div>
            
            <div className={`flex justify-between items-center p-3 rounded-lg ${isPrayerActive(prayerTimes.dhuhr) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <div className="flex items-center">
                <div className={`w-10 h-10 flex items-center justify-center rounded-full mr-3 ${isPrayerActive(prayerTimes.dhuhr) ? 'bg-emerald-100 dark:bg-emerald-800/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <span className={`text-sm font-medium ${isPrayerActive(prayerTimes.dhuhr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>02</span>
                </div>
                <span className={`font-medium ${isPrayerActive(prayerTimes.dhuhr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>Dhuhr</span>
              </div>
              <span className={`text-lg font-medium ${isPrayerActive(prayerTimes.dhuhr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>{formatTime(prayerTimes.dhuhr)}</span>
            </div>
            
            <div className={`flex justify-between items-center p-3 rounded-lg ${isPrayerActive(prayerTimes.asr) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <div className="flex items-center">
                <div className={`w-10 h-10 flex items-center justify-center rounded-full mr-3 ${isPrayerActive(prayerTimes.asr) ? 'bg-emerald-100 dark:bg-emerald-800/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <span className={`text-sm font-medium ${isPrayerActive(prayerTimes.asr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>03</span>
                </div>
                <span className={`font-medium ${isPrayerActive(prayerTimes.asr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>Asr</span>
              </div>
              <span className={`text-lg font-medium ${isPrayerActive(prayerTimes.asr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>{formatTime(prayerTimes.asr)}</span>
            </div>
            
            <div className={`flex justify-between items-center p-3 rounded-lg ${isPrayerActive(prayerTimes.maghrib) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <div className="flex items-center">
                <div className={`w-10 h-10 flex items-center justify-center rounded-full mr-3 ${isPrayerActive(prayerTimes.maghrib) ? 'bg-emerald-100 dark:bg-emerald-800/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <span className={`text-sm font-medium ${isPrayerActive(prayerTimes.maghrib) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>04</span>
                </div>
                <span className={`font-medium ${isPrayerActive(prayerTimes.maghrib) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>Maghrib</span>
              </div>
              <span className={`text-lg font-medium ${isPrayerActive(prayerTimes.maghrib) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>{formatTime(prayerTimes.maghrib)}</span>
            </div>
            
            <div className={`flex justify-between items-center p-3 rounded-lg ${isPrayerActive(prayerTimes.isha) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <div className="flex items-center">
                <div className={`w-10 h-10 flex items-center justify-center rounded-full mr-3 ${isPrayerActive(prayerTimes.isha) ? 'bg-emerald-100 dark:bg-emerald-800/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <span className={`text-sm font-medium ${isPrayerActive(prayerTimes.isha) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>05</span>
                </div>
                <span className={`font-medium ${isPrayerActive(prayerTimes.isha) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>Isha</span>
              </div>
              <span className={`text-lg font-medium ${isPrayerActive(prayerTimes.isha) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>{formatTime(prayerTimes.isha)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
