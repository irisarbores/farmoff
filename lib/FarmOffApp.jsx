'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

import InviteTab from './InviteTab';
import RecurringTab from './RecurringTab';
import PayoutTab from './PayoutTab';

// アップロードファイルの検証（画像 ＋ PDF に対応）
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

function validateImageOrPdfFile(file, allowPdf = false) {
  if (!file) return { ok: true };
  const allowed = allowPdf ? ALLOWED_FILE_TYPES : ALLOWED_IMAGE_TYPES;
  if (!allowed.includes(file.type)) {
    return { 
      ok: false, 
      message: allowPdf 
        ? '対応していないファイル形式です（JPEG/PNG/WEBP/GIF/PDFのみ）' 
        : '対応していないファイル形式です（JPEG/PNG/WEBP/GIFのみ）' 
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, message: 'ファイルサイズが大きすぎます（15MBまで）' };
  }
  return { ok: true };
}

// Privateバケット用ヘルパー関数：パスからSigned URL（有効期限付きURL）を取得
async function getSignedImageUrl(pathOrUrl, expiresInSeconds = 3600) {
  if (!pathOrUrl) return null;

  let filePath = pathOrUrl;
  if (pathOrUrl.includes('/report-photos/')) {
    filePath = pathOrUrl.split('/report-photos/')[1];
  }

  const { data, error } = await supabase.storage
    .from('report-photos')
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    console.error('Signed URLの取得に失敗しました:', error.message);
    return null;
  }
  return data.signedUrl;
}

// 🖼️ 渡されたファイルパス（画像またはPDF）から動的に Signed URL を生成して表示するコンポーネント
function PrivateMedia({ path, alt, style }) {
  const [signedUrl, setSignedUrl] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (path) {
      getSignedImageUrl(path).then((url) => {
        if (isMounted) setSignedUrl(url);
      });
    } else {
      setSignedUrl(null);
    }
    return () => { isMounted = false; };
  }, [path]);

  if (!signedUrl) return null;

  // PDFファイルの場合は閲覧・ダウンロード用リンクを表示
  const isPdf = path.toLowerCase().endsWith('.pdf') || path.includes('application/pdf');

  if (isPdf) {
    return (
      <div style={{ marginTop: 8, padding: '10px 12px', background: '#eef2f7', borderRadius: 6, border: '1px solid #cbd5e1' }}>
        <a 
          href={signedUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ color: '#1d4ed8', fontWeight: 'bold', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}
        >
          📄 マニュアルPDFを開く (別タブで閲覧)
        </a>
      </div>
    );
  }

  return <img src={signedUrl} alt={alt} style={style} loading="lazy" />;
}

