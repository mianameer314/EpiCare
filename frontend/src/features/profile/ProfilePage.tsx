import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { usersApi, type PatientProfileData, type DoctorProfileData, type CaretakerProfileData } from '../../api/users';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import './ProfilePage.css';

/* ────────────────────────────────────────────────────
   Profile Management Page — User Bio, Clinical Profile & Security
   ──────────────────────────────────────────────────── */

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

  // Clinical profile state
  const [patientForm, setPatientForm] = useState<PatientProfileData>({
    date_of_birth: '',
    gender: 'Male',
    blood_type: 'O+',
    city: '',
    primary_diagnosis: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    known_triggers: [],
  });

  const [doctorForm, setDoctorForm] = useState<DoctorProfileData>({
    pmdc_number: '',
    specialty: 'Epileptologist / Neurologist',
    hospital_affiliation: '',
  });

  const [caretakerForm, setCaretakerForm] = useState<CaretakerProfileData>({
    relationship_to_patient: 'Family Caregiver',
    crisis_phone_number: '',
  });

  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

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

  // Mutations
  const updatePatientMutation = useMutation({
    mutationFn: (data: PatientProfileData) => usersApi.updatePatientProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'patient'] });
      setProfileSuccess('Patient clinical profile saved successfully.');
      setTimeout(() => setProfileSuccess(''), 4000);
    },
    onError: (err: any) => setProfileError(err.message || 'Failed to update patient profile.'),
  });

  const updateDoctorMutation = useMutation({
    mutationFn: (data: Partial<DoctorProfileData>) => usersApi.updateDoctorProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'doctor'] });
      setProfileSuccess('Doctor credentials updated.');
      setTimeout(() => setProfileSuccess(''), 4000);
    },
    onError: (err: any) => setProfileError(err.message || 'Failed to update doctor profile.'),
  });

  const updateCaretakerMutation = useMutation({
    mutationFn: (data: CaretakerProfileData) => usersApi.updateCaretakerProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'caretaker'] });
      setProfileSuccess('Caregiver details updated.');
      setTimeout(() => setProfileSuccess(''), 4000);
    },
    onError: (err: any) => setProfileError(err.message || 'Failed to update caretaker profile.'),
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPassError('New password must be at least 8 characters long.');
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
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password. Verify your current password.');
    } finally {
      setIsChangingPass(false);
    }
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* ── Basic Account Bio Card ── */}
        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
          <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ShieldCheck size={18} style={{ color: 'var(--color-primary)' }} />
              <h3>Account Bio & Verification</h3>
            </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Full Legal Name</div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{user?.full_name}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Email Address</div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} style={{ color: 'var(--color-primary)' }} />
                <span>{user?.email}</span>
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
        </div>

        {/* ── Role-Specific Clinical Profile Details ── */}
        {user?.role === 'PATIENT' && (
          <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <User size={18} style={{ color: 'var(--color-primary)' }} />
                <h3>Patient Medical Information</h3>
              </div>
            </div>

            {profileSuccess && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 'var(--space-3)', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> <span>{profileSuccess}</span>
              </motion.div>
            )}

            {profileError && (
              <div className="auth-error-banner" style={{ marginBottom: 'var(--space-4)' }}>
                <AlertCircle size={16} /> <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); updatePatientMutation.mutate(patientForm); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                <Input
                  id="p_dob"
                  type="date"
                  label="Date of Birth"
                  value={patientForm.date_of_birth || ''}
                  onChange={(e) => setPatientForm(p => ({ ...p, date_of_birth: e.target.value }))}
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
                  label="Blood Group"
                  placeholder="e.g. O+, A+, B+, AB-"
                  value={patientForm.blood_type || ''}
                  onChange={(e) => setPatientForm(p => ({ ...p, blood_type: e.target.value }))}
                />
                <Input
                  id="p_city"
                  label="City / Location"
                  placeholder="e.g. Islamabad"
                  value={patientForm.city || ''}
                  onChange={(e) => setPatientForm(p => ({ ...p, city: e.target.value }))}
                />
              </div>

              <Input
                id="p_diag"
                label="Primary Diagnosis / Seizure Classification"
                placeholder="e.g. Temporal Lobe Epilepsy, Juvenile Myoclonic Epilepsy"
                value={patientForm.primary_diagnosis || ''}
                onChange={(e) => setPatientForm(p => ({ ...p, primary_diagnosis: e.target.value }))}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="submit" className="btn btn-primary btn-md" disabled={updatePatientMutation.isPending}>
                  {updatePatientMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Medical Details</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {user?.role === 'DOCTOR' && (
          <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
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

            <form onSubmit={(e) => { e.preventDefault(); updateDoctorMutation.mutate(doctorForm); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <Input
                  id="doc_pmdc_view"
                  label="PMDC License Number"
                  disabled
                  value={doctorProfile?.pmdc_number || 'PMDC-PENDING'}
                />
                <Input
                  id="doc_spec"
                  label="Clinical Specialty"
                  placeholder="e.g. Neurologist, Epileptologist"
                  value={doctorForm.specialty || ''}
                  onChange={(e) => setDoctorForm(p => ({ ...p, specialty: e.target.value }))}
                />
                <Input
                  id="doc_hosp"
                  label="Hospital / Clinic Affiliation"
                  placeholder="e.g. Shifa International, PIMS"
                  value={doctorForm.hospital_affiliation || ''}
                  onChange={(e) => setDoctorForm(p => ({ ...p, hospital_affiliation: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="submit" className="btn btn-primary btn-md" disabled={updateDoctorMutation.isPending}>
                  {updateDoctorMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Practitioner Info</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {user?.role === 'CARETAKER' && (
          <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <HeartHandshake size={18} style={{ color: 'var(--color-primary)' }} />
                <h3>Caregiver Information</h3>
              </div>
            </div>

            {profileSuccess && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 'var(--space-3)', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> <span>{profileSuccess}</span>
              </motion.div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); updateCaretakerMutation.mutate(caretakerForm); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <Input
                  id="care_relation"
                  label="Relationship to Patient"
                  placeholder="e.g. Mother, Spouse, Nurse, Guardian"
                  value={caretakerForm.relationship_to_patient || ''}
                  onChange={(e) => setCaretakerForm(p => ({ ...p, relationship_to_patient: e.target.value }))}
                />
                <Input
                  id="care_crisis_phone"
                  label="Emergency Crisis Contact Number"
                  placeholder="e.g. +923001234567"
                  value={caretakerForm.crisis_phone_number || ''}
                  onChange={(e) => setCaretakerForm(p => ({ ...p, crisis_phone_number: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="submit" className="btn btn-primary btn-md" disabled={updateCaretakerMutation.isPending}>
                  {updateCaretakerMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Caregiver Info</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Change Password Security Card ── */}
        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
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
            <div className="auth-error-banner" style={{ marginBottom: 'var(--space-4)' }}>
              <AlertCircle size={16} /> <span>{passError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input
              id="current_pass"
              type="password"
              label="Current Password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              <Input
                id="new_pass"
                type="password"
                label="New Password"
                placeholder="Min 8 characters"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input
                id="confirm_pass"
                type="password"
                label="Confirm New Password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <button type="submit" className="btn btn-outline btn-md" disabled={isChangingPass}>
                {isChangingPass ? <Loader2 size={14} className="animate-spin" /> : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
