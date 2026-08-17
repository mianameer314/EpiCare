import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  ShieldCheck,
  Mail,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Stethoscope,
  HeartHandshake,
  Save,
  Plus,
  Phone,
  Activity,
  ShieldAlert,
  Edit3,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { authApi } from '../../api/auth';
import {
  usersApi,
  type PatientProfileData,
  type DoctorProfileData,
  type CaretakerProfileData,
} from '../../api/users';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useUnsavedChanges } from '../../providers/UnsavedChangesProvider';
import './ProfilePage.css';

/* ────────────────────────────────────────────────────
   Profile Management Page — User Bio, Clinical Profile & Security
   ──────────────────────────────────────────────────── */

const COMMON_EPILEPSY_TRIGGERS = [
  'Sleep Deprivation',
  'Flashing Lights / Photosensitivity',
  'Emotional Stress',
  'Missed Medication',
  'Fever / Physical Illness',
  'Dehydration',
  'Alcohol / Caffeine',
  'Physical Overexertion',
  'Hormonal Fluctuations',
];

const POPULAR_TIMEZONES = [
  { value: 'Asia/Karachi', label: '🇵🇰 Pakistan Standard Time (PKT, UTC+05:00) — Karachi, Islamabad, Lahore' },
  { value: 'Asia/Dubai', label: '🇦🇪 Gulf Standard Time (GST, UTC+04:00) — Dubai, Abu Dhabi, Muscat' },
  { value: 'Asia/Riyadh', label: '🇸🇦 Saudi Arabia Time (AST, UTC+03:00) — Riyadh, Jeddah, Makkah' },
  { value: 'Asia/Kolkata', label: '🇮🇳 India Standard Time (IST, UTC+05:30) — Mumbai, Delhi, Bengaluru' },
  { value: 'Asia/Dhaka', label: '🇧🇩 Bangladesh Time (BST, UTC+06:00) — Dhaka' },
  { value: 'Asia/Kabul', label: '🇦🇫 Afghanistan Time (AFT, UTC+04:30) — Kabul' },
  { value: 'Europe/London', label: '🇬🇧 UK / Greenwich Mean Time (GMT/BST, UTC+00:00) — London' },
  { value: 'Europe/Berlin', label: '🇩🇪 Central European Time (CET, UTC+01:00) — Berlin, Frankfurt' },
  { value: 'Europe/Paris', label: '🇫🇷 Central European Time (CET, UTC+01:00) — Paris' },
  { value: 'Europe/Istanbul', label: '🇹🇷 Turkey Time (TRT, UTC+03:00) — Istanbul, Ankara' },
  { value: 'America/New_York', label: '🇺🇸 US Eastern Time (ET, UTC-05:00) — New York, Miami, Boston' },
  { value: 'America/Chicago', label: '🇺🇸 US Central Time (CT, UTC-06:00) — Chicago, Dallas, Houston' },
  { value: 'America/Denver', label: '🇺🇸 US Mountain Time (MT, UTC-07:00) — Denver, Phoenix' },
  { value: 'America/Los_Angeles', label: '🇺🇸 US Pacific Time (PT, UTC-08:00) — Los Angeles, San Francisco, Seattle' },
  { value: 'America/Toronto', label: '🇨🇦 Canada Eastern Time (ET, UTC-05:00) — Toronto, Montreal' },
  { value: 'Asia/Singapore', label: '🇸🇬 Singapore Standard Time (SGT, UTC+08:00) — Singapore' },
  { value: 'Asia/Tokyo', label: '🇯🇵 Japan Standard Time (JST, UTC+09:00) — Tokyo' },
  { value: 'Australia/Sydney', label: '🇦🇺 Australian Eastern Time (AEST, UTC+10:00) — Sydney, Melbourne' },
  { value: 'UTC', label: '🌐 Coordinated Universal Time (UTC+00:00)' },
];

function detectLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';
  } catch {
    return 'Asia/Karachi';
  }
}

interface MissingFieldItem {
  id: string;
  label: string;
  category: 'clinical' | 'emergency' | 'account';
}

interface ValidationErrors {
  date_of_birth?: string;
  blood_type?: string;
  city?: string;
  primary_diagnosis?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  specialty?: string;
  hospital_affiliation?: string;
  license_image_url?: string;
  relationship_to_patient?: string;
  crisis_phone_number?: string;
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
}

