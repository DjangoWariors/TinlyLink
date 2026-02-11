import React, { useState } from 'react';
import { Link } from 'react-router';
import { Code, Copy, Check, ExternalLink, Key, Zap, Shield } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/common/Button';
import { Navbar } from '@/components/layout/Navbar';
import { SEO } from '@/components/common/SEO';
import toast from 'react-hot-toast';

export function APIDocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success('Copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'links', label: 'Links' },
    { id: 'qrcodes', label: 'QR Codes' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'errors', label: 'Errors' },
    { id: 'rate-limits', label: 'Rate Limits' },
  ];

  const CodeBlock = ({ code, language = 'bash', id }: { code: string; language?: string; id: string }) => (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400 uppercase">{language}</span>
        <button
          onClick={() => handleCopy(code, id)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {copiedCode === id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-gray-300">
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="API Documentation - Developers"
        description="Complete API documentation for TinlyLink. Integrate URL shortening, QR code generation, and analytics into your applications."
      />
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-12 bg-gradient-to-br from-secondary to-secondary-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary rounded-lg">
              <Code className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">API Documentation</h1>
          </div>
          <p className="text-lg text-gray-300 max-w-2xl">
            Integrate TinlyLink into your applications with our powerful REST API.
            Create links, generate QR codes, and access analytics programmatically.
          </p>
          <div className="flex items-center gap-4 mt-6">
            <Link to="/dashboard/api-keys">
              <Button leftIcon={<Key className="w-4 h-4" />}>
                Get API Key
              </Button>
            </Link>
            <a
              href="https://github.com/TinlyLink/api-examples"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white flex items-center gap-1 text-sm"
            >
              View Examples <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Documentation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <nav className="lg:w-48 flex-shrink-0">
            <div className="sticky top-24 space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    activeSection === section.id
                      ? 'bg-primary-50 text-primary'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Overview */}
            {activeSection === 'overview' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
                  <p className="text-gray-600 mb-4">
                    The TinlyLink API is a RESTful API that allows you to create and manage short links,
                    QR codes, and access analytics data. All API requests must be made over HTTPS.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm font-mono text-gray-700">
                      Base URL: <span className="text-primary">https://api.TinlyLink.com/v1</span>
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-primary-50 rounded-lg border border-primary/20">
                    <Zap className="w-5 h-5 text-primary mb-2" />
                    <h3 className="font-semibold text-gray-900">Fast & Reliable</h3>
                    <p className="text-sm text-gray-600 mt-1">Sub-100ms response times with 99.9% uptime</p>
                  </div>
                  <div className="p-4 bg-primary-50 rounded-lg border border-primary/20">
                    <Shield className="w-5 h-5 text-primary mb-2" />
                    <h3 className="font-semibold text-gray-900">Secure</h3>
                    <p className="text-sm text-gray-600 mt-1">TLS encryption and API key authentication</p>
                  </div>
                  <div className="p-4 bg-primary-50 rounded-lg border border-primary/20">
                    <Code className="w-5 h-5 text-primary mb-2" />
                    <h3 className="font-semibold text-gray-900">RESTful</h3>
                    <p className="text-sm text-gray-600 mt-1">Standard HTTP methods and JSON responses</p>
                  </div>
                </div>
              </div>
            )}

            {/* Authentication */}
            {activeSection === 'authentication' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Authentication</h2>
                <p className="text-gray-600">
                  Authenticate your API requests by including your API key in the Authorization header.
                </p>

                <CodeBlock
                  id="auth-header"
                  language="bash"
                  code={`curl -X GET "https://api.TinlyLink.com/v1/links" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
                />

                <div className="bg-warning-bg border border-warning/20 rounded-lg p-4">
                  <p className="text-sm text-warning-dark">
                    <strong>Important:</strong> Keep your API keys secure. Never expose them in client-side code
                    or public repositories.
                  </p>
                </div>
              </div>
            )}

            {/* Links */}
            {activeSection === 'links' && (
              <div className="space-y-8">
                <h2 className="text-2xl font-bold text-gray-900">Links</h2>

                {/* Create Link */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Create a Link</h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-success-bg text-success text-xs font-bold rounded">POST</span>
                    <code className="text-sm text-gray-600">/links</code>
                  </div>

                  <CodeBlock
                    id="create-link"
                    language="bash"
                    code={`curl -X POST "https://api.TinlyLink.com/v1/links" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "original_url": "https://example.com/very-long-url",
    "custom_slug": "my-link",
    "title": "My Campaign Link",
    "utm_source": "twitter",
    "utm_medium": "social"
  }'`}
                  />

                  <h4 className="font-medium text-gray-900 mt-4">Response</h4>
                  <CodeBlock
                    id="create-link-response"
                    language="json"
                    code={`{
  "id": "lnk_abc123",
  "short_code": "my-link",
  "short_url": "https://lnks.io/my-link",
  "original_url": "https://example.com/very-long-url",
  "title": "My Campaign Link",
  "total_clicks": 0,
  "created_at": "2025-01-15T10:30:00Z"
}`}
                  />
                </div>

                {/* List Links */}
                <div className="space-y-4 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">List Links</h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-primary-100 text-primary text-xs font-bold rounded">GET</span>
                    <code className="text-sm text-gray-600">/links</code>
                  </div>

                  <CodeBlock
                    id="list-links"
                    language="bash"
                    code={`curl -X GET "https://api.TinlyLink.com/v1/links?page=1&limit=20" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
                  />
                </div>

                {/* Delete Link */}
                <div className="space-y-4 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Delete a Link</h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-danger-bg text-danger text-xs font-bold rounded">DELETE</span>
                    <code className="text-sm text-gray-600">/links/:id</code>
                  </div>

                  <CodeBlock
                    id="delete-link"
                    language="bash"
                    code={`curl -X DELETE "https://api.TinlyLink.com/v1/links/lnk_abc123" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
                  />
                </div>
              </div>
            )}

            {/* QR Codes */}
            {activeSection === 'qrcodes' && (
              <div className="space-y-8">
                <h2 className="text-2xl font-bold text-gray-900">QR Codes</h2>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Create a QR Code</h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-success-bg text-success text-xs font-bold rounded">POST</span>
                    <code className="text-sm text-gray-600">/qr-codes</code>
                  </div>

                  <CodeBlock
                    id="create-qr"
                    language="bash"
                    code={`curl -X POST "https://api.TinlyLink.com/v1/qr-codes" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "link_id": "lnk_abc123",
    "style": "rounded",
    "foreground_color": "#000000",
    "background_color": "#FFFFFF"
  }'`}
                  />
                </div>
              </div>
            )}

            {/* Analytics */}
            {activeSection === 'analytics' && (
              <div className="space-y-8">
                <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Get Link Analytics</h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-primary-100 text-primary text-xs font-bold rounded">GET</span>
                    <code className="text-sm text-gray-600">/links/:id/stats</code>
                  </div>

                  <CodeBlock
                    id="link-stats"
                    language="bash"
                    code={`curl -X GET "https://api.TinlyLink.com/v1/links/lnk_abc123/stats?period=30d" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
                  />

                  <h4 className="font-medium text-gray-900 mt-4">Response</h4>
                  <CodeBlock
                    id="link-stats-response"
                    language="json"
                    code={`{
  "total_clicks": 1247,
  "unique_clicks": 892,
  "clicks_by_day": [
    { "date": "2025-01-15", "clicks": 45 },
    { "date": "2025-01-14", "clicks": 52 }
  ],
  "top_countries": [
    { "country": "US", "clicks": 523 },
    { "country": "GB", "clicks": 234 }
  ],
  "devices": {
    "desktop": 650,
    "mobile": 520,
    "tablet": 77
  }
}`}
                  />
                </div>
              </div>
            )}

            {/* Errors */}
            {activeSection === 'errors' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Error Handling</h2>
                <p className="text-gray-600">
                  The API uses standard HTTP status codes to indicate success or failure.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-3 text-left font-semibold text-gray-900">Code</th>
                        <th className="py-3 text-left font-semibold text-gray-900">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr><td className="py-3 text-gray-600">200</td><td className="py-3 text-gray-600">Success</td></tr>
                      <tr><td className="py-3 text-gray-600">201</td><td className="py-3 text-gray-600">Created</td></tr>
                      <tr><td className="py-3 text-gray-600">400</td><td className="py-3 text-gray-600">Bad Request - Invalid parameters</td></tr>
                      <tr><td className="py-3 text-gray-600">401</td><td className="py-3 text-gray-600">Unauthorized - Invalid API key</td></tr>
                      <tr><td className="py-3 text-gray-600">403</td><td className="py-3 text-gray-600">Forbidden - Insufficient permissions</td></tr>
                      <tr><td className="py-3 text-gray-600">404</td><td className="py-3 text-gray-600">Not Found</td></tr>
                      <tr><td className="py-3 text-gray-600">429</td><td className="py-3 text-gray-600">Rate Limited</td></tr>
                      <tr><td className="py-3 text-gray-600">500</td><td className="py-3 text-gray-600">Server Error</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Rate Limits */}
            {activeSection === 'rate-limits' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Rate Limits</h2>
                <p className="text-gray-600">
                  API rate limits depend on your plan. Limits are applied per API key.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-3 text-left font-semibold text-gray-900">Plan</th>
                        <th className="py-3 text-left font-semibold text-gray-900">Requests/Month</th>
                        <th className="py-3 text-left font-semibold text-gray-900">Requests/Minute</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr><td className="py-3 text-gray-600">Pro</td><td className="py-3 text-gray-600">1,000</td><td className="py-3 text-gray-600">60</td></tr>
                      <tr><td className="py-3 text-gray-600">Business</td><td className="py-3 text-gray-600">Unlimited</td><td className="py-3 text-gray-600">300</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-600">
                    Rate limit headers are included in every response:
                  </p>
                  <ul className="mt-2 text-sm text-gray-600 space-y-1">
                    <li><code className="text-primary">X-RateLimit-Limit</code> - Total requests allowed</li>
                    <li><code className="text-primary">X-RateLimit-Remaining</code> - Requests remaining</li>
                    <li><code className="text-primary">X-RateLimit-Reset</code> - Reset timestamp</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
