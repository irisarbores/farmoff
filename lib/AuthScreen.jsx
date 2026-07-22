
// lib/AuthScreen.jsx
// 農家 / 代理管理者、両方が使う共通ログイン・新規登録画面
import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function AuthScreen({ onLoggedIn }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('farmer'); // 'farmer' | 'agent'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'signup') {
      // 1. 認証ユーザーを作成
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // 2. profilesテーブルに役割と表示名を保存
      const userId = data.user?.id;
      if (userId) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: userId,
          role,
          display_name: displayName || email,
        });
        if (profileError) {
          setError(profileError.message);
          setLoading(false);
          return;
        }
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onLoggedIn?.();
  }

  return (
    <div style={{ maxWidth: 360, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>
        {mode === 'login' ? 'ログイン' : '新規登録'}
      </h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mode === 'signup' && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setRole('farmer')}
                style={{
                  flex: 1,
                  padding: 8,
                  border: role === 'farmer' ? '2px solid #333' : '1px solid #ccc',
                }}
              >
                農家として登録
              </button>
              <button
                type="button"
                onClick={() => setRole('agent')}
                style={{
                  flex: 1,
                  padding: 8,
                  border: role === 'agent' ? '2px solid #333' : '1px solid #ccc',
                }}
              >
                代理管理者として登録
              </button>
            </div>
            <input
              type="text"
              placeholder="お名前"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </>
        )}

        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        {error && <p style={{ color: 'red', fontSize: 13 }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? '処理中…' : mode === 'login' ? 'ログイン' : '登録する'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        style={{ marginTop: 12, fontSize: 13, background: 'none', border: 'none', textDecoration: 'underline' }}
      >
        {mode === 'login' ? 'アカウントをお持ちでない方はこちら' : 'ログインはこちら'}
      </button>
    </div>
  );
}