function computeProfileCompletion(
  role?: string,
  user?: any,
  patient?: PatientProfileData,
  doctor?: DoctorProfileData,
  caretaker?: CaretakerProfileData
): { percentage: number; missingFields: MissingFieldItem[]; completedCount: number; totalCount: number } {
  const missing: MissingFieldItem[] = [];
  let total = 0;
  let filled = 0;

  // Common User fields
  total += 2;
  if (user?.full_name?.trim()) filled++; else missing.push({ id: 'acc_name', label: 'Full Legal Name', category: 'account' });
  if (user?.phone_number?.trim()) filled++; else missing.push({ id: 'acc_phone', label: 'Contact Phone Number', category: 'account' });

  if (role === 'PATIENT') {
    // 1. Date of Birth (check not default today)
    total++;
    const isDefaultDob = patient?.date_of_birth && new Date(patient.date_of_birth).toDateString() === new Date().toDateString();
    if (patient?.date_of_birth && !isDefaultDob) filled++; else missing.push({ id: 'p_dob', label: 'Date of Birth', category: 'clinical' });

    // 2. Gender
    total++;
    if (patient?.gender) filled++; else missing.push({ id: 'p_gender', label: 'Gender', category: 'clinical' });

    // 3. Blood Group
    total++;
    if (patient?.blood_type?.trim()) filled++; else missing.push({ id: 'p_blood', label: 'Blood Group', category: 'clinical' });

    // 4. City / Location
    total++;
    if (patient?.city?.trim()) filled++; else missing.push({ id: 'p_city', label: 'City / Location', category: 'clinical' });

    // 5. Primary Diagnosis
    total++;
    if (patient?.primary_diagnosis?.trim()) filled++; else missing.push({ id: 'p_diag', label: 'Primary Diagnosis / Seizure Type', category: 'clinical' });

    // 6. Emergency Contact Name
    total++;
    if (patient?.emergency_contact_name?.trim()) filled++; else missing.push({ id: 'p_em_name', label: 'Emergency Contact Name', category: 'emergency' });

    // 7. Emergency Contact Phone
    total++;
    if (patient?.emergency_contact_phone?.trim()) filled++; else missing.push({ id: 'p_em_phone', label: 'Emergency Contact Phone', category: 'emergency' });

    // 8. Emergency Contact Relation
    total++;
    if (patient?.emergency_contact_relation?.trim()) filled++; else missing.push({ id: 'p_em_rel', label: 'Emergency Contact Relation', category: 'emergency' });

    // 9. Known Seizure Triggers
    total++;
    if (patient?.known_triggers && patient.known_triggers.length > 0) filled++; else missing.push({ id: 'p_triggers', label: 'Known Seizure Triggers', category: 'clinical' });
  } else if (role === 'DOCTOR') {
    // 1. PMDC Number
    total++;
    if (doctor?.pmdc_number?.trim()) filled++; else missing.push({ id: 'doc_pmdc', label: 'PMDC License Number', category: 'clinical' });

    // 2. Specialty
    total++;
    if (doctor?.specialty?.trim()) filled++; else missing.push({ id: 'doc_spec', label: 'Clinical Specialty', category: 'clinical' });

    // 3. Hospital Affiliation
    total++;
    if (doctor?.hospital_affiliation?.trim()) filled++; else missing.push({ id: 'doc_hosp', label: 'Hospital / Clinic Affiliation', category: 'clinical' });

    // 4. License Image / Document URL
    total++;
    if (doctor?.license_image_url?.trim()) filled++; else missing.push({ id: 'doc_license_doc', label: 'PMDC Verification Certificate', category: 'clinical' });
  } else if (role === 'CARETAKER') {
    // 1. Relationship to Patient
    total++;
    if (caretaker?.relationship_to_patient?.trim()) filled++; else missing.push({ id: 'care_relation', label: 'Relationship to Patient', category: 'emergency' });

    // 2. Crisis Phone Number
    total++;
    if (caretaker?.crisis_phone_number?.trim()) filled++; else missing.push({ id: 'care_crisis_phone', label: '24/7 Crisis Call Number', category: 'emergency' });
  }

  const percentage = total === 0 ? 100 : Math.min(100, Math.round((filled / total) * 100));
  return { percentage, missingFields: missing, completedCount: filled, totalCount: total };
}

