import axios from 'axios';

// Define types for Mawaqit API responses
export interface Mosque {
  id: string;
  slug: string;
  title: string;
  city: string;
  country: string;
  distance?: number; // Distance in km from user's location
  latitude: number;
  longitude: number;
}

export interface PrayerTimes {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  jumua?: string;
  current?: string; // Current prayer name
  next?: string;   // Next prayer name
  nextTime?: string; // Time of next prayer
  date?: string;     // Current date (Islamic and Gregorian)
}

/**
 * Get nearest mosques to a location
 * @param latitude User's latitude
 * @param longitude User's longitude
 * @param limit Number of results to return
 */
export const getNearestMosques = async (
  latitude: number,
  longitude: number,
  limit: number = 5
): Promise<Mosque[]> => {
  try {
    // Using the unofficial Mawaqit API as described in mrsofiane/mawaqit-api
    const url = `https://mawaqit.net/api/2.0/mosque/nearest?lat=${latitude}&lon=${longitude}&limit=${limit}`;
    const response = await axios.get(url);
    
    // Process the response to match our interface
    return response.data.map((mosque: any) => ({
      id: mosque.id.toString(),
      slug: mosque.slug,
      title: mosque.title,
      city: mosque.city || '',
      country: mosque.country || '',
      distance: mosque.distance,
      latitude: mosque.latitude,
      longitude: mosque.longitude
    }));
  } catch (error) {
    console.error('Error fetching nearest mosques:', error);
    throw error;
  }
};

/**
 * Get prayer times for a specific mosque
 * @param mosqueId The ID or slug of the mosque
 */
export const getMosquePrayerTimes = async (mosqueId: string): Promise<PrayerTimes> => {
  try {
    const url = `https://mawaqit.net/api/2.0/mosque/${mosqueId}/prayer-times`;
    const response = await axios.get(url);
    
    const prayerTimes: PrayerTimes = {
      fajr: response.data.fajr,
      dhuhr: response.data.dhuhr,
      asr: response.data.asr,
      maghrib: response.data.maghrib,
      isha: response.data.isha,
      date: response.data.date
    };
    
    // Add jumuah time if available
    if (response.data.jumua) {
      prayerTimes.jumua = response.data.jumua;
    }
    
    // Determine current and next prayer
    const prayers = [
      { name: 'fajr', time: prayerTimes.fajr },
      { name: 'dhuhr', time: prayerTimes.dhuhr },
      { name: 'asr', time: prayerTimes.asr },
      { name: 'maghrib', time: prayerTimes.maghrib },
      { name: 'isha', time: prayerTimes.isha }
    ];
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;
    
    let currentPrayer = null;
    let nextPrayer = null;
    
    for (let i = 0; i < prayers.length; i++) {
      const prayer = prayers[i];
      const [prayerHours, prayerMinutes] = prayer.time.split(':').map(Number);
      const prayerTimeInMinutes = prayerHours * 60 + prayerMinutes;
      
      if (currentTimeInMinutes < prayerTimeInMinutes) {
        nextPrayer = prayer;
        if (i > 0) {
          currentPrayer = prayers[i - 1];
        } else {
          // If we haven't prayed Fajr yet, the current prayer is Isha from yesterday
          currentPrayer = prayers[prayers.length - 1];
        }
        break;
      }
    }
    
    // If we've passed all prayers, next is tomorrow's Fajr
    if (!nextPrayer) {
      nextPrayer = prayers[0];
      currentPrayer = prayers[prayers.length - 1];
    }
    
    if (currentPrayer) {
      prayerTimes.current = currentPrayer.name;
    }
    
    if (nextPrayer) {
      prayerTimes.next = nextPrayer.name;
      prayerTimes.nextTime = nextPrayer.time;
    }
    
    return prayerTimes;
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    throw error;
  }
};

/**
 * Save preferred mosque to local storage
 * @param mosque The mosque to save
 */
export const savePreferredMosque = (mosque: Mosque): void => {
  localStorage.setItem('preferredMosque', JSON.stringify(mosque));
};

/**
 * Get preferred mosque from local storage
 */
export const getPreferredMosque = (): Mosque | null => {
  const savedMosque = localStorage.getItem('preferredMosque');
  if (savedMosque) {
    try {
      return JSON.parse(savedMosque);
    } catch (e) {
      console.error('Error parsing saved mosque:', e);
    }
  }
  return null;
};

/**
 * Get user's current location
 * @returns Promise with latitude and longitude
 */
export const getUserLocation = (): Promise<{latitude: number, longitude: number}> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
    }
  });
}; 