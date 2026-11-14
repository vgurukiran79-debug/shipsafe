import {
  FileCheck2,
  FileText,
  History,
  LayoutDashboard,
  Lock,
  ScanSearch,
  Settings,
  Shield,
  ShieldAlert,
  X,
} from 'lucide-react';
import { PageId } from '../types/scanner';

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  hasActiveScan: boolean;
  hasSelectedFinding: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: PageId;
  label: string;
  Icon: typeof LayoutDashboard;
  disabled?: boolean;
}

export function Sidebar({
  activePage,
  onNavigate,
  hasActiveScan,
  hasSelectedFinding,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'scan', label: 'New Security Scan', Icon: ScanSearch },
    {
      id: 'results',
      label: 'Scan Results',
      Icon: FileCheck2,
      disabled: !hasActiveScan,
    },
    {
      id: 'details',
      label: 'Vulnerability Details',
      Icon: ShieldAlert,
      disabled: !hasSelectedFinding,
    },
    { id: 'history', label: 'Scan History', Icon: History },
    { id: 'reports', label: 'Security Reports', Icon: FileText },
    { id: 'settings', label: 'Settings & About', Icon: Settings },
  ];

  const handleSelect = (item: NavItem) => {
    if (item.disabled) return;
    onNavigate(item.id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#080E1E] border-r border-slate-800/80 w-64">
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-800/80 shrink-0">
        <button
          type="button"
          onClick={() => {
            onNavigate('dashboard');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-md"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap">
            ShipSafe
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-100 rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Primary navigation">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          const Icon = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              disabled={item.disabled}
              title={
                item.disabled
                  ? item.id === 'results'
                    ? 'Run or open a scan first'
                    : 'Select a vulnerability from Scan Results first'
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap text-left ${
                isActive
                  ? 'bg-cyan-500/12 text-cyan-300 border border-cyan-500/25'
                  : item.disabled
                    ? 'text-slate-600 cursor-not-allowed border border-transparent'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive
                    ? 'text-cyan-400'
                    : item.disabled
                      ? 'text-slate-600'
                      : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800/80 shrink-0">
        <div className="flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
          <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            Your source code is processed locally in your browser. ShipSafe does not send project files to an external AI service.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
