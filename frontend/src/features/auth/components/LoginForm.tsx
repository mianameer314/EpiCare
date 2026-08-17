import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { authApi } from '../../../api/auth';
import type { LoginPayload } from '../../../types/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';

type FormState = LoginPayload & {
  otp: string;
  new_password: string;
  confirm_password: string;
};

interface LoginFormProps {
  onToggleMode?: () => void;
}

export function LoginForm({ onToggleMode }: LoginFormProps) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'none' | 'email' | 'otp' | 'reset'>('none');
  const [rememberMe, setRememberMe] = useState(false);

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
        <h2>
          {forgotPasswordStep === 'none' && 'Welcome back'}
          {forgotPasswordStep === 'email' && 'Forgot Password'}
          {forgotPasswordStep === 'otp' && 'OTP Verification'}
          {forgotPasswordStep === 'reset' && 'Create New Password'}
        </h2>
        <p>
          {forgotPasswordStep === 'none' && 'Sign in to access your neurology telemetry portal.'}
          {forgotPasswordStep === 'email' && 'Enter your email to receive a password reset code.'}
          {forgotPasswordStep === 'otp' && `Enter the 6-digit code sent to ${formData.email}`}
          {forgotPasswordStep === 'reset' && 'Create a new secure password for your account.'}
        </p>
      </div>

      {globalError && (
        <div className="auth-error-banner" role="alert">
          {globalError}
        </div>
      )}
      
      {globalSuccess && forgotPasswordStep !== 'otp' && (
        <div className="auth-success-banner" role="alert">
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
        <>
          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={handleChange}
            error={fieldErrors.password}
          />
          <div className="auth-forgot-row">
            <label 
              className="auth-remember-toggle"
              onClick={() => setRememberMe(!rememberMe)}
            >
              <div 
                className={`auth-switch ${rememberMe ? 'on' : ''}`} 
                role="switch" 
                aria-checked={rememberMe}
              />
              <span>Remember me</span>
            </label>
            <a
              href="#"
              className="auth-forgot-link"
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
        </>
      )}

      {forgotPasswordStep === 'otp' && (
        <div className="otp-container">
          {otpArray.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                otpInputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(index, e)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text').trim();
                if (/^\d{6}$/.test(pasted)) {
                  const digits = pasted.split('');
                  setOtpArray(digits);
                  otpInputRefs.current[5]?.focus();
                  handleOtpChange(5, digits[5]);
                }
              }}
              className={`otp-digit-input ${otpError ? 'error' : ''} ${otpSuccess ? 'success' : ''}`}
              disabled={isLoading || otpSuccess}
              autoComplete="one-time-code"
              aria-label={`Reset verification digit ${index + 1}`}
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

      <div className="auth-form-actions">
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
            className="auth-back-link"
          >
            Back to Sign In
          </button>
        )}

        {forgotPasswordStep === 'none' && onToggleMode && (
          <div className="auth-switch-text">
            Don't have an account?{' '}
            <a onClick={onToggleMode}>Sign up</a>
          </div>
        )}
      </div>
    </form>
  );
}
