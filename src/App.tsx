// Shell de la app: 4 destinos (Hoy / Jugar / Cálculo / Panel) + Ajustes, que
// no es un tab sino un engranaje en el header (footer de la barra lateral en
// escritorio, barra superior en celular) para no diluir los cuatro destinos.
// Layouts responsive del design system §4: nav inferior en celular, lateral
// fina en escritorio. El cambio de orientación re-acomoda sin recargar ni
// perder estado (RNF-1).
import { useEffect, useRef, useState } from 'react';
import { HoyScreen } from './ui/screens/HoyScreen';
import { JugarScreen } from './ui/screens/JugarScreen';
import { CalculoScreen } from './ui/screens/CalculoScreen';
import { PanelScreen } from './ui/screens/PanelScreen';
import { AjustesScreen } from './ui/screens/AjustesScreen';
import { t } from './ui/i18n/es';

export type Tab = 'hoy' | 'jugar' | 'calculo' | 'panel';
export type Route = Tab | 'ajustes';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'hoy', label: t.nav.hoy },
  { id: 'jugar', label: t.nav.jugar },
  { id: 'calculo', label: t.nav.calculo },
  { id: 'panel', label: t.nav.panel },
];

const TAB_IDS = new Set<Tab>(TABS.map((tab) => tab.id));

export function tabFromHash(hash: string): Tab {
  const candidate = hash.replace(/^#\/?/, '').split('/')[0] as Tab;
  return TAB_IDS.has(candidate) ? candidate : 'hoy';
}

export function hashForTab(tab: Tab): string {
  return `#/${tab}`;
}

export function routeFromHash(hash: string): Route {
  const candidate = hash.replace(/^#\/?/, '').split('/')[0];
  return candidate === 'ajustes' ? 'ajustes' : tabFromHash(hash);
}

export function hashForRoute(route: Route): string {
  return `#/${route}`;
}

// Trazos de ícono por destino (prototipo docs/prototipos/sesion-de-hoy.dc.html):
// líneas simples, un solo <path>, sin relleno. "Cálculo" no tenía ícono en el
// prototipo (era una pestaña nueva); se agrega una línea quebrada como analogía
// de la línea de jugadas que se declara en E7.
const NAV_ICON_PATHS: Record<Tab, string> = {
  hoy: 'M12 3l8 7v10h-5v-6h-6v6H4V10z',
  jugar: 'M8 5v14l11-7z',
  calculo: 'M4 17l5-5 3 3 8-8',
  panel: 'M4 19V9m6 10V5m6 14v-8',
};

function NavIcon({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={active ? 'text-accent' : 'text-secondary'}
    >
      <path d={NAV_ICON_PATHS[tab]} />
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={active ? 'text-accent' : 'text-secondary'}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));
  const mainRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const onLocationChange = () => setRoute(routeFromHash(window.location.hash));
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    return () => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      const heading = mainRef.current?.querySelector<HTMLElement>('h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      } else {
        mainRef.current?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route]);

  function navigate(next: Route) {
    if (next === route) {
      mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    window.history.pushState(null, '', hashForRoute(next));
    setRoute(next);
  }

  const ajustesActivo = route === 'ajustes';

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Barra superior solo en celular: identidad + acceso a Ajustes (el
          engranaje que en escritorio vive en el pie de la barra lateral). */}
      <header className="flex shrink-0 items-center justify-between border-b border-subtle px-4 py-2 lg:hidden">
        <span className="font-display text-lg text-accent">{t.app.nombre}</span>
        <button
          type="button"
          onClick={() => navigate('ajustes')}
          aria-current={ajustesActivo ? 'page' : undefined}
          aria-label={t.nav.ajustes}
          className={`flex min-h-11 min-w-11 items-center justify-center rounded-md transition-colors duration-[120ms] ${
            ajustesActivo ? 'bg-accent-subtle' : 'hover:bg-elevated'
          }`}
        >
          <GearIcon active={ajustesActivo} />
        </button>
      </header>

      {/* Navegación lateral fina (escritorio) */}
      <nav aria-label={t.nav.principal} className="hidden shrink-0 flex-col gap-1 border-r border-subtle p-2 lg:flex lg:w-36">
        <span className="px-3 py-2 font-display text-lg text-accent">{t.app.nombre}</span>
        {TABS.map((item) => (
          <NavButton key={item.id} tab={item.id} active={route === item.id} onClick={() => navigate(item.id)}>
            {item.label}
          </NavButton>
        ))}
        <button
          type="button"
          onClick={() => navigate('ajustes')}
          aria-current={ajustesActivo ? 'page' : undefined}
          aria-label={t.nav.ajustes}
          className={`mt-auto flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-[120ms] ${
            ajustesActivo ? 'bg-accent-subtle text-primary' : 'text-secondary hover:bg-elevated'
          }`}
        >
          <GearIcon active={ajustesActivo} />
          {t.nav.ajustes}
        </button>
      </nav>

      <main ref={mainRef} tabIndex={-1} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 pb-24 focus:outline-none lg:pb-4">
        {route === 'hoy' && <HoyScreen />}
        {route === 'jugar' && <JugarScreen />}
        {route === 'calculo' && <CalculoScreen />}
        {route === 'panel' && <PanelScreen />}
        {route === 'ajustes' && <AjustesScreen />}
      </main>

      {/* Navegación inferior de 4 ítems (celular/tablet), targets ≥44 px */}
      <nav aria-label={t.nav.principal} className="fixed inset-x-0 bottom-0 z-20 flex border-t border-subtle bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            aria-current={route === item.id ? 'page' : undefined}
            className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-semibold transition-colors duration-[120ms] ${
              route === item.id
                ? 'bg-accent-subtle text-primary before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:rounded-full before:bg-accent'
                : 'text-secondary hover:bg-elevated'
            }`}
          >
            <NavIcon tab={item.id} active={route === item.id} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function NavButton({
  tab,
  active,
  onClick,
  children,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-[120ms] ${
        active ? 'bg-accent-subtle text-primary' : 'text-secondary hover:bg-elevated'
      }`}
    >
      <NavIcon tab={tab} active={active} />
      {children}
    </button>
  );
}
