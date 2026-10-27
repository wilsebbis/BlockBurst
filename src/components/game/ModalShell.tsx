import { useEffect, useRef, type ReactNode } from 'react';

/** A bottom sheet on phones (thumb zone), a centred card on wider screens. Focus moves into it. */
export function ModalShell({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[autofocus], button')?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-night-950/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center" role="dialog" aria-modal="true" aria-label={label}>
      <div ref={ref} className="pop-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-blob border-[3px] border-night-950 bg-night-800 p-5 text-white shadow-chunky">
        {children}
      </div>
    </div>
  );
}
