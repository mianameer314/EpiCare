import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { authApi } from '../../../api/auth';
import type { LoginPayload } from '../../../types/auth';
import { useNavigate } from 'react-router-dom';

type FormState = LoginPayload & {
  otp: string;
  new_password: string;
  confirm_password: string;
};

export function LoginForm() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'none' | 'email' | 'reset'>('none');

  const [formData, setFormData] = useState<FormState>({
    email: '',
    password: '',
    otp: '',
    new_password: '',
    confirm_password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.id as keyof FormState;
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
    setGlobalError('');
    setGlobalSuccess('');
  };

  const handleLoginSubmit = async () => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!formData.email.trim()) errors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) errors.email = "Please enter a valid email address";
    if (!formData.password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.login({ email: formData.email, password: formData.password });
      localStorage.setItem('access_token', response.access_token);
      navigate('/');
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotEmailSubmit = async () => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!formData.email.trim()) errors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) errors.email = "Please enter a valid email address";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email: formData.email });
      setGlobalSuccess('OTP sent successfully to your email address.');
      setForgotPasswordStep('reset');
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!formData.otp.trim()) errors.otp = "OTP is required";
    else if (formData.otp.length !== 6) errors.otp = "OTP must be 6 digits";
    
    if (!formData.new_password) errors.new_password = "New password is required";
    else if (formData.new_password.length < 8) errors.new_password = "Password must be at least 8 characters";
    
    if (formData.new_password !== formData.confirm_password) {
      errors.confirm_password = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword({
        email: formData.email,
        otp: formData.otp,
        new_password: formData.new_password
      });
      setGlobalSuccess('Password reset successfully! You can now sign in.');
      setForgotPasswordStep('none');
      setFormData(prev => ({ ...prev, password: '', otp: '', new_password: '', confirm_password: '' }));
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to reset password. Check OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    setGlobalSuccess('');
    
    if (forgotPasswordStep === 'none') {
      await handleLoginSubmit();
    } else if (forgotPasswordStep === 'email') {
      await handleForgotEmailSubmit();
    } else if (forgotPasswordStep === 'reset') {
      await handleResetSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="auth-form-header">
        <div className="auth-brand">
          <img src="/logo.png" alt="EpiCare" className="auth-brand-logo" />
          <span className="auth-brand-name">
            <span className="brand-epi">Epi</span>
            <span className="brand-care">Care</span>
          </span>
        </div>
        <h2>{forgotPasswordStep === 'none' ? 'Welcome back' : 'Reset Password'}</h2>
      </div>

      {globalError && (
        <div className="auth-error-banner" role="alert">
          {globalError}
        </div>
      )}
      
      {globalSuccess && (
        <div className="auth-success-banner" role="alert" style={{ background: 'rgba(46, 204, 113, 0.1)', color: '#27ae60', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(46, 204, 113, 0.3)', fontSize: '0.9rem' }}>
          {globalSuccess}
        </div>
      )}

      <Input
        id="email"
        type="email"
        label="Email address"
        placeholder="Enter your email address"
        autoComplete="email"
        required
        value={formData.email}
        onChange={handleChange}
        error={fieldErrors.email}
        disabled={forgotPasswordStep === 'reset'}
      />

      {forgotPasswordStep === 'none' && (
        <div style={{ position: 'relative' }}>
          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={handleChange}
            error={fieldErrors.password}
          />
          <a
            href="#"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-primary)',
              textDecoration: 'none',
              fontWeight: 500
            }}
            onClick={(e) => {
              e.preventDefault();
              setForgotPasswordStep('email');
              setGlobalError('');
              setGlobalSuccess('');
              setFieldErrors({});
            }}
          >
            Forgot password?
          </a>
        </div>
      )}

      {forgotPasswordStep === 'reset' && (
        <>
          <Input
            id="otp"
            type="text"
            label="6-Digit OTP"
            placeholder="Enter OTP sent to email"
            required
            value={formData.otp}
            onChange={handleChange}
            error={fieldErrors.otp}
            maxLength={6}
          />
          <Input
            id="new_password"
            type="password"
            label="New Password"
            placeholder="Create a strong password"
            required
            value={formData.new_password}
            onChange={handleChange}
            error={fieldErrors.new_password}
          />
          <Input
            id="confirm_password"
            type="password"
            label="Confirm Password"
            placeholder="Repeat your new password"
            required
            value={formData.confirm_password}
            onChange={handleChange}
            error={fieldErrors.confirm_password}
          />
        </>
      )}

      <div className="auth-form-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Button type="submit" className="w-full" isLoading={isLoading}>
          {forgotPasswordStep === 'none' && 'Sign In'}
          {forgotPasswordStep === 'email' && 'Send OTP'}
          {forgotPasswordStep === 'reset' && 'Reset Password'}
        </Button>
        
        {forgotPasswordStep !== 'none' && (
          <button 
            type="button" 
            onClick={() => {
              setForgotPasswordStep('none');
              setGlobalError('');
              setGlobalSuccess('');
            }}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-main)', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Back to Sign In
          </button>
        )}
      </div>
    </form>
  );
}
