import { Play } from 'lucide-react';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import { formatDate, formatTime } from '../utils/time.js';
import { BOOKING_STATUS_STYLE } from '../utils/status.js';

export default function BookingDetailsModal({ booking, onClose }) {
  if (!booking) return null;

  const mentor = booking.mentor || {};
  const student = booking.student || {};
  const createdAt = booking.createdAt
    ? new Date(booking.createdAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

  const Row = ({ label, value }) => (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );

  return (
    <Modal open={!!booking} onClose={onClose} title="Booking details" size="sm">
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <Avatar name={mentor.name} src={mentor.avatar} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{mentor.name || '—'}</p>
          <p className="text-xs text-slate-400">Mentor</p>
        </div>
        <span className={`chip ml-auto shrink-0 ${BOOKING_STATUS_STYLE[booking.status] || ''}`}>{booking.status}</span>
      </div>

      <div className="mt-4">
        <Row label="Student" value={student.name || '—'} />
        <Row label="Date" value={formatDate(booking.date)} />
        <Row label="Time" value={`${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`} />
        <Row label="Status" value={booking.status} />
        <Row label="Created" value={createdAt} />
        {booking.notes && (
          <div className="pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Notes</p>
            <p className="mt-1 text-sm italic text-slate-600 dark:text-slate-300">"{booking.notes}"</p>
          </div>
        )}
        {booking.meetLink && (
          <a
            href={booking.meetLink}
            target="_blank"
            rel="noreferrer"
            className="btn-primary mt-4 w-full !py-2 !text-xs"
          >
            <Play className="h-3.5 w-3.5" /> Join Meet
          </a>
        )}
      </div>
    </Modal>
  );
}