export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  // Validation errors state
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Clinical profile state
  const [patientForm, setPatientForm] = useState<PatientProfileData>({
    date_of_birth: '',
    gender: 'Male',
    blood_type: '',
    city: '',
    primary_diagnosis: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    known_triggers: [],
    notes: '',
    timezone: 'UTC',
  });

  const [doctorForm, setDoctorForm] = useState<DoctorProfileData>({
    pmdc_number: '',
    specialty: 'Neurologist',
    hospital_affiliation: '',
    license_image_url: '',
  });

  const [caretakerForm, setCaretakerForm] = useState<CaretakerProfileData>({
    relationship_to_patient: '',
    crisis_phone_number: '',
  });

  const [customTriggerInput, setCustomTriggerInput] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Patient Medical Profile editing state
  const [isEditingPatient, setIsEditingPatient] = useState(false);

  // User Bio editing state
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioForm, setBioForm] = useState({
    full_name: user?.full_name || '',
    phone_number: user?.phone_number || '',
  });
  const [bioSuccess, setBioSuccess] = useState('');
  const [bioError, setBioError] = useState('');

  useEffect(() => {
    if (user) {
      setBioForm({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
      });
    }
  }, [user]);

  const updateBioMutation = useMutation({
    mutationFn: (data: { full_name?: string; phone_number?: string }) => authApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setBioSuccess('Account profile updated successfully!');
      setIsEditingBio(false);
      setTimeout(() => setBioSuccess(''), 4000);
    },
    onError: (err: any) => {
      setBioError(err?.response?.data?.detail || 'Failed to update account information');
    },
  });

  const isBioDirty = useMemo(() => {
    if (!user) return false;
    return (
      bioForm.full_name.trim() !== (user.full_name || '') ||
      bioForm.phone_number.trim() !== (user.phone_number || '')
    );
  }, [user, bioForm]);

  const handleBioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBioError('');
    if (!bioForm.full_name.trim()) {
      setBioError('Full legal name is required');
      return;
    }
    updateBioMutation.mutate({
      full_name: bioForm.full_name.trim(),
      phone_number: bioForm.phone_number.trim(),
    });
  };

  // Timezone options calculation
  const detectedTz = useMemo(() => detectLocalTimezone(), []);
  const allTimezoneOptions = useMemo(() => {
    const current = patientForm.timezone || detectedTz;
    const list = [...POPULAR_TIMEZONES];
    if (current && !list.some((tz) => tz.value === current)) {
      list.unshift({ value: current, label: `📍 Current Setting: ${current}` });
    }
    return list;
  }, [patientForm.timezone, detectedTz]);

  // Fetch role-specific profile
  const { data: patientProfile } = useQuery({
    queryKey: ['profile', 'patient'],
    queryFn: usersApi.getPatientProfile,
    enabled: user?.role === 'PATIENT',
  });

  const { data: doctorProfile } = useQuery({
    queryKey: ['profile', 'doctor'],
    queryFn: usersApi.getDoctorProfile,
    enabled: user?.role === 'DOCTOR',
  });

  const { data: caretakerProfile } = useQuery({
    queryKey: ['profile', 'caretaker'],
    queryFn: usersApi.getCaretakerProfile,
    enabled: user?.role === 'CARETAKER',
  });

  useEffect(() => {
    if (patientProfile) {
      setPatientForm((prev) => ({ ...prev, ...patientProfile }));
    }
  }, [patientProfile]);

  useEffect(() => {
    if (doctorProfile) {
      setDoctorForm((prev) => ({ ...prev, ...doctorProfile }));
    }
  }, [doctorProfile]);

  useEffect(() => {
    if (caretakerProfile) {
      setCaretakerForm((prev) => ({ ...prev, ...caretakerProfile }));
    }
  }, [caretakerProfile]);

  // Compute profile completion dynamically
  const completion = useMemo(() => {
    return computeProfileCompletion(
      user?.role,
      user,
      patientForm,
      doctorForm,
      caretakerForm
    );
  }, [user, patientForm, doctorForm, caretakerForm]);

  // Auto-dismiss 100% completion card after a few seconds, re-show if data becomes missing
  const [isCompletionCardHidden, setIsCompletionCardHidden] = useState(false);
  useEffect(() => {
    if (completion.percentage < 100) {
      setIsCompletionCardHidden(false);
    } else if (completion.percentage === 100) {
      const timer = setTimeout(() => {
        setIsCompletionCardHidden(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [completion.percentage]);

  // Check if Patient form has unsaved modifications
  const isPatientDirty = useMemo(() => {
    if (!patientProfile) return false;
    const initialDob = patientProfile.date_of_birth || '';
    const currentDob = patientForm.date_of_birth || '';
    const initialBlood = patientProfile.blood_type || '';
    const currentBlood = patientForm.blood_type || '';
    const initialCity = patientProfile.city || '';
    const currentCity = patientForm.city || '';
    const initialDiag = patientProfile.primary_diagnosis || '';
    const currentDiag = patientForm.primary_diagnosis || '';
    const initialEmName = patientProfile.emergency_contact_name || '';
    const currentEmName = patientForm.emergency_contact_name || '';
    const initialEmPhone = patientProfile.emergency_contact_phone || '';
    const currentEmPhone = patientForm.emergency_contact_phone || '';
    const initialEmRel = patientProfile.emergency_contact_relation || '';
    const currentEmRel = patientForm.emergency_contact_relation || '';
    const initialGender = patientProfile.gender || 'Male';
    const currentGender = patientForm.gender || 'Male';
    const initialNotes = patientProfile.notes || '';
    const currentNotes = patientForm.notes || '';
    const initialTz = patientProfile.timezone || '';
    const currentTz = patientForm.timezone || '';
    const initialTriggers = JSON.stringify(patientProfile.known_triggers || []);
    const currentTriggers = JSON.stringify(patientForm.known_triggers || []);

    return (
      initialDob !== currentDob ||
      initialBlood !== currentBlood ||
      initialCity !== currentCity ||
      initialDiag !== currentDiag ||
      initialEmName !== currentEmName ||
      initialEmPhone !== currentEmPhone ||
      initialEmRel !== currentEmRel ||
      initialGender !== currentGender ||
      initialNotes !== currentNotes ||
      initialTz !== currentTz ||
      initialTriggers !== currentTriggers
    );
  }, [patientProfile, patientForm]);

  // Check if Doctor form has unsaved modifications
  const isDoctorDirty = useMemo(() => {
    if (!doctorProfile) return false;
    return (
      (doctorProfile.specialty || 'Neurologist') !== (doctorForm.specialty || 'Neurologist') ||
      (doctorProfile.hospital_affiliation || '') !== (doctorForm.hospital_affiliation || '') ||
      (doctorProfile.license_image_url || '') !== (doctorForm.license_image_url || '')
    );
  }, [doctorProfile, doctorForm]);

  // Check if Caretaker form has unsaved modifications
  const isCaretakerDirty = useMemo(() => {
    if (!caretakerProfile) return false;
    return (
      (caretakerProfile.relationship_to_patient || '') !== (caretakerForm.relationship_to_patient || '') ||
      (caretakerProfile.crisis_phone_number || '') !== (caretakerForm.crisis_phone_number || '')
    );
  }, [caretakerProfile, caretakerForm]);

  // Check if Password form has valid input
  const isPasswordDirty = Boolean(currentPassword || newPassword || confirmPassword);
  const isPasswordValid = Boolean(
    currentPassword.trim() &&
    newPassword.length >= 8 &&
    confirmPassword &&
    newPassword === confirmPassword
  );

  const isFormDirty = useMemo(() => {
    const baseDirty = isBioDirty || isPasswordDirty;
    if (user?.role === 'PATIENT') return isPatientDirty || baseDirty;
    if (user?.role === 'DOCTOR') return isDoctorDirty || baseDirty;
    if (user?.role === 'CARETAKER') return isCaretakerDirty || baseDirty;
    return baseDirty;
  }, [user?.role, isPatientDirty, isDoctorDirty, isCaretakerDirty, isBioDirty, isPasswordDirty]);

  useUnsavedChanges(isFormDirty, "You have unsaved changes in your profile. Are you sure you want to leave without saving?");

  // ── Field-Level Validation Rules ──
  const validateField = (fieldName: keyof ValidationErrors, value: string): string => {
    const trimmed = value ? value.trim() : '';

    switch (fieldName) {
      case 'date_of_birth': {
        if (!trimmed) return 'Date of birth is required';
        const dateObj = new Date(trimmed);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isNaN(dateObj.getTime())) return 'Please enter a valid date';
        if (dateObj >= today) return 'Date of birth must be a past date';
        if (dateObj < new Date('1900-01-01')) return 'Date must be after 1900';
        return '';
      }

      case 'blood_type': {
        if (!trimmed) return '';
        const normalized = trimmed.toUpperCase().replace(/^0/, 'O');
        if (!/^(A|B|AB|O)[+-]$/.test(normalized)) {
          return 'Invalid blood group. Use standard notation: O+, O-, A+, A-, B+, B-, AB+, AB-';
        }
        return '';
      }

      case 'emergency_contact_phone': {
        if (!trimmed) return '';
        if (!/^\+?[1-9]\d{6,14}$/.test(trimmed)) {
          return 'Must be a valid international phone format (e.g. +923001234567)';
        }
        return '';
      }

      case 'crisis_phone_number': {
        if (!trimmed) return '';
        if (!/^\+?[1-9]\d{6,14}$/.test(trimmed)) {
          return 'Must be a valid 24/7 crisis phone format (e.g. +923001234567)';
        }
        return '';
      }

      case 'primary_diagnosis': {
        if (trimmed.length > 100) return 'Primary diagnosis must be 100 characters or fewer';
        return '';
      }

      case 'emergency_contact_name': {
        if (trimmed.length > 150) return 'Contact name must be 150 characters or fewer';
        return '';
      }

      case 'emergency_contact_relation': {
        if (trimmed.length > 100) return 'Relationship must be 100 characters or fewer';
        return '';
      }

      case 'city': {
        if (!trimmed) return '';
        if (/^\d+$/.test(trimmed)) {
          return 'City name must contain alphabetic letters (e.g. Islamabad, Lahore)';
        }
        if (!/^[a-zA-Z\s\.,'-]+$/.test(trimmed)) {
          return 'City name should only contain letters and standard punctuation';
        }
        if (trimmed.length > 100) return 'City name must be 100 characters or fewer';
        return '';
      }

      case 'specialty': {
        if (trimmed.length > 100) return 'Specialty must be 100 characters or fewer';
        return '';
      }

      case 'hospital_affiliation': {
        if (trimmed.length > 200) return 'Hospital affiliation must be 200 characters or fewer';
        return '';
      }

      case 'license_image_url': {
        if (!trimmed) return '';
        if (!/^https?:\/\/.+/i.test(trimmed)) {
          return 'Must be a valid URL starting with http:// or https://';
        }
        return '';
      }

      case 'relationship_to_patient': {
        if (trimmed.length > 100) return 'Relationship must be 100 characters or fewer';
        return '';
      }

      default:
        return '';
    }
  };

  // Helper to parse backend error responses
  const parseBackendError = (err: any) => {
    const newErrors: ValidationErrors = {};
    if (err?.response?.data?.detail) {
      const detail = err.response.data.detail;
      if (Array.isArray(detail)) {
        detail.forEach((item: any) => {
          const field = item.loc?.[item.loc.length - 1];
          if (field) {
            newErrors[field as keyof ValidationErrors] = item.msg || 'Invalid value entered';
          }
        });
      } else if (typeof detail === 'string') {
        setProfileError(detail);
      }
    } else {
      setProfileError(err?.message || 'Request validation failed. Please check the highlighted fields.');
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }));
      setProfileError('Please correct the highlighted fields with red warnings below.');
    }
  };

  // Mutations
  const updatePatientMutation = useMutation({
    mutationFn: (data: PatientProfileData) => usersApi.updatePatientProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'patient'] });
      setProfileSuccess('Patient clinical profile saved successfully.');
      setIsEditingPatient(false);
      setProfileError('');
      setErrors({});
      setTimeout(() => setProfileSuccess(''), 4000);
    },
    onError: (err: any) => parseBackendError(err),
  });

  const updateDoctorMutation = useMutation({
    mutationFn: (data: Partial<DoctorProfileData>) => usersApi.updateDoctorProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'doctor'] });
      setProfileSuccess('Doctor credentials updated successfully.');
      setProfileError('');
      setErrors({});
      setTimeout(() => setProfileSuccess(''), 4000);
    },
    onError: (err: any) => parseBackendError(err),
  });

  const updateCaretakerMutation = useMutation({
    mutationFn: (data: CaretakerProfileData) => usersApi.updateCaretakerProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'caretaker'] });
      setProfileSuccess('Caregiver details updated successfully.');
      setProfileError('');
      setErrors({});
      setTimeout(() => setProfileSuccess(''), 4000);
    },
    onError: (err: any) => parseBackendError(err),
  });

  const handlePatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');

    const normalizedBlood = patientForm.blood_type?.trim().toUpperCase().replace(/^0/, 'O') || '';
    const cleanDob = patientForm.date_of_birth || '';

    const formErrors: ValidationErrors = {
      date_of_birth: validateField('date_of_birth', cleanDob),
      blood_type: validateField('blood_type', normalizedBlood),
      emergency_contact_phone: validateField('emergency_contact_phone', patientForm.emergency_contact_phone || ''),
      primary_diagnosis: validateField('primary_diagnosis', patientForm.primary_diagnosis || ''),
      city: validateField('city', patientForm.city || ''),
      emergency_contact_name: validateField('emergency_contact_name', patientForm.emergency_contact_name || ''),
      emergency_contact_relation: validateField('emergency_contact_relation', patientForm.emergency_contact_relation || ''),
    };

    const activeErrors = Object.entries(formErrors).filter(([_, msg]) => !!msg);

    if (activeErrors.length > 0) {
      setErrors(formErrors);
      setProfileError('Please correct the highlighted fields with red warnings below.');
      const firstInvalidId = `p_${activeErrors[0][0].replace('emergency_contact_', 'em_')}`;
      const el = document.getElementById(firstInvalidId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
      return;
    }

    setErrors({});
    updatePatientMutation.mutate({
      ...patientForm,
      blood_type: normalizedBlood || undefined,
      city: patientForm.city?.trim() || undefined,
      primary_diagnosis: patientForm.primary_diagnosis?.trim() || undefined,
      emergency_contact_name: patientForm.emergency_contact_name?.trim() || undefined,
      emergency_contact_relation: patientForm.emergency_contact_relation?.trim() || undefined,
      emergency_contact_phone: patientForm.emergency_contact_phone?.trim() || undefined,
      notes: patientForm.notes?.trim() || undefined,
    });
  };

  const handleDoctorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');

    const formErrors: ValidationErrors = {
      specialty: validateField('specialty', doctorForm.specialty || ''),
      hospital_affiliation: validateField('hospital_affiliation', doctorForm.hospital_affiliation || ''),
      license_image_url: validateField('license_image_url', doctorForm.license_image_url || ''),
    };

    const activeErrors = Object.entries(formErrors).filter(([_, msg]) => !!msg);
    if (activeErrors.length > 0) {
      setErrors(formErrors);
      setProfileError('Please correct the highlighted fields with red warnings below.');
      return;
    }

    setErrors({});
    updateDoctorMutation.mutate({
      specialty: doctorForm.specialty?.trim() || undefined,
      hospital_affiliation: doctorForm.hospital_affiliation?.trim() || undefined,
      license_image_url: doctorForm.license_image_url?.trim() || undefined,
    });
  };

  const handleCaretakerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');

    const formErrors: ValidationErrors = {
      relationship_to_patient: validateField('relationship_to_patient', caretakerForm.relationship_to_patient || ''),
      crisis_phone_number: validateField('crisis_phone_number', caretakerForm.crisis_phone_number || ''),
    };

    const activeErrors = Object.entries(formErrors).filter(([_, msg]) => !!msg);
    if (activeErrors.length > 0) {
      setErrors(formErrors);
      setProfileError('Please correct the highlighted fields with red warnings below.');
      return;
    }

    setErrors({});
    updateCaretakerMutation.mutate({
      relationship_to_patient: caretakerForm.relationship_to_patient?.trim() || undefined,
      crisis_phone_number: caretakerForm.crisis_phone_number?.trim() || undefined,
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');
    setErrors(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));

    if (!currentPassword) {
      setErrors(prev => ({ ...prev, current_password: 'Enter your current password' }));
      return;
    }
    if (newPassword.length < 8) {
      setErrors(prev => ({ ...prev, new_password: 'New password must be at least 8 characters long' }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirm_password: 'New passwords do not match' }));
      return;
    }

    setIsChangingPass(true);
    try {
      await apiClient.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPassSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password. Verify your current password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const toggleTrigger = (trigger: string) => {
    const current = patientForm.known_triggers || [];
    if (current.includes(trigger)) {
      setPatientForm((p) => ({
        ...p,
        known_triggers: current.filter((t) => t !== trigger),
      }));
    } else {
      setPatientForm((p) => ({
        ...p,
        known_triggers: [...current, trigger],
      }));
    }
  };

  const addCustomTrigger = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = customTriggerInput.trim();
    if (!trimmed) return;
    const current = patientForm.known_triggers || [];
    if (!current.includes(trimmed)) {
      setPatientForm((p) => ({
        ...p,
        known_triggers: [...current, trimmed],
      }));
    }
    setCustomTriggerInput('');
  };

  return (
    <div className="profile-page">
      {/* ── Header ── */}
      <div className="profile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-primary-50)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <User size={24} />
          </div>
          <div>
            <h1>Account & Clinical Profile</h1>
            <p>Manage your account credentials, security preferences, and role clinical details.</p>
          </div>
        </div>
      </div>

      {/* ── Dynamic Profile Completion Hero Banner (Auto-dismisses at 100% after delay) ── */}
      <AnimatePresence>
        {!isCompletionCardHidden && (
          <motion.div
            key="profile-completion-card"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8, marginBottom: 0 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            className={`profile-completion-card glass-panel ${completion.percentage === 100 ? 'complete' : ''}`}
          >
            <div className="completion-top-row">
              <div
                className={`completion-percentage-circle ${
                  completion.percentage === 100
                    ? 'complete'
                    : completion.percentage < 50
                    ? 'low'
                    : ''
                }`}
              >
                <span>{completion.percentage}%</span>
              </div>

              <div className="completion-info">
                <div className="completion-title-row">
                  <h3>
                    {completion.percentage === 100
                      ? '🎉 Profile 100% Complete & Clinically Ready'
                      : 'Complete Your Clinical Profile'}
                  </h3>
                  <span className={`completion-status-pill ${completion.percentage === 100 ? 'complete' : ''}`}>
                    <Activity size={12} />
                    <span>{completion.completedCount} of {completion.totalCount} Fields Completed</span>
                  </span>
                </div>
                <p className="completion-subtitle">
                  {completion.percentage === 100
                    ? 'Your clinical medical record, emergency contacts, and diagnostic configurations are up to date.'
                    : 'Please fill in your remaining medical details below to enable accurate AI seizure risk telemetry, automated SOS dispatch, and verified physician oversight.'}
                </p>

                {/* Missing Fields Checklist */}
                {completion.missingFields.length > 0 && (
                  <div className="missing-fields-container">
                    <span className="missing-fields-lead">Missing to Complete:</span>
                    <div className="missing-fields-pills">
                      {completion.missingFields.map((field) => (
                        <button
                          key={field.id}
                          type="button"
                          className="missing-field-btn"
                          onClick={() => {
                            if (field.category === 'account') {
                              setIsEditingBio(true);
                            } else if (field.category === 'clinical' || field.category === 'emergency') {
                              if (user?.role === 'PATIENT') setIsEditingPatient(true);
                            }
                            setTimeout(() => {
                              const el = document.getElementById(field.id);
                              if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.focus();
                              }
                            }, 100);
                          }}
                          title={`Click to jump to ${field.label}`}
                        >
                          <Plus size={11} />
                          <span>{field.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div className="completion-progress-track">
              <div
                className="completion-progress-bar"
                style={{
                  width: `${completion.percentage}%`,
                  background:
                    completion.percentage === 100
                      ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                      : completion.percentage > 60
                      ? 'linear-gradient(90deg, #0284c7, #16a34a)'
                      : 'linear-gradient(90deg, #d97706, #0284c7)',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* ── Basic Account Bio Card ── */}
        <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
          <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ShieldCheck size={18} style={{ color: 'var(--color-primary)' }} />
              <h3>Account Bio & Verification</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span
                className="glass-badge"
                style={{
                  color: user?.is_email_verified ? 'var(--color-success)' : 'var(--color-warning)',
                  fontSize: '11px',
                }}
              >
                {user?.is_email_verified ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                <span>{user?.is_email_verified ? 'Email Verified' : 'Unverified Email'}</span>
              </span>
            </div>
          </div>

          {bioSuccess && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 'var(--space-3)', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> <span>{bioSuccess}</span>
            </motion.div>
          )}

          {bioError && (
            <div className="auth-error-banner" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} /> <span>{bioError}</span>
            </div>
          )}

          {!isEditingBio ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Full Legal Name</div>
                  <div id="acc_name" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{user?.full_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Email Address</div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} style={{ color: 'var(--color-primary)' }} />
                    <span>{user?.email}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Contact Phone Number</div>
                  <div id="acc_phone" style={{ fontWeight: 600, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} style={{ color: 'var(--color-primary)' }} />
                    <span>{user?.phone_number || 'Not provided'}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Platform Role</div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    <span className="glass-badge" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                      {user?.role.toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)', borderTop: '1px solid rgba(45, 90, 63, 0.08)', paddingTop: 'var(--space-3)' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setBioForm({
                      full_name: user?.full_name || '',
                      phone_number: user?.phone_number || '',
                    });
                    setIsEditingBio(true);
                  }}
                >
                  <Edit3 size={13} />
                  <span>Edit Account Details</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBioSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <Input
                  id="acc_edit_name"
                  label="Full Legal Name"
                  required
                  placeholder="e.g. Aashan Khan"
                  value={bioForm.full_name}
                  onChange={(e) => setBioForm(p => ({ ...p, full_name: e.target.value }))}
                />
                <Input
                  id="acc_edit_email"
                  label="Email Address"
                  disabled
                  value={user?.email || ''}
                />
                <Input
                  id="acc_edit_phone"
                  label="Contact Phone Number"
                  placeholder="e.g. +923001234567"
                  value={bioForm.phone_number}
                  onChange={(e) => setBioForm(p => ({ ...p, phone_number: e.target.value }))}
                />
                <Input
                  id="acc_edit_role"
                  label="Platform Role"
                  disabled
                  value={user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : 'Patient'}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setBioForm({
                      full_name: user?.full_name || '',
                      phone_number: user?.phone_number || '',
                    });
                    setIsEditingBio(false);
                    setBioError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={updateBioMutation.isPending || !isBioDirty || !bioForm.full_name.trim()}
                  style={{
                    opacity: (!isBioDirty || !bioForm.full_name.trim()) && !updateBioMutation.isPending ? 0.5 : 1,
                    cursor: (!isBioDirty || !bioForm.full_name.trim()) && !updateBioMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {updateBioMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Account Details</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Patient Medical Profile Details ── */}
        {user?.role === 'PATIENT' && (
          <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Activity size={18} style={{ color: 'var(--color-primary)' }} />
                <h3>Patient Medical & Seizure Profile</h3>
              </div>
            </div>

            {profileSuccess && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 'var(--space-3)', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> <span>{profileSuccess}</span>
              </motion.div>
            )}

            {profileError && (
              <div className="auth-error-banner" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} /> <span>{profileError}</span>
              </div>
            )}

            {!isEditingPatient ? (
              <div>
                {/* 1. Clinical Demographics View */}
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                    1. Clinical Demographics
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Date of Birth</div>
                      <div id="p_dob" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {patientForm.date_of_birth || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not provided</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Gender</div>
                      <div id="p_gender" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {patientForm.gender || 'Male'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Blood Group</div>
                      <div id="p_blood" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {patientForm.blood_type || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not provided</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>City / Region</div>
                      <div id="p_city" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {patientForm.city || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not provided</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Diagnosis View */}
                <div style={{ marginBottom: 'var(--space-4)', borderTop: '1px solid rgba(45, 90, 63, 0.08)', paddingTop: 'var(--space-3)' }}>
                  <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                    2. Epilepsy Classification & Diagnosis
                  </h4>
                  <div id="p_diag" style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-main)' }}>
                    {patientForm.primary_diagnosis || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No primary diagnosis entered</span>}
                  </div>
                </div>

                {/* 3. Emergency Contact View */}
                <div style={{ padding: 'var(--space-4)', background: 'rgba(239, 68, 68, 0.03)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(239, 68, 68, 0.15)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-3)', color: '#dc2626' }}>
                    <ShieldAlert size={16} />
                    <h4 style={{ margin: 0, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                      3. Emergency Crisis Contact (For SOS Dispatch)
                    </h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Emergency Contact Name</div>
                      <div id="p_em_name" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {patientForm.emergency_contact_name || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not provided</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Relationship</div>
                      <div id="p_em_rel" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {patientForm.emergency_contact_relation || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not provided</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Emergency Phone</div>
                      <div id="p_em_phone" style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: '#dc2626' }}>
                        {patientForm.emergency_contact_phone || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not provided</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Known Triggers View */}
                <div style={{ marginBottom: 'var(--space-4)', borderTop: '1px solid rgba(45, 90, 63, 0.08)', paddingTop: 'var(--space-3)' }}>
                  <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                    4. Known Seizure Triggers
                  </h4>
                  <div id="p_triggers" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {patientForm.known_triggers && patientForm.known_triggers.length > 0 ? (
                      patientForm.known_triggers.map((trig) => (
                        <span
                          key={trig}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #15803d, #166534)',
                            color: '#ffffff',
                            boxShadow: '0 2px 6px rgba(22, 101, 52, 0.15)',
                          }}
                        >
                          <CheckCircle2 size={12} />
                          <span>{trig}</span>
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: 'var(--text-sm)' }}>
                        No specific triggers logged yet
                      </span>
                    )}
                  </div>
                </div>

                {/* 5. Timezone & Notes View */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', borderTop: '1px solid rgba(45, 90, 63, 0.08)', paddingTop: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Preferred Timezone</div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{patientForm.timezone || detectedTz}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Additional Clinical Notes</div>
                    <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: patientForm.notes ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>
                      {patientForm.notes || <span style={{ fontStyle: 'italic' }}>No additional notes</span>}
                    </div>
                  </div>
                </div>

                {/* Edit Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)', borderTop: '1px solid rgba(45, 90, 63, 0.08)', paddingTop: 'var(--space-3)' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setIsEditingPatient(true)}
                  >
                    <Edit3 size={13} />
                    <span>Edit Medical Profile</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePatientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {/* Demographics */}
                <div>
                  <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                    1. Clinical Demographics
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                    <Input
                      id="p_dob"
                      type="date"
                      label="Date of Birth"
                      required
                      value={patientForm.date_of_birth || ''}
                      error={errors.date_of_birth}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPatientForm(p => ({ ...p, date_of_birth: val }));
                        setErrors(prev => ({ ...prev, date_of_birth: validateField('date_of_birth', val) }));
                      }}
                    />
                    <Select
                      id="p_gender"
                      label="Gender"
                      value={patientForm.gender || 'Male'}
                      onChange={(val) => setPatientForm(p => ({ ...p, gender: val as any }))}
                      options={[
                        { value: 'Male', label: 'Male' },
                        { value: 'Female', label: 'Female' },
                        { value: 'Other', label: 'Other' },
                        { value: 'Prefer not to say', label: 'Prefer not to say' },
                      ]}
                    />
                    <Input
                      id="p_blood"
                      label="Blood Group (e.g. O+, A+, B+, AB-)"
                      placeholder="e.g. O+, A+, B+, AB-"
                      value={patientForm.blood_type || ''}
                      error={errors.blood_type}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().replace(/^0/, 'O');
                        setPatientForm(p => ({ ...p, blood_type: val }));
                        setErrors(prev => ({ ...prev, blood_type: validateField('blood_type', val) }));
                      }}
                    />
                    <Input
                      id="p_city"
                      label="City / Region"
                      placeholder="e.g. Islamabad, Pakistan"
                      value={patientForm.city || ''}
                      error={errors.city}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPatientForm(p => ({ ...p, city: val }));
                        setErrors(prev => ({ ...prev, city: validateField('city', val) }));
                      }}
                    />
                  </div>
                </div>

                {/* Diagnosis */}
                <div>
                  <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                    2. Epilepsy Classification & Diagnosis
                  </h4>
                  <Input
                    id="p_diag"
                    label="Primary Diagnosis / Seizure Type"
                    placeholder="e.g. Focal Aware Seizures, Temporal Lobe Epilepsy, Generalized Tonic-Clonic"
                    value={patientForm.primary_diagnosis || ''}
                    error={errors.primary_diagnosis}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPatientForm(p => ({ ...p, primary_diagnosis: val }));
                      setErrors(prev => ({ ...prev, primary_diagnosis: validateField('primary_diagnosis', val) }));
                    }}
                  />
                </div>

                {/* Emergency Contact */}
                <div style={{ padding: 'var(--space-4)', background: 'rgba(239, 68, 68, 0.03)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-3)', color: '#dc2626' }}>
                    <ShieldAlert size={16} />
                    <h4 style={{ margin: 0, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                      3. Emergency Crisis Contact (For SOS Dispatch)
                    </h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                    <Input
                      id="p_em_name"
                      label="Emergency Contact Name"
                      placeholder="e.g. Sarah Khan"
                      value={patientForm.emergency_contact_name || ''}
                      error={errors.emergency_contact_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPatientForm(p => ({ ...p, emergency_contact_name: val }));
                        setErrors(prev => ({ ...prev, emergency_contact_name: validateField('emergency_contact_name', val) }));
                      }}
                    />
                    <Input
                      id="p_em_rel"
                      label="Relationship to Patient"
                      placeholder="e.g. Mother, Spouse, Guardian, Brother"
                      value={patientForm.emergency_contact_relation || ''}
                      error={errors.emergency_contact_relation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPatientForm(p => ({ ...p, emergency_contact_relation: val }));
                        setErrors(prev => ({ ...prev, emergency_contact_relation: validateField('emergency_contact_relation', val) }));
                      }}
                    />
                    <Input
                      id="p_em_phone"
                      label="Emergency Phone Number"
                      placeholder="e.g. +923001234567"
                      value={patientForm.emergency_contact_phone || ''}
                      error={errors.emergency_contact_phone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPatientForm(p => ({ ...p, emergency_contact_phone: val }));
                        setErrors(prev => ({ ...prev, emergency_contact_phone: validateField('emergency_contact_phone', val) }));
                      }}
                    />
                  </div>
                </div>

                {/* Known Seizure Triggers */}
                <div id="p_triggers">
                  <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                    4. Known Seizure Triggers (Tap to Toggle)
                  </h4>
                  <div className="trigger-picker-grid">
                    {COMMON_EPILEPSY_TRIGGERS.map((trigger) => {
                      const isSelected = (patientForm.known_triggers || []).includes(trigger);
                      return (
                        <button
                          key={trigger}
                          type="button"
                          className={`trigger-pill-toggle ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleTrigger(trigger)}
                        >
                          {isSelected ? <CheckCircle2 size={13} /> : <Plus size={13} />}
                          <span>{trigger}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Trigger Input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                    <input
                      type="text"
                      placeholder="Add custom trigger and press Add..."
                      value={customTriggerInput}
                      onChange={(e) => setCustomTriggerInput(e.target.value)}
                      onKeyDown={addCustomTrigger}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid rgba(45, 90, 63, 0.2)',
                        background: 'rgba(255, 255, 255, 0.9)',
                        fontSize: 'var(--text-xs)',
                        outline: 'none',
                        width: '100%',
                        maxWidth: '260px',
                        minWidth: 0,
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={addCustomTrigger}
                      style={{ fontSize: '11px', padding: '5px 12px', borderRadius: 'var(--radius-full)' }}
                    >
                      + Add Custom
                    </button>
                  </div>
                </div>

                {/* Clinical Notes & Timezone */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label htmlFor="p_tz" className="input-label" style={{ margin: 0 }}>
                        Preferred Timezone
                      </label>
                      <button
                        type="button"
                        className="profile-autodetect-btn"
                        onClick={() => setPatientForm((p) => ({ ...p, timezone: detectLocalTimezone() }))}
                        title="Auto-detect timezone from your device"
                      >
                        Auto-Detect Local Time
                      </button>
                    </div>
                    <Select
                      id="p_tz"
                      label=""
                      value={patientForm.timezone || detectedTz}
                      onChange={(val) => setPatientForm((p) => ({ ...p, timezone: val }))}
                      options={allTimezoneOptions}
                    />
                  </div>

                  <Input
                    id="p_notes"
                    label="Additional Clinical Notes"
                    placeholder="e.g. Aura sensations, post-ictal confusion details..."
                    value={patientForm.notes || ''}
                    onChange={(e) => setPatientForm(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (patientProfile) {
                        setPatientForm((p) => ({ ...p, ...patientProfile }));
                      }
                      setIsEditingPatient(false);
                      setProfileError('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={updatePatientMutation.isPending || !isPatientDirty}
                    style={{
                      opacity: !isPatientDirty && !updatePatientMutation.isPending ? 0.5 : 1,
                      cursor: !isPatientDirty && !updatePatientMutation.isPending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {updatePatientMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    <span>Save Medical Details</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Doctor Credentials & Profile ── */}
        {user?.role === 'DOCTOR' && (
          <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Stethoscope size={18} style={{ color: 'var(--color-primary)' }} />
                <h3>Physician Credentials & Affiliation</h3>
              </div>
              <span className="glass-badge" style={{ color: doctorProfile?.is_pmdc_verified ? 'var(--color-success)' : '#d97706' }}>
                {doctorProfile?.is_pmdc_verified ? 'PMDC Verified' : 'PMDC Review Pending'}
              </span>
            </div>

            {profileSuccess && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 'var(--space-3)', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> <span>{profileSuccess}</span>
              </motion.div>
            )}

            {profileError && (
              <div className="auth-error-banner" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} /> <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleDoctorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <Input
                  id="doc_pmdc"
                  label="PMDC License Number"
                  disabled
                  value={doctorProfile?.pmdc_number || 'PMDC-PENDING'}
                />
                <Input
                  id="doc_spec"
                  label="Clinical Specialty"
                  placeholder="e.g. Neurologist, Epileptologist, Pediatric Neurologist"
                  value={doctorForm.specialty || ''}
                  error={errors.specialty}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDoctorForm(p => ({ ...p, specialty: val }));
                    setErrors(prev => ({ ...prev, specialty: validateField('specialty', val) }));
                  }}
                />
                <Input
                  id="doc_hosp"
                  label="Hospital / Clinic Affiliation"
                  placeholder="e.g. Shifa International Hospital, Islamabad"
                  value={doctorForm.hospital_affiliation || ''}
                  error={errors.hospital_affiliation}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDoctorForm(p => ({ ...p, hospital_affiliation: val }));
                    setErrors(prev => ({ ...prev, hospital_affiliation: validateField('hospital_affiliation', val) }));
                  }}
                />
              </div>

              <Input
                id="doc_license_doc"
                label="PMDC Certificate Document / URL"
                placeholder="e.g. https://storage.epicare.ai/docs/license.pdf"
                value={doctorForm.license_image_url || ''}
                error={errors.license_image_url}
                onChange={(e) => {
                  const val = e.target.value;
                  setDoctorForm(p => ({ ...p, license_image_url: val }));
                  setErrors(prev => ({ ...prev, license_image_url: validateField('license_image_url', val) }));
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-md"
                  disabled={updateDoctorMutation.isPending || !isDoctorDirty}
                  style={{
                    opacity: !isDoctorDirty && !updateDoctorMutation.isPending ? 0.5 : 1,
                    cursor: !isDoctorDirty && !updateDoctorMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {updateDoctorMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Practitioner Info</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Caretaker Profile ── */}
        {user?.role === 'CARETAKER' && (
          <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <HeartHandshake size={18} style={{ color: 'var(--color-primary)' }} />
                <h3>Caregiver Emergency Information</h3>
              </div>
            </div>

            {profileSuccess && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 'var(--space-3)', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> <span>{profileSuccess}</span>
              </motion.div>
            )}

            {profileError && (
              <div className="auth-error-banner" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} /> <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleCaretakerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <Input
                  id="care_relation"
                  label="Relationship to Patient"
                  placeholder="e.g. Mother, Spouse, Guardian, Home Nurse"
                  value={caretakerForm.relationship_to_patient || ''}
                  error={errors.relationship_to_patient}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCaretakerForm(p => ({ ...p, relationship_to_patient: val }));
                    setErrors(prev => ({ ...prev, relationship_to_patient: validateField('relationship_to_patient', val) }));
                  }}
                />
                <Input
                  id="care_crisis_phone"
                  label="24/7 Emergency Crisis Contact Number"
                  placeholder="e.g. +923001234567"
                  value={caretakerForm.crisis_phone_number || ''}
                  error={errors.crisis_phone_number}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCaretakerForm(p => ({ ...p, crisis_phone_number: val }));
                    setErrors(prev => ({ ...prev, crisis_phone_number: validateField('crisis_phone_number', val) }));
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-md"
                  disabled={updateCaretakerMutation.isPending || !isCaretakerDirty}
                  style={{
                    opacity: !isCaretakerDirty && !updateCaretakerMutation.isPending ? 0.5 : 1,
                    cursor: !isCaretakerDirty && !updateCaretakerMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {updateCaretakerMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Caregiver Info</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Change Password Security Card ── */}
        <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
          <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Lock size={18} style={{ color: 'var(--color-primary)' }} />
              <h3>Security & Password Update</h3>
            </div>
          </div>

          {passSuccess && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 'var(--space-3)', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> <span>{passSuccess}</span>
            </motion.div>
          )}

          {passError && (
            <div className="auth-error-banner" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} /> <span>{passError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input
              id="current_pass"
              type="password"
              label="Current Password"
              required
              value={currentPassword}
              error={errors.current_password}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setErrors(prev => ({ ...prev, current_password: '' }));
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              <Input
                id="new_pass"
                type="password"
                label="New Password"
                placeholder="Min 8 characters"
                required
                value={newPassword}
                error={errors.new_password}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewPassword(val);
                  setErrors(prev => ({ ...prev, new_password: val.length < 8 ? 'Password must be at least 8 characters' : '' }));
                }}
              />
              <Input
                id="confirm_pass"
                type="password"
                label="Confirm New Password"
                required
                value={confirmPassword}
                error={errors.confirm_password}
                onChange={(e) => {
                  const val = e.target.value;
                  setConfirmPassword(val);
                  setErrors(prev => ({ ...prev, confirm_password: val !== newPassword ? 'Passwords do not match' : '' }));
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <button
                type="submit"
                className="btn btn-outline btn-md"
                disabled={isChangingPass || !isPasswordValid}
                style={{
                  opacity: !isPasswordValid && !isChangingPass ? 0.5 : 1,
                  cursor: !isPasswordValid && !isChangingPass ? 'not-allowed' : 'pointer',
                }}
              >
                {isChangingPass ? <Loader2 size={14} className="animate-spin" /> : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
