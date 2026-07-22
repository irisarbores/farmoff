// lib/supabaseClient.js
// Supabaseプロジェクトの「Settings > API」から下記2つの値を取得して
// .env.local に入れてください（このファイルはそのまま使えます）
//
// NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
// NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
