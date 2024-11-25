import { createEffect } from 'solid-js';

export function useAutoFocusOnVisible(elementRef: HTMLElement | null) {
  createEffect(() => {
    const element = elementRef;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            element.focus();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  });
}
