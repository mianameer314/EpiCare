import { useState } from 'react';
import { Send, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { usersApi } from '../../api/users';

/**
 * Button that sends a test push notification to the current device.
 * Useful for verifying FCM is configured correctly before relying on SOS alerts.
 */
export function TestPushButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleTest = async () => {
    setStatus('loading');
    try {
      const res = await usersApi.testPush();
      if (res.success) {
        setStatus('success');
        setMessage(res.message);
      } else {
        setStatus('error');
        setMessage(res.message);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Request failed');
    }
    // Reset after 5 seconds
    setTimeout(() => { setStatus('idle'); setMessage(''); }, 5000);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={handleTest}
        disabled={status === 'loading'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 9999,
          border: '1px solid rgba(45, 90, 63, 0.2)',
          background: status === 'success' ? '#dcfce7' : status === 'error' ? '#fef2f2' : '#f0fdf4',
          color: status === 'success' ? '#166534' : status === 'error' ? '#991b1b' : '#2d5a3f',
          fontSize: 11,
          fontWeight: 700,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          opacity: status === 'loading' ? 0.7 : 1,
          transition: 'all 150ms ease',
        }}
      >
        {status === 'loading' ? (
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
        ) : status === 'success' ? (
          <CheckCircle2 size={13} />
        ) : status === 'error' ? (
          <XCircle size={13} />
        ) : (
          <Send size={13} />
        )}
        {status === 'loading' ? 'Sending…' : status === 'success' ? 'Sent!' : status === 'error' ? message || 'Failed' : 'Test Push Notification'}
      </button>
    </div>
  );
}
