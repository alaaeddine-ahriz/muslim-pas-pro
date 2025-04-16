/**
 * Service for handling audio playback with special consideration for iOS devices
 */

export interface PlaybackState {
  progress: number;
  time: number;
  isPaused: boolean;
  verseIndex?: number;
  surahNumber?: number;
}

class AudioService {
  private static instance: AudioService;
  private audioElement: HTMLAudioElement | null = null;
  private isIOS: boolean = false;

  private constructor() {
    // Detect iOS devices
    this.isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    this.initializeAudio();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  /**
   * Initialize audio for iOS devices
   */
  private initializeAudio(): void {
    if (this.isIOS && typeof window !== 'undefined') {
      // Create a silent audio for iOS devices
      const silentAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//tUwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAABAAADQgD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAAA5TEFNRTMuMTAwBK8AAAAAAAAAABUgJAUHQQAB9gAAA0LJ5EPfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
      silentAudio.volume = 0.01;

      // Set up event listeners to initialize audio on user interaction
      const initAudio = () => {
        silentAudio.play().catch(error => {
          console.log('iOS audio initialization failed, will retry on next interaction', error);
        });
      };

      // Add listeners for user interaction events
      document.addEventListener('click', initAudio, { once: true });
      document.addEventListener('touchstart', initAudio, { once: true });
    }
  }

  /**
   * Play audio file
   * @param url URL of the audio file
   * @param onEnd Callback for when audio playback ends
   * @param onTimeUpdate Callback for when audio time updates
   * @param onError Callback for error handling
   * @returns The created audio element
   */
  public playAudio(
    url: string,
    onEnd?: () => void,
    onTimeUpdate?: (currentTime: number, duration: number) => void,
    onError?: (error: any) => void
  ): HTMLAudioElement {
    // Stop any existing audio
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }

    // Create new audio element
    const audio = new Audio();
    this.audioElement = audio;

    // Set up event listeners
    if (onEnd) {
      audio.addEventListener('ended', onEnd);
    }

    if (onTimeUpdate) {
      audio.addEventListener('timeupdate', () => {
        onTimeUpdate(audio.currentTime, audio.duration || 0);
      });
    }

    audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      if (onError) onError(e);
    });

    // Set source and play
    audio.src = url;
    
    // Special handling for iOS
    if (this.isIOS) {
      // For iOS, we need to handle playback differently
      audio.load();
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('iOS playback error, might need user interaction:', error);
          // For iOS Safari, we might need user interaction
          if (onError) onError(error);
        });
      }
    } else {
      // Regular playback for other browsers
      audio.play().catch(error => {
        console.error('Audio playback error:', error);
        if (onError) onError(error);
      });
    }

    return audio;
  }

  /**
   * Pause current audio playback
   */
  public pauseAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  /**
   * Resume paused audio
   */
  public resumeAudio(): void {
    if (this.audioElement && this.audioElement.paused) {
      this.audioElement.play().catch(error => {
        console.error('Error resuming audio:', error);
      });
    }
  }

  /**
   * Stop and release audio resources
   */
  public stopAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
  }

  /**
   * Set current time of audio playback
   * @param time Time in seconds
   */
  public seekTo(time: number): void {
    if (this.audioElement) {
      this.audioElement.currentTime = time;
    }
  }

  /**
   * Get current audio element
   */
  public getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }

  /**
   * Save playback state to localStorage
   * @param key Storage key
   * @param state Playback state to save
   */
  public savePlaybackState(key: string, state: PlaybackState): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(state));
    }
  }

  /**
   * Get saved playback state from localStorage
   * @param key Storage key
   */
  public getPlaybackState(key: string): PlaybackState | null {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          return JSON.parse(data);
        } catch (e) {
          console.error('Error parsing playback state:', e);
        }
      }
    }
    return null;
  }

  /**
   * Clear saved playback state
   * @param key Storage key
   */
  public clearPlaybackState(key: string): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
}

export default AudioService; 