import { useId } from 'react';
import PhoneInputLib from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './PhoneInput.css'; // Custom overrides to match our design system

interface PhoneInputProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string | undefined) => void;
  required?: boolean;
  description?: string;
  error?: string;
}

export function PhoneInput({
  id: externalId,
  label,
  value,
  onChange,
  required,
  description,
  error
}: PhoneInputProps) {
  const internalId = useId();
  const id = externalId || internalId;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <div className="input-wrapper">
      <label htmlFor={id} className="input-label">
        {label}
        {required && <span className="input-required" aria-hidden="true">*</span>}
      </label>
      
      <div className={`custom-phone-container ${error ? 'has-error' : ''}`}>
        <PhoneInputLib
          id={id}
          defaultCountry="PK"
          value={value}
          onChange={onChange}
          className="custom-phone-input"
          aria-invalid={!!error}
          aria-describedby={
            error ? errorId : description ? descriptionId : undefined
          }
        />
      </div>

      {description && !error && (
        <p id={descriptionId} className="input-description">
          {description}
        </p>
      )}
      
      {error && (
        <div id={errorId} className="input-error-msg" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
