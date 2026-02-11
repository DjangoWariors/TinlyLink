import React from 'react';
import { Link } from 'react-router';
import { Calendar, Clock, ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Navbar } from '@/components/layout/Navbar';
import { SEO, StructuredData } from '@/components/common/SEO';

export function BlogPage() {
  const featuredPost = {
    id: 1,
    title: 'The Complete Guide to UTM Parameters in 2025',
    excerpt: 'Learn how to effectively use UTM parameters to track your marketing campaigns and make data-driven decisions.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop',
    author: 'Sarah Johnson',
    date: 'Jan 10, 2025',
    readTime: '8 min read',
    category: 'Marketing',
  };

  const posts = [
    {
      id: 2,
      title: '10 Ways to Increase Click-Through Rates on Your Short Links',
      excerpt: 'Discover proven strategies to boost engagement and get more clicks on your shortened URLs.',
      author: 'Mike Chen',
      date: 'Jan 8, 2025',
      readTime: '5 min read',
      category: 'Tips & Tricks',
    },
    {
      id: 3,
      title: 'QR Codes for Small Business: A Practical Guide',
      excerpt: 'How small businesses can leverage QR codes to drive foot traffic and increase sales.',
      author: 'Emily Davis',
      date: 'Jan 5, 2025',
      readTime: '6 min read',
      category: 'QR Codes',
    },
    {
      id: 4,
      title: 'Understanding Link Analytics: Metrics That Matter',
      excerpt: 'A deep dive into the analytics metrics you should be tracking for your marketing campaigns.',
      author: 'Sarah Johnson',
      date: 'Jan 2, 2025',
      readTime: '7 min read',
      category: 'Analytics',
    },
    {
      id: 5,
      title: 'Custom Domains: Building Trust with Branded Links',
      excerpt: 'Why branded short links outperform generic ones and how to set up your custom domain.',
      author: 'Mike Chen',
      date: 'Dec 28, 2024',
      readTime: '4 min read',
      category: 'Branding',
    },
    {
      id: 6,
      title: 'API Integration Best Practices for Developers',
      excerpt: 'Technical guide for developers integrating TinlyLink API into their applications.',
      author: 'Alex Kumar',
      date: 'Dec 22, 2024',
      readTime: '10 min read',
      category: 'Development',
    },
    {
      id: 7,
      title: 'Social Media Link Strategy for 2025',
      excerpt: 'Maximize your social media presence with effective link sharing strategies.',
      author: 'Emily Davis',
      date: 'Dec 18, 2024',
      readTime: '6 min read',
      category: 'Social Media',
    },
  ];

  const categories = [
    'All',
    'Marketing',
    'QR Codes',
    'Analytics',
    'Tips & Tricks',
    'Development',
    'Case Studies',
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Blog - Marketing Tips & Updates"
        description="Latest insights, updates, and guides on link management, QR codes, and digital marketing strategies from the TinlyLink team."
      />
      <StructuredData
        type="Organization"
        data={{
          name: "TinlyLink Blog",
          url: "https://TinlyLink.com/blog",
          logo: "https://TinlyLink.com/logo.png"
        }}
      />
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-12 bg-gradient-to-br from-secondary to-secondary-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            TinlyLink Blog
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl">
            Tips, guides, and insights on link management, QR codes, and digital marketing.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((category) => (
            <button
              key={category}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${category === 'All'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Featured Post */}
        <div className="mb-12">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
            <div className="md:flex">
              <div className="md:w-1/2">
                <img
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="w-full h-64 md:h-full object-cover"
                />
              </div>
              <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
                <span className="inline-block px-3 py-1 bg-primary-50 text-primary text-xs font-semibold rounded-full mb-4 w-fit">
                  {featuredPost.category}
                </span>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  {featuredPost.title}
                </h2>
                <p className="text-gray-600 mb-4">{featuredPost.excerpt}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {featuredPost.author}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {featuredPost.date}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {featuredPost.readTime}
                  </div>
                </div>
                <Link to={`/blog/${featuredPost.id}`}>
                  <Button rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Read Article
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <article
              key={post.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all"
            >
              <div className="p-6">
                <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full mb-3">
                  {post.category}
                </span>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  <Link to={`/blog/${post.id}`} className="hover:text-primary transition-colors">
                    {post.title}
                  </Link>
                </h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{post.author}</span>
                  <div className="flex items-center gap-3">
                    <span>{post.date}</span>
                    <span>·</span>
                    <span>{post.readTime}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-12">
          <Button variant="outline">Load More Articles</Button>
        </div>
      </div>

      {/* Newsletter CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Subscribe to Our Newsletter
          </h2>
          <p className="text-gray-600 mb-6">
            Get the latest articles, tips, and product updates delivered to your inbox.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
            <Button type="submit">Subscribe</Button>
          </form>
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
