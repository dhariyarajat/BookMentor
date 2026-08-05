import Modal from './Modal.jsx';

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title={title} size="sm">
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
      <div className="mt-5 flex gap-3">
        <button className="btn-secondary flex-1" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </button>
        <button
          className={`flex-1 ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
