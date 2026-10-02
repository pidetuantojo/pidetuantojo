import { useState, useRef, useEffect, type RefObject } from 'react';

const AUTOPLAY_MS = 5000;
const RESUME_DELAY_MS = 8000;

export interface PromoCarouselControls {
  scrollRef: RefObject<HTMLDivElement>;
  activeIndex: number;
  goTo: (i: number) => void;
  next: () => void;
  prev: () => void;
  handleScroll: () => void;
  pauseTemporarily: () => void;
}

export function usePromoCarousel(count: number): PromoCarouselControls {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [outOfView, setOutOfView] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const paused = userPaused || outOfView || tabHidden;

  function scrollToIndex(i: number, behavior: ScrollBehavior = 'smooth') {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.offsetWidth, behavior: reducedMotion.current ? 'auto' : behavior });
  }

  function pauseTemporarily() {
    setUserPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setUserPaused(false), RESUME_DELAY_MS);
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIndex(Math.round(el.scrollLeft / el.offsetWidth));
  }

  function goTo(i: number) {
    scrollToIndex(i);
    pauseTemporarily();
  }

  function next() {
    const el = scrollRef.current;
    const cur = el ? Math.round(el.scrollLeft / el.offsetWidth) : activeIndex;
    goTo((cur + 1) % count);
  }

  function prev() {
    const el = scrollRef.current;
    const cur = el ? Math.round(el.scrollLeft / el.offsetWidth) : activeIndex;
    goTo((cur - 1 + count) % count);
  }

  // Autoplay
  useEffect(() => {
    if (count <= 1 || paused || reducedMotion.current) return;
    const id = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const cur = Math.round(el.scrollLeft / el.offsetWidth);
      const nextIdx = (cur + 1) % count;
      el.scrollTo({ left: nextIdx * el.offsetWidth, behavior: 'smooth' });
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count, paused]);

  // IntersectionObserver — pausa cuando el carrusel sale del viewport
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || count <= 1) return;
    const obs = new IntersectionObserver(
      ([entry]) => setOutOfView(!entry.isIntersecting),
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [count]);

  // Pausa cuando la pestaña está oculta
  useEffect(() => {
    if (count <= 1) return;
    const handle = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [count]);

  // Si count cae y el índice queda fuera de rango, volver a 0
  useEffect(() => {
    if (count > 0 && activeIndex >= count) {
      scrollToIndex(0, 'auto');
      setActiveIndex(0);
    }
  }, [count, activeIndex]);

  // Limpieza del timer al desmontar
  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  return { scrollRef, activeIndex, goTo, next, prev, handleScroll, pauseTemporarily };
}
