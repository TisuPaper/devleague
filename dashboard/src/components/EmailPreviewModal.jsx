import React, { useState, useEffect } from 'react';
import './EmailPreviewModal.css';

const EmailPreviewModal = ({ issue, onClose, onSend }) => {
  const [subject, setSubject] = useState(issue.emailSubject);
  const [body, setBody] = useState(issue.emailBody);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSend = async () => {
    setSending(true);
    // Simulate network delay
    await new Promise(res => setTimeout(res, 800));
    setSent(true);
    setTimeout(onSend, 1000);
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-panel">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 id="modal-title" className="modal-title">Follow-up Email Preview</h2>
            <p className="modal-sub">Review and edit before sending</p>
          </div>
          <button
            id="btn-close-modal"
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {sent ? (
          <div className="modal-sent-state">
            <div className="sent-checkmark">✓</div>
            <h3>Email Sent Successfully</h3>
            <p>The follow-up email has been dispatched to the client.</p>
          </div>
        ) : (
          <>
            {/* Email form */}
            <div className="modal-body">
              <div className="email-field">
                <label htmlFor="email-subject" className="email-field-label">Subject</label>
                <input
                  id="email-subject"
                  type="text"
                  className="text-input email-subject-input"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>
              <div className="email-field">
                <label htmlFor="email-body" className="email-field-label">Message</label>
                <textarea
                  id="email-body"
                  className="text-input email-body-textarea"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={14}
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="modal-footer">
              <button
                id="btn-cancel-email"
                className="btn-secondary"
                onClick={onClose}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                id="btn-confirm-send-email"
                className="btn-primary"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? 'Sending…' : 'Confirm & Send →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailPreviewModal;
