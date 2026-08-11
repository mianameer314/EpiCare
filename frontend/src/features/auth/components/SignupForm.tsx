import React, { useState } from 'react';
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterPayload | 'confirm_password', string>>>({});
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<RegisterPayload & { confirm_password?: string }>({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
    role: 'PATIENT',
    pmdc_number: '',
    confirm_password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.id as keyof (RegisterPayload & { confirm_password?: string });
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePhoneChange = (val: string | undefined) => {
    setFormData(prev => ({ ...prev, phone_number: val || '' }));
    if (fieldErrors.phone_number) {
      setFieldErrors(prev => ({ ...prev, phone_number: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
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

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setIsLoading(false);
      return;
    }

    try {
      // Exclude confirm_password before sending to API
      const { confirm_password, ...payload } = formData;
      await authApi.register(payload);
      setSuccess(true);
    } catch (err: any) {
      setGlobalError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div 
        className="auth-success-state"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h3 style={{ color: 'var(--color-primary-dark)', fontSize: 'var(--text-xl)', marginBottom: '8px' }}>Account Created!</h3>
        <p style={{ color: 'var(--color-text-main)', lineHeight: '1.5' }}>
          Please check your email to verify your account before signing in.
        </p>
      </motion.div>
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
