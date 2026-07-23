'use client';

// lib/FarmOffApp.jsx
// プロトタイプで見た「予定・報告・チャット・マニュアル」の4タブを
// Supabaseの実データに接続したバージョンです。
//
// 使い方の前提:
// - 農家は最初にfarmsテーブルへ自分の農園を登録する（ここでは簡略化のため
//   ログイン後に農園が1件もなければ自動で1件作成する処理を入れています）
// - 代行者は farm_agents テーブルで農園に割り当てられている前提

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

import InviteTab from './InviteTab';
import RecurringTab from './RecurringTab';
import PayoutTab from './PayoutTab';

// テーマカラー設定（緑ベース）
const THEME = {
  primary: '#2E7D32',      // メインの緑色
  primaryHover: '#1B5E20', // ホバー・押下時の濃い緑
  lightBg: '#E8F5E9',      // 薄い緑背景
  border: '#A5D6A7',       // 緑系の枠線
  textOnPrimary: '#FFFFFF' // 緑ボタンの上の文字色
};

// 適用例（ボタン部分）
<button 
  style={{ 
    background: THEME.primary, 
    color: THEME.buttonText, 
    border: 'none', 
    borderRadius: 4 
  }}
>
  送信
</button>

export default function FarmOffApp({ session }) {
  const [profile, setProfile] = useState(null);
  const [farms, setFarms] = useState([]);
  const [activeFarmId, setActiveFarmId] = useState(null);
  const [tab, setTab] = useState('schedule');

  const [schedules, setSchedules] = useState([]);
  const [reports, setReports] = useState([]);
  const [messages, setMessages] = useState([]);
  const [manuals, setManuals] = useState([]);

  const userId = session.user.id;

  // 1. 自分のプロフィールを取得
  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => setProfile(data));
  }, [userId]);

// 2. 関係する農園一覧を取得（一部変更）
useEffect(() => {
  if (!profile) return;

  async function loadFarms() {
    const savedFarmId = localStorage.getItem('activeFarmId'); // ローカルストレージから取得

    if (profile.role === 'farmer') {
      const { data } = await supabase.from('farms').select('*').eq('farmer_id', userId);
      if (data && data.length === 0) {
        // 初回作成処理（変更なし）
        const { data: created } = await supabase
          .from('farms')
          .insert({ farmer_id: userId, name: `${profile.display_name}の農園` })
          .select()
          .single();
        setFarms(created ? [created] : []);
        setActiveFarmId(created?.id ?? null);
      } else {
        setFarms(data ?? []);
        // 保存されたIDが存在すればそれを、なければ1件目をセット
        const defaultId = data?.find(f => f.id === savedFarmId)?.id ?? data?.[0]?.id ?? null;
        setActiveFarmId(defaultId);
      }
    } else {
      // 代行者側の処理
      const { data } = await supabase
        .from('farm_agents')
        .select('farm_id, farms(*)')
        .eq('agent_id', userId);
      const list = (data ?? []).map((row) => row.farms);
      setFarms(list);
      const defaultId = list?.find(f => f.id === savedFarmId)?.id ?? list?.[0]?.id ?? null;
      setActiveFarmId(defaultId);
    }
  }
  loadFarms();
}, [profile, userId]);

