import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Star, Trash2, Edit2, Phone, AlertCircle, Loader2, X } from 'lucide-react';
import { emergencyApi, type EmergencyContact, type EmergencyContactCreate } from '../../../api/emergency';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { PhoneInput } from '../../../components/ui/PhoneInput';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { useToast } from '../../../providers/ToastProvider';

/* ────────────────────────────────────────────────────
   Emergency Contacts Manager — CRUD for up to 3 contacts
   ──────────────────────────────────────────────────── */

interface EmergencyContactsManagerProps {
  contacts: EmergencyContact[];
  isLoading: boolean;
}

export function EmergencyContactsManager({ contacts, isLoading }: EmergencyContactsManagerProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState<EmergencyContactCreate>({
    name: '',
    relationship: 'Family',
    phone_number: '',
    is_primary: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: EmergencyContactCreate) => emergencyApi.createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency', 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      closeModal();
      toast.success('Emergency contact added successfully.');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to add emergency contact.');
      toast.error(err.message || 'Failed to add emergency contact.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EmergencyContactCreate> }) =>
      emergencyApi.updateContact(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency', 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      closeModal();
      toast.success('Emergency contact updated successfully.');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to update contact.');
      toast.error(err.message || 'Failed to update contact.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => emergencyApi.deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency', 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      toast.delete('Emergency contact removed.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove contact.');
    },
  });

  const openAddModal = () => {
    setEditingContact(null);
    setFormData({
      name: '',
      relationship: 'Family',
      phone_number: '',
      is_primary: contacts.length === 0,
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (c: EmergencyContact) => {
    setEditingContact(c);
    setFormData({
      name: c.name,
      relationship: c.relationship,
      phone_number: c.phone_number,
      is_primary: c.is_primary,
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingContact(null);
    setFormError('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Contact name is required.');
      return;
    }
    if (!formData.phone_number || !isValidPhoneNumber(formData.phone_number)) {
      setFormError('Please enter a valid international phone number.');
      return;
    }

    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
      <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h3>Emergency Contacts</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            Registered contacts who will receive automated SOS SMS & location alerts (Max 3).
          </p>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={openAddModal}
          disabled={contacts.length >= 3}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
        >
          <UserPlus size={14} />
          <span>Add Contact ({contacts.length}/3)</span>
        </button>
      </div>

      {/* ── Contacts List ── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2].map(i => (
            <div key={i} className="skeleton" style={{ height: '64px', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px dashed var(--color-border)' }}>
          <Phone size={36} style={{ color: 'var(--color-text-placeholder)', margin: '0 auto var(--space-2)', opacity: 0.5 }} />
          <h4 style={{ fontSize: 'var(--text-base)', margin: '0 0 var(--space-1)' }}>No Emergency Contacts Configured</h4>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            Add up to 3 trusted contacts (family, physician, or caretaker) to notify during an SOS event.
          </p>
          <button className="btn btn-primary btn-sm" onClick={openAddModal}>
            Add Your First Contact
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {contacts.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-subtle)',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-full)',
                  background: c.is_primary ? 'var(--color-primary-50)' : 'var(--color-surface-hover)',
                  color: c.is_primary ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                }}>
                  {c.is_primary ? <Star size={18} fill="currentColor" /> : <Phone size={18} />}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                      {c.name}
                    </span>
                    {c.is_primary && (
                      <span className="glass-badge" style={{ fontSize: '10px', color: 'var(--color-primary)' }}>
                        Primary Contact
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {c.relationship} · <strong>{c.phone_number}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <button
                  onClick={() => openEditModal(c)}
                  className="btn btn-ghost btn-sm"
                  title="Edit contact"
                  style={{ padding: '6px' }}
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(c.id)}
                  className="btn btn-ghost btn-sm"
                  title="Delete contact"
                  style={{ padding: '6px', color: 'var(--color-error)' }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      <AnimatePresence>
        {modalOpen && (
          <div className="glass-backdrop" onClick={closeModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', zIndex: 1000 }}>
            <motion.div
              className="glass-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                width: '100%',
                maxWidth: '460px',
                padding: 'var(--space-6)',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                  {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
                </h3>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="auth-error-banner" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Input
                  id="contact_name"
                  label="Full Name"
                  placeholder="e.g. Sarah Jenkins"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />

                <Select
                  id="contact_rel"
                  label="Relationship"
                  value={formData.relationship}
                  onChange={(val) => setFormData(prev => ({ ...prev, relationship: val }))}
                  options={[
                    { value: 'Parent', label: 'Parent' },
                    { value: 'Spouse', label: 'Spouse / Partner' },
                    { value: 'Family', label: 'Family Member' },
                    { value: 'Caretaker', label: 'Caretaker' },
                    { value: 'Physician', label: 'Physician / Neurologist' },
                    { value: 'Friend', label: 'Friend' },
                  ]}
                />

                <PhoneInput
                  id="contact_phone"
                  label="Phone Number (SMS Alert Target)"
                  required
                  value={formData.phone_number}
                  onChange={(val) => setFormData(prev => ({ ...prev, phone_number: val || '' }))}
                />

                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_primary: e.target.checked }))}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <span>Mark as Primary Emergency Contact</span>
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <button type="button" className="btn btn-outline btn-md" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-md" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      editingContact ? 'Save Changes' : 'Add Contact'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
