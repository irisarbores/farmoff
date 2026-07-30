'use client';

import React, { useEffect, useState } from 'react';
import FarmOffApp from '../../lib/FarmOffApp'; 
import { supabase } from '../../lib/supabaseClient'; 

export default function AppPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>認証情報を確認中...</div>;
  }

  if (!session) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: 400, margin: '0 auto', fontFamily: 'sans-serif' }}>
        <h2 style={{ textAlign: 'center', color: '#2E7D32', marginBottom: 24 }}>FarmOffにログイン</h2>
        <LoginForm />
      </div>
    );
  }

  return <FarmOffApp session={session} />;
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true); 
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('処理中...');
    
    let error;
    if (isLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      error = signInError;
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      error = signUpError;
      if (!signUpError) {
        setMessage('確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。');
        return;
      }
    }

    if (error) {
      setMessage(`エラー: ${error.message}`);
    } else if (isLogin) {
      setMessage('ログインしました。');
    }
  };

  return (
    <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={{ padding: 12, border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 16 }}
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        style={{ padding: 12, border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 16 }}
      />
      <button 
        type="submit" 
        style={{ padding: 14, background: '#2E7D32', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 16 }}
      >
        {isLogin ? 'ログイン' : '新規登録'}
      </button>
      
      <button 
        type="button" 
        onClick={() => { setIsLogin(!isLogin); setMessage(''); }} 
        style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', textDecoration: 'underline' }}
      >
        {isLogin ? 'アカウントをお持ちでない方は新規登録' : 'すでにアカウントをお持ちの方はログイン'}
      </button>

      {message && <p style={{ color: '#DC2626', fontSize: 14, textAlign: 'center' }}>{message}</p>}
    </form>
  );
}