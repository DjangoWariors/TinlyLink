import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { CheckCircle, XCircle, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { SEO } from '@/components/common/SEO';
import { authAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

type VerificationState = 'loading' | 'success' | 'error' | 'resend';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const token = searchParams.get('token');
  
  const [state, setState] = useState<VerificationState>(token ? 'loading' : 'resend');
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (token) {
      verifyEmail();
    }
  }, [token]);

  const verifyEmail = async () => {
    if (!token) return;
    
    try {
      await authAPI.verifyEmail(token);
      setState('success');
      // Refresh user data to update email_verified status
      if (isAuthenticated) {
        await refreshUser();
      }
      toast.success('Email verified successfully!');
    } catch (error: any) {
      setState('error');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsResending(true);
    try {
      await authAPI.resendVerification();
      toast.success('Verification email sent!');
      setResendCooldown(60);
    } catch (error: any) {
      if (!error.response) {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to send verification email.');
      }
    } finally {
      setIsResending(false);
    }
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <SEO title="Verifying Email - TinlyLink" description="Verifying your email address." />
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-md rounded-xl border border-gray-200 text-center">
            <div className="mx-auto w-12 h-12 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verifying your email...</h2>
            <p className="text-gray-600">
              Please wait while we verify your email address.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Auto-redirect to dashboard after successful verification
  useEffect(() => {
    if (state === 'success' && isAuthenticated) {
      const timer = setTimeout(() => navigate('/dashboard'), 3000);
      return () => clearTimeout(timer);
    }
  }, [state, isAuthenticated, navigate]);

  // Success state
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <SEO title="Email Verified - TinlyLink" description="Your email has been successfully verified." />
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-md rounded-xl border border-gray-200 text-center">
            <div className="mx-auto w-12 h-12 bg-success-bg rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Email verified!</h2>
            <p className="text-gray-600 mb-6">
              Your email has been successfully verified. You now have full access to your account.
            </p>
            {isAuthenticated ? (
              <>
                <p className="text-xs text-gray-500 mb-4">Redirecting to dashboard in a moment...</p>
                <Link to="/dashboard">
                  <Button className="w-full">
                    Go to Dashboard
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/login">
                <Button className="w-full">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-md rounded-xl border border-gray-200 text-center">
            <div className="mx-auto w-12 h-12 bg-danger-bg rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-6 h-6 text-danger" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verification failed</h2>
            <p className="text-gray-600 mb-6">
              This verification link is invalid or has expired. Please request a new verification email.
            </p>
            <div className="space-y-3">
              {isAuthenticated ? (
                <Button
                  className="w-full"
                  onClick={handleResend}
                  isLoading={isResending}
                  disabled={resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
                </Button>
              ) : (
                <Link to="/login">
                  <Button className="w-full">
                    Sign in to resend
                  </Button>
                </Link>
              )}
              <Link to="/">
                <Button variant="ghost" className="w-full">
                  Go to homepage
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Resend state (no token, user needs to request verification)
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <SEO title="Verify Email - TinlyLink" description="Verify your email address to complete registration." />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <Link to="/" className="flex justify-center">
          <span className="text-2xl font-bold text-secondary">
            Tinly<span className="text-primary">Link</span>
          </span>
        </Link>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-xl border border-gray-200 text-center">
          <div className="mx-auto w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Verify your email</h2>
          
          {isAuthenticated && user ? (
            <>
              <p className="text-gray-600 mb-6">
                We've sent a verification link to <strong>{user.email}</strong>. 
                Click the link in the email to verify your account.
              </p>
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={handleResend}
                  isLoading={isResending}
                  disabled={resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
                </Button>
                <Link to="/dashboard">
                  <Button variant="ghost" className="w-full">
                    Skip for now
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Make sure to check your spam folder if you don't see the email.
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-600 mb-6">
                Please sign in to verify your email address or request a new verification link.
              </p>
              <Link to="/login">
                <Button className="w-full">
                  Sign in
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
