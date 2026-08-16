import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { authApi } from '../../../api/auth';
import type { LoginPayload } from '../../../types/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { BrandLogo } from '../../../components/shared/BrandLogo';

type FormState = LoginPayload & {
  otp: string;
  new_password: string;
  confirm_password: string;
};

export function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'none' | 'email' | 'otp' | 'reset'>('none');

  const [formData, setFormData] = useState<FormState>({
    email: '',
    password: '',
    otp: '',
    new_password: '',
    confirm_password: '',
  });

  const [otpArray, setOtpArray] = useState<string[]>(Array(6).fill(''));
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpError, setOtpError] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);

  useEffect(() => {
    if (forgotPasswordStep === 'otp' && otpInputRefs.current[0]) {
      otpInputRefs.current[0].focus();
    }
  }, [forgotPasswordStep]);

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
      await login(formData.email, formData.password);
      navigate('/dashboard');
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
      setForgotPasswordStep('otp');
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = async (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    
    setOtpError(false);
    const newOtp = [...otpArray];
    newOtp[index] = value;
    setOtpArray(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(d => d !== '')) {
      const otpCode = newOtp.join('');
      setIsLoading(true);
      try {
        await authApi.verifyResetOtp({ email: formData.email, otp: otpCode });
        setOtpSuccess(true);
        setGlobalSuccess('OTP Verified!');
        setGlobalError('');
        setTimeout(() => {
          setForgotPasswordStep('reset');
          setFormData(prev => ({ ...prev, otp: otpCode }));
          setOtpSuccess(false);
          setOtpArray(Array(6).fill(''));
        }, 800);
      } catch {
        setOtpError(true);
        setGlobalError('Invalid OTP. Please try again.');
        setTimeout(() => {
          setOtpArray(Array(6).fill(''));
          setOtpError(false);
          otpInputRefs.current[0]?.focus();
        }, 1000);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleResetSubmit = async () => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    
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
      setGlobalError(err.message || 'Failed to reset password.');
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
          <BrandLogo size="lg" to="/" subtitle="Neurology AI Portal" />
        </div>
        <h2>
          {forgotPasswordStep === 'none' && 'Welcome back'}
          {forgotPasswordStep === 'email' && 'Forgot Password'}
          {forgotPasswordStep === 'otp' && 'OTP Verification'}
          {forgotPasswordStep === 'reset' && 'Create New Password'}
        </h2>
        {forgotPasswordStep === 'otp' && (
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-light)', marginTop: '8px' }}>
            Enter the 6-digit code sent to<br/><strong>{formData.email}</strong>
          </p>
        )}
      </div>

      {globalError && (
        <div className="auth-error-banner" role="alert">
          {globalError}
        </div>
      )}
      
      {globalSuccess && forgotPasswordStep !== 'otp' && (
        <div className="auth-success-banner" role="alert" style={{ background: 'rgba(46, 204, 113, 0.1)', color: '#27ae60', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(46, 204, 113, 0.3)', fontSize: '0.9rem' }}>
          {globalSuccess}
        </div>
      )}

      {forgotPasswordStep !== 'otp' && (
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
      )}

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

      {forgotPasswordStep === 'otp' && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '24px 0' }}>
          {otpArray.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                otpInputRefs.current[index] = el;
              }}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(index, e)}
              style={{
                width: '45px',
                height: '55px',
                textAlign: 'center',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: `2px solid ${
                  otpError ? '#e74c3c' : 
                  otpSuccess ? '#2ecc71' : 
                  digit ? 'var(--color-primary)' : 
                  '#e2e8f0'
                }`,
                background: otpError ? 'rgba(231, 76, 60, 0.05)' : otpSuccess ? 'rgba(46, 204, 113, 0.05)' : '#f8fafc',
                color: otpError ? '#c0392b' : otpSuccess ? '#27ae60' : 'var(--color-text-main)',
                transition: 'all 0.2s',
                outline: 'none',
                boxShadow: digit && !otpError && !otpSuccess ? '0 0 0 3px rgba(45, 90, 63, 0.1)' : 'none'
              }}
              disabled={isLoading || otpSuccess}
            />
          ))}
        </div>
      )}

      {forgotPasswordStep === 'reset' && (
        <>
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
        {forgotPasswordStep !== 'otp' && (
          <Button type="submit" className="w-full" isLoading={isLoading}>
            {forgotPasswordStep === 'none' && 'Sign In'}
            {forgotPasswordStep === 'email' && 'Send OTP'}
            {forgotPasswordStep === 'reset' && 'Reset Password'}
          </Button>
        )}
        
        {forgotPasswordStep !== 'none' && (
          <button 
            type="button" 
            onClick={() => {
              setForgotPasswordStep('none');
              setGlobalError('');
              setGlobalSuccess('');
              setOtpArray(Array(6).fill(''));
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
