import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/instrument-sans/index.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import 'chessground/assets/chessground.base.css';
import './ui/styles/tokens.css';
import './ui/styles/board.css';
import { injectPieceTheme } from './ui/styles/pieceTheme';
import { observarOcioParaActualizar } from './ui/pwaIdle';
import App from './App';

injectPieceTheme();
// La versión nueva del service worker entra cuando no hay nada en curso, no a
// mitad de un bloque (ver ui/pwaUpdate.ts).
observarOcioParaActualizar();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
