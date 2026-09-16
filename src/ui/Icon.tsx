// One authored stroke set (16px grid, 1.5 stroke) shared by StatusPill and Notice.
const PATHS = {
  check: 'M3.5 8.5l3 3 6-7',
  clock: 'M8 4.5V8l2.5 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0',
  box: 'M2.5 5L8 2.5 13.5 5v6L8 13.5 2.5 11zM2.5 5L8 7.5 13.5 5M8 7.5v6',
  home: 'M2.5 7.5L8 3l5.5 4.5M4 6.5v6.5h8V6.5',
  flag: 'M3.5 14V2.5M3.5 3h8l-2 3 2 3h-8',
  cross: 'M4 4l8 8M12 4l-8 8',
  undo: 'M5.5 3.5L2.5 6.5l3 3M2.5 6.5H10a3.5 3.5 0 0 1 0 7H6',
  eye: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  question:
    'M6 6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M8 11.8v.2M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0',
  alert: 'M8 2.5l6 11H2zM8 7v3M8 11.8v.2',
  info: 'M8 7.5v4M8 5v.2M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0',
  dash: 'M4 8h8',
  hollow: 'M11 8A3 3 0 1 1 5 8a3 3 0 0 1 6 0',
} as const

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  className = 'size-3.5',
}: {
  name: IconName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
