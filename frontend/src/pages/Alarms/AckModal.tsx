import { useState, type FormEvent } from 'react';
import { MdClose, MdWarning, MdError } from 'react-icons/md';
import type { Alarm } from '@/types';
import { EQUIPMENT_LABELS } from '@/utils/constants';

interface Props {
  alarm: Alarm;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function AckModal({ alarm, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('Please provide a reason for acknowledgement'); return; }
    onConfirm(reason.trim());
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Acknowledge Alarm</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><MdClose /></button>
        </div>

        <div className="px-6 py-4">
          <div className={`flex items-start gap-3 p-3 rounded-xl mb-4 ${
            alarm.severity === 'critical' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <span className={`text-2xl mt-0.5 ${alarm.severity === 'critical' ? 'text-brand-red' : 'text-brand-amber'}`}>
              {alarm.severity === 'critical' ? <MdError /> : <MdWarning />}
            </span>
            <div>
              <p className="font-semibold text-slate-800">{EQUIPMENT_LABELS[alarm.deviceId] ?? alarm.deviceId}</p>
              <p className="text-sm text-slate-600">{alarm.parameter.replace(/_/g, ' ')}</p>
              <p className="text-xs text-slate-400 mt-1">Value: <span className="font-mono">{String(alarm.value)}</span></p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reason / Action Taken <span className="text-brand-red">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => { setReason(e.target.value); setError(''); }}
                rows={3}
                className="input-field resize-none"
                placeholder="Describe the action taken or reason for acknowledgement…"
                autoFocus
              />
              {error && <p className="text-xs text-brand-red mt-1">{error}</p>}
            </div>

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-danger">Acknowledge</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
