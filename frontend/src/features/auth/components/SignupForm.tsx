import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { PhoneInput } from '../../../components/ui/PhoneInput';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { authApi } from '../../../api/auth';
import type { RegisterPayload } from '../../../types/auth';
import { motion } from 'framer-motion';

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterPayload | 'confirm_password', string>>>({});
  
  // Steps: 'form' -> 'otp' -> 'verified'
  const [step, setStep] = useState<'form' | 'otp' | 'verified'>('form');
  const [registeredEmail, setRegisteredEmail] = useState('');

  const [otpArray, setOtpArray] = useState<string[]>(Array(6).fill(''));
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpError, setOtpError] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);
  
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const [formData, setFormData] = useState<RegisterPayload & { confirm_password: string }>({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirm_password: '',
    role: 'PATIENT',
    pmdc_number: '',
  });

  // Handle countdown timer for OTP resend
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handlePhoneChange = (val: string | undefined) => {
    const phoneVal = val || '';
    setFormData((prev) => ({ ...prev, phone_number: phoneVal }));
    if (fieldErrors.phone_number) {
      setFieldErrors((prev) => ({ ...prev, phone_number: undefined }));
    }
  };

  const validate = () => {
    const errors: typeof fieldErrors = {};

    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.phone_number) {
      errors.phone_number = 'Phone number is required';
    } else if (!isValidPhoneNumber(formData.phone_number)) {
      errors.phone_number = 'Please enter a valid phone number with country code';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirm_password) {
      errors.confirm_password = 'Confirm password is required';
    } else if (formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }

    if (!formData.role) {
      errors.role = 'Please select your account role';
    }

    if (formData.role === 'DOCTOR' && !formData.pmdc_number?.trim()) {
      errors.pmdc_number = 'PMDC registration number is required for doctors';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    setGlobalSuccess('');

    if (!validate()) return;

    setIsLoading(true);
    try {
      const payload: RegisterPayload = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_number: formData.phone_number,
        password: formData.password,
        role: formData.role,
      };

      if (formData.role === 'DOCTOR' && formData.pmdc_number?.trim()) {
        payload.pmdc_number = formData.pmdc_number.trim();
      }

      await authApi.register(payload);
      setRegisteredEmail(payload.email);
      setStep('otp');
      setResendTimer(60);
      setCanResend(false);
      setGlobalSuccess('Registration successful! Verification code sent to your email.');
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        (Array.isArray(err.response?.data?.detail)
          ? err.response?.data?.detail.map((d: any) => d.msg).join(', ')
          : 'Registration failed. Please check your information and try again.');
      setGlobalError(typeof msg === 'string' ? msg : 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Handling
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpArray];
    newOtp[index] = value.slice(-1);
    setOtpArray(newOtp);
    setOtpError(false);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtpArray(digits);
      otpInputRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpArray.join('');
    if (otpCode.length !== 6) {
      setOtpError(true);
      setGlobalError('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsLoading(true);
    setGlobalError('');
    try {
      await authApi.verifyEmail({ email: registeredEmail, otp: otpCode });
      setOtpSuccess(true);
      setTimeout(() => {
        setStep('verified');
      }, 800);
    } catch (err: any) {
      setOtpError(true);
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Invalid or expired OTP code.';
      setGlobalError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || isLoading) return;
    setIsLoading(true);
    setGlobalError('');
    setGlobalSuccess('');
    try {
      await authApi.resendOtp({ email: registeredEmail });
      setGlobalSuccess('A fresh verification code has been sent to your email.');
      setResendTimer(60);
      setCanResend(false);
      setOtpArray(Array(6).fill(''));
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to resend code.';
      setGlobalError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'verified') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="auth-success-screen"
        style={{ textAlign: 'center', padding: '40px 20px' }}
      >
        <div style={{ fontSize: '3rem', color: 'var(--color-primary, #1b4332)', marginBottom: '16px' }}>
          ✓
        </div>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px', color: 'var(--color-primary-dark, #0f2b19)' }}>
          Account Verified!
        </h2>
        <p style={{ color: 'var(--color-text-muted, #555)', marginBottom: '24px', lineHeight: 1.6 }}>
          Your email has been confirmed and your EpiCare account is active.<br />
          You can now switch to <strong>Sign In</strong> to access your dashboard.
        </p>
      </motion.div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="auth-form" style={{ textAlign: 'center' }}>
        <div className="auth-form-header">
          <h2>Verify Your Email</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted, #666)', marginTop: '8px' }}>
            Enter the 6-digit verification code sent to<br/><strong>{registeredEmail}</strong>
          </p>
        </div>

        {globalError && (
          <div className="auth-error-banner" role="alert" style={{ marginBottom: '16px' }}>
            {globalError}
          </div>
        )}
        
        {globalSuccess && (
          <div className="auth-success-banner" role="alert" style={{ background: 'rgba(46, 204, 113, 0.1)', color: '#27ae60', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(46, 204, 113, 0.3)', fontSize: '0.9rem' }}>
            {globalSuccess}
          </div>
        )}

        <form onSubmit={handleVerifyOtp}>
          <div className="otp-container" style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '24px 0' }}>
            {otpArray.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { otpInputRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                onPaste={handleOtpPaste}
                disabled={isLoading || otpSuccess}
                className={`otp-digit-input ${otpError ? 'error' : ''} ${otpSuccess ? 'success' : ''}`}
                style={{
                  width: '44px',
                  height: '52px',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  borderRadius: '8px',
                  border: otpError ? '2px solid var(--color-danger, #e74c3c)' : '1.5px solid var(--color-border, #ddd)',
                  background: 'var(--color-background, #fff)',
                  color: 'var(--color-text-main, #222)',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>

          <Button type="submit" isLoading={isLoading} className="w-full" disabled={otpSuccess}>
            {otpSuccess ? 'Verified!' : 'Confirm OTP'}
          </Button>

          <div style={{ marginTop: '20px', fontSize: '0.9rem', color: 'var(--color-text-muted, #777)' }}>
            Didn't receive the code?{' '}
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={!canResend || isLoading || otpSuccess}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: canResend ? 'var(--color-primary, #1b4332)' : 'var(--color-text-muted, #999)',
                fontWeight: '600',
                cursor: canResend ? 'pointer' : 'default',
                textDecoration: canResend ? 'underline' : 'none',
              }}
            >
              {canResend ? 'Resend Code' : `Resend in ${resendTimer}s`}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="auth-form-header">
        <h2>Create an account</h2>
      </div>

      {globalError && (
        <div className="auth-error-banner" role="alert">
          {globalError}
        </div>
      )}

      <div className="auth-form-row">
        <Input
          id="full_name"
          name="full_name"
          label="Full Name"
          value={formData.full_name}
          onChange={handleChange}
          error={fieldErrors.full_name}
          placeholder="Enter your full name"
          required
        />
        <Input
          id="email"
          name="email"
          type="email"
          label="Email Address"
          value={formData.email}
          onChange={handleChange}
          error={fieldErrors.email}
          placeholder="Enter your email address"
          required
        />
      </div>

      <div className="auth-form-row">
        <PhoneInput
          id="phone_number"
          label="Phone Number"
          value={formData.phone_number}
          onChange={handlePhoneChange}
          error={fieldErrors.phone_number}
          required
        />
        <Select
          id="role"
          name="role"
          label="I am a"
          value={formData.role}
          onChange={(val) => {
            setFormData((prev) => ({ ...prev, role: val as RegisterPayload['role'] }));
            if (fieldErrors.role) {
              setFieldErrors((prev) => ({ ...prev, role: undefined }));
            }
          }}
          error={fieldErrors.role}
          options={[
            { value: 'PATIENT', label: 'Patient' },
            { value: 'CARETAKER', label: 'Caretaker / Family' },
            { value: 'DOCTOR', label: 'Neurologist / Doctor' },
          ]}
        />
      </div>

      {formData.role === 'DOCTOR' && (
        <div className="auth-form-row">
          <Input
            id="pmdc_number"
            name="pmdc_number"
            label="PMDC Registration Number"
            value={formData.pmdc_number || ''}
            onChange={handleChange}
            error={fieldErrors.pmdc_number}
            placeholder="12345-P"
            required
          />
        </div>
      )}

      <div className="auth-form-row">
        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          value={formData.password}
          onChange={handleChange}
          error={fieldErrors.password}
          placeholder="••••••••"
          required
        />
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          label="Confirm Password"
          value={formData.confirm_password}
          onChange={handleChange}
          error={fieldErrors.confirm_password}
          placeholder="••••••••"
          required
        />
      </div>

      <div className="auth-form-actions">
        <Button type="submit" isLoading={isLoading} className="w-full">
          Create Account
        </Button>
      </div>
    </form>
  );
}
