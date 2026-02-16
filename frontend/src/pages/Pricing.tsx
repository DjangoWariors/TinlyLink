import React, { useState } from 'react';
import { Link } from 'react-router';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Navbar } from '@/components/layout/Navbar';
import { SEO } from '@/components/common/SEO';
import { Loading } from '@/components/common';
import { clsx } from 'clsx';
import { usePlans } from '@/hooks/usePlans';
import type { Plan } from '@/types';

// Helper to format limits
const formatLimit = (value: number) => {
  if (value === -1) return 'Unlimited';
  return value.toLocaleString();
};

const formatRetention = (days: number) => {
  if (days >= 3650) return '10 years';
  if (days >= 730) return '2 years';
  if (days >= 365) return '1 year';
  return `${days} days`;
};

const getPrice = (plan: Plan, billingCycle: 'monthly' | 'yearly') => {
  if (plan.monthly_price === 0) return '$0';
  const price = billingCycle === 'monthly'
    ? plan.monthly_price / 100
    : plan.yearly_price / 100 / 12;
  return `$${price.toFixed(0)}`;
};

export function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { plans, isLoading } = usePlans();

  const faqs = [
    {
      question: 'Can I try TinlyLink for free?',
      answer: 'Yes! Our Free plan lets you create up to 50 links per month with basic analytics. No credit card required. You can also start a 14-day free trial of Pro or Business to test all features.',
    },
    {
      question: 'What happens when I reach my link limit?',
      answer: "When you reach your monthly limit, you won't be able to create new links until the next billing cycle. Existing links will continue to work. You can upgrade anytime to increase your limits.",
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer: "Yes, you can cancel your subscription at any time. You'll continue to have access to paid features until the end of your current billing period.",
    },
    {
      question: 'Do you offer refunds?',
      answer: "We offer a 14-day money-back guarantee. If you're not satisfied within the first 14 days, contact us for a full refund.",
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.',
    },
    {
      question: 'Can I change plans later?',
      answer: "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll be charged a prorated amount. When downgrading, the change takes effect at the start of your next billing cycle.",
    },
    {
      question: 'Do you offer discounts for nonprofits or education?',
      answer: 'Yes! We offer 50% off for verified nonprofits and educational institutions. Contact our support team with proof of status to get your discount.',
    },
    {
      question: 'What happens to my links if I downgrade?',
      answer: "Your existing links will continue to work. However, if you exceed your new plan's limits, you won't be able to create new links until usage falls within limits or you upgrade.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Pricing - Flexible Plans for Everyone"
        description="Choose the perfect plan for your needs. From free personal use to enterprise-grade link management solutions."
      />
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-16 bg-gradient-to-br from-secondary to-secondary-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-8">
            Choose the plan that's right for you. All plans include a 14-day free trial.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 bg-white/10 rounded-full p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-full transition-colors',
                billingCycle === 'monthly'
                  ? 'bg-white text-secondary'
                  : 'text-white hover:text-gray-200'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-full transition-colors',
                billingCycle === 'yearly'
                  ? 'bg-white text-secondary'
                  : 'text-white hover:text-gray-200'
              )}
            >
              Yearly
              <span className="ml-1.5 text-xs text-primary font-semibold">Save 17%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 -mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loading /></div>
          ) : (
            <div className={clsx(
              'grid gap-6 max-w-6xl mx-auto',
              plans.length <= 3 ? `md:grid-cols-${plans.length}` : 'md:grid-cols-2 lg:grid-cols-4'
            )}>
              {plans.map((plan) => (
                <div
                  key={plan.slug}
                  className={clsx(
                    'relative bg-white rounded-2xl border-2 p-8',
                    plan.is_popular
                      ? 'border-primary shadow-xl scale-105 z-10'
                      : 'border-gray-200'
                  )}
                >
                  {plan.is_popular && !plan.is_coming_soon && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-sm font-semibold rounded-full">
                      {plan.badge_text || 'Most Popular'}
                    </div>
                  )}
                  {plan.is_coming_soon && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gray-500 text-white text-sm font-semibold rounded-full">
                      Coming Soon
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                    <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-gray-900">{getPrice(plan, billingCycle)}</span>
                      {plan.monthly_price > 0 && (
                        <span className="text-gray-500">/month</span>
                      )}
                    </div>
                    {billingCycle === 'yearly' && plan.yearly_price > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        ${(plan.yearly_price / 100).toFixed(0)} billed yearly
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.is_coming_soon ? (
                    <Button variant="outline" className="w-full" disabled>
                      Coming Soon
                    </Button>
                  ) : (
                    <Link to="/register">
                      <Button
                        variant={plan.is_popular ? 'primary' : 'outline'}
                        className="w-full"
                      >
                        {plan.cta_text}
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Feature Comparison */}
      {!isLoading && plans.length > 0 && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Compare Plans
              </h2>
              <p className="text-lg text-gray-600">
                See what's included in each plan
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full max-w-5xl mx-auto">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-4 text-left text-sm font-semibold text-gray-900">Feature</th>
                    {plans.map((plan) => (
                      <th
                        key={plan.slug}
                        className={clsx(
                          'py-4 text-center text-sm font-semibold',
                          plan.is_popular ? 'text-primary' : 'text-gray-900'
                        )}
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[
                    { label: 'Links per month', getValue: (p: Plan) => formatLimit(p.limits.links_per_month) },
                    { label: 'QR codes per month', getValue: (p: Plan) => formatLimit(p.limits.qr_codes_per_month) },
                    { label: 'Analytics retention', getValue: (p: Plan) => formatRetention(p.limits.analytics_retention_days) },
                    { label: 'Custom slugs', getValue: (p: Plan) => p.limits.custom_slugs ? '\u2713' : '\u2014' },
                    { label: 'Password protection', getValue: (p: Plan) => p.limits.password_protection ? '\u2713' : '\u2014' },
                    { label: 'Custom domains', getValue: (p: Plan) => p.limits.custom_domains > 0 ? String(p.limits.custom_domains) : '\u2014' },
                    { label: 'API calls per month', getValue: (p: Plan) => p.limits.api_calls_per_month > 0 ? formatLimit(p.limits.api_calls_per_month) : '\u2014' },
                    { label: 'Team members', getValue: (p: Plan) => p.limits.team_members > 0 ? String(p.limits.team_members) : '1' },
                    { label: 'Priority support', getValue: (p: Plan) => p.limits.priority_support ? '\u2713' : '\u2014' },
                    { label: 'SSO & SAML', getValue: (p: Plan) => p.limits.sso ? '\u2713' : '\u2014' },
                  ].map((row) => (
                    <tr key={row.label}>
                      <td className="py-4 text-sm text-gray-600">{row.label}</td>
                      {plans.map((plan) => (
                        <td
                          key={plan.slug}
                          className={clsx(
                            'py-4 text-center text-sm',
                            plan.is_popular ? 'text-gray-900 font-medium' : 'text-gray-600'
                          )}
                        >
                          {row.getValue(plan)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-600">
              Everything you need to know about our pricing
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <span className="font-medium text-gray-900">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4 text-gray-600">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-secondary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Still have questions?
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            Our team is here to help. Contact us anytime.
          </p>
          <Link to="/contact">
            <Button size="lg">
              Contact Sales
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xl font-bold text-white">
              Tinly<span className="text-primary">Link</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link to="/features" className="hover:text-white transition-colors">Features</Link>
              <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            </div>
            <p className="text-sm text-gray-500">
              &copy; 2025 TinlyLink. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
