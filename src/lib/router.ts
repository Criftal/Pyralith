import { useEffect, useState } from 'react';

export const ROUTES = ['/', '/mission', '/investigations', '/gap', '/rank', '/export', '/next', '/ask'] as const;
export type Route = (typeof ROUTES)[number];

export function parseHash(hash: string): Route | null {
  const path = hash.replace(/^#/, '').split('?')[0] || '/';
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : null;
}

export function useRoute(): Route | null {
  const [route, setRoute] = useState<Route | null>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(to: Route): void {
  window.location.hash = to;
}

export const href = (to: Route): string => `#${to}`;
