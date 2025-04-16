import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaMicrophone, FaLanguage, FaFont, FaCog, FaArrowLeft } from 'react-icons/fa';
import { Surah, Ayah, Reciter, AVAILABLE_RECITERS, getSurahAudioUrl, getAyahAudioUrl, checkReciterAvailability } from '@/services/alquran-api';
import AudioService from '@/services/audio-service';

interface SurahContentProps {
  surah: Surah | null;
  ayahs: Ayah[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
}

const SurahContent: React.FC<SurahContentProps> = ({ surah, ayahs, loading, error, onBack }) => {
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlayingFullSurah, setIsPlayingFullSurah] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [selectedReciter, setSelectedReciter] = useState<string>('ar.alafasy');
  const [isReciterMenuOpen, setIsReciterMenuOpen] = useState(false);
  const [showTranslation, setShowTranslation] = useState<boolean>(true);
  const [textSizeLevel, setTextSizeLevel] = useState<number>(2); // 0: small, 1: medium, 2: normal, 3: large, 4: larger
  const [showTextSizeControls, setShowTextSizeControls] = useState<boolean>(false);
  const [availableReciters, setAvailableReciters] = useState<string[]>([]);
  const [currentAyah, setCurrentAyah] = useState<number | null>(null);
  
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentIndexRef = useRef<number>(0);
  const settingsRef = useRef<HTMLDivElement>(null);
  const reciterMenuRef = useRef<HTMLDivElement>(null);

