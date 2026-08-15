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
  
  const [formData, setFormData] = useState<RegisterPayload & { confirm_password?: string }>({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
    role: 'PATIENT',
    pmdc_number: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (step === 'otp' && otpInputRefs.current[0]) {
      otpInputRefs.current[0].focus();
    }
  }, [step]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.id as keyof (RegisterPayload & { confirm_password?: string });
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
    setGlobalError('');
  };

  const handlePhoneChange = (val: string | undefined) => {
    setFormData(prev => ({ ...prev, phone_number: val || '' }));
    if (fieldErrors.phone_number) {
      setFieldErrors(prev => ({ ...prev, phone_number: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    
    const errors: Partial<Record<keyof RegisterPayload | 'confirm_password', string>> = {};
    
    if (!formData.full_name.trim()) errors.full_name = "Full name is required";
    
    if (!formData.phone_number) {
      errors.phone_number = "Phone number is required";
    } else if (!isValidPhoneNumber(formData.phone_number)) {
      errors.phone_number = "Please enter a valid phone number";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 8) {
      errors.password = "Password must be at least 8 characters long";
    }

    if (formData.password !== formData.confirm_password) {
      errors.confirm_password = "Passwords do not match";
    }

    if (formData.role === 'DOCTOR' && !formData.pmdc_number?.trim()) {
      errors.pmdc_number = "PMDC number is required for doctors";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const { confirm_password: _confirmPassword, ...payload } = formData;
      await authApi.register(payload);
      setRegisteredEmail(formData.email);
      setStep('otp');
      setGlobalSuccess('Verification code sent to your email. Check your inbox or server logs.');
    } catch (err: any) {
      setGlobalError(err.message || 'Registration failed. Please try again.');
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
        await authApi.verifyEmail({ email: registeredEmail, otp: otpCode });
        setOtpSuccess(true);
        setGlobalSuccess('Email verified successfully! You can now sign in.');
        setGlobalError('');
        setTimeout(() => {
          setStep('verified');
        }, 800);
      } catch (err: any) {
        setOtpError(true);
        setGlobalError(err.message || 'Invalid or expired OTP. Please try again.');
        setTimeout(() => {
          setOtpArray(Array(6).fill(''));
          setOtpError(false);
          otpInputRefs.current[0]?.focus();
        }, 1200);
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

  const handleResendOtp = async () => {
    setIsLoading(true);
    setGlobalError('');
    try {
      await authApi.resendOtp({ email: registeredEmail });
      setGlobalSuccess('A new verification code has been sent to your email.');
      setOtpArray(Array(6).fill(''));
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'verified') {
    return (
      <motion.div 
        className="auth-success-state"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{ textAlign: 'center', padding: '24px 0' }}
      >
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-primary-50)',
          color: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: '1.5rem',
          fontWeight: 'bold',
        }}>
          ✓
        </div>
        <h3 style={{ color: 'var(--color-primary-dark)', fontSize: 'var(--text-xl)', marginBottom: '8px' }}>
          Account Verified!
        </h3>
        <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.5', marginBottom: '24px' }}>
          Your email has been verified. You can now sign in with your credentials.
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-main)' }}>
          Click <strong>Sign In</strong> to access your dashboard.
        </p>
      </motion.div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="auth-form" style={{ textAlign: 'center' }}>
        <div className="auth-form-header">
          <div className="auth-brand">
            <img src="/logo.png" alt="EpiCare" className="auth-brand-logo" />
            <span className="auth-brand-name">
              <span className="brand-epi">Epi</span>
              <span className="brand-care">Care</span>
            </span>
          </div>
          <h2>Verify Your Email</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            Enter the 6-digit verification code sent to<br/><strong>{registeredEmail}</strong>
          </p>
        </div>

        {globalError && (
          <div className="auth-error-banner" role="alert" style={{ marginBottom: '16px' }}>
            {globalError}
          </div>
        )}
        
        {globalSuccess && (
          <div className="auth-success-banner" role="alert" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary-dark)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--color-primary-100)', fontSize: '0.9rem' }}>
            {globalSuccess}
          </div>
        )}

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
                  'var(--color-border)'
                }`,
                background: otpError ? 'rgba(231, 76, 60, 0.05)' : otpSuccess ? 'rgba(46, 204, 113, 0.05)' : 'var(--color-surface)',
                color: otpError ? '#c0392b' : otpSuccess ? '#27ae60' : 'var(--color-text-main)',
                transition: 'all 0.2s',
                outline: 'none',
                boxShadow: digit && !otpError && !otpSuccess ? '0 0 0 3px var(--color-primary-50)' : 'none'
              }}
              disabled={isLoading || otpSuccess}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={isLoading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
            }}
          >
            Resend verification code
          </button>
          
          <button
            type="button"
            onClick={() => {
              setStep('form');
              setGlobalError('');
              setGlobalSuccess('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            ← Back to registration form
          </button>
        </div>
      </div>
    );
  }

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
          type="text"
          label="Full name"
          placeholder="Enter your full name"
          required
          value={formData.full_name}
          onChange={handleChange}
          error={fieldErrors.full_name}
        />
        <PhoneInput
          id="phone_number"
          label="Phone number"
          required
          value={formData.phone_number}
          onChange={handlePhoneChange}
          error={fieldErrors.phone_number}
        />
      </div>

      <Input
        id="email"
        type="email"
        label="Email address"
        placeholder="Enter Your Email"
        required
        value={formData.email}
        onChange={handleChange}
        error={fieldErrors.email}
      />

      <div className="auth-form-row">
        <Input
          id="password"
          type="password"
          label="Password"
          placeholder="Create a strong password"
          required
          value={formData.password}
          onChange={handleChange}
          error={fieldErrors.password}
        />
        <Input
          id="confirm_password"
          type="password"
          label="Confirm password"
          placeholder="Repeat your password"
          required
          value={formData.confirm_password || ''}
          onChange={handleChange}
          error={fieldErrors.confirm_password}
        />
      </div>

      <Select
        id="role"
        label="I am a..."
        value={formData.role}
        onChange={(val) => setFormData(prev => ({ ...prev, role: val as any }))}
        options={[
          { value: 'PATIENT', label: 'Patient' },
          { value: 'CARETAKER', label: 'Caretaker' },
          { value: 'DOCTOR', label: 'Medical Professional' },
        ]}
      />

      {formData.role === 'DOCTOR' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Input
            id="pmdc_number"
            type="text"
            label="PMDC Number"
            required
            description="Required for medical professional verification."
            value={formData.pmdc_number || ''}
            onChange={handleChange}
            error={fieldErrors.pmdc_number}
          />
        </motion.div>
      )}

      <div className="auth-form-actions">
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Create Account
        </Button>
      </div>
    </form>
  );
}
