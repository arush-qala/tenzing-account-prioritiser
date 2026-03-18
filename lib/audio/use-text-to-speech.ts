'use client';

import { useState, useRef, useCallback } from 'react';

export function useTextToSpeech() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(async (text: string) => {
    // Stop any currently playing audio
    stop();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      // Check if the response is an error (JSON) vs audio
      const contentType = res.headers.get('content-type') || '';

      if (!res.ok || contentType.includes('application/json')) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(errData.error || `Audio failed (${res.status})`);
        setIsLoading(false);
        return;
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        setError('Empty audio response');
        setIsLoading(false);
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setError('Audio playback failed');
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      audioRef.current = audio;
      setIsPlaying(true);
      setIsLoading(false);
      await audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
      setIsPlaying(false);
      setIsLoading(false);
    }
  }, [stop]);

  return { play, stop, isPlaying, isLoading, error };
}
