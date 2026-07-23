'use client';

// lib/App.jsx
// Next.jsなら pages/index.js または app/page.js からこのコンポーネントを呼び出してください
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import AuthScreen from './AuthScreen';
import FarmOffApp from './FarmOffApp';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // ログアウト時は前ユーザーの選択農園IDを消す
      // （共有端末で別アカウントに切り替わった際に、前の人が見ていた
      //   farmIdが引き継がれてしまうのを防ぐ）
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('activeFarmId');
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <p>読み込み中…</p>;

  return session ? <FarmOffApp session={session} /> : <AuthScreen onLoggedIn={() => {}} />;
}
