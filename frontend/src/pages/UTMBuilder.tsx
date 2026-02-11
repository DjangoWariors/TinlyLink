import React, { useState, useMemo } from 'react';
import { Link2, Copy, Check, HelpCircle, Zap, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Badge } from '@/components/common';
import { useLocalStorage } from '@/hooks';
import toast from 'react-hot-toast';

interface UTMHistory {
  id: string;
  url: string;
  params: UTMParams;
  createdAt: string;
}

interface UTMParams {
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
}

const COMMON_SOURCES = ['google', 'facebook', 'twitter', 'linkedin', 'instagram', 'email', 'newsletter'];
const COMMON_MEDIUMS = ['cpc', 'social', 'email', 'organic', 'referral', 'display', 'affiliate'];

export function UTMBuilderPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [params, setParams] = useState<UTMParams>({
    source: '',
    medium: '',
    campaign: '',
    term: '',
    content: '',
  });
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useLocalStorage<UTMHistory[]>('utm-history', []);

  // Build the full URL with UTM parameters
  const fullUrl = useMemo(() => {
    if (!baseUrl) return '';
    
    try {
      const url = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
      
      if (params.source) url.searchParams.set('utm_source', params.source);
      if (params.medium) url.searchParams.set('utm_medium', params.medium);
      if (params.campaign) url.searchParams.set('utm_campaign', params.campaign);
      if (params.term) url.searchParams.set('utm_term', params.term);
      if (params.content) url.searchParams.set('utm_content', params.content);
      
      return url.toString();
    } catch {
      return '';
    }
  }, [baseUrl, params]);

  const isValid = baseUrl && params.source && params.medium && params.campaign;

  const handleCopy = async () => {
    if (!fullUrl) return;
    
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success('Copied to clipboard!');
    
    // Add to history
    const newEntry: UTMHistory = {
      id: Date.now().toString(),
      url: fullUrl,
      params: { ...params },
      createdAt: new Date().toISOString(),
    };
    setHistory([newEntry, ...history.slice(0, 9)]); // Keep last 10
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearHistory = () => {
    setHistory([]);
    toast.success('History cleared');
  };

  const handleLoadFromHistory = (entry: UTMHistory) => {
    try {
      const url = new URL(entry.url);
      setBaseUrl(url.origin + url.pathname);
      setParams(entry.params);
      toast.success('Loaded from history');
    } catch {
      toast.error('Failed to load URL');
    }
  };

  const handleReset = () => {
    setBaseUrl('');
    setParams({
      source: '',
      medium: '',
      campaign: '',
      term: '',
      content: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">UTM Builder</h1>
        <p className="text-gray-500 mt-1">Create trackable URLs with UTM parameters for campaign tracking</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* Base URL */}
          <Card>
            <CardHeader>
              <CardTitle>Base URL</CardTitle>
              <CardDescription>Enter the destination URL you want to track</CardDescription>
            </CardHeader>
            <Input
              placeholder="https://example.com/landing-page"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              leftIcon={<Link2 className="w-4 h-4" />}
            />
          </Card>

          {/* UTM Parameters */}
          <Card>
            <CardHeader>
              <CardTitle>UTM Parameters</CardTitle>
              <CardDescription>Add campaign tracking parameters</CardDescription>
            </CardHeader>
            <div className="space-y-4">
              {/* Source - Required */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="label mb-0">utm_source</label>
                  <Badge variant="danger">Required</Badge>
                  <div className="group relative">
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Identifies the source of traffic (e.g., google, newsletter)
                    </div>
                  </div>
                </div>
                <Input
                  placeholder="e.g., google, facebook, newsletter"
                  value={params.source}
                  onChange={(e) => setParams({ ...params, source: e.target.value })}
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {COMMON_SOURCES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setParams({ ...params, source: s })}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Medium - Required */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="label mb-0">utm_medium</label>
                  <Badge variant="danger">Required</Badge>
                  <div className="group relative">
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Marketing medium (e.g., cpc, email, social)
                    </div>
                  </div>
                </div>
                <Input
                  placeholder="e.g., cpc, email, social"
                  value={params.medium}
                  onChange={(e) => setParams({ ...params, medium: e.target.value })}
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {COMMON_MEDIUMS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setParams({ ...params, medium: m })}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campaign - Required */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="label mb-0">utm_campaign</label>
                  <Badge variant="danger">Required</Badge>
                  <div className="group relative">
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Campaign name or identifier
                    </div>
                  </div>
                </div>
                <Input
                  placeholder="e.g., spring_sale, product_launch"
                  value={params.campaign}
                  onChange={(e) => setParams({ ...params, campaign: e.target.value })}
                />
              </div>

              {/* Term - Optional */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="label mb-0">utm_term</label>
                  <Badge variant="default">Optional</Badge>
                  <div className="group relative">
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Paid search keywords
                    </div>
                  </div>
                </div>
                <Input
                  placeholder="e.g., running+shoes, best+deals"
                  value={params.term}
                  onChange={(e) => setParams({ ...params, term: e.target.value })}
                />
              </div>

              {/* Content - Optional */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="label mb-0">utm_content</label>
                  <Badge variant="default">Optional</Badge>
                  <div className="group relative">
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Differentiates ads or links pointing to the same URL
                    </div>
                  </div>
                </div>
                <Input
                  placeholder="e.g., banner_ad, text_link, sidebar"
                  value={params.content}
                  onChange={(e) => setParams({ ...params, content: e.target.value })}
                />
              </div>
            </div>
          </Card>

          {/* Generated URL */}
          <Card className={isValid ? 'border-primary' : ''}>
            <CardHeader>
              <CardTitle>Generated URL</CardTitle>
              <CardDescription>Your trackable URL with UTM parameters</CardDescription>
            </CardHeader>
            <div className="space-y-4">
              {fullUrl ? (
                <div className="p-3 bg-gray-50 rounded-lg break-all text-sm font-mono text-gray-700">
                  {fullUrl}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-400 italic">
                  Enter a URL and fill in the required parameters to generate your trackable link
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={handleCopy}
                  disabled={!isValid}
                  leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  className="flex-1"
                >
                  {copied ? 'Copied!' : 'Copy URL'}
                </Button>
                <Button variant="ghost" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar - History & Tips */}
        <div className="space-y-6">
          {/* Quick Tips */}
          <Card className="bg-primary-50 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary rounded-lg text-white">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Quick Tips</h3>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>• Use lowercase for consistency</li>
                  <li>• Avoid spaces (use underscores)</li>
                  <li>• Keep names short but descriptive</li>
                  <li>• Be consistent across campaigns</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* History */}
          <Card padding="none">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-400" />
                <h3 className="font-medium text-gray-900">Recent URLs</h3>
              </div>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">
                Your generated URLs will appear here
              </p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleLoadFromHistory(entry)}
                    className="w-full px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm text-gray-900 truncate">{entry.params.campaign}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {entry.params.source} / {entry.params.medium}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Create Short Link CTA */}
          <Card className="bg-secondary text-white">
            <div className="text-center">
              <h3 className="font-semibold">Want a shorter URL?</h3>
              <p className="text-sm text-gray-300 mt-1">
                Create a short link with your UTM parameters
              </p>
              <Button
                variant="primary"
                className="mt-4 w-full"
                onClick={() => {
                  if (fullUrl) {
                    const searchParams = new URLSearchParams();
                    searchParams.set('url', fullUrl);
                    if (params.source) searchParams.set('utm_source', params.source);
                    if (params.medium) searchParams.set('utm_medium', params.medium);
                    if (params.campaign) searchParams.set('utm_campaign', params.campaign);
                    if (params.term) searchParams.set('utm_term', params.term);
                    if (params.content) searchParams.set('utm_content', params.content);
                    window.location.href = `/dashboard/links/new?${searchParams.toString()}`;
                  } else {
                    window.location.href = '/dashboard/links/new';
                  }
                }}
              >
                Create Short Link
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
