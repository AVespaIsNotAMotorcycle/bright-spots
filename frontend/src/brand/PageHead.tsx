// One header for every tab, so each page opens the same way.
import type { ReactNode } from "react";

export default function PageHead({ eyebrow, title, lead, children }: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Extra row under the lead (filters, moods, a rank bar). */
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      {eyebrow && <div className="section-title">{eyebrow}</div>}
      <h1 className="page-title">{title}</h1>
      {lead && <p className="page-lead">{lead}</p>}
      {children && <div className="page-extra">{children}</div>}
    </header>
  );
}
