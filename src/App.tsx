// Shell de la app: 4 destinos (Hoy / Jugar / Cálculo / Panel). Layouts
// responsive del design system §4: nav inferior en celular, lateral fina en
// escritorio. El cambio de orientación re-acomoda sin recargar ni perder
// estado (RNF-1). "Cálculo" (E7, RF-7.1) se suma en Fase 4: su patrón de
// interacción (línea completa sin mover el tablero) no encaja como submodo
// de otra pantalla, así que pasa a ser su propio destino.
import { useState } from 'react';
import { HoyScreen } from './ui/screens/HoyScreen';
import { JugarScreen } from './ui/screens/JugarScreen';
import { CalculoScreen } from './ui/screens/CalculoScreen';
import { PanelScreen } from './ui/screens/PanelScreen';
import { t } from './ui/i18n/es';

type Tab = 'hoy' | 'jugar' | 'calculo' | 'panel';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'hoy', label: t.nav.hoy },
  { id: 'jugar', label: t.nav.jugar },
  { id: 'calculo', label: t.nav.calculo },
  { id: 'panel', label: t.nav.panel },
];

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
      className={active ? 'text-accent' : 'text-tertiary'}
    >
      <path d={NAV_ICON_PATHS[tab]} />
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('hoy');

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Navegación lateral fina (escritorio) */}
      <nav className="hidden shrink-0 flex-col gap-1 border-r border-subtle p-2 lg:flex lg:w-36">
        <span className="px-3 py-2 font-display text-lg text-accent">{t.app.nombre}</span>
        {TABS.map((item) => (
          <NavButton key={item.id} tab={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </NavButton>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
        {tab === 'hoy' && <HoyScreen />}
        {tab === 'jugar' && <JugarScreen />}
        {tab === 'calculo' && <CalculoScreen />}
        {tab === 'panel' && <PanelScreen />}
      </main>

      {/* Navegación inferior de 4 ítems (celular/tablet), targets ≥44 px */}
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-subtle bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] font-semibold transition-colors duration-[120ms] ${
              tab === item.id ? 'text-accent' : 'text-tertiary'
            }`}
          >
            <NavIcon tab={item.id} active={tab === item.id} />
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