  // Load saved preferences
  useEffect(() => {
    const savedReciter = localStorage.getItem('selectedReciter');
    if (savedReciter) {
      setSelectedReciter(savedReciter);
    }
    
    const savedTextSize = localStorage.getItem('textSizeLevel');
    if (savedTextSize) {
      setTextSizeLevel(parseInt(savedTextSize));
    }
    
    // Add click outside handler for both settings and reciter panels
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowTextSizeControls(false);
      }
      
      if (reciterMenuRef.current && !reciterMenuRef.current.contains(event.target as Node)) {
        setIsReciterMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check available reciters for the current surah
  useEffect(() => {
    if (surah) {
      const checkAllReciters = async () => {
        setIsReciterMenuOpen(false);
        setAvailableReciters([]); // Clear the list first
        
        // Show loading state
        const loadingReciters = ['ar.alafasy']; // Consider Alafasy always available initially
        setAvailableReciters(loadingReciters);
        
        // Check each reciter in parallel
        const reciterChecks = AVAILABLE_RECITERS.map(async reciter => {
          if (reciter.identifier === 'ar.alafasy') return reciter.identifier; // Always include Alafasy
          
          const isAvailable = await checkReciterAvailability(reciter.identifier, surah.number);
          if (isAvailable) {
            return reciter.identifier;
          }
          return null;
        });
        
        // Wait for all checks to complete
        const availableResults = await Promise.all(reciterChecks);
        const available = availableResults.filter(id => id !== null) as string[];
        
        setAvailableReciters(available);
        
        // If current reciter is not available, switch to first available
        if (available.length > 0 && !available.includes(selectedReciter)) {
          handleReciterChange(available[0]);
        }
      };
      
      checkAllReciters();
    }
  }, [surah]);

  // Handle continuous playback
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    
    if (isPlayingFullSurah && playingAyah === null && currentIndexRef.current < ayahs.length - 1) {
      timerId = setTimeout(() => {
        const nextIndex = currentIndexRef.current + 1;
        if (nextIndex < ayahs.length) {
          const nextAyah = ayahs[nextIndex];
          playAyah(nextAyah.audio || '', nextAyah.numberInSurah);
          currentIndexRef.current = nextIndex;
        }
      }, 800);
    }
    
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [playingAyah, isPlayingFullSurah, ayahs]);

  // Handle full surah playback
  const handlePlayFullSurah = () => {
    if (!surah) return;
    
    const audioService = AudioService.getInstance();
    
    // If already playing and pressed again, pause
    if (isPlayingFullSurah && currentAudioRef.current) {
      audioService.pauseAudio();
      setIsPlayingFullSurah(false);
      
      // Save current state for future resume
      if (currentAudioRef.current) {
        const currentTime = currentAudioRef.current.currentTime;
        const duration = currentAudioRef.current.duration || 1;
        const progress = currentTime / duration;
        
        audioService.savePlaybackState(`surah-${surah.number}`, {
          progress,
          time: currentTime,
          isPaused: true,
          surahNumber: surah.number
        });
      }
      
      return;
    }
    
    // Check if there's a saved state
    const savedState = audioService.getPlaybackState(`surah-${surah.number}`);
    
    // Set loading state
    setIsAudioLoading(true);
    
    // Build URL for the full surah
    const fullSurahUrl = getSurahAudioUrl(surah.number, selectedReciter);
    
    // Play audio with callbacks
    const audio = audioService.playAudio(
      fullSurahUrl,
      // onEnd callback
      () => {
        setIsPlayingFullSurah(false);
        setIsAudioLoading(false);
        audioService.clearPlaybackState(`surah-${surah.number}`);
      },
      // onTimeUpdate callback
      (currentTime, duration) => {
        const progress = currentTime / duration;
        setAudioProgress(progress);
        
        // Update periodically to save progress
        if (Math.floor(currentTime) % 5 === 0) {
          audioService.savePlaybackState(`surah-${surah.number}`, {
            progress,
            time: currentTime,
            isPaused: false,
            surahNumber: surah.number
          });
        }
      },
      // onError callback
      (error) => {
        console.error('Audio error:', error);
        setIsAudioLoading(false);
        setIsPlayingFullSurah(false);
      }
    );
    
    // Store reference to the audio element
    currentAudioRef.current = audio;
    
    // Set up additional event listeners
    audio.onloadstart = () => setIsAudioLoading(true);
    audio.oncanplaythrough = () => setIsAudioLoading(false);
    audio.onwaiting = () => setIsAudioLoading(true);
    audio.onplaying = () => {
      setIsAudioLoading(false);
      setIsPlayingFullSurah(true);
    };
    
    // If there's a saved position, start from there
    if (savedState && savedState.isPaused && savedState.time) {
      audio.currentTime = savedState.time;
    }
  };

  // Play a single ayah
  const playAyah = (audioUrl: string, ayahNumber: number) => {
    const audioService = AudioService.getInstance();
    
    audioService.playAudio(
      audioUrl,
      // onEnd callback
      () => {
        setPlayingAyah(null);
      },
      undefined,
      // onError callback
      (error) => {
        console.error("Audio playback error:", error);
        setPlayingAyah(null);
      }
    );
    
    setPlayingAyah(ayahNumber);
    setCurrentAyah(ayahNumber);
  };

  const handlePlayAudio = (audioUrl: string, ayahNumber: number) => {
    // Stop full surah playback if it's active
    setIsPlayingFullSurah(false);
    
    // Use the common function
    playAyah(audioUrl, ayahNumber);
  };

  const handleStopAudio = () => {
    const audioService = AudioService.getInstance();
    audioService.stopAudio();
    
    if (surah && isPlayingFullSurah && currentAudioRef.current) {
      const currentTime = currentAudioRef.current.currentTime;
      const duration = currentAudioRef.current.duration || 1;
      const progress = currentTime / duration;
      
      audioService.savePlaybackState(`surah-${surah.number}`, {
        progress,
        time: currentTime,
        isPaused: true,
        surahNumber: surah.number
      });
    }
    
    setPlayingAyah(null);
    setIsPlayingFullSurah(false);
  };

  // Handle reciter change
  const handleReciterChange = (reciterId: string) => {
    if (!availableReciters.includes(reciterId)) {
      console.warn(`Reciter ${reciterId} is not available for this surah`);
      return;
    }
    
    setSelectedReciter(reciterId);
    setIsReciterMenuOpen(false);
    
    // Save preference
    localStorage.setItem('selectedReciter', reciterId);
    
    // Stop audio if playing
    if (audioElement) {
      audioElement.pause();
      setPlayingAyah(null);
    }
    
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      setIsPlayingFullSurah(false);
    }
  };

