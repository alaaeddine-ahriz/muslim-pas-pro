import axios from 'axios';

// Base API URLs
const API_BASE_URL = 'https://api.alquran.cloud/v1';
const CDN_BASE_URL = 'https://cdn.islamic.network/quran/audio';

// TypeScript interfaces for API responses
export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | {
    recommended: boolean;
    obligatory: boolean;
  };
  audio?: string;
  audioSecondary?: string[];
  translation?: string;
}

export interface Edition {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: string;
  type: string;
  direction?: string;
}

export interface QuranResponse {
  code: number;
  status: string;
  data: {
    surahs?: Surah[];
    ayahs?: Ayah[];
    edition?: Edition;
    number?: number;
    name?: string;
    englishName?: string;
    englishNameTranslation?: string;
    numberOfAyahs?: number;
    revelationType?: string;
  };
}

export interface Reciter {
  identifier: string;
  name: string;
  arabicName?: string;
}

// Available reciters
export const AVAILABLE_RECITERS: Reciter[] = [
  { identifier: 'ar.alafasy', name: 'Mishary Rashid Alafasy', arabicName: 'مشاري راشد العفاسي' },
  { identifier: 'ar.abdurrahmaansudais', name: 'Abdurrahmaan As-Sudais', arabicName: 'عبدالرحمن السديس' },
  { identifier: 'ar.abdulbasitmurattal', name: 'Abdul Basit Murattal', arabicName: 'عبد الباسط عبد الصمد' },
  { identifier: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly', arabicName: 'ماهر المعيقلي' },
  { identifier: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', arabicName: 'محمود خليل الحصري' },
  { identifier: 'ar.minshawi', name: 'Mohamed Siddiq Al-Minshawi', arabicName: 'محمد صديق المنشاوي' },
  { identifier: 'ar.muhammadayyoub', name: 'Muhammad Ayyoub', arabicName: 'محمد أيوب' },
  { identifier: 'ar.muhammadjibreel', name: 'Muhammad Jibreel', arabicName: 'محمد جبريل' }
];

/**
 * Get all surahs in the Quran
 */
export const getAllSurahs = async (): Promise<Surah[]> => {
  try {
    const response = await axios.get<QuranResponse>(`${API_BASE_URL}/surah`);
    return response.data.data.surahs || [];
  } catch (error) {
    console.error('Error fetching surahs:', error);
    throw error;
  }
};

/**
 * Get a specific surah by number
 * @param surahNumber The number of the surah (1-114)
 * @param edition The edition identifier (default: quran-uthmani)
 */
export const getSurah = async (surahNumber: number, edition: string = 'quran-uthmani'): Promise<{ surah: Surah, ayahs: Ayah[] }> => {
  try {
    const response = await axios.get<QuranResponse>(`${API_BASE_URL}/surah/${surahNumber}/${edition}`);
    const { data } = response.data;
    
    return {
      surah: {
        number: data.number || 0,
        name: data.name || '',
        englishName: data.englishName || '',
        englishNameTranslation: data.englishNameTranslation || '',
        numberOfAyahs: data.numberOfAyahs || 0,
        revelationType: data.revelationType || ''
      },
      ayahs: data.ayahs || []
    };
  } catch (error) {
    console.error(`Error fetching surah ${surahNumber}:`, error);
    throw error;
  }
};

/**
 * Get multiple editions of a surah
 * @param surahNumber The number of the surah (1-114)
 * @param editions Array of edition identifiers
 */
export const getSurahWithEditions = async (surahNumber: number, editions: string[]): Promise<{ [key: string]: Ayah[] }> => {
  try {
    const editionsStr = editions.join(',');
    const response = await axios.get<QuranResponse>(`${API_BASE_URL}/surah/${surahNumber}/editions/${editionsStr}`);
    
    // The response format is different for multiple editions, we need to restructure it
    const result: { [key: string]: Ayah[] } = {};
    
    if (Array.isArray(response.data.data)) {
      response.data.data.forEach((edition: any) => {
        if (edition.edition && edition.edition.identifier) {
          result[edition.edition.identifier] = edition.ayahs || [];
        }
      });
    }
    
    return result;
  } catch (error) {
    console.error(`Error fetching surah ${surahNumber} with editions:`, error);
    throw error;
  }
};

/**
 * Get available editions
 * @param format Optional filter by format (text, audio)
 * @param language Optional filter by language code (en, ar, fr, etc.)
 * @param type Optional filter by type (translation, tafsir, versebyverse, etc.)
 */
export const getEditions = async (format?: string, language?: string, type?: string): Promise<Edition[]> => {
  try {
    let url = `${API_BASE_URL}/edition`;
    const params: Record<string, string> = {};
    
    if (format) params.format = format;
    if (language) params.language = language;
    if (type) params.type = type;
    
    const response = await axios.get<QuranResponse>(url, { params });
    return response.data.data as unknown as Edition[];
  } catch (error) {
    console.error('Error fetching editions:', error);
    throw error;
  }
};

/**
 * Check if a reciter is available for a specific surah
 * @param reciterId The reciter identifier
 * @param surahNumber The surah number
 */
export const checkReciterAvailability = async (reciterId: string, surahNumber: number): Promise<boolean> => {
  try {
    // First try to check with HEAD request
    try {
      const response = await axios.head(`${API_BASE_URL}/surah/${surahNumber}/${reciterId}`);
      return response.status === 200;
    } catch (headError) {
      // If HEAD fails, try a GET request to a specific ayah instead
      const testResponse = await axios.get(`${CDN_BASE_URL}/128/${reciterId}/${surahNumber}:1.mp3`, {
        responseType: 'blob',
        timeout: 5000 // 5-second timeout
      });
      return testResponse.status === 200;
    }
  } catch (error) {
    console.log(`Reciter ${reciterId} not available for surah ${surahNumber}`);
    return false;
  }
};

/**
 * Get audio URL for a specific ayah
 * @param surahNumber The surah number
 * @param ayahNumber The ayah number within the surah
 * @param reciterId The reciter identifier
 * @param quality The audio quality (16, 32, 64, 128)
 */
export const getAyahAudioUrl = (
  surahNumber: number, 
  ayahNumber: number, 
  reciterId: string = 'ar.alafasy',
  quality: 16 | 32 | 64 | 128 = 128
): string => {
  return `${CDN_BASE_URL}/${quality}/${reciterId}/${surahNumber}:${ayahNumber}.mp3`;
};

/**
 * Get audio URL for a full surah
 * @param surahNumber The surah number
 * @param reciterId The reciter identifier
 * @param quality The audio quality (16, 32, 64, 128)
 */
export const getSurahAudioUrl = (
  surahNumber: number, 
  reciterId: string = 'ar.alafasy',
  quality: 16 | 32 | 64 | 128 = 128
): string => {
  return `${CDN_BASE_URL}-surah/${quality}/${reciterId}/${surahNumber}.mp3`;
};

/**
 * Search the Quran for a keyword
 * @param keyword The keyword to search for
 * @param surah The surah to search in (1-114 or 'all')
 * @param edition The edition or language to search in
 */
export const searchQuran = async (keyword: string, surah: number | 'all' = 'all', edition?: string): Promise<Ayah[]> => {
  try {
    const url = `${API_BASE_URL}/search/${encodeURIComponent(keyword)}/${surah}/${edition || 'en'}`;
    const response = await axios.get<QuranResponse>(url);
    return response.data.data.ayahs || [];
  } catch (error) {
    console.error(`Error searching Quran for "${keyword}":`, error);
    throw error;
  }
}; 