import type { ReactNode } from 'react';

/** Where a panel's figures come from, folded away under the HMI so the panel itself stays clean. */
export function DataNote({ children }: { children: ReactNode }) {
  return (
    <details className="group rounded-sm text-[10px] leading-snug text-[#8fa3b3]">
      <summary className="cursor-pointer select-none py-0.5 text-[#9fb3c2] marker:text-[#5f7383]">Data sources</summary>
      <p className="mt-1">{children}</p>
    </details>
  );
}
