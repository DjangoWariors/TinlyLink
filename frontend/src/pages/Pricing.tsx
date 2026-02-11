import React, { useState } from 'react';
import { Link } from 'react-router';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Navbar } from '@/components/layout/Navbar';
import { SEO } from '@/components/common/SEO';
import { clsx } from 'clsx';
import { PLAN_LIMITS, PLAN_PRICING } from '@/config';

// Helper to format limits
const formatLimit = (value: number, suffix: string = '') => {
  if (value === -1) return 'Unlimited' + (suffix ? ` ${suffix}` : '');
  return value.toLocaleString() + (suffix ? ` ${suffix}` : '');
};

const formatRetention = (days: number) => {
  if (days >= 3650) return '10-year analytics retention';
  if (days >= 730) return '2-year analytics retention';
  if (days >= 365) return '1-year analytics retention';
  return `${days}-day analytics`;
};

export function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const plans = [
    {
      name: 'Free',
      key: 'free' as const,
      description: 'Perfect for getting started',
      monthlyPrice: PLAN_PRICING.free.monthly,
      yearlyPrice: PLAN_PRICING.free.yearly,
      features: [
        { name: `${formatLimit(PLAN_LIMITS.free.linksPerMonth)} links per month`, included: true },
        { name: `${formatLimit(PLAN_LIMITS.free.qrCodesPerMonth)} QR codes per month`, included: true },
        { name: formatRetention(PLAN_LIMITS.free.analyticsRetentionDays), included: true },
        { name: 'Basic link tracking', included: true },
        { name: 'Custom slugs', included: PLAN_LIMITS.free.customSlugs },
        { name: 'Password protection', included: PLAN_LIMITS.free.passwordProtection },
        { name: 'Custom domains', included: PLAN_LIMITS.free.customDomains > 0 },
        { name: 'API access', included: PLAN_LIMITS.free.apiCallsPerMonth > 0 },
        { name: 'Priority support', included: false },
      ],
      cta: 'Get Started',
      popular: false,
    },
    {
      name: 'Pro',
      key: 'pro' as const,
      description: 'Best for professionals',
      monthlyPrice: PLAN_PRICING.pro.monthly,
      yearlyPrice: PLAN_PRICING.pro.yearly,
      features: [
        { name: `${formatLimit(PLAN_LIMITS.pro.linksPerMonth)} links per month`, included: true },
        { name: `${formatLimit(PLAN_LIMITS.pro.qrCodesPerMonth)} QR codes per month`, included: true },
        { name: formatRetention(PLAN_LIMITS.pro.analyticsRetentionDays), included: true },
        { name: 'Advanced analytics', included: true },
        { name: 'Custom slugs', included: PLAN_LIMITS.pro.customSlugs },
        { name: 'Password protection', included: PLAN_LIMITS.pro.passwordProtection },
        { name: `${PLAN_LIMITS.pro.customDomains} custom domain`, included: true },
        { name: `API access (${formatLimit(PLAN_LIMITS.pro.apiCallsPerMonth)} calls/mo)`, included: true },
        { name: 'Priority support', included: false },
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Business',
      key: 'business' as const,
      description: 'For growing teams',
      monthlyPrice: PLAN_PRICING.business.monthly,
      yearlyPrice: PLAN_PRICING.business.yearly,
      features: [
        { name: `${formatLimit(PLAN_LIMITS.business.linksPerMonth)} links per month`, included: true },
        { name: `${formatLimit(PLAN_LIMITS.business.qrCodesPerMonth)} QR codes per month`, included: true },
        { name: formatRetention(PLAN_LIMITS.business.analyticsRetentionDays), included: true },
        { name: 'Advanced analytics', included: true },
        { name: 'Custom slugs', included: PLAN_LIMITS.business.customSlugs },
        { name: 'Password protection', included: PLAN_LIMITS.business.passwordProtection },
        { name: `${PLAN_LIMITS.business.customDomains} custom domains`, included: true },
        { name: `${formatLimit(PLAN_LIMITS.business.apiCallsPerMonth)} API calls per month`, included: true },
        { name: `Up to ${PLAN_LIMITS.business.teamMembers} team members`, included: true },
        { name: 'Priority support', included: true },
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Enterprise',
      key: 'enterprise' as const,
      description: 'For large organizations',
      monthlyPrice: PLAN_PRICING.enterprise.monthly,
      yearlyPrice: PLAN_PRICING.enterprise.yearly,
      features: [
        { name: `${formatLimit(PLAN_LIMITS.enterprise.linksPerMonth)} links`, included: true },
        { name: `${formatLimit(PLAN_LIMITS.enterprise.qrCodesPerMonth)} QR codes`, included: true },
        { name: formatRetention(PLAN_LIMITS.enterprise.analyticsRetentionDays), included: true },
        { name: 'Advanced analytics', included: true },
        { name: 'Custom slugs', included: PLAN_LIMITS.enterprise.customSlugs },
        { name: 'Password protection', included: PLAN_LIMITS.enterprise.passwordProtection },
        { name: `${PLAN_LIMITS.enterprise.customDomains} custom domains`, included: true },
        { name: `${formatLimit(PLAN_LIMITS.enterprise.apiCallsPerMonth)} API calls`, included: true },
        { name: `Up to ${PLAN_LIMITS.enterprise.teamMembers} team members`, included: true },
        { name: 'Priority support', included: PLAN_LIMITS.enterprise.prioritySupport },
        { name: 'SSO & SAML', included: PLAN_LIMITS.enterprise.sso },
        { name: 'Dedicated account manager', included: PLAN_LIMITS.enterprise.dedicatedAccountManager },
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

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

  const getPrice = (plan: typeof plans[0]) => {
    if (plan.monthlyPrice === 0) return '$0';
    const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice / 12;
    return `$${price.toFixed(0)}`;
  };

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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={clsx(
                  'relative bg-white rounded-2xl border-2 p-8',
                  plan.popular
                    ? 'border-primary shadow-xl scale-105 z-10'
                    : 'border-gray-200'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-sm font-semibold rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">{getPrice(plan)}</span>
                    {plan.monthlyPrice > 0 && (
                      <span className="text-gray-500">/month</span>
                    )}
                  </div>
                  {billingCycle === 'yearly' && plan.yearlyPrice > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      ${plan.yearlyPrice} billed yearly
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature.name} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={feature.included ? 'text-gray-600' : 'text-gray-400'}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link to="/register">
                  <Button
                    variant={plan.popular ? 'primary' : 'outline'}
                    className="w-full"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
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
                  <th className="py-4 text-center text-sm font-semibold text-gray-900">Free</th>
                  <th className="py-4 text-center text-sm font-semibold text-primary">Pro</th>
                  <th className="py-4 text-center text-sm font-semibold text-gray-900">Business</th>
                  <th className="py-4 text-center text-sm font-semibold text-gray-900">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  ['Links per month', formatLimit(PLAN_LIMITS.free.linksPerMonth), formatLimit(PLAN_LIMITS.pro.linksPerMonth), formatLimit(PLAN_LIMITS.business.linksPerMonth), formatLimit(PLAN_LIMITS.enterprise.linksPerMonth)],
                  ['QR codes per month', formatLimit(PLAN_LIMITS.free.qrCodesPerMonth), formatLimit(PLAN_LIMITS.pro.qrCodesPerMonth), formatLimit(PLAN_LIMITS.business.qrCodesPerMonth), formatLimit(PLAN_LIMITS.enterprise.qrCodesPerMonth)],
                  ['Analytics retention', `${PLAN_LIMITS.free.analyticsRetentionDays} days`, '1 year', '2 years', '10 years'],
                  ['Custom slugs', PLAN_LIMITS.free.customSlugs ? '✓' : '—', PLAN_LIMITS.pro.customSlugs ? '✓' : '—', PLAN_LIMITS.business.customSlugs ? '✓' : '—', PLAN_LIMITS.enterprise.customSlugs ? '✓' : '—'],
                  ['Password protection', PLAN_LIMITS.free.passwordProtection ? '✓' : '—', PLAN_LIMITS.pro.passwordProtection ? '✓' : '—', PLAN_LIMITS.business.passwordProtection ? '✓' : '—', PLAN_LIMITS.enterprise.passwordProtection ? '✓' : '—'],
                  ['Custom domains', PLAN_LIMITS.free.customDomains || '—', String(PLAN_LIMITS.pro.customDomains), String(PLAN_LIMITS.business.customDomains), String(PLAN_LIMITS.enterprise.customDomains)],
                  ['API calls per month', PLAN_LIMITS.free.apiCallsPerMonth || '—', formatLimit(PLAN_LIMITS.pro.apiCallsPerMonth), formatLimit(PLAN_LIMITS.business.apiCallsPerMonth), formatLimit(PLAN_LIMITS.enterprise.apiCallsPerMonth)],
                  ['Team members', '1', '1', String(PLAN_LIMITS.business.teamMembers), String(PLAN_LIMITS.enterprise.teamMembers)],
                  ['Priority support', '—', '—', '✓', PLAN_LIMITS.enterprise.prioritySupport ? '✓' : '—'],
                  ['SSO & SAML', '—', '—', '—', PLAN_LIMITS.enterprise.sso ? '✓' : '—'],
                  ['Dedicated account manager', '—', '—', '—', PLAN_LIMITS.enterprise.dedicatedAccountManager ? '✓' : '—'],
                ].map(([feature, free, pro, business, enterprise]) => (
                  <tr key={feature}>
                    <td className="py-4 text-sm text-gray-600">{feature}</td>
                    <td className="py-4 text-center text-sm text-gray-600">{free}</td>
                    <td className="py-4 text-center text-sm text-gray-900 font-medium">{pro}</td>
                    <td className="py-4 text-center text-sm text-gray-600">{business}</td>
                    <td className="py-4 text-center text-sm text-gray-600">{enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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
              © 2025 TinlyLink. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
