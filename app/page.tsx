'use client';

import React from 'react';
import Link from 'next/link'; // ★ Linkをインポート

const THEME = {
  primary: '#2E7D32',
  primaryHover: '#1B5E20',
  lightBg: '#F8FAF8',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  textMain: '#1E293B',
  textSub: '#64748B',
  textOnPrimary: '#FFFFFF',
  accent: '#F59E0B'
};

export default function FarmerLP() {
  return (
    <div style={{ fontFamily: 'sans-serif', color: THEME.textMain, backgroundColor: THEME.lightBg, minHeight: '100vh' }}>
      
      {/* ヘッダー */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: THEME.cardBg, borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: THEME.primary }}>
          FarmOff
        </div>
        <nav>
          {/* ★ <a> タグを <Link> タグに変更 */}
          <Link 
            href="/app" 
            style={{ 
              background: THEME.primary, 
              color: THEME.textOnPrimary, 
              padding: '10px 20px', 
              borderRadius: 8, 
              textDecoration: 'none', 
              fontWeight: 'bold'
            }}
          >
            ログイン
          </Link>
        </nav>
      </header>

      {/* ヒーローセクション（農家様への強いメッセージ） */}
      <section style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: '#E8F5E9' }}>
        <h1 style={{ fontSize: 36, marginBottom: 16, color: THEME.primary, fontWeight: 'bold' }}>
          農作業の一部を、安心して学生に任せませんか？
        </h1>
        <p style={{ fontSize: 18, color: THEME.textSub, marginBottom: 32, maxWidth: 700, margin: '0 auto 32px auto', lineHeight: 1.6 }}>
          FarmOffは、人手不足に悩む農家さんと、意欲ある大学生（代理管理者）をつなぐ管理ツールです。
          スケジュール共有、マニュアル化、現場の写真報告まで、遠隔でも作業をしっかり管理できます。
        </p>
        <a 
          href="#contact" 
          style={{ 
            background: THEME.accent, 
            color: '#FFF', 
            padding: '14px 32px', 
            borderRadius: 30, 
            textDecoration: 'none', 
            fontWeight: 'bold', 
            fontSize: 18,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          まずは無料で試してみる
        </a>
      </section>

      {/* フローチャートセクション（利用の流れ） */}
      <section style={{ padding: '60px 20px', maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 28, marginBottom: 40 }}>導入から作業完了までの流れ</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Step 
            number="1" 
            title="予定とマニュアルを登録" 
            description="FarmOffのアプリ上で、任せたい作業の予定日と、簡単な手順（PDFや写真）を登録します。" 
          />
          <Arrow />
          <Step 
            number="2" 
            title="学生（代理管理者）が現場へ" 
            description="大学でマッチングした学生が、アプリの予定とマニュアルを確認して農園へ向かいます。" 
          />
          <Arrow />
          <Step 
            number="3" 
            title="写真付きで作業報告を受信" 
            description="学生は作業完了後、スマホから写真を添付して報告。病害虫などの異常があればアラートでお知らせします。" 
          />
          <Arrow />
          <Step 
            number="4" 
            title="内容を確認して承認" 
            description="農家さんは報告内容を確認し、問題なければ承認。気になる点はチャットで直接やり取りできます。" 
          />
        </div>
      </section>

      {/* 料金プランセクション */}
      <section style={{ padding: '60px 20px', backgroundColor: THEME.cardBg, borderTop: `1px solid ${THEME.border}`, borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 28, marginBottom: 40 }}>料金プラン</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}>
            
            {/* 1回チケット */}
            <div style={{ width: 300, padding: 32, border: `1px solid ${THEME.border}`, borderRadius: 12, textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: 20, marginBottom: 12 }}>1回チケット</h3>
              <p style={{ color: THEME.textSub, marginBottom: 24, fontSize: 14 }}>指定の休日に単発で依頼したい方へ</p>
              <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 24, color: THEME.textMain }}>
                6,000円 <span style={{ fontSize: 14, fontWeight: 'normal', color: THEME.textSub }}>/ 1回</span>
              </div>
              <div style={{ textAlign: 'left', marginTop: 'auto' }}>
                <p style={{ fontSize: 14, color: THEME.textMain, lineHeight: 1.6, padding: '12px', backgroundColor: THEME.lightBg, borderRadius: 8 }}>
                  指定の休日に代行管理者が伺います。
                </p>
              </div>
            </div>

            {/* 月額プラン */}
            <div style={{ width: 300, padding: 32, border: `2px solid ${THEME.primary}`, borderRadius: 12, textAlign: 'center', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: THEME.primary, color: '#FFF', padding: '4px 16px', borderRadius: 20, fontSize: 12, fontWeight: 'bold' }}>
                おすすめ
              </div>
              <h3 style={{ fontSize: 20, marginBottom: 12 }}>月額プラン</h3>
              <p style={{ color: THEME.textSub, marginBottom: 24, fontSize: 14 }}>定期的な管理でお任せしたい方へ</p>
              <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 24, color: THEME.primary }}>
                40,000円 <span style={{ fontSize: 14, fontWeight: 'normal', color: THEME.textSub }}>/ 月</span>
              </div>
              <div style={{ textAlign: 'left', marginTop: 'auto' }}>
                <p style={{ fontSize: 14, color: THEME.textMain, lineHeight: 1.6, padding: '12px', backgroundColor: '#E8F5E9', borderRadius: 8 }}>
                  毎週土日（基本的に月8回）代行管理者が伺います。
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* よくある質問 (Q&A) */}
      <section style={{ padding: '60px 20px', maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 28, marginBottom: 40 }}>よくある質問 (Q&A)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FaqItem 
            question="Q. 解約に条件はありますか？" 
            answer="A. 特にありません。ただし、解約当月は日割りとはならず、全額負担となります。翌月から解約となります。" 
          />
          <FaqItem 
            question="Q. 代行管理による損害が発生した場合はどうすればいいですか？" 
            answer="A. ログイン後、サポート宛に損害発生の旨をお伝えください。" 
          />
          <FaqItem 
            question="Q. 平日に代行は行ってもらえますか？" 
            answer="A. 基本的に土日祝日のサービス提供となります。" 
          />
          <FaqItem 
            question="Q. どのような作業を任せられますか？" 
            answer="A. 当社が提供するテンプレートに沿って、管理委託用のマニュアルを作成していただきます。基本的には合計で1時間程度の作業を上限としております。代行以外の農作業は、追加料金をいただきます。" 
          />
        </div>
      </section>

      {/* フッター */}
      <footer style={{ backgroundColor: THEME.textMain, color: '#FFF', textAlign: 'center', padding: '24px' }}>
        <p style={{ fontSize: 14 }}>&copy; 2026 FarmOff. All rights reserved.</p>
      </footer>

    </div>
  );
}

function Step({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, backgroundColor: THEME.cardBg, padding: 24, borderRadius: 12, border: `1px solid ${THEME.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: THEME.primary, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 'bold', flexShrink: 0 }}>
        {number}
      </div>
      <div>
        <h3 style={{ fontSize: 18, marginBottom: 8, color: THEME.primary }}>{title}</h3>
        <p style={{ fontSize: 15, color: THEME.textSub, lineHeight: 1.6 }}>{description}</p>
      </div>
    </div>
  );
}

function Arrow() {
  return <div style={{ textAlign: 'center', color: THEME.primary, fontSize: 24 }}>↓</div>;
}

function FaqItem({ question, answer }: { question: string, answer: string }) {
  return (
    <div style={{ backgroundColor: THEME.cardBg, padding: 20, borderRadius: 8, border: `1px solid ${THEME.border}` }}>
      <div style={{ fontWeight: 'bold', color: THEME.textMain, marginBottom: 8 }}>{question}</div>
      <div style={{ color: THEME.textSub, fontSize: 15, lineHeight: 1.5 }}>{answer}</div>
    </div>
  );
}