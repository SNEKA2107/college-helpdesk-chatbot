import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Page entrance + scroll reveal animations, matching the legacy app.js behaviour. */
export function usePageAnimations() {
  useEffect(() => {
    const ctx = gsap.context(() => {
      const reveals = document.querySelectorAll('.reveal');
      if (reveals.length) {
        gsap.to(reveals, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, delay: 0.1 });
      }
      document.querySelectorAll('.card, .stat-card, .step-row, table').forEach(el => {
        if (el.classList.contains('reveal')) return;
        gsap.fromTo(el,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true } },
        );
      });
      gsap.fromTo('.nav-link',
        { opacity: 0, x: -12 },
        { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out', stagger: 0.04, delay: 0.2 },
      );
    });
    return () => ctx.revert();
  }, []);
}
