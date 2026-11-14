import {
  ChevronLeft,
  ChevronRight,
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
import { useState } from 'react';
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
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

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

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const collapsed = !isMobileDrawer && desktopCollapsed;

    return (
      <div
        className={`flex h-full flex-col bg-[#080E1E] border-r border-slate-800/80 transition-[width] duration-200 ease-out ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {/* Brand header */}
        <div
          className={`flex items-center h-16 border-b border-slate-800/80 shrink-0 ${
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              onNavigate('dashboard');
              onCloseMobile();
            }}
            title="ShipSafe Dashboard"
            className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-lg p-1 cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-violet-500/15 border border-cyan-500/30 text-cyan-400 shrink-0 shadow-[0_0_20px_-6px_rgba(6,182,212,0.5)]">
              <Shield className="w-4 h-4" aria-hidden="true" />
            </div>
            {!collapsed && (
              <span className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap">
                ShipSafe
              </span>
            )}
          </button>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            !collapsed && (
              <button
                type="button"
                onClick={() => setDesktopCollapsed(true)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* Navigation links */}
        <nav
          className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto"
          aria-label="Primary navigation"
        >
          {collapsed && (
            <button
              type="button"
              onClick={() => setDesktopCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="w-full flex items-center justify-center py-2 mb-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {navItems.map((item) => {
            const isActive = activePage === item.id;
            const Icon = item.Icon;
            const disabledTitle =
              item.id === 'results'
                ? 'Run or open a scan first'
                : 'Select a vulnerability from Scan Results first';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                aria-current={isActive ? 'page' : undefined}
                title={
                  item.disabled
                    ? disabledTitle
                    : collapsed
                      ? item.label
                      : undefined
                }
                className={`group w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5 text-left'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-200 border border-cyan-500/30 shadow-[0_0_18px_-8px_rgba(6,182,212,0.55)]'
                    : item.disabled
                      ? 'text-slate-600 cursor-not-allowed border border-transparent'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent cursor-pointer'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors duration-150 ${
                    isActive
                      ? 'text-cyan-400'
                      : item.disabled
                        ? 'text-slate-600'
                        : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                  aria-hidden="true"
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Local-first privacy guarantee footer */}
        <div
          className={`border-t border-slate-800/80 shrink-0 ${
            collapsed ? 'p-3 flex justify-center' : 'p-4'
          }`}
        >
          {collapsed ? (
            <div
              title="Local-first execution: all scanning happens strictly in your browser."
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/80 border border-slate-800 text-cyan-400"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
          ) : (
            <div className="flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
              <Lock
                className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p>
                Your source code stays in your browser. Zero server uploads and zero external AI calls.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">
        {renderSidebarBody(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{renderSidebarBody(true)}</div>
        </div>
      )}
    </>
  );
}