// 追加: activeFarmIdが変わるたびにlocalStorageに保存
useEffect(() => {
  if (activeFarmId) {
    localStorage.setItem('activeFarmId', activeFarmId);
  }
}, [activeFarmId]);

  // 3. 選択中の農園に紐づくデータを読み込み＋リアルタイム購読
  useEffect(() => {
    if (!activeFarmId) return;

    async function loadAll() {
      const [s, r, m, man] = await Promise.all([
        supabase.from('schedules').select('*').eq('farm_id', activeFarmId).order('visit_date'),
        supabase.from('reports').select('*').eq('farm_id', activeFarmId).order('created_at', { ascending: false }),
        supabase.from('messages').select('*').eq('farm_id', activeFarmId).order('created_at'),
        supabase.from('manuals').select('*').eq('farm_id', activeFarmId).order('created_at'),
      ]);
      setSchedules(s.data ?? []);
      setReports(r.data ?? []);
      setMessages(m.data ?? []);
      setManuals(man.data ?? []);
    }
    loadAll();

    // チャットだけリアルタイム反映（相手の発言をすぐ表示するため）
    const channel = supabase
      .channel(`messages-${activeFarmId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `farm_id=eq.${activeFarmId}` },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeFarmId]);

  // ---- 予定の追加・編集・削除 ----
  async function addSchedule() {
    const { data, error } = await supabase
      .from('schedules')
      .insert({ farm_id: activeFarmId, visit_date: new Date().toISOString().slice(0, 10), task: '新しい予定' })
      .select()
      .single();
      
    // エラー時はログを出して処理を中断する
    if (error) {
      console.error('予定の追加に失敗しました:', error.message);
      alert('予定の追加に失敗しました。テーブルが存在しないか、権限がありません。');
      return;
    }
    
    // 成功時のみ配列に追加
    if (data) {
      setSchedules((prev) => [...prev, data]);
    }
  }
  async function updateSchedule(id, fields) {
    await supabase.from('schedules').update(fields).eq('id', id);
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  }
  async function deleteSchedule(id) {
    await supabase.from('schedules').delete().eq('id', id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  // ---- 報告の送信（写真アップロード込み）----
  async function submitReport(note, isOk, file) {
    let photoUrl = null;
    if (file) {
      const path = `${activeFarmId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('report-photos').upload(path, file);
      if (!uploadError) {
        const { data } = supabase.storage.from('report-photos').getPublicUrl(path);
        photoUrl = data.publicUrl;
      }
    }
    const { data } = await supabase
      .from('reports')
      .insert({ farm_id: activeFarmId, agent_id: userId, note, is_ok: isOk, photo_url: photoUrl })
      .select()
      .single();
    setReports((prev) => [data, ...prev]);
  }

// ---- 報告の削除申請 ----
  async function requestDeleteReport(id, reason) {
    await supabase.from('reports').update({ delete_requested: true, delete_reason: reason }).eq('id', id);
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, delete_requested: true, delete_reason: reason } : r))
    );
  }

