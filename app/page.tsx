'use client';

import React from 'react';

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
          <a 
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
          </a>
        </nav>
      </header>

      {/* ヒーローセクション */}
      <section style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: '#E8F5E9' }}>
        <h1 style={{ fontSize: 36, marginBottom: 16, color: THEME.primary, fontWeight: 'bold' }}>
          農作業の一部を、安心して学生に任せませんか？
        </h1>
        <p style={{ fontSize: 18, color: THEME.textSub, marginBottom: 32, maxWidth: 700, margin: '0 auto 32px auto', lineHeight: 1.6 }}>
          FarmOffは、人手不足に悩む農家さんと、意欲ある大学生（代理管理者）をつなぐ管理ツールです。
          スケジュール共有、マニュアル化、現場の写真報告まで、遠隔でも作業をしっかり管理できます。
        </p>
      </section>

      {/* 簡略化のため中略していますが、お手元の元のLPコードを貼り付けてください */}
      <footer style={{ backgroundColor: THEME.textMain, color: '#FFF', textAlign: 'center', padding: '24px' }}>
        <p style={{ fontSize: 14 }}>&copy; 2026 FarmOff. All rights reserved.</p>
      </footer>
    </div>
  );
}