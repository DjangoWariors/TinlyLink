import React from 'react';
import { Link, useNavigate } from 'react-router';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/common/Button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary to-secondary-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-9xl font-extrabold text-white/10 select-none">404</div>
          <div className="relative -mt-20">
            <div className="w-24 h-24 mx-auto bg-primary rounded-full flex items-center justify-center shadow-lg">
              <Search className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>

        {/* Content */}
        <h1 className="text-3xl font-bold text-white mb-4">
          Page Not Found
        </h1>
        <p className="text-gray-300 mb-8">
          Oops! The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="border-white text-white hover:bg-white hover:text-secondary"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Go Back
          </Button>
          <Link to="/">
            <Button leftIcon={<Home className="w-4 h-4" />}>
              Back to Home
            </Button>
          </Link>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-gray-400 text-sm mb-4">Here are some helpful links:</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link to="/dashboard" className="text-gray-300 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link to="/features" className="text-gray-300 hover:text-white transition-colors">
              Features
            </Link>
            <Link to="/pricing" className="text-gray-300 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link to="/api" className="text-gray-300 hover:text-white transition-colors">
              API Docs
            </Link>
            <Link to="/contact" className="text-gray-300 hover:text-white transition-colors">
              Contact
            </Link>
          </div>
        </div>

        {/* Logo */}
        <div className="mt-12">
          <Link to="/" className="text-xl font-bold text-white/50 hover:text-white/70 transition-colors">
            Tinly<span className="text-primary/50">Link</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
