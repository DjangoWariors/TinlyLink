import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  User, Lock, CreditCard, Bell, Trash2, Check, AlertTriangle,
  Mail, Download, Link2, Zap, Shield, Globe, Smartphone, LogOut, Monitor,
  Eye, EyeOff
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Badge, Modal, ProgressBar, Loading } from '@/components/common';
import { accountAPI, billingAPI, downloadBlob, getErrorMessage } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS, PLAN_PRICING } from '@/config';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'security' | 'billing' | 'notifications' | 'data' | 'integrations';

interface NotificationSettings {
  weekly_report: boolean;
  usage_warning: boolean;
  marketing: boolean;
  link_alerts: boolean;
  security_alerts: boolean;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, subscription, refreshUser, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read tab from URL or default to 'profile'
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const validTabs: Tab[] = ['profile', 'security', 'billing', 'notifications', 'data', 'integrations'];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'profile';

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Handle redirect from Stripe checkout
  const hasHandledCheckout = useRef(false);
  useEffect(() => {
    if (hasHandledCheckout.current) return;
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      hasHandledCheckout.current = true;
      setActiveTab('billing');
      toast.success('Payment successful! Updating your plan...');

      // Poll refreshUser until the subscription plan changes from free,
      // or give up after several attempts (webhook may be delayed).
      const initialPlan = subscription?.plan || 'free';
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await refreshUser();
        // Stop polling once the plan has changed or after 10 tries
        if (subscription?.plan !== initialPlan) {
          clearInterval(poll);
          toast.success('Your plan has been upgraded!');
        } else if (attempts >= 10) {
          clearInterval(poll);
          toast('Plan update may take a moment. Refresh the page if your plan hasn\'t changed.', { icon: 'ℹ️' });
        }
      }, 2000);

      // Clean up query params so a page refresh doesn't re-trigger
      setSearchParams({ tab: 'billing' }, { replace: true });

