import React from 'react';

type IconProps = { size?: number; className?: string; style?: React.CSSProperties };
const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 16, className = '', style, children
}) => (
  <svg
    width={size} height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const MenuIcon: React.FC<IconProps> = (p) => <Icon {...p}><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></Icon>;
export const ChevronLeftIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="m15 18-6-6 6-6"/></Icon>;
export const ChevronRightIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="m9 18 6-6-6-6"/></Icon>;
export const ChevronUpIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="m18 15-6-6-6 6"/></Icon>;
export const ChevronDownIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>;
export const GripVerticalIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></Icon>;
export const XIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Icon>;
export const SearchIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></Icon>;
export const UserPlusIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></Icon>;
export const GitBranchIcon: React.FC<IconProps> = (p) => <Icon {...p}><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></Icon>;
export const BarChart2Icon: React.FC<IconProps> = (p) => <Icon {...p}><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></Icon>;
export const DownloadIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></Icon>;
export const UploadIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></Icon>;
export const ImageIcon: React.FC<IconProps> = (p) => <Icon {...p}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></Icon>;
export const FileTextIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></Icon>;
export const Trash2Icon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></Icon>;
export const PencilIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></Icon>;
export const HeartIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 1.5C10.5 3.5 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></Icon>;
export const MoreVerticalIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></Icon>;
export const EyeIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></Icon>;
export const EyeOffIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></Icon>;
export const UsersIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Icon>;
export const UserIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>;
export const ActivityIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Icon>;
export const RotateCcwIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></Icon>;
export const Undo2Icon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></Icon>;
export const Redo2Icon: React.FC<IconProps> = (p) => <Icon {...p}><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/></Icon>;
export const AlertCircleIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></Icon>;
export const AlertTriangleIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></Icon>;
export const ArrowUpIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></Icon>;
export const ArrowDownIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="m19 12-7 7-7-7"/><path d="M12 5v14"/></Icon>;
export const ArrowRightIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></Icon>;
export const BabyIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6 9 9 0 0 1 2.5-4L7 5"/><path d="M12 3c-1 2-2 3.5-2 5"/><path d="M12 3c1 2 2 3.5 2 5"/></Icon>;
export const Loader2Icon: React.FC<IconProps> = (p) => <Icon {...p} className={`icon-spin${p.className ? ' ' + p.className : ''}`}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></Icon>;
export const SlidersHorizontalIcon: React.FC<IconProps> = (p) => <Icon {...p}><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></Icon>;
export const Maximize2Icon: React.FC<IconProps> = (p) => <Icon {...p}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></Icon>;
export const CalendarIcon: React.FC<IconProps> = (p) => <Icon {...p}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></Icon>;
export const ClockIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Icon>;
export const LayersIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></Icon>;
export const MapPinIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></Icon>;
export const BriefcaseIcon: React.FC<IconProps> = (p) => <Icon {...p}><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></Icon>;
export const TrophyIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></Icon>;
export const MaleIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="10" cy="14" r="5"/><path d="M19 5h-4m4 0v4m0-4-7.06 7.06"/></Icon>;
export const FemaleIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="8" r="5"/><line x1="12" x2="12" y1="13" y2="21"/><line x1="9" x2="15" y1="19" y2="19"/></Icon>;
export const SunIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></Icon>;
export const MoonIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></Icon>;
export const ScrollIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 3H8.5a2.5 2.5 0 0 0 0 5H11v4"/></Icon>;
export const LeafIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></Icon>;
export const WavesIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></Icon>;
export const SunriseIcon: React.FC<IconProps> = (p) => <Icon {...p}><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></Icon>;
export const FocusIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></Icon>;
export const HelpCircleIcon: React.FC<IconProps> = (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/></Icon>;
