import {
  LayoutDashboard, UserPlus, FlaskConical, BarChart2, CheckSquare, FileText, CreditCard, Stethoscope,
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
  { label: 'Sample Collection',href: '/lims/sample-collection', icon: FlaskConical },
  { label: 'Result Entry',     href: '/lims/results',           icon: BarChart2 },
  { label: 'Verification',     href: '/lims/verification',      icon: CheckSquare, featureFlag: 'lims.verification.enabled' },
  { label: 'Published Reports',href: '/lims/reports',           icon: FileText },
  { label: 'Payments',         href: '/lims/payments',          icon: CreditCard },
];

export const OPD_NAV: NavItem[] = [
  { label: 'OPD Worklist',      href: '/opd/worklist',          icon: Stethoscope, featureFlag: 'module.opd' },
  { label: 'New Appointment',   href: '/opd/appointments/new',  icon: UserPlus,    featureFlag: 'module.opd' },
  { label: 'OPD Billing',       href: '/opd/billing',           icon: CreditCard,  featureFlag: 'module.opd' },
];

export const FUTURE_MODULES = [
  { label: 'Radiology',  disabled: true },
  { label: 'OPD',        disabled: true },
];
