import { useState, useEffect } from 'react';

/**
 * Hook to progressively reveal items from an array with delay
 */
export function useProgressiveReveal<T>(
  items: T[],
  delayMs: number = 300,
  enabled: boolean = true
): T[] {
  const [revealed, setRevealed] = useState<T[]>([]);

  useEffect(() => {
    if (!enabled || items.length === 0) {
      setRevealed(items);
      return;
    }

    setRevealed([]);
    const timers: NodeJS.Timeout[] = [];

    items.forEach((item, index) => {
      const timer = setTimeout(() => {
        setRevealed((prev) => [...prev, item]);
      }, delayMs * index);
      timers.push(timer);
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [items, delayMs, enabled]);

  return revealed;
}

/**
 * Hook to create typing effect for text
 */
export function useTypingEffect(
  text: string,
  speedMs: number = 30,
  enabled: boolean = true
): string {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      return;
    }

    setDisplayed('');
    let index = 0;

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayed(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, speedMs);

    return () => clearInterval(timer);
  }, [text, speedMs, enabled]);

  return displayed;
}

/**
 * Hook to manage processing stages with status messages
 */
export interface ProcessingStage {
  message: string;
  duration: number;
}

export function useProcessingStages(
  stages: ProcessingStage[],
  onComplete?: () => void
): { currentStage: number; currentMessage: string; isComplete: boolean } {
  const [currentStage, setCurrentStage] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (stages.length === 0) return;

    let totalDelay = 0;
    const timers: NodeJS.Timeout[] = [];

    stages.forEach((stage, index) => {
      const timer = setTimeout(() => {
        setCurrentStage(index);

        if (index === stages.length - 1) {
          setTimeout(() => {
            setIsComplete(true);
            onComplete?.();
          }, stage.duration);
        }
      }, totalDelay);

      timers.push(timer);
      totalDelay += stage.duration;
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [stages, onComplete]);

  return {
    currentStage,
    currentMessage: stages[currentStage]?.message || '',
    isComplete,
  };
}
