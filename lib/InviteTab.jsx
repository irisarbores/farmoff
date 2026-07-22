'use client';

// lib/InviteTab.jsx
// 農家: 招待コードを発行する
// 代行者: 招待コードを入力して農園に参加する
import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function InviteTab({ profile, farmId, onJoined }) {
  if (profile.role === 'farmer') {
    return <IssueInvite farmId={farmId} />;
  }
  return <RedeemInvite onJoined={onJoined} />;
}

function IssueInvite({ farmId }) {
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000)); // 6桁
  }

  async function handleIssue() {
    setLoading(true);
    setError('');
    const newCode = generateCode();
    const { data: session } = await supabase.auth.getUser();
    const { data, error: insertError } = await supabase
      .from('farm_invites')
      .insert({ farm_id: farmId, code: newCode, created_by: session.user.id })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
    } else {
      setCode(data.code);
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
        代行者に伝える招待コードを発行します（発行から30分間だけ有効です）。
      </p>
      <button onClick={handleIssue} disabled={loading}>
        {loading ? '発行中…' : '招待コードを発行する'}
      </button>

      {code && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#666' }}>このコードを代行者に伝えてください</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', letterSpacing: 4, marginTop: 6 }}>{code}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>30分間有効</div>
        </div>
      )}

      {error && <p style={{ color: 'red', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}

function RedeemInvite({ onJoined }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleRedeem() {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('redeem_farm_invite', {
      invite_code: input.trim(),
    });

    if (rpcError) {
      setError(
        rpcError.message.includes('invite_invalid_or_expired')
          ? 'コードが無効か、期限切れです。もう一度確認してください。'
          : rpcError.message
      );
    } else {
      setSuccess(true);
      onJoined?.(data); // data = farm_id
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
        農家から伝えられた招待コードを入力してください。
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="6桁のコード"
          maxLength={6}
          style={{ flex: 1, fontSize: 18, letterSpacing: 2, textAlign: 'center' }}
        />
        <button onClick={handleRedeem} disabled={loading || input.length !== 6}>
          {loading ? '確認中…' : '参加する'}
        </button>
      </div>
      {success && <p style={{ color: 'green', fontSize: 13, marginTop: 8 }}>参加しました！</p>}
      {error && <p style={{ color: 'red', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
