import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Loader2 } from 'lucide-react';

export const MagicLinkHandlerPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refreshSession } = useAdminAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function consume() {
      if (!token) {
        navigate('/magic-link-error', { replace: true });
        return;
      }

      try {
        const res = await fetch('/api/auth/consume-magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: token.trim() }),
        });

        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.success && data.restaurantId) {
          await refreshSession();
          navigate(`/admin/${data.restaurantId}`, { replace: true });
        } else {
          navigate('/magic-link-error', { replace: true });
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to consume magic link:', err);
        navigate('/magic-link-error', { replace: true });
      }
    }

    consume();

    return () => {
      isMounted = false;
    };
  }, [token, navigate, refreshSession]);

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-4 text-center" dir="rtl">
      <div className="bg-stone-800/90 border border-stone-700/60 p-8 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
        <h2 className="text-xl font-bold text-white">جاري التحقق من الرابط السحري...</h2>
        <p className="text-xs text-stone-400">يرجى الانتظار قليلاً، يتم تحويلك إلى لوحة تحكم المطعم</p>
      </div>
    </div>
  );
};