  // Text size utilities
  const getTextSize = () => {
    switch (textSizeLevel) {
      case 0: return { arabic: 'text-lg', translation: 'text-xs' };
      case 1: return { arabic: 'text-xl', translation: 'text-sm' };
      case 2: return { arabic: 'text-2xl', translation: 'text-base' };
      case 3: return { arabic: 'text-3xl', translation: 'text-lg' };
      case 4: return { arabic: 'text-4xl', translation: 'text-xl' };
      default: return { arabic: 'text-2xl', translation: 'text-base' };
    }
  };

  const handleTextSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseFloat(e.target.value);
    setTextSizeLevel(newSize);
    localStorage.setItem('textSizeLevel', Math.round(newSize).toString());
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audioService = AudioService.getInstance();
    const audio = audioService.getAudioElement();
    
    if (!audio || !isPlayingFullSurah) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const progressBarWidth = rect.width;
    
    const seekPosition = clickPosition / progressBarWidth;
    
    const duration = audio.duration;
    if (duration) {
      audio.currentTime = duration * seekPosition;
      setAudioProgress(seekPosition);
      
      if (surah) {
        audioService.savePlaybackState(`surah-${surah.number}`, {
          progress: seekPosition,
          time: duration * seekPosition,
          isPaused: false,
          surahNumber: surah.number
        });
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!surah) return null;

  return (
    <div className="min-h-screen pb-16">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 dark:text-gray-400 mb-6 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        <FaArrowLeft className="mr-2" /> Retour à la liste des sourates
      </button>

      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              {surah.englishName}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">{surah.englishNameTranslation}</p>
          </div>
          <div className="text-right">
            <h2 className="font-arabic text-4xl text-gray-800 dark:text-white mb-1">{surah.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {surah.revelationType === 'Meccan' ? 'Mecquoise' : 'Médinoise'} • {surah.numberOfAyahs} versets
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-2 mb-6">
          <button
            onClick={handlePlayFullSurah}
            className={`h-12 flex-1 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
              isAudioLoading 
                ? 'bg-yellow-100/70 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' 
                : isPlayingFullSurah 
                  ? 'bg-red-100/70 dark:bg-red-500/20 text-red-700 dark:text-red-400' 
                  : 'bg-emerald-100/70 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {isAudioLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                <span className="text-base font-medium">Chargement...</span>
              </>
            ) : isPlayingFullSurah ? (
              <>
                <FaPause size={16} />
                <span className="text-base font-medium">Pause</span>
              </>
            ) : (
              <>
                <FaPlay size={16} />
                <span className="text-base font-medium">Lire</span>
              </>
            )}
          </button>

          <div className="relative" ref={reciterMenuRef}>
            <button
              onClick={() => {
                setIsReciterMenuOpen(!isReciterMenuOpen);
                setShowTextSizeControls(false);
              }}
              className={`h-12 w-12 rounded-lg ${
                isReciterMenuOpen 
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
              } flex items-center justify-center`}
            >
              <FaMicrophone size={16} />
            </button>
            
            {isReciterMenuOpen && (
              <div className="absolute right-0 z-10 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                {availableReciters.length === 0 ? (
                  <div className="p-3 text-center text-gray-500 dark:text-gray-400">
                    <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Chargement des récitateurs...
                  </div>
                ) : (
                  AVAILABLE_RECITERS.map(reciter => {
                    const isAvailable = availableReciters.includes(reciter.identifier);
                    return (
                      <button
                        key={reciter.identifier}
                        onClick={() => isAvailable && handleReciterChange(reciter.identifier)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                          !isAvailable 
                            ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600' 
                            : selectedReciter === reciter.identifier 
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                              : 'text-gray-700 dark:text-gray-300'
                        }`}
                        disabled={!isAvailable}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm">{reciter.name}</div>
                            <div className="text-xs text-gray-500">{reciter.arabicName}</div>
                          </div>
                          {!isAvailable && <span className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">Indisponible</span>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => {
                setShowTextSizeControls(!showTextSizeControls);
                setIsReciterMenuOpen(false);
              }}
              className={`h-12 w-12 rounded-lg ${
                showTextSizeControls ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
              } flex items-center justify-center`}
            >
              <FaCog size={16} />
            </button>
            
            {showTextSizeControls && (
              <div className="absolute right-0 top-full mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 w-64">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                      <FaLanguage size={16} className="mr-2" /> 
                      Traduction
                    </span>
                    <button 
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={`w-10 h-5 rounded-full flex items-center transition-colors ${
                        showTranslation ? 'bg-blue-500 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full mx-0.5 ${showTranslation ? 'bg-white' : 'bg-gray-100 dark:bg-gray-400'}`}></span>
                    </button>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                        <FaFont size={14} className="mr-2" /> 
                        Taille du texte
                      </span>
                    </div>
                    
                    <div className="mt-2">
                      <div className="flex justify-between px-1 mb-1">
                        {[0, 1, 2, 3, 4].map(step => (
                          <div 
                            key={step}
                            className={`w-1 h-3 rounded-full ${textSizeLevel >= step ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                          ></div>
                        ))}
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="4" 
                        step="1"
                        value={textSizeLevel} 
                        onChange={handleTextSizeChange}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${textSizeLevel / 4 * 100}%, #e5e7eb ${textSizeLevel / 4 * 100}%, #e5e7eb 100%)`,
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                        <span>Petit</span>
                        <span>Normal</span>
                        <span>Grand</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Audio progress bar */}
        {isPlayingFullSurah && currentAudioRef.current && (
          <div className="mb-4 w-full">
            <div 
              className="relative h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden cursor-pointer"
              onClick={handleProgressBarClick}
            >
              <div 
                className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${audioProgress * 100}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatTime(currentAudioRef.current.currentTime)}</span>
              <span>{currentAudioRef.current.duration ? formatTime(currentAudioRef.current.duration) : 'Chargement...'}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-200 dark:border-gray-700 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : (
          <div className="space-y-4">
            {ayahs.map((ayah) => {
              const textSize = getTextSize();
              return (
                <div 
                  key={ayah.number.toString()} 
                  id={`verse-${ayah.numberInSurah}`} 
                  className={`py-3 ${
                    currentAyah === ayah.numberInSurah ? 'bg-emerald-50/70 dark:bg-emerald-900/10 rounded-lg px-3 -mx-3' : ''
                  } ${ayah.numberInSurah !== ayahs.length ? 'border-b border-gray-200 dark:border-gray-700/30' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="bg-emerald-50 dark:bg-gray-800/70 text-emerald-700 dark:text-emerald-400 font-medium rounded-full w-8 h-8 flex items-center justify-center text-xs">
                      {ayah.numberInSurah}
                    </div>
                    <button
                      aria-label={playingAyah === ayah.numberInSurah ? "Pause" : "Play"}
                      onClick={() => {
                        const audioUrl = ayah.audio || getAyahAudioUrl(surah.number, ayah.numberInSurah, selectedReciter);
                        playingAyah === ayah.numberInSurah ? handleStopAudio() : handlePlayAudio(audioUrl, ayah.numberInSurah);
                      }}
                      className="bg-emerald-50 dark:bg-gray-800/70 text-emerald-700 dark:text-emerald-400 rounded-full p-2"
                    >
                      {playingAyah === ayah.numberInSurah ? <FaPause size={10} /> : <FaPlay size={10} />}
                    </button>
                  </div>
                  <p className={`text-right font-arabic leading-relaxed text-gray-800 dark:text-white py-1 ${textSize.arabic}`}>{ayah.text}</p>
                  {showTranslation && ayah.translation && (
                    <p className={`mt-2 text-gray-600 dark:text-gray-400 leading-relaxed ${textSize.translation}`}>{ayah.translation}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SurahContent; 