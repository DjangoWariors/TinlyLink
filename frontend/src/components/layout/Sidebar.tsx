import { Link, useLocation } from 'react-router';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Link2,
  QrCode,
  BarChart3,
  FolderKanban,
  Settings,
  Key,
  Globe,
  Zap,
  X,
  GitBranch,
  Package,
  Target,
  LayoutList,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressBar } from '@/components/common';
import { TeamSwitcher } from './TeamSwitcher';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { subscription, usage } = useAuth();

  const mainNavItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/dashboard/links', icon: Link2, label: 'My Links' },
    { href: '/dashboard/qr-codes', icon: QrCode, label: 'QR Codes' },
  ];

  const marketingNavItems = [
    { href: '/dashboard/utm-builder', icon: Zap, label: 'UTM Builder' },
    { href: '/dashboard/campaigns', icon: FolderKanban, label: 'Campaigns' },
    { href: '/dashboard/rules', icon: GitBranch, label: 'Smart Rules' },
    { href: '/dashboard/pixels', icon: Target, label: 'Pixels' },
    { href: '/dashboard/bio', icon: LayoutList, label: 'Bio Pages' },
    { href: '/dashboard/pages', icon: FileText, label: 'Landing Pages' },
    { href: '/dashboard/serial-batches', icon: Package, label: 'Serial Batches' },
    { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  ];

  const accountNavItems = [
    { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
    { href: '/dashboard/domains', icon: Globe, label: 'Domains' },
    { href: '/dashboard/api-keys', icon: Key, label: 'API Keys' },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(href);
  };

  const linksLimit = subscription?.limits?.links_per_month || 50;
  const linksUsed = usage?.links_created || 0;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col',
          'transform transition-transform duration-300 ease-in-out',
          'lg:transform-none',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 flex-shrink-0">
          <Link to="/dashboard" className="text-xl font-bold text-secondary">
            Tinly<span className="text-primary">Link</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Team Switcher */}
        <div className="px-3 py-3 border-b border-gray-100">
          <TeamSwitcher />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {/* Main */}
          <div className="px-3 mb-6">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mb-1 transition-colors relative',
                  isActive(item.href)
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {isActive(item.href) && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Marketing */}
          <div className="px-3 mb-6">
            <p className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Marketing
            </p>
            {marketingNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mb-1 transition-colors relative',
                  isActive(item.href)
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {isActive(item.href) && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Account */}
          <div className="px-3 mb-6">
            <p className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Account
            </p>
            {accountNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mb-1 transition-colors relative',
                  isActive(item.href)
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {isActive(item.href) && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Usage Card */}
        <div className="p-3 flex-shrink-0 border-t border-gray-100">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Links Used</span>
              <span className="text-sm text-gray-500">{linksUsed}/{linksLimit.toLocaleString()}</span>
            </div>
            <ProgressBar value={linksUsed} max={linksLimit} size="sm" />
            {subscription?.plan === 'free' && (
              <Link
                to="/dashboard/settings?tab=billing"
                className="mt-3 block w-full text-center py-2 text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
              >
                Upgrade to Pro →
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
