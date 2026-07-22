/** Reserva exactamente la huella responsive del tablero mientras motor o
 * catálogo se preparan. La cuadrícula es decorativa; el estado se anuncia en
 * el panel hermano. */
export function BoardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`board-stage mx-auto grid aspect-square w-full min-w-[320px] max-w-[640px] grid-cols-8 overflow-hidden rounded-sm border border-subtle sm:mx-0 sm:w-[60%] ${className}`}
    >
      {Array.from({ length: 64 }, (_, index) => (
        <span key={index} className={(Math.floor(index / 8) + index) % 2 === 0 ? 'bg-surface' : 'bg-elevated'} />
      ))}
    </div>
  );
}
