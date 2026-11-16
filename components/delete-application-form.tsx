'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle } from 'lucide-react';

interface DeleteApplicationFormProps {
  applicationId: string;
  applicationName: string;
}

export default function DeleteApplicationForm({ 
  applicationId, 
  applicationName 
}: DeleteApplicationFormProps) {
  const router = useRouter();
  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canDelete = confirmName === applicationName;

  async function handleDelete() {
    if (!canDelete) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/developer/applications/${applicationId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete application');
        setLoading(false);
        return;
      }

      // Redirect to applications list
      router.push('/developer/applications');
      router.refresh();
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <div 
          className="alert" 
          style={{ 
            background: '#fee2e2', 
            border: '1px solid #fca5a5',
            color: '#991b1b',
            marginBottom: '16px'
          }}
        >
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <div className="field">
        <label htmlFor="confirm-name" style={{ color: '#7f1d1d', fontWeight: 600 }}>
          Type <strong style={{ 
            fontFamily: 'DM Mono', 
            background: '#fee2e2',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            {applicationName}
          </strong> to confirm
        </label>
        <input
          id="confirm-name"
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={applicationName}
          style={{
            fontFamily: 'DM Mono',
            fontSize: '14px'
          }}
        />
      </div>

      <button
        onClick={handleDelete}
        disabled={!canDelete || loading}
        className="button"
        style={{
          background: canDelete && !loading ? '#dc2626' : '#d1d5db',
          color: canDelete && !loading ? 'white' : '#6b7280',
          cursor: canDelete && !loading ? 'pointer' : 'not-allowed',
          border: 'none'
        }}
      >
        <Trash2 size={14} />
        {loading ? 'Deleting...' : 'Delete Application Permanently'}
      </button>
    </div>
  );
}
