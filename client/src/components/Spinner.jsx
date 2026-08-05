export default function Spinner({ className = 'h-8 w-8' }) {
  return (
    <div className="flex items-center justify-center p-8" role="status" aria-label="Loading">
      <div className={`${className} animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600`} />
    </div>
  );
}
