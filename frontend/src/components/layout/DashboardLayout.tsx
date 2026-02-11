import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { Menu, Search, Bell, ChevronDown, LogOut, User, Settings } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Dropdown, DropdownItem } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, subscription, logout } = useAuth();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/dashboard/links?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16 flex-shrink-0">
          <div className="flex items-center justify-between h-full px-4 sm:px-6">
            {/* Left */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              {/* Search */}
              <form onSubmit={handleSearch} className="hidden sm:block relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search links... (Enter to search)"
                  className="w-64 pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
                />
              </form>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
              {/* Plan Badge */}
              <button
                onClick={() => navigate('/dashboard/settings?tab=billing')}
                className="hidden sm:inline-flex px-3 py-1 text-xs font-semibold text-primary bg-primary-50 rounded-full capitalize hover:bg-primary-100 transition-colors cursor-pointer"
              >
                {subscription?.plan || 'Free'} Plan
              </button>

              {/* Notifications */}
              <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
              </button>

              {/* User Menu */}
              <Dropdown
                trigger={
                  <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
                      {user?.initials || user?.full_name?.charAt(0) || 'U'}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900">{user?.full_name || user?.display_name || 'User'}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <ChevronDown className="hidden sm:block w-4 h-4 text-gray-400" />
                  </button>
                }
              >
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.full_name || user?.display_name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <DropdownItem onClick={() => navigate('/dashboard/settings')}>
                  <User className="w-4 h-4" />
                  <span>Profile</span>
                </DropdownItem>
                <DropdownItem onClick={() => navigate('/dashboard/settings')}>
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </DropdownItem>
                <div className="border-t border-gray-100 my-1" />
                <DropdownItem onClick={handleLogout} danger>
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </DropdownItem>
              </Dropdown>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
