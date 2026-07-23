'use client';

// lib/RecurringTab.jsx
// 「毎週 火・木・土」のような繰り返し予定を設定する画面
// 保存すると、向こう4週間分の schedules が自動生成されます
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// コンポーネントの定義部分に onSaved を追加
export default function RecurringTab({ farmId, onSaved }) {
  const [rules, setRules] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [time, setTime] = useState('09:00');
  const [task, setTask] = useState('水やり・見回り');
  const [saving, setSaving] = useState(false);

    function generateNext4Weeks(days) {
    const result = [];
    const today = new Date();

    for (let i = 0; i < 28; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);

      if (days.includes(d.getDay())) {
        result.push(d.toISOString().split('T')[0]);
      }
    }

    return result;
  }
  
  useEffect(() => {
    if (!farmId) return;
    loadRules();
  }, [farmId]);

  async function loadRules() {
    const { data } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('farm_id', farmId)
      .eq('active', true);
    setRules(data ?? []);
  }

  function toggleDay(day) {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSave() {
    if (selectedDays.length === 0) return;
    setSaving(true);

    // 1. ルールの保存
    const { data: rule, error: ruleError } = await supabase
      .from('recurring_rules')
      .insert({ farm_id: farmId, weekdays: selectedDays, visit_time: time, task })
      .select()
      .single();

    if (ruleError) {
      console.error('繰り返しルールの保存エラー:', ruleError.message);
      alert('ルールの保存に失敗しました: ' + ruleError.message);
      setSaving(false);
      return;
    }

    // 2. 予定の自動生成
    if (rule) {
      const dates = generateNext4Weeks(selectedDays);

      const inserts = dates.map(d => ({
        farm_id: farmId,
        visit_date: d,
        visit_time: time, // ★設定した時間を予定に引き継ぐ
        task,
      }));

      const { error: scheduleError } = await supabase.from('schedules').insert(inserts);

      if (scheduleError) {
        console.error('予定の自動生成エラー:', scheduleError.message);
        alert('予定の生成に失敗しました: ' + scheduleError.message);
      } else {
        // 成功時の処理
        setSelectedDays([]);
        setTask('水やり・見回り');
        loadRules();
        if (onSaved) onSaved();
        alert('繰り返し予定を登録し、4週間分の予定を生成しました！');
      }
    }
    setSaving(false);
  }

  async function handleDeactivate(ruleId) {
    await supabase.from('recurring_rules').update({ active: false }).eq('id', ruleId);
    loadRules();
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>新しい繰り返し予定</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {WEEKDAY_LABELS.map((label, idx) => (
          <button
            key={idx}
            onClick={() => toggleDay(idx)}
            style={{
              flex: 1,
              padding: '8px 0',
              border: selectedDays.includes(idx) ? '2px solid #333' : '1px solid #ccc',
              background: selectedDays.includes(idx) ? '#333' : 'white',
              color: selectedDays.includes(idx) ? 'white' : '#333',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <input
          type="text"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="作業内容"
          style={{ flex: 1 }}
        />
      </div>

      <button
  onClick={handleSave}
  disabled={saving || selectedDays.length === 0}
  style={{
    width: '100%',
    padding: '12px 8px',
    border: '2px solid #2E7D32',     // 緑枠
    borderRadius: 6,
    background: saving || selectedDays.length === 0 ? '#f5f5f5' : '#E8F5E9', // 選択時は明るい緑背景
    color: saving || selectedDays.length === 0 ? '#999' : '#2E7D32',         // 緑文字
    fontWeight: 'bold',
    fontSize: 13,
    cursor: saving || selectedDays.length === 0 ? 'not-allowed' : 'pointer',
  }}
>
  {saving ? '保存中…' : 'この繰り返し予定を保存する（向こう4週間分を自動作成）'}
</button>

      <div style={{ fontSize: 13, fontWeight: 500, margin: '20px 0 8px' }}>設定済みの繰り返し予定</div>
      {rules.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>まだありません</p>}
      {rules.map((r) => (
        <div
          key={r.id}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #ddd', padding: 8, marginBottom: 6 }}
        >
          <div style={{ fontSize: 13 }}>
            毎週 {r.weekdays.map((d) => WEEKDAY_LABELS[d]).join('・')} {r.visit_time?.slice(0, 5)} — {r.task}
          </div>
          <button onClick={() => handleDeactivate(r.id)} style={{ fontSize: 12 }}>
            停止
          </button>
        </div>
      ))}
    </div>
  );
}