// テーマカラー設定（明るい白ベース ＋ 緑アクセント）
const THEME = {
  primary: '#2E7D32',
  primaryHover: '#1B5E20',
  lightBg: '#F8FAF8',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  textMain: '#1E293B',
  textSub: '#64748B',
  textOnPrimary: '#FFFFFF'
};

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

  // 1. プロフィール取得
  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => setProfile(data));
  }, [userId]);

  // 2. 関係する農園一覧の取得
  useEffect(() => {
    if (!profile) return;

    async function loadFarms() {
      const savedFarmId = localStorage.getItem('activeFarmId');

      if (profile.role === 'farmer') {
        const { data } = await supabase.from('farms').select('*').eq('farmer_id', userId);
        if (data && data.length === 0) {
          const { data: created } = await supabase
            .from('farms')
            .insert({ farmer_id: userId, name: `${profile.display_name}の農園` })
            .select()
            .single();
          setFarms(created ? [created] : []);
          setActiveFarmId(created?.id ?? null);
        } else {
          setFarms(data ?? []);
          const defaultId = data?.find(f => f.id === savedFarmId)?.id ?? data?.[0]?.id ?? null;
          setActiveFarmId(defaultId);
        }
      } else {
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

  useEffect(() => {
    if (activeFarmId) {
      localStorage.setItem('activeFarmId', activeFarmId);
    }
  }, [activeFarmId]);

  // 3. データの読み込み ＋ チャットのリアルタイム購読
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

  // ---- 予定 ----
  async function addSchedule() {
    const { data, error } = await supabase
      .from('schedules')
      .insert({ farm_id: activeFarmId, visit_date: new Date().toISOString().slice(0, 10), task: '新しい予定' })
      .select()
      .single();
      
    if (error) {
      console.error('予定の追加に失敗しました:', error.message);
      alert('予定の追加に失敗しました。テーブルが存在しないか、権限がありません。');
      return;
    }
    if (data) setSchedules((prev) => [...prev, data]);
  }
  async function updateSchedule(id, fields) {
    await supabase.from('schedules').update(fields).eq('id', id);
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  }
  async function deleteSchedule(id) {
    await supabase.from('schedules').delete().eq('id', id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  // ---- 報告の送信 ----
  async function submitReport(note, isOk, file) {
    let photoPath = null;
    if (file) {
      const check = validateImageOrPdfFile(file, false);
      if (!check.ok) {
        alert(check.message);
        return;
      }
      photoPath = `${activeFarmId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('report-photos').upload(photoPath, file);
      if (uploadError) {
        console.error('アップロード失敗:', uploadError.message);
        photoPath = null;
      }
    }
    const { data } = await supabase
      .from('reports')
      .insert({ farm_id: activeFarmId, agent_id: userId, note, is_ok: isOk, photo_url: photoPath })
      .select()
      .single();
    if (data) setReports((prev) => [data, ...prev]);
  }

  async function requestDeleteReport(id, reason) {
    await supabase.from('reports').update({ delete_requested: true, delete_reason: reason }).eq('id', id);
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, delete_requested: true, delete_reason: reason } : r))
    );
  }

  async function approveReport(id, newStatus) {
    await supabase.from('reports').update({ status: newStatus }).eq('id', id);
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
  }

  // ---- 共通アップロード（マニュアル用はPDF許可） ----
  async function uploadFile(file, folder, allowPdf = false) {
    if (!file) return null;
    const check = validateImageOrPdfFile(file, allowPdf);
    if (!check.ok) {
      alert(check.message);
      return null;
    }
    const path = `${activeFarmId}/${folder}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('report-photos').upload(path, file);
    if (error) {
      console.error('ファイルアップロード失敗:', error.message);
      return null;
    }
    return path;
  }

  // ---- チャット送信 ----
  async function sendMessage(body, file) {
    let imagePath = null;
    if (file) {
      imagePath = await uploadFile(file, 'chat', false);
    }
    await supabase.from('messages').insert({
      farm_id: activeFarmId,
      sender_id: userId,
      body: body || '',
      image_url: imagePath,
    });
  }

  // ---- マニュアル ----
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
      const filePath = await uploadFile(file, 'manuals', true); // PDF許可
      if (filePath) updatedFields.image_url = filePath;
    }
    await supabase.from('manuals').update(updatedFields).eq('id', id);
    setManuals((prev) => prev.map((m) => (m.id === id ? { ...m, ...updatedFields } : m)));
  }

  async function deleteManual(id) {
    await supabase.from('manuals').delete().eq('id', id);
    setManuals((prev) => prev.filter((m) => m.id !== id));
  }
  
  if (!profile) return <p style={{ padding: 16, color: THEME.textMain }}>読み込み中…</p>;

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#FFFFFF', minHeight: '100vh', color: THEME.textMain }}>
      {profile.role === 'admin' ? (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${THEME.border}`, paddingBottom: 12, marginBottom: 16 }}>
            <strong>運営ダッシュボード</strong>
            <button onClick={() => supabase.auth.signOut()}>ログアウト</button>
          </div>
          <AdminTab />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#FAFAFA', borderBottom: `1px solid ${THEME.border}` }}>
            <strong>{profile.display_name}さん（{profile.role === 'farmer' ? '農家' : '代理管理者'}）</strong>
            <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 13 }}>ログアウト</button>
          </div>

          {farms.length > 1 && (
            <div style={{ padding: '8px 12px' }}>
              <select value={activeFarmId ?? ''} onChange={(e) => setActiveFarmId(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 4, border: `1px solid ${THEME.border}`, background: '#FFFFFF', color: THEME.textMain }}>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', borderBottom: `1px solid ${THEME.border}`, overflowX: 'auto', background: '#FFFFFF' }}>
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
                  color: tab === t ? THEME.primary : THEME.textSub,
                  fontWeight: tab === t ? 'bold' : 'normal',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
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
            <RecurringTab 
              farmId={activeFarmId} 
              onSaved={async () => {
                const { data } = await supabase
                  .from('schedules')
                  .select('*')
                  .eq('farm_id', activeFarmId)
                  .order('visit_date');
                setSchedules(data ?? []);
              }} 
            />
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
      <button onClick={onAdd} style={{ width: '100%', padding: 10, background: THEME.primary, color: THEME.textOnPrimary, border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>＋ 予定を追加</button>
      {schedules.map((s) => (
        <ScheduleItem key={s.id} schedule={s} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  );
}

function ScheduleItem({ schedule, onUpdate, onDelete }) {
  const [task, setTask] = useState(schedule.task ?? '');
  const [visitDate, setVisitDate] = useState(schedule.visit_date ?? '');
  const [visitTime, setVisitTime] = useState(schedule.visit_time ?? '09:00');

  return (
    <div style={{ border: `1px solid ${THEME.border}`, padding: 10, marginTop: 8, borderRadius: 6, background: THEME.cardBg }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
          onBlur={() => onUpdate(schedule.id, { visit_date: visitDate })}
          style={{ flex: 1, padding: 6, borderRadius: 4, border: `1px solid ${THEME.border}`, color: THEME.textMain }}
        />
        <input
          type="time"
          value={visitTime}
          onChange={(e) => setVisitTime(e.target.value)}
          onBlur={() => onUpdate(schedule.id, { visit_time: visitTime })}
          style={{ width: 100, padding: 6, borderRadius: 4, border: `1px solid ${THEME.border}`, color: THEME.textMain }}
        />
      </div>

      <input
        type="text"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        onBlur={() => onUpdate(schedule.id, { task })}
        style={{ width: '100%', boxSizing: 'border-box', padding: 6, borderRadius: 4, border: `1px solid ${THEME.border}`, color: THEME.textMain }}
      />
      <button onClick={() => onDelete(schedule.id)} style={{ marginTop: 6, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
        削除
      </button>
    </div>
  );
}

function ReportTab({ reports, onSubmit, profile, onApprove, onRequestDelete }) {
  const [note, setNote] = useState('');
  const [hasIssue, setHasIssue] = useState(false); 
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    await onSubmit(note || (hasIssue ? '異常発生の報告' : '作業完了'), !hasIssue, file);
    setNote('');
    setHasIssue(false);
    setFile(null);
    setPreviewUrl(null);
    setSubmitting(false);
  };

  return (
    <div style={{ padding: 12 }}>
      {profile?.role !== 'farmer' && (
        <div style={{ marginBottom: 24, padding: 12, border: `1px solid ${THEME.border}`, borderRadius: 6, background: THEME.cardBg }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例: 水やり完了、特に異常なし"
            style={{ width: '100%', height: 70, padding: 8, boxSizing: 'border-box', borderRadius: 4, border: `1px solid ${THEME.border}`, color: THEME.textMain }}
          />

          <label style={{ display: 'block', margin: '8px 0', cursor: 'pointer', color: hasIssue ? '#DC2626' : THEME.textMain, fontWeight: hasIssue ? 'bold' : 'normal' }}>
            <input 
              type="checkbox" 
              checked={hasIssue} 
              onChange={(e) => setHasIssue(e.target.checked)} 
            /> ⚠️ 異常あり（病害虫・設備破損など）
          </label>

          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'inline-block',
                padding: '8px 12px',
                background: '#F1F5F9',
                border: `1px solid ${THEME.border}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
                color: THEME.textMain
              }}
            >
              📷 写真を添付する
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
            {file && <span style={{ marginLeft: 8, fontSize: 12, color: THEME.textSub }}>{file.name}</span>}
          </div>

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
              background: submitting ? '#CBD5E1' : THEME.primary,
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

      <h4 style={{ marginTop: profile?.role !== 'farmer' ? 20 : 0, borderBottom: `1px solid ${THEME.border}`, paddingBottom: 4, color: THEME.textMain }}>
        送信済みの報告
      </h4>
      {reports.map((r) => (
        <div key={r.id} style={{ borderBottom: `1px solid ${THEME.border}`, padding: '12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: THEME.textSub }}>
              {new Date(r.created_at).toLocaleString('ja-JP')}
            </div>
            
            <div style={{ 
              fontSize: 11, 
              padding: '2px 6px', 
              borderRadius: 4,
              background: r.status === 'approved' ? '#E8F5E9' : r.status === 'rejected' ? '#FFEBEE' : '#FFF3E0',
              color: r.status === 'approved' ? '#2E7D32' : r.status === 'rejected' ? '#C62828' : '#EF6C00'
            }}>
              {r.status === 'approved' ? '✅ 承認済み' : r.status === 'rejected' ? '❌ 差し戻し' : '⏳ 承認待ち'}
            </div>
          </div>
          
          <div style={{ margin: '8px 0', fontWeight: r.is_ok ? 'normal' : 'bold', color: r.is_ok ? THEME.textMain : '#DC2626' }}>
            {r.note} {!r.is_ok && '⚠️要確認'}
          </div>

          {r.photo_url && (
            <PrivateMedia 
              path={r.photo_url} 
              alt="現場写真" 
              style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 4 }} 
            />
          )}

          {profile?.role === 'farmer' && (!r.status || r.status === 'pending') && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button 
                onClick={() => onApprove(r.id, 'approved')}
                style={{ flex: 1, padding: '8px', background: '#16A34A', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                承認する
              </button>
              <button 
                onClick={() => onApprove(r.id, 'rejected')}
                style={{ flex: 1, padding: '8px', background: '#DC2626', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                差し戻し
              </button>
            </div>
          )}

          <div style={{ marginTop: 12, borderTop: `1px dashed ${THEME.border}`, paddingTop: 8 }}>
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
                  background: '#FFFFFF',
                  color: THEME.textSub,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                🗑️ 削除を申請する
              </button>
            ) : (
              <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 'bold' }}>
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
      <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
        {messages.map((m) => {
          const isMe = m.sender_id === userId;
          return (
            <div key={m.id} style={{ textAlign: isMe ? 'right' : 'left', margin: '8px 0' }}>
              <div
                style={{
                  background: isMe ? THEME.primary : '#F1F5F9',
                  color: isMe ? '#FFFFFF' : THEME.textMain,
                  padding: '8px 12px',
                  borderRadius: 12,
                  display: 'inline-block',
                  maxWidth: '80%',
                  textAlign: 'left',
                }}
              >
                {m.image_url && (
                  <PrivateMedia
                    path={m.image_url}
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

      {previewUrl && (
        <div style={{ position: 'relative', marginBottom: 8, display: 'inline-block' }}>
          <img src={previewUrl} alt="プレビュー" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
          <button
            onClick={() => { setFile(null); setPreviewUrl(null); }}
            style={{ position: 'absolute', top: -4, right: -4, background: '#333', color: '#FFF', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <label style={{ background: '#F1F5F9', border: `1px solid ${THEME.border}`, padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 16 }}>
          📷
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
          placeholder="メッセージを入力…"
          style={{ flex: 1, padding: 8, borderRadius: 4, border: `1px solid ${THEME.border}`, color: THEME.textMain }}
        />
        <button onClick={handleSend} disabled={sending} style={{ padding: '8px 14px', background: THEME.primary, color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
          {sending ? '…' : '送信'}
        </button>
      </div>
    </div>
  );
}

function ManualTab({ profile, manuals, onAdd, onUpdate, onDelete }) {
  return (
    <div style={{ padding: 12 }}>
      {profile?.role === 'farmer' && (
        <button onClick={onAdd} style={{ width: '100%', padding: 10, background: THEME.primary, color: THEME.textOnPrimary, border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', marginBottom: 12 }}>＋ マニュアルを追加</button>
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
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onUpdate(manual.id, { title, body }, file);
    setUploading(false);
  };

  return (
    <div style={{ border: `1px solid ${THEME.border}`, padding: 12, marginTop: 8, borderRadius: 6, background: THEME.cardBg }}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => onUpdate(manual.id, { title, body })}
        disabled={profile?.role !== 'farmer'}
        style={{ width: '100%', fontWeight: 'bold', padding: 6, boxSizing: 'border-box', borderRadius: 4, border: `1px solid ${THEME.border}`, color: THEME.textMain }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => onUpdate(manual.id, { title, body })}
        disabled={profile?.role !== 'farmer'}
        rows={3}
        style={{ width: '100%', marginTop: 6, padding: 6, boxSizing: 'border-box', borderRadius: 4, border: `1px solid ${THEME.border}`, color: THEME.textMain }}
      />

      {/* 📄 画像・PDF の安全な参照表示 */}
      {manual.image_url && (
        <PrivateMedia 
          path={manual.image_url} 
          alt="マニュアル資料" 
          style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 4, marginTop: 6 }} 
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        {profile?.role === 'farmer' && (
          <>
            <label style={{ fontSize: 12, background: '#F1F5F9', border: `1px solid ${THEME.border}`, padding: '6px 10px', borderRadius: 4, cursor: 'pointer', color: THEME.textMain }}>
              {uploading ? 'アップロード中…' : '📁 写真/PDFを追加・変更'}
              <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            <button onClick={() => onDelete(manual.id)} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>削除</button>
          </>
        )}
      </div>
    </div>
  );
}

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
      <h3 style={{ fontSize: 16, marginBottom: 16, color: THEME.textMain }}>🗑️ 削除申請一覧</h3>
      {requests.length === 0 && <p style={{ fontSize: 13, color: THEME.textSub }}>現在、未処理の削除申請はありません。</p>}
      
      {requests.map((r) => (
        <div key={r.id} style={{ border: '1px solid #FECDD3', padding: 12, marginBottom: 16, borderRadius: 6, background: '#FFF5F5' }}>
          <div style={{ fontSize: 12, color: THEME.textSub, marginBottom: 4 }}>報告日時: {new Date(r.created_at).toLocaleString('ja-JP')}</div>
          <div style={{ fontWeight: 'bold', marginBottom: 8, color: THEME.textMain }}>{r.note}</div>
          
          <div style={{ fontSize: 13, background: '#FFFFFF', padding: 8, border: '1px solid #FECDD3', borderRadius: 4, color: THEME.textMain }}>
            <strong>申請理由:</strong> {r.delete_reason || '理由なし'}
          </div>
          
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button 
              onClick={() => executeDelete(r.id)} 
              style={{ flex: 1, padding: 8, background: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              削除を実行
            </button>
            <button 
              onClick={() => rejectDelete(r.id)} 
              style={{ flex: 1, padding: 8, background: '#F1F5F9', color: THEME.textMain, border: `1px solid ${THEME.border}`, borderRadius: 4, cursor: 'pointer' }}
            >
              却下して戻す
            </button>
          </div>
        </div>
      ))}

      <a
        href="https://forms.gle/your-google-form-link"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#1E293B',
          color: '#FFFFFF',
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