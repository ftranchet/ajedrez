// Inyecta las reglas CSS de las piezas Staunty con URLs relativas a la base
// de despliegue. En CSS estático `url('/piece/…')` se rompe cuando la app se
// sirve desde un subpath (p. ej. GitHub Pages en /ajedrez/).

const PIECES: Array<[cssName: string, letter: string]> = [
  ['pawn', 'P'],
  ['knight', 'N'],
  ['bishop', 'B'],
  ['rook', 'R'],
  ['queen', 'Q'],
  ['king', 'K'],
];

/** URL de un SVG de pieza (p. ej. pieceUrl('w', 'Q')), respetando la base. */
export function pieceUrl(color: 'w' | 'b', letter: string): string {
  return `${import.meta.env.BASE_URL}piece/staunty/${color}${letter}.svg`;
}

export function injectPieceTheme(): void {
  const rules = PIECES.flatMap(([name, letter]) => [
    `.cg-wrap piece.${name}.white { background-image: url('${pieceUrl('w', letter)}'); }`,
    `.cg-wrap piece.${name}.black { background-image: url('${pieceUrl('b', letter)}'); }`,
  ]);
  const style = document.createElement('style');
  style.setAttribute('data-piece-theme', 'staunty');
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}
