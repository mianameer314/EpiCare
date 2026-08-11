import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { authApi } from '../../../api/auth';
import type { LoginPayload } from '../../../types/auth';
import { useNavigate } from 'react-router-dom';

export function LoginForm() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginPayload, string>>>({});
  
  const [formData, setFormData] = useState<LoginPayload>({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.id as keyof LoginPayload;
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setGlobalError('');
    
    const errors: Partial<Record<keyof LoginPayload, string>> = {};
    
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setIsLoading(false);
      return;
    }

    try {
      const response = await authApi.login(formData);
      localStorage.setItem('access_token', response.access_token);
      // Optional: Set user context here
      navigate('/');
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
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
        <h2>Welcome back</h2>
      </div>

      {globalError && (
        <div className="auth-error-banner" role="alert">
          {globalError}
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
      />

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
          onClick={(e) => e.preventDefault()}
        >
          Forgot password?
        </a>
      </div>

      <div className="auth-form-actions">
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Sign In
        </Button>
      </div>
    </form>
  );
}
