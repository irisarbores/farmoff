# FARM OFF アプリ — セットアップ手順

## 1. Supabaseプロジェクトを作る
1. https://supabase.com にアクセスし、無料でアカウント作成
2. 「New project」でプロジェクトを作成（東京リージョン推奨）
3. 作成後、左メニュー「SQL Editor」を開き、`sql/schema.sql` の中身を
   すべて貼り付けて実行（テーブル・セキュリティルール・写真保存用の
   バケットが一括で作られます）

## 2. Next.jsプロジェクトを作る（まだの場合）
```bash
npx create-next-app@latest farm-off-app
cd farm-off-app
npm install @supabase/supabase-js
```

## 3. ファイルを配置する
- `lib/supabaseClient.js`
- `lib/AuthScreen.jsx`
- `lib/FarmOffApp.jsx`
- `lib/App.jsx`

これらを、作成したNext.jsプロジェクトの `lib/` フォルダにコピーしてください。

## 4. 環境変数を設定する
Supabaseダッシュボードの「Settings > API」から2つの値をコピーし、
プロジェクト直下に `.env.local` を作成:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
```

## 5. トップページから呼び出す
`app/page.js`（または `pages/index.js`）を以下のように書き換え:

```jsx
import App from '../lib/App';
export default function Home() {
  return <App />;
}
```

## 6. 起動して確認
```bash
npm run dev
```
http://localhost:3000 を開き、「新規登録」から
農家アカウント・代理管理者アカウントをそれぞれ作って動作確認してください。

## 7. 代行者を農園に割り当てる（今は手動）
今の段階では、代行者を農園に割り当てる画面がないので、
Supabaseダッシュボードの「Table Editor」→ `farm_agents` テーブルで
`farm_id` と `agent_id` を手入力して1行追加してください。
（本格運用する前に、農家が代行者を招待できる画面を追加するのがおすすめです）

## 8. 本番公開する
```bash
npm install -g vercel
vercel
```
Vercel側の環境変数にも同じ `NEXT_PUBLIC_SUPABASE_URL` と
`NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してください。

---

## できていること / まだのこと

**できていること**
- 農家・代理管理者、それぞれの新規登録とログイン
- 農園ごとの訪問予定（追加・編集・削除）
- 訪問後の報告（写真つき、Supabase Storageに保存）
- 農家⇄代行者のチャット（リアルタイム反映）
- 農園ごとのマニュアル（追加・編集・削除）
- 行レベルセキュリティにより、自分に関係のない農園のデータは見えない

**まだのこと（次のステップ）**
- 農家が代行者を招待する画面（今は手動でテーブルに追加）
- コア登録者への月次保証・品質ボーナスの集計画面
- プッシュ通知（新しい報告やメッセージが来たとき）
- パスワードリセット画面
