// Mawaqit API service for fetching prayer times
// API documentation: https://mawaqit.net/en/developers

// Define interfaces for type safety
export interface Mosque {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance?: number; // Optional distance from user (in km)
}

export interface PrayerTimes {
  date: string;
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  // Add jumua if needed in the future
  // jumua?: string;
}

export interface MawaqitResponse {
  data: any;
  message: string;
  status: number;
}

// Mock data for nearby mosques
const MOCK_MOSQUES: Mosque[] = [
  {
    id: "mosque1",
    name: "Mosquée de Paris",
    address: "2bis Place du Puits de l'Ermite, 75005 Paris",
    latitude: 48.842201,
    longitude: 2.355170
  },
  {
    id: "mosque2",
    name: "Mosquée de Pantin",
    address: "136 Avenue Jean Lolive, 93500 Pantin",
    latitude: 48.893749,
    longitude: 2.412905
  },
  {
    id: "mosque3",
    name: "Mosquée de Clichy-sous-Bois",
    address: "Avenue de Sévigné, 93390 Clichy-sous-Bois",
    latitude: 48.910942,
    longitude: 2.543006
  }
];

// Mock prayer times data
const MOCK_PRAYER_TIMES: Record<string, PrayerTimes> = {
  "mosque1": {
    date: new Date().toISOString().split('T')[0],
    fajr: "05:45",
    dhuhr: "13:05",
    asr: "16:25",
    maghrib: "20:35",
    isha: "22:05"
  },
  "mosque2": {
    date: new Date().toISOString().split('T')[0],
    fajr: "05:40",
    dhuhr: "13:00",
    asr: "16:20",
    maghrib: "20:30",
    isha: "22:00"
  },
  "mosque3": {
    date: new Date().toISOString().split('T')[0],
    fajr: "05:50",
    dhuhr: "13:10",
    asr: "16:30",
    maghrib: "20:40",
    isha: "22:10"
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Fetch nearby mosques based on user's location
 * @param latitude User's latitude
 * @param longitude User's longitude
 * @returns Promise that resolves to array of mosques with distances
 */
export async function fetchNearbyMosques(
  latitude: number,
  longitude: number
): Promise<Mosque[]> {
  // In a real app, you would call an API here
  // For now, use mock data with a small delay to simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      const mosquesWithDistance = MOCK_MOSQUES.map(mosque => ({
        ...mosque,
        distance: calculateDistance(
          latitude, 
          longitude, 
          mosque.latitude, 
          mosque.longitude
        )
      }));
      
      // Sort by distance
      mosquesWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      resolve(mosquesWithDistance);
    }, 800); // Simulate network delay
  });
}

/**
 * Fetch prayer times for a specific mosque
 * @param mosqueId ID of the mosque
 * @returns Promise that resolves to prayer times
 */
export async function fetchPrayerTimes(mosqueId: string): Promise<PrayerTimes> {
  // In a real app, you would call an API here
  // For now, use mock data with a small delay to simulate API call
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const times = MOCK_PRAYER_TIMES[mosqueId];
      if (times) {
        resolve(times);
      } else {
        reject(new Error(`Prayer times not found for mosque ID: ${mosqueId}`));
      }
    }, 600); // Simulate network delay
  });
}

/**
 * Format time string to more readable format
 * @param timeString Time string in format "HH:MM"
 * @returns Formatted time string
 */
export function formatTime(timeString: string | undefined): string {
  if (!timeString) return '--:--';
  return timeString;
}

/**
 * Determine current and next prayers based on prayer times
 * @param prayerTimes Prayer times object
 * @returns Object containing current and next prayer keys
 */
export function getCurrentPrayer(prayerTimes: PrayerTimes): { 
  current: string | null; 
  next: string | null 
} {
  const prayers = [
    { key: 'fajr', time: prayerTimes.fajr },
    { key: 'dhuhr', time: prayerTimes.dhuhr },
    { key: 'asr', time: prayerTimes.asr },
    { key: 'maghrib', time: prayerTimes.maghrib },
    { key: 'isha', time: prayerTimes.isha }
  ];
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Convert current time to minutes since midnight for easier comparison
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  
  // Convert prayer times to minutes
  const prayerTimesInMinutes = prayers.map(prayer => {
    const [hours, minutes] = prayer.time.split(':').map(Number);
    return {
      key: prayer.key,
      timeInMinutes: hours * 60 + minutes
    };
  });
  
  // Sort prayer times chronologically
  prayerTimesInMinutes.sort((a, b) => a.timeInMinutes - b.timeInMinutes);
  
  // Find current and next prayers
  let current: string | null = null;
  let next: string | null = null;
  
  for (let i = 0; i < prayerTimesInMinutes.length; i++) {
    if (currentTimeInMinutes < prayerTimesInMinutes[i].timeInMinutes) {
      // If we're before this prayer, it's the next one
      next = prayerTimesInMinutes[i].key;
      
      // The current prayer is the previous one, or isha from yesterday if before fajr
      if (i > 0) {
        current = prayerTimesInMinutes[i - 1].key;
      } else {
        // Before first prayer of the day (fajr), the current prayer is isha from the previous day
        current = 'isha';
      }
      
      break;
    }
  }
  
  // If we've passed all prayers for the day, current is the last one and next is the first one tomorrow
  if (!next) {
    current = prayerTimesInMinutes[prayerTimesInMinutes.length - 1].key;
    next = prayerTimesInMinutes[0].key;
  }
  
  return { current, next };
} 