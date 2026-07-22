'use client';

// lib/PayoutTab.jsx
// 代行者本人: 自分の等級（コア/フレックス）と、今月の支払い見込みを確認
// 農家: このタブは表示しない想定（別途、農家向け管理画面は今後拡張）
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function PayoutTab({ profile }) {
  const [tier, setTier] = useState(profile.agent_tier ?? 'flex');
  const [guaranteed, setGuaranteed] = useState(profile.guaranteed_monthly ?? 0);
  const [monthly, setMonthly] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMonthlyPayout();
  }, []);

  async function loadMonthlyPayout() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('agent_monthly_payout')
      .select('*')
      .eq('agent_id', profile.id)
      .gte('month', startOfMonth.toISOString());

    setMonthly(data?.[0] ?? null);
  }

  async function handleSaveTier() {
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ agent_tier: tier, guaranteed_monthly: tier === 'core' ? guaranteed : 0 })
      .eq('id', profile.id);
    setSaving(false);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>登録区分</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setTier('core')}
          style={{ flex: 1, padding: 10, border: tier === 'core' ? '2px solid #333' : '1px solid #ccc' }}
        >
          コア登録者<br />
          <span style={{ fontSize: 11, color: '#666' }}>月次保証あり</span>
        </button>
        <button
          onClick={() => setTier('flex')}
          style={{ flex: 1, padding: 10, border: tier === 'flex' ? '2px solid #333' : '1px solid #ccc' }}
        >
          フレックス登録者<br />
          <span style={{ fontSize: 11, color: '#666' }}>歩合のみ</span>
        </button>
      </div>

      {tier === 'core' && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>希望する月次保証額（円）</label>
          <input
            type="number"
            value={guaranteed}
            onChange={(e) => setGuaranteed(Number(e.target.value))}
            step={1000}
            style={{ width: '100%' }}
          />
          <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            ※ 実際の金額は、農家との個別合意・農園密度に応じて事業者側と調整してください
          </p>
        </div>
      )}

      <button onClick={handleSaveTier} disabled={saving} style={{ width: '100%', marginBottom: 20 }}>
        {saving ? '保存中…' : '登録区分を保存する'}
      </button>

      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>今月の見込み</div>
      {monthly ? (
        <div style={{ border: '1px solid #ddd', padding: 12, fontSize: 13, lineHeight: 1.8 }}>
          <div>訪問回数: {monthly.visit_count}回</div>
          <div>トラブル報告: {monthly.trouble_count}件</div>
          <div>歩合の合計: {Number(monthly.commission_total ?? 0).toLocaleString()}円</div>
          <div>月次保証額: {Number(monthly.guaranteed_monthly ?? 0).toLocaleString()}円</div>
          <div style={{ fontWeight: 'bold', marginTop: 6, borderTop: '1px solid #eee', paddingTop: 6 }}>
            支払い見込み額（高い方）: {Number(monthly.final_payout ?? 0).toLocaleString()}円
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#999' }}>今月の報告実績がまだありません</p>
      )}
    </div>
  );
}
