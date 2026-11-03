import type { ReactNode, SVGProps } from 'react';

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = () => (
  <Icon>
    <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />
  </Icon>
);
export const PauseIcon = () => (
  <Icon>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
  </Icon>
);
export const StopIcon = () => (
  <Icon>
    <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
  </Icon>
);
export const UndoIcon = () => (
  <Icon>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);
export const RedoIcon = () => (
  <Icon>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Icon>
);
export const FileIcon = () => (
  <Icon>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Icon>
);
export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);
export const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Icon>
);
export const KeyboardIcon = () => (
  <Icon>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9" />
  </Icon>
);
export const InstrumentsIcon = () => (
  <Icon>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </Icon>
);
export const PencilIcon = () => (
  <Icon>
    <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
  </Icon>
);
export const PointerIcon = () => (
  <Icon>
    <path d="M4 3l7 17 2.5-7.5L21 10z" />
  </Icon>
);
export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const TrashIcon = () => (
  <Icon>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </Icon>
);
export const ChevronUpIcon = () => (
  <Icon>
    <path d="m6 15 6-6 6 6" />
  </Icon>
);
export const ChevronDownIcon = () => (
  <Icon>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const CloseIcon = () => (
  <Icon>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);
export const EraseIcon = () => (
  <Icon>
    <path d="M20 20H8.5L3.6 15.1a2 2 0 0 1 0-2.8L12.3 3.6a2 2 0 0 1 2.8 0l5.3 5.3a2 2 0 0 1 0 2.8L12 20" />
    <path d="m9 9 7 7" />
  </Icon>
);
export const TieIcon = () => (
  <Icon>
    <path d="M3 10c4 6 14 6 18 0" />
    <path d="M3 10c4 4 14 4 18 0" fill="currentColor" stroke="none" />
  </Icon>
);
export const MeasurePlusIcon = () => (
  <Icon>
    <path d="M3 5v14M14 5v14M3 8h11M3 12h11M3 16h11" strokeWidth="1.5" />
    <path d="M19 9v6M16 12h6" />
  </Icon>
);
export const MeasureMinusIcon = () => (
  <Icon>
    <path d="M3 5v14M14 5v14M3 8h11M3 12h11M3 16h11" strokeWidth="1.5" />
    <path d="M16 12h6" />
  </Icon>
);

/** The Clefhanger mark: a treble-clef-like hook hanging from a line. */
export const LogoMark = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
    <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--accent)" />
    <path d="M8 9h16" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" />
    <path
      d="M16 9v13.5a3.2 3.2 0 1 1-3.2-3.2c1.7 0 3.2 1.4 3.2 3.2"
      fill="none"
      stroke="var(--on-accent)"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);