// ---- 報告の承認・差し戻し ----
  async function approveReport(id, newStatus) {
    await supabase.from('reports').update({ status: newStatus }).eq('id', id);
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
  }

  // ---- 共通の画像アップロード関数 ----
  async function uploadImage(file, folder) {
    if (!file) return null;
    const path = `${activeFarmId}/${folder}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('report-photos').upload(path, file);
    if (error) {
      console.error('画像アップロード失敗:', error.message);
      return null;
    }
    const { data } = supabase.storage.from('report-photos').getPublicUrl(path);
    return data.publicUrl;
  }

  // ---- チャット送信 ----
  async function sendMessage(body, file) {
    let imageUrl = null;
    if (file) {
      imageUrl = await uploadImage(file, 'chat');
    }
    await supabase.from('messages').insert({
      farm_id: activeFarmId,
      sender_id: userId,
      body: body || '',
      image_url: imageUrl,
    });
  }

  // ---- マニュアルの追加・編集・削除 ----
async function addManual() {
    const { data } = await supabase
      .from('manuals')
      .insert({ farm_id: activeFarmId, title: '新しいマニュアル', body: '' })
      .select()
      .single();
    if (data) setManuals((prev) => [...prev, data]);
  }

  async function updateManual(id, fields, file) {
    let updatedFields = { ...fields };
    if (file) {
      const imageUrl = await uploadImage(file, 'manuals');
      if (imageUrl) updatedFields.image_url = imageUrl;
    }
    await supabase.from('manuals').update(updatedFields).eq('id', id);
    setManuals((prev) => prev.map((m) => (m.id === id ? { ...m, ...updatedFields } : m)));
  }

  async function deleteManual(id) {
    await supabase.from('manuals').delete().eq('id', id);
    setManuals((prev) => prev.filter((m) => m.id !== id));
  }
  
if (!profile) return <p>読み込み中…</p>;

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 👑 運営管理者（admin）でログインしている場合専用の画面を表示 */}
      {profile.role === 'admin' ? (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: 12, marginBottom: 16 }}>
            <strong>運営ダッシュボード</strong>
            <button onClick={() => supabase.auth.signOut()}>ログアウト</button>
          </div>
          <AdminTab />
        </div>
      ) : (
        /* 👇 ここから下が通常の農家・代行者用画面 */
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 4px' }}>
            <strong>{profile.display_name}さん（{profile.role === 'farmer' ? '農家' : '代理管理者'}）</strong>
            <button onClick={() => supabase.auth.signOut()}>ログアウト</button>
          </div>

          {farms.length > 1 && (
            <select value={activeFarmId ?? ''} onChange={(e) => setActiveFarmId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', overflowX: 'auto' }}>
            {['schedule', 'report', 'chat', 'manual', 'invite', 'recurring', 'payout']
              .filter((t) => t !== 'payout' || profile.role !== 'farmer')
              .map((t) => (
              <button
  key={t}
  onClick={() => setTab(t)}
  style={{
    flex: 1,
    padding: 10,
    borderBottom: tab === t ? `3px solid ${THEME.primary}` : '3px solid transparent',
    color: tab === t ? THEME.primary : '#666',
    fontWeight: tab === t ? 'bold' : 'normal',
    background: 'none',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    cursor: 'pointer'
  }}
>
                {{
                  schedule: '予定',
                  report: '報告',
                  chat: 'チャット',
                  manual: 'マニュアル',
                  invite: '招待',
                  recurring: '繰り返し',
                  payout: '報酬'
                }[t]}
              </button>
            ))}
          </div>

          {tab === 'schedule' && (
            <ScheduleTab schedules={schedules} onAdd={addSchedule} onUpdate={updateSchedule} onDelete={deleteSchedule} />
          )}
          {tab === 'report' && (
            <ReportTab 
              reports={reports} 
              onSubmit={submitReport} 
              profile={profile} 
              onApprove={approveReport} 
              onRequestDelete={requestDeleteReport}
            />
          )}
          {tab === 'chat' && <ChatTab messages={messages} userId={userId} onSend={sendMessage} />}
          {tab === 'invite' && (
            <InviteTab
              profile={profile}
              farmId={activeFarmId}
              onJoined={(farmId) => setActiveFarmId(farmId)}
            />
          )}

          {tab === 'recurring' && (
            <RecurringTab farmId={activeFarmId} />
          )}

          {tab === 'payout' && profile.role !== 'farmer' && (
            <PayoutTab profile={profile} />
          )}

          {tab === 'manual' && (
  <ManualTab
    profile={profile}
    manuals={manuals}
    onAdd={addManual}
    onUpdate={updateManual}
    onDelete={deleteManual}
  />
)}
        </>
      )}

    </div>
  );
}

function ScheduleTab({ schedules, onAdd, onUpdate, onDelete }) {
  return (
    <div style={{ padding: 12 }}>
      <button onClick={onAdd}>＋ 予定を追加</button>
      {schedules.map((s) => (
        <ScheduleItem key={s.id} schedule={s} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  );
}

// 1件ごとのコンポーネントに分離
function ScheduleItem({ schedule, onUpdate, onDelete }) {
  const [task, setTask] = useState(schedule.task ?? '');
  const [visitDate, setVisitDate] = useState(schedule.visit_date ?? '');

  return (
    <div style={{ border: '1px solid #ddd', padding: 8, marginTop: 8 }}>
      <input
        type="date"
        value={visitDate}
        onChange={(e) => setVisitDate(e.target.value)}
        onBlur={() => onUpdate(schedule.id, { visit_date: visitDate })}
      />
      <input
        type="text"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        onBlur={() => onUpdate(schedule.id, { task })} // フォーカスが外れた時に保存
        style={{ width: '100%', marginTop: 4 }}
      />
      <button onClick={() => onDelete(schedule.id)} style={{ marginTop: 4 }}>削除</button>
    </div>
  );
}

// 1. 引数を追加する
function ReportTab({ reports, onSubmit, profile, onApprove, onRequestDelete }) {

// 2. 下の方にある {reports.map((r) => ( ... ))} の中身の最後にボタンを追加する
  const [note, setNote] = useState('');
  const [isOk, setIsOk] = useState(true);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ファイルが選ばれたらプレビュー画像を作る
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(note || '作業完了', isOk, file);
    setNote('');
    setFile(null);
    setPreviewUrl(null);
    setSubmitting(false);
  };

  return (
    <div style={{ padding: 12 }}>
      {/* 代行者アカウントのみ報告フォームを表示 */}
      {profile?.role !== 'farmer' && (
        <div style={{ marginBottom: 24 }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例: 水やり完了、特に異常なし"
            style={{ width: '100%', height: 70, padding: 8, boxSizing: 'border-box' }}
          />

          <label style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={isOk} onChange={(e) => setIsOk(e.target.checked)} /> 異常なし
          </label>

          {/* 分かりやすいファイル選択エリア */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'inline-block',
                padding: '8px 12px',
                background: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              📷 写真を添付する
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }} // 元の不格好なボタンは隠す
              />
            </label>
            {file && <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>{file.name}</span>}
          </div>

          {/* 選択した写真のプレビュー表示 */}
          {previewUrl && (
            <div style={{ marginBottom: 12 }}>
              <img src={previewUrl} alt="プレビュー" style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 4 }} />
            </div>
          )}

          <button
  onClick={handleSubmit}
  disabled={submitting}
  style={{
    width: '100%',
    padding: 10,
    background: submitting ? '#ccc' : THEME.primary, // 既存の #0070f3 を変更
    color: THEME.textOnPrimary,
    border: 'none',
    borderRadius: 4,
    fontWeight: 'bold',
    cursor: submitting ? 'not-allowed' : 'pointer',
  }}
>
  {submitting ? '送信中…' : '報告を送信'}
</button>
        </div>
      )}

    <h4 style={{ marginTop: profile?.role !== 'farmer' ? 20 : 0, borderBottom: '1px solid #eee', paddingBottom: 4 }}>
        送信済みの報告
      </h4>
      {reports.map((r) => (
        <div key={r.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#888' }}>
              {new Date(r.created_at).toLocaleString('ja-JP')}
            </div>
            
            {/* ステータスバッジの表示 */}
            <div style={{ 
              fontSize: 11, 
              padding: '2px 6px', 
              borderRadius: 4,
              background: r.status === 'approved' ? '#e8f5e9' : r.status === 'rejected' ? '#ffebee' : '#fff3e0',
              color: r.status === 'approved' ? '#2e7d32' : r.status === 'rejected' ? '#c62828' : '#ef6c00'
            }}>
              {r.status === 'approved' ? '✅ 承認済み' : r.status === 'rejected' ? '❌ 差し戻し' : '⏳ 承認待ち'}
            </div>
          </div>
          
          <div style={{ margin: '8px 0', fontWeight: r.is_ok ? 'normal' : 'bold', color: r.is_ok ? '#333' : '#d32f2f' }}>
            {r.note} {!r.is_ok && '⚠️要確認'}
          </div>
          {r.photo_url && (
           <img 
  src={r.photo_url} 
  alt="現場写真" 
  loading="lazy" 
  style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} 
/>
          )}

          {/* 農家アカウントで、かつステータスが「承認待ち」の時だけボタンを表示 */}
          {profile?.role === 'farmer' && (!r.status || r.status === 'pending') && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button 
                onClick={() => onApprove(r.id, 'approved')}
                style={{ flex: 1, padding: '8px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                承認する
              </button>
              <button 
                onClick={() => onApprove(r.id, 'rejected')}
                style={{ flex: 1, padding: '8px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                差し戻し
              </button>
            </div>
          )}

        

         {/* 削除申請ボタンエリア */}
<div style={{ marginTop: 12, borderTop: '1px dashed #eee', paddingTop: 8 }}>
  {!r.delete_requested ? (
    <button
      onClick={() => {
        const isConfirmed = window.confirm('本当に削除申請を行いますか？');
        if (isConfirmed) {
          const reason = window.prompt('削除申請の理由を入力してください（運営が確認します）:');
          if (reason) onRequestDelete(r.id, reason);
        }
      }}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        background: '#fff',
        color: '#666',
        border: '1px solid #ccc',
        borderRadius: 4,
        cursor: 'pointer'
      }}
    >
      🗑️ 削除を申請する
    </button>
  ) : (
    <span style={{ fontSize: 12, color: '#d32f2f', fontWeight: 'bold' }}>
      ⏳ 運営へ削除申請中...
    </span>
  )}
</div> 

        </div>
      ))}
    </div>
  );
}

function ChatTab({ messages, userId, onSend }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sending, setSending] = useState(false);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  };

  const handleSend = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    await onSend(text.trim(), file);
    setText('');
    setFile(null);
    setPreviewUrl(null);
    setSending(false);
  };

  return (
    <div style={{ padding: 12 }}>
      {/* メッセージ一覧 */}
      <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
        {messages.map((m) => {
          const isMe = m.sender_id === userId;
          return (
            <div key={m.id} style={{ textAlign: isMe ? 'right' : 'left', margin: '8px 0' }}>
              <div
                style={{
                  background: isMe ? '#0070f3' : '#eee',
                  color: isMe ? '#fff' : '#333',
                  padding: '6px 12px',
                  borderRadius: 12,
                  display: 'inline-block',
                  maxWidth: '80%',
                  textAlign: 'left',
                }}
              >
                {m.image_url && (
                  <img
                    src={m.image_url}
                    alt="添付画像"
                    style={{ width: '100%', borderRadius: 8, marginBottom: m.body ? 4 : 0, display: 'block' }}
                  />
                )}
                {m.body && <div>{m.body}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* プレビュー表示 */}
      {previewUrl && (
        <div style={{ position: 'relative', marginBottom: 8, display: 'inline-block' }}>
          <img src={previewUrl} alt="プレビュー" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
          <button
            onClick={() => { setFile(null); setPreviewUrl(null); }}
            style={{ position: 'absolute', top: -4, right: -4, background: '#333', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}

      {/* 入力欄 & 写真ボタン */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <label style={{ background: '#f0f0f0', border: '1px solid #ccc', padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 16 }}>
          📷
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
          placeholder="メッセージを入力…"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSend} disabled={sending} style={{ padding: '8px 12px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4 }}>
          {sending ? '…' : '送信'}
        </button>
      </div>
    </div>
  );
}

function ManualTab({ profile, manuals, onAdd, onUpdate, onDelete }) {
  return (
    <div style={{ padding: 12 }}>
      {/* 農家のみ追加ボタンを表示 */}
      {profile?.role === 'farmer' && (
        <button onClick={onAdd}>＋ マニュアルを追加</button>
      )}
      {manuals.map((m) => (
        <ManualItem key={m.id} manual={m} onUpdate={onUpdate} onDelete={onDelete} profile={profile} />
      ))}
    </div>
  );
}

function ManualItem({ manual, onUpdate, onDelete, profile }) {
  const [title, setTitle] = useState(manual.title ?? '');
  const [body, setBody] = useState(manual.body ?? '');
  const [imageUrl, setImageUrl] = useState(manual.image_url ?? null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onUpdate(manual.id, { title, body }, file);
    setUploading(false);
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: 8, marginTop: 8, borderRadius: 4 }}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => onUpdate(manual.id, { title, body })}
        disabled={profile?.role !== 'farmer'} // 代行者は編集不可に
        style={{ width: '100%', fontWeight: 'bold', padding: 4, boxSizing: 'border-box' }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => onUpdate(manual.id, { title, body })}
        disabled={profile?.role !== 'farmer'} // 代行者は編集不可に
        rows={3}
        style={{ width: '100%', marginTop: 4, padding: 4, boxSizing: 'border-box' }}
      />

      {/* 画像の表示 */}
      {manual.image_url && (
        <img src={manual.image_url} alt="マニュアル画像" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 4, marginTop: 4 }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        {/* 農家のみアップロードと削除を表示 */}
        {profile?.role === 'farmer' && (
          <>
            <label style={{ fontSize: 12, background: '#f0f0f0', border: '1px solid #ccc', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>
              {uploading ? 'アップロード中…' : '📷 写真を変更/追加'}
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
            <button onClick={() => onDelete(manual.id)} style={{ color: '#d32f2f' }}>削除</button>
          </>
        )}
      </div>
    </div>
  );
}

// 運営管理者用のタブコンポーネント
function AdminTab() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('delete_requested', true)
      .order('created_at', { ascending: false });
    setRequests(data ?? []);
  }

  async function executeDelete(id) {
    if (!window.confirm('本当にこの報告をデータベースから完全に削除しますか？\n（復元できません）')) return;
    await supabase.from('reports').delete().eq('id', id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  async function rejectDelete(id) {
    await supabase.from('reports').update({ delete_requested: false, delete_reason: null }).eq('id', id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 16 }}>🗑️ 削除申請一覧</h3>
      {requests.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>現在、未処理の削除申請はありません。</p>}
      
      {requests.map((r) => (
        <div key={r.id} style={{ border: '1px solid #d32f2f', padding: 12, marginBottom: 16, borderRadius: 6, background: '#fff9f9' }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>報告日時: {new Date(r.created_at).toLocaleString('ja-JP')}</div>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{r.note}</div>
          
          <div style={{ fontSize: 13, background: '#fff', padding: 8, border: '1px solid #ffcdd2', borderRadius: 4 }}>
            <strong>申請理由:</strong> {r.delete_reason || '理由なし'}
          </div>
          
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button 
              onClick={() => executeDelete(r.id)} 
              style={{ flex: 1, padding: 8, background: '#d32f2f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              削除を実行
            </button>
            <button 
              onClick={() => rejectDelete(r.id)} 
              style={{ flex: 1, padding: 8, background: '#eee', color: '#333', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              却下して戻す
            </button>
          </div>
        </div>
      ))}

      {/* カスタマーサポートボタン */}
  <a
    href="https://forms.gle/your-google-form-link" // 実際のフォーム等のURL
    target="_blank"
    rel="noopener noreferrer"
    style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      background: '#333',
      color: '#fff',
      padding: '12px 16px',
      borderRadius: 30,
      textDecoration: 'none',
      fontSize: 14,
      fontWeight: 'bold',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 1000,
    }}
  >
    💬 お問い合わせ
  </a>

    </div>
  );
}