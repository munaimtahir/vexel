import {
  LayoutDashboard, UserPlus, FlaskConical, BarChart2, CheckSquare, FileText, Users, CreditCard, Stethoscope,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number; color?: string }>;
  featureFlag?: string; // only show if this flag is enabled
};

export const LIMS_NAV: NavItem[] = [
  { label: 'Worklist',         href: '/lims/worklist',          icon: LayoutDashboard },
  { label: 'New Registration', href: '/lims/registrations/new', icon: UserPlus },
  { label: 'Payments',         href: '/lims/payments',          icon: CreditCard },
  { label: 'Sample Collection',href: '/lims/sample-collection', icon: FlaskConical },
  { label: 'Results',          href: '/lims/results',           icon: BarChart2 },
  { label: 'Verification',     href: '/lims/verification',      icon: CheckSquare, featureFlag: 'lims.verification' },
  { label: 'Patients',         href: '/lims/patients',          icon: Users },
  { label: 'Reports',          href: '/lims/reports',           icon: FileText },
];

export const FUTURE_MODULES = [
  { label: 'Radiology',  disabled: true },
  { label: 'OPD',        disabled: true },
];
