export function SectionHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`m-0 text-sm font-medium tracking-wider text-secondary uppercase ${className}`}>
      {children}
    </h2>
  );
}
