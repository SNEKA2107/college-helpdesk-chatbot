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
      /* The sidebar is deliberately NOT animated here. Every page renders its
         own <Layout>, so navigating remounts the shell and re-ran this tween:
         the outgoing page's ctx.revert() would kill the incoming page's
         in-flight tween, stranding .nav-link at whatever opacity it had
         reached (measured in the browser: 0.33, 0.08, 0.007, then 0 for the
         rest) with no tween left to finish it. The nav then stayed invisible
         until a full reload. Sidebar links are persistent chrome, not page
         content, so they should not re-enter on every navigation. */
    });
    return () => ctx.revert();
  }, []);
}
