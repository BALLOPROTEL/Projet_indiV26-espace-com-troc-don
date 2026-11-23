import type { ReactNode } from 'react';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'pm-brand-mark is-compact' : 'pm-brand-mark'} aria-hidden="true">
      <svg viewBox="0 0 34 34" fill="none">
        <path d="M4 16 17 5 30 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 14v16h18V14" stroke="currentColor" strokeWidth="2.7" strokeLinejoin="round" />
        <path d="M14 30v-9a3 3 0 0 1 6 0v9" stroke="#F28C45" strokeWidth="2.7" />
        <rect x="10" y="16" width="3" height="4" rx="1" fill="#20AFA3" />
        <rect x="22" y="16" width="3" height="4" rx="1" fill="#20AFA3" />
      </svg>
    </span>
  );
}

export function RoadmapBadge({
  children = 'En préparation',
  tone = 'orange',
}: {
  children?: ReactNode;
  tone?: 'orange' | 'teal' | 'navy';
}) {
  return <span className={'pm-roadmap-badge pm-roadmap-badge--' + tone}>{children}</span>;
}

export function SectionHeading({
  eyebrow,
  title,
  titleId,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  titleId?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pm-section-heading">
      <div>
        {eyebrow ? <span className="pm-overline">{eyebrow}</span> : null}
        <h2 id={titleId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="pm-section-heading__action">{action}</div> : null}
    </div>
  );
}