      return () => clearInterval(poll);
    }

    if (canceled === 'true') {
      hasHandledCheckout.current = true;
      setActiveTab('billing');
      toast('Checkout canceled', { icon: '↩' });
      setSearchParams({ tab: 'billing' }, { replace: true });
    }
  }, [searchParams, refreshUser, setSearchParams]);

  // Sync tab changes to URL
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const [notifications, setNotifications] = useState<NotificationSettings>({
    weekly_report: true,
    usage_warning: true,
    marketing: false,
    link_alerts: true,
    security_alerts: true,
  });

  // Fetch notification settings from API
  const { data: notificationData, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: () => accountAPI.getNotificationSettings(),
    enabled: activeTab === 'notifications',
  });

  // Sync fetched notification settings to local state
  useEffect(() => {
    if (notificationData) {
      setNotifications(notificationData);
    }
  }, [notificationData]);

  // Fetch sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => accountAPI.getSessions(),
    enabled: activeTab === 'security',
  });

  // Fetch integrations
  const { data: integrations, isLoading: integrationsLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => accountAPI.getIntegrations(),
    enabled: activeTab === 'integrations',
  });

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: (id: string) => accountAPI.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session revoked', { id: 'session-revoke' });
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'session-revoke' }),
  });

  // Revoke all sessions mutation
  const revokeAllSessionsMutation = useMutation({
    mutationFn: () => accountAPI.revokeAllSessions(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success(`Signed out of ${data.revoked} other session(s)`, { id: 'sessions-revoke-all' });
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'sessions-revoke-all' }),
  });

  // Connect integration mutation
  const connectIntegrationMutation = useMutation({
    mutationFn: (provider: string) => accountAPI.connectIntegration(provider),
    onSuccess: (data) => {
      window.location.href = data.authorization_url;
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'integration-connect' }),
  });

  // Disconnect integration mutation
  const disconnectIntegrationMutation = useMutation({
    mutationFn: (provider: string) => accountAPI.disconnectIntegration(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration disconnected', { id: 'integration-disconnect' });
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'integration-disconnect' }),
  });

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'security' as Tab, label: 'Security', icon: Lock },
    { id: 'billing' as Tab, label: 'Billing', icon: CreditCard },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    { id: 'data' as Tab, label: 'Data & Privacy', icon: Shield },
    { id: 'integrations' as Tab, label: 'Integrations', icon: Zap },
  ];

  const profileForm = useForm({
    defaultValues: { full_name: user?.full_name || '', company: user?.company || '' },
  });

  const passwordForm = useForm({
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { full_name?: string; company?: string }) => accountAPI.updateProfile(data),
    onSuccess: () => { refreshUser(); toast.success('Profile updated', { id: 'profile-update' }); },
    onError: (error) => { toast.error(getErrorMessage(error), { id: 'profile-update' }); },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      accountAPI.changePassword(data),
    onSuccess: () => { passwordForm.reset(); toast.success('Password changed'); },
    onError: (e: any) => { toast.error(e.response?.data?.error || 'Failed to change password'); },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (password: string) => accountAPI.deleteAccount(password),
    onSuccess: () => { toast.success('Account scheduled for deletion'); logout(); },
    onError: (e: any) => { toast.error(e.response?.data?.error || 'Failed to delete account'); },
  });

  const handleProfileSubmit = (data: any) => updateProfileMutation.mutate(data);

  const handlePasswordSubmit = (data: any) => {
    if (data.new_password !== data.confirm_password) {
      toast.error('Passwords do not match'); return;
    }
    changePasswordMutation.mutate({ current_password: data.current_password, new_password: data.new_password });
  };

  const handleUpgrade = async (plan: 'pro' | 'business' | 'enterprise') => {
    try {
      const { checkout_url } = await billingAPI.createCheckoutSession(plan);
      window.location.href = checkout_url;
    } catch (err) { toast.error(getErrorMessage(err), { id: 'checkout' }); }
  };

  const handleManageBilling = async () => {
    try {
      const { portal_url } = await billingAPI.createPortalSession();
      window.location.href = portal_url;
    } catch (err) { toast.error(getErrorMessage(err), { id: 'billing-portal' }); }
  };

  const handleExportData = async (type: 'links' | 'analytics' | 'all') => {
    setExportLoading(type);
    try {
      const blob = await accountAPI.exportUserData(type);
      downloadBlob(blob, `tinlylink-${type}-export.zip`);
      toast.success('Data exported successfully', { id: 'data-export' });
    } catch (err) { toast.error(getErrorMessage(err), { id: 'data-export' }); }
    finally { setExportLoading(null); }
  };

  const handleSaveNotifications = async () => {
    try {
      await accountAPI.updateNotificationSettings(notifications);
      toast.success('Notification preferences saved', { id: 'notifications-save' });
    } catch (err) { toast.error(getErrorMessage(err), { id: 'notifications-save' }); }
  };

  // Fetch real usage data from API
  const { data: usageData } = useQuery({
    queryKey: ['usage'],
    queryFn: () => accountAPI.getUsage(),
    enabled: activeTab === 'billing',
  });

  const usageLimits = usageData ? {
    links: { used: usageData.links.used, limit: usageData.links.limit },
    qr: { used: usageData.qr_codes.used, limit: usageData.qr_codes.limit },
  } : {
    links: { used: 0, limit: subscription?.limits?.links_per_month ?? 50 },
    qr: { used: 0, limit: subscription?.limits?.qr_codes_per_month ?? 10 },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-52 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                  activeTab === tab.id ? 'bg-primary-50 text-primary' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 space-y-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal information</CardDescription>
                </CardHeader>
                <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                  <Input label="Email" value={user?.email || ''} disabled hint="Email cannot be changed" />
                  <Input label="Full Name" {...profileForm.register('full_name')} />
                  <Input label="Company" {...profileForm.register('company')} />
                  <div className="flex justify-end">
                    <Button type="submit" isLoading={updateProfileMutation.isPending}>Save Changes</Button>
                  </div>
                </form>
              </Card>
              <Card className="border-danger/20">
                <CardHeader>
                  <div className="flex items-center gap-2 text-danger">
                    <AlertTriangle className="w-5 h-5" />
                    <CardTitle className="text-danger">Danger Zone</CardTitle>
                  </div>
                  <CardDescription>Permanently delete your account and all data</CardDescription>
                </CardHeader>
                <Button variant="danger" onClick={() => setDeleteModalOpen(true)} leftIcon={<Trash2 className="w-4 h-4" />}>
                  Delete Account
                </Button>
              </Card>
            </>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your password to keep your account secure</CardDescription>
                </CardHeader>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                  <Input
                    type={showCurrentPw ? 'text' : 'password'}
                    label="Current Password"
                    leftIcon={<Lock className="w-4 h-4" />}
                    rightIcon={
                      <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="text-gray-400 hover:text-gray-600 transition-colors" tabIndex={-1}>
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                    {...passwordForm.register('current_password')}
                  />
                  <Input
                    type={showNewPw ? 'text' : 'password'}
                    label="New Password"
                    hint="Minimum 8 characters"
                    leftIcon={<Lock className="w-4 h-4" />}
                    rightIcon={
                      <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="text-gray-400 hover:text-gray-600 transition-colors" tabIndex={-1}>
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                    {...passwordForm.register('new_password')}
                  />
                  <Input
                    type={showConfirmPw ? 'text' : 'password'}
                    label="Confirm New Password"
                    leftIcon={<Lock className="w-4 h-4" />}
                    rightIcon={
                      <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="text-gray-400 hover:text-gray-600 transition-colors" tabIndex={-1}>
                        {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                    {...passwordForm.register('confirm_password')}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" isLoading={changePasswordMutation.isPending}>Update Password</Button>
                  </div>
                </form>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>Manage your active sessions across devices</CardDescription>
                </CardHeader>
                {sessionsLoading ? (
                  <div className="py-8 flex justify-center"><Loading /></div>
                ) : (
                  <div className="space-y-3">
                    {sessions?.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {session.device === 'Mobile' ? (
                            <Smartphone className="w-5 h-5 text-gray-400" />
                          ) : session.device === 'Desktop' ? (
                            <Monitor className="w-5 h-5 text-gray-400" />
                          ) : (
                            <Globe className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{session.browser} on {session.os}</p>
                            <p className="text-xs text-gray-500">
                              {session.location || session.ip_address} • Last active {formatDistanceToNow(new Date(session.last_active), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        {session.is_current ? (
                          <Badge variant="success">Current</Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeSessionMutation.mutate(session.id)}
                            isLoading={revokeSessionMutation.isPending}
                          >
                            <LogOut className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {(!sessions || sessions.length === 0) && (
                      <p className="text-sm text-gray-500 text-center py-4">No active sessions</p>
                    )}
                  </div>
                )}
                {sessions && sessions.filter(s => !s.is_current).length > 0 && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    size="sm"
                    onClick={() => revokeAllSessionsMutation.mutate()}
                    isLoading={revokeAllSessionsMutation.isPending}
                  >
                    Sign out all other sessions
                  </Button>
                )}
              </Card>
            </>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <>
              {subscription?.status === 'past_due' && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Payment failed</p>
                    <p className="text-sm text-red-700 mt-0.5">
                      Your last payment could not be processed. Please update your payment method to avoid service interruption.
                    </p>
                    <Button variant="danger" size="sm" className="mt-2" onClick={handleManageBilling}>
                      Update Payment Method
                    </Button>
                  </div>
                </div>
              )}
              {subscription?.cancel_at_period_end && subscription?.status !== 'past_due' && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Cancellation scheduled</p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      Your subscription will be cancelled at the end of the current billing period. You'll be downgraded to the Free plan.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={handleManageBilling}>
                      Reactivate Subscription
                    </Button>
                  </div>
                </div>
              )}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <CardTitle>Current Plan</CardTitle>
                      <CardDescription>Manage your subscription</CardDescription>
                    </div>
                    <Badge variant={subscription?.plan === 'free' ? 'default' : 'primary'}>
                      {subscription?.plan?.toUpperCase() || 'FREE'}
                    </Badge>
                  </div>
                </CardHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Links Usage</p>
                      <ProgressBar value={(usageLimits.links.used / usageLimits.links.limit) * 100} max={100} />
                      <p className="text-xs text-gray-400 mt-1">{usageLimits.links.used} / {usageLimits.links.limit.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">QR Codes Usage</p>
                      <ProgressBar value={(usageLimits.qr.used / usageLimits.qr.limit) * 100} max={100} />
                      <p className="text-xs text-gray-400 mt-1">{usageLimits.qr.used} / {usageLimits.qr.limit.toLocaleString()}</p>
                    </div>
                  </div>
                  {subscription?.plan !== 'free' && (
                    <Button variant="outline" onClick={handleManageBilling}>Manage Subscription</Button>
                  )}
                </div>
              </Card>
              <div className="grid md:grid-cols-3 gap-4">
                <Card className={subscription?.plan === 'pro' ? 'border-primary' : ''}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Pro</h3>
                      {subscription?.plan === 'pro' && <Badge variant="primary">Current</Badge>}
                    </div>
                    <div><span className="text-3xl font-bold">${PLAN_PRICING.pro.monthly}</span><span className="text-gray-500">/month</span></div>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> {PLAN_LIMITS.pro.linksPerMonth.toLocaleString()} links/month</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> {PLAN_LIMITS.pro.qrCodesPerMonth.toLocaleString()} QR codes/month</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> 1-year analytics</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> Custom slugs</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> {PLAN_LIMITS.pro.customDomains} custom domain</li>
                    </ul>
                    {subscription?.plan !== 'pro' && <Button className="w-full" onClick={() => handleUpgrade('pro')}>Upgrade to Pro</Button>}
                  </div>
                </Card>
                <Card className={subscription?.plan === 'business' ? 'border-primary' : ''}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Business</h3>
                      {subscription?.plan === 'business' && <Badge variant="primary">Current</Badge>}
                    </div>
                    <div><span className="text-3xl font-bold">${PLAN_PRICING.business.monthly}</span><span className="text-gray-500">/month</span></div>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> {PLAN_LIMITS.business.linksPerMonth.toLocaleString()} links/month</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> {PLAN_LIMITS.business.qrCodesPerMonth.toLocaleString()} QR codes/month</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> 2-year analytics</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> {PLAN_LIMITS.business.customDomains} custom domains</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> Up to {PLAN_LIMITS.business.teamMembers} team members</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> Priority support</li>
                    </ul>
                    {subscription?.plan !== 'business' && <Button className="w-full" onClick={() => handleUpgrade('business')}>Upgrade to Business</Button>}
                  </div>
                </Card>
                <Card className={subscription?.plan === 'enterprise' ? 'border-primary' : ''}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Enterprise</h3>
                      {subscription?.plan === 'enterprise' && <Badge variant="primary">Current</Badge>}
                    </div>
                    <div><span className="text-3xl font-bold">${PLAN_PRICING.enterprise.monthly}</span><span className="text-gray-500">/month</span></div>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> Unlimited links</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> Unlimited QR codes</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> 10-year analytics</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> {PLAN_LIMITS.enterprise.customDomains} custom domains</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> Up to {PLAN_LIMITS.enterprise.teamMembers} team members</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> SSO & SAML</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> Dedicated account manager</li>
                    </ul>
                    {subscription?.plan !== 'enterprise' && <Button className="w-full" onClick={() => handleUpgrade('enterprise')}>Contact Sales</Button>}
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what you want to be notified about</CardDescription>
              </CardHeader>
              {notificationsLoading ? (
                <div className="py-8 flex justify-center"><Loading /></div>
              ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2"><Mail className="w-4 h-4" /> Email Notifications</h4>
                  {[
                    { id: 'weekly_report', label: 'Weekly Performance Report', desc: 'Summary of link performance every Monday' },
                    { id: 'usage_warning', label: 'Usage Warnings', desc: 'Alerts when approaching plan limits' },
                    { id: 'link_alerts', label: 'Link Alerts', desc: 'Notifications when links reach milestones' },
                    { id: 'security_alerts', label: 'Security Alerts', desc: 'Important security notifications' },
                    { id: 'marketing', label: 'Product Updates', desc: 'News about new features' },
                  ].map((item) => (
                    <label key={item.id} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={notifications[item.id as keyof NotificationSettings]}
                        onChange={(e) => setNotifications(prev => ({ ...prev, [item.id]: e.target.checked }))}
                        className="w-4 h-4 mt-0.5 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={handleSaveNotifications}>Save Preferences</Button>
                </div>
              </div>
              )}
            </Card>
          )}

          {/* Data & Privacy Tab */}
          {activeTab === 'data' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Export Your Data</CardTitle>
                  <CardDescription>Download a copy of your data (GDPR compliant)</CardDescription>
                </CardHeader>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { type: 'links' as const, label: 'Links', desc: 'All your shortened links' },
                      { type: 'analytics' as const, label: 'Analytics', desc: 'Click and visitor data' },
                      { type: 'all' as const, label: 'Everything', desc: 'Complete data export' },
                    ].map((item) => (
                      <button
                        key={item.type}
                        onClick={() => handleExportData(item.type)}
                        disabled={exportLoading !== null}
                        className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary-50/50 transition-all text-left"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Download className="w-5 h-5 text-gray-400" />
                          {exportLoading === item.type && <Loading />}
                        </div>
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Data will be exported as a ZIP file containing JSON files.</p>
                </div>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Privacy Settings</CardTitle>
                  <CardDescription>How your data is handled</CardDescription>
                </CardHeader>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Your Privacy Matters</p>
                      <p className="text-sm text-gray-600 mt-1">
                        TinlyLink collects anonymized click analytics and visitor geolocation data to power your link analytics dashboard.
                        We never sell your data to third parties. For full details, see our{' '}
                        <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <Card>
              <CardHeader>
                <CardTitle>Connected Apps</CardTitle>
                <CardDescription>Manage third-party integrations</CardDescription>
              </CardHeader>
              {integrationsLoading ? (
                <div className="py-8 flex justify-center"><Loading /></div>
              ) : (
                <div className="space-y-4">
                  {integrations?.map((app) => (
                    <div key={app.provider} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                          {app.icon_url ? (
                            <img src={app.icon_url} alt={app.name} className="w-6 h-6" />
                          ) : (
                            <Zap className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{app.name}</p>
                            {app.is_connected && <Badge variant="success">Connected</Badge>}
                          </div>
                          <p className="text-xs text-gray-500">{app.description}</p>
                          {app.is_connected && app.account_name && (
                            <p className="text-xs text-gray-400 mt-0.5">Connected as {app.account_name}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant={app.is_connected ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => app.is_connected
                          ? disconnectIntegrationMutation.mutate(app.provider)
                          : connectIntegrationMutation.mutate(app.provider)
                        }
                        isLoading={
                          (connectIntegrationMutation.isPending && connectIntegrationMutation.variables === app.provider) ||
                          (disconnectIntegrationMutation.isPending && disconnectIntegrationMutation.variables === app.provider)
                        }
                      >
                        {app.is_connected ? 'Disconnect' : 'Connect'}
                      </Button>
                    </div>
                  ))}
                  {(!integrations || integrations.length === 0) && (
                    <p className="text-sm text-gray-500 text-center py-4">No integrations available</p>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Delete Account Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => { setDeleteModalOpen(false); setDeletePassword(''); }} title="Delete Account">
        <div className="space-y-4">
          <div className="p-4 bg-danger-bg rounded-lg">
            <p className="text-sm text-danger">
              <strong>Warning:</strong> All your data will be permanently deleted after a 30-day grace period.
            </p>
          </div>
          <Input type="password" label="Enter your password to confirm" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteAccountMutation.mutate(deletePassword)} isLoading={deleteAccountMutation.isPending} disabled={!deletePassword}>
              Delete My Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
