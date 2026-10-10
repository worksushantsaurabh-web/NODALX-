import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold tracking-widest text-black  bg-white uppercase mb-4">
          404
        </p>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
          Page not found
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-lg bg-black text-white hover:bg-neutral-800 text-white text-sm font-semibold transition-colors"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}
