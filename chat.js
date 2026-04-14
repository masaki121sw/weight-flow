// ─── Weight Flow AI Chat ─────────────────────────────────────────────────────
// ルールベースのチャットボット。外部APIなしで動作します。

(function () {
  "use strict";

  // ─── ボット知識データベース ───────────────────────────────────────────────
  const BOT_NAME = "Flow";
  const TYPING_DELAY = 700; // ms

  function getSyncRuntimeState() {
    const sync = window.wfSync ?? null;
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const reachable = protocol !== "file:" && !["localhost", "127.0.0.1", "::1"].includes(host);

    return {
      sync,
      status: sync?.status ?? "unconfigured",
      code: sync?.code ?? localStorage.getItem("weight-flow-sync-code") ?? "",
      configured: Boolean(sync && sync.status !== "unconfigured"),
      reachable,
      protocol,
      host
    };
  }

  function buildSyncAnswer() {
    const runtime = getSyncRuntimeState();

    if (!runtime.configured) {
      return `デバイス同期は **Firebase Realtime Database** を使って動きます ☁️\n\n**いまの状態:** まだ同期設定が完了していません\n\n**やること:**\n1. \`firebase-config.js\` に Firebase の設定値を入れる\n2. Firebase の Realtime Database を有効化する\n3. 画面を再読み込みする\n\n設定が完了すると「デバイス同期」パネルに **同期コード** が出て、今ある記録も自動でDBへ保存されます。`;
    }

    if (!runtime.reachable) {
      return `同期機能は有効ですが、このURLはスマホ共有向きではありません 📡\n\n**いまの状態:** ${runtime.protocol === "file:" ? "ローカルファイルで開いています" : "この端末専用のURLで開いています"}\n\n**スマホで使うには:**\n1. このアプリを **HTTP/HTTPS のURL** で開く\n2. 「デバイス同期」パネルの **同期コード** をスマホ側で入力する\n3. 共有できるURLなら **QRコード** でも開けます\n\n**現在の同期コード:** ${runtime.code || "まだ未発行です"}`;
    }

    return `デバイス同期はもう使えます ✅\n\n**使い方:**\n1. この端末の「デバイス同期」パネルで **同期コード** を確認\n2. スマホや別PCで同じアプリを開く\n3. 「別のデバイスのコードを入力」に同じコードを入れる\n4. 接続後は、いまの記録も新しい記録も **Realtime Database** に保存されて自動同期されます\n\n**現在の同期コード:** ${runtime.code || "読み込み中"}\n**同期ステータス:** ${syncStatusLabel(runtime.status)}\n\nQRコードボタンが押せる環境なら、スマホはコード入力なしでも接続できます。`;
  }

  function syncStatusLabel(status) {
    const labels = {
      init: "接続中",
      ready: "準備完了",
      syncing: "同期中",
      synced: "同期済み",
      offline: "オフライン",
      unconfigured: "未設定"
    };
    return labels[status] || "確認中";
  }

  const FAQ = [
    {
      id: "overview",
      label: "このアプリでできること",
      patterns: ["できること", "機能", "概要", "何ができ", "どんな", "全体", "summary", "overview"],
      answer: `**Weight Flow** は体重と運動をまとめて管理できる記録アプリです 📊\n\n主な機能はこちらです：\n\n🔹 **体重クイック記録** — 日付・時刻・体重を入力するだけ。前回値を一発入力するボタンも！\n\n🔹 **運動記録** — ランニング・筋トレ・ヨガなど8種類の運動を記録。距離・時間・カロリー・心拍数を保存できます\n\n🔹 **統計ダッシュボード** — 現在体重・前回比・BMI・週間フィットネス集計を自動で計算します\n\n🔹 **推移グラフ** — 体重・運動・統合の3種類のグラフで変化を可視化\n\n🔹 **Apple Health連携** — ヘルスケアのXMLデータを取り込めます\n\n🔹 **CSVエクスポート** — データをファイルに保存して管理も可能\n\n何か詳しく知りたい機能はありますか？`
    },
    {
      id: "weight",
      label: "体重の記録方法",
      patterns: ["体重", "記録", "入力", "登録", "保存", "どうやって", "やり方", "方法"],
      answer: `体重の記録はとても簡単です！ ⚖️\n\n**手順：**\n1. 画面上部の「Quick Log」カードを開きます\n2. タブが **⚖️ 体重** になっていることを確認\n3. 日付・時刻が自動で入っているので、**体重だけ入力** してください\n4. 「記録を保存」ボタンを押したら完了！\n\n**便利なボタン：**\n- 📌 **前回値を入れる** — 前回の体重がそのまま入ります\n- ⊕−ボタン — 0.1kg / 0.3kg 単位で微調整できます\n- 🎲 **サンプル** — まずは試しに使ってみたい時に\n\n💡 同じ日時の記録は自動で上書きされるので、記録ミスも安心です`
    },
    {
      id: "workout",
      label: "運動の記録方法",
      patterns: ["運動", "ワークアウト", "ランニング", "走", "筋トレ", "ヨガ", "カロリー", "距離", "フィットネス"],
      answer: `運動の記録もお任せください！ 🏃\n\n**手順：**\n1. 「Quick Log」の **🏃 運動** タブをクリック\n2. 運動の種類を選択（8種類から選べます）\n3. 距離・時間・カロリー・心拍数を入力\n4. 「運動を保存」で完了！\n\n**記録できる運動の種類：**\n🏃 ランニング　🚶 ウォーキング　🚴 サイクリング\n🏊 スイミング　🔥 HIIT　💪 筋トレ　🧘 ヨガ　⚡ その他\n\n💡 距離・時間・カロリーはどれか1つだけでもOK！心拍数は任意入力です`
    },
    {
      id: "stats",
      label: "統計データの見方",
      patterns: ["統計", "数値", "インサイト", "前回比", "平均", "変化", "スタート", "開始"],
      answer: `「今日のインサイト」パネルには、自動計算された統計が表示されます 📈\n\n**体重の統計：**\n- **現在の体重** — 一番新しい記録の体重\n- **前回比** — ひとつ前の記録との差（↑↓で方向がわかります）\n- **直近平均** — 最新の複数件を平均した値（日々のブレに惑わされにくい）\n- **開始からの変化** — 一番最初の記録からの差分\n- **目標まで** — 目標体重との差（目標設定が必要です）\n- **BMI** — 身長を設定すると自動計算されます\n\n**今週のフィットネス：**\n運動回数・合計距離・消費カロリー・平均ペースが集計されます`
    },
    {
      id: "chart",
      label: "グラフの使い方",
      patterns: ["グラフ", "チャート", "推移", "可視化", "見方", "統合", "chart"],
      answer: `推移グラフでは3つの表示モードがあります 📊\n\n**表示切替（グラフ上部のボタン）：**\n- ⚖️ **体重** — 体重の時系列変化を折れ線グラフで表示\n- 🏃 **運動** — ワークアウトの回数・カロリーを棒グラフで表示\n- 🔀 **統合** — 体重と運動を一画面で比較できる複合グラフ\n\n💡 体重の変化と運動の頻度を同時に見ることで、「運動した週は体重が落ちた」などの相関がわかります！\n\nグラフの下には自動生成された**推移サマリー**も表示されます`
    },
    {
      id: "profile",
      label: "身長・目標体重の設定",
      patterns: ["身長", "目標", "プロフィール", "設定", "bmi", "ゴール"],
      answer: `プロフィール設定をすると、より詳しい分析ができます！\n\n**設定方法：**\n1. 「固定プロフィール」パネルを探す\n2. **固定身長（cm）** を入力して保存 → BMIが自動計算されます\n3. **目標体重（kg）** を入力して保存 → 「目標まで」の差分が表示されます\n\n**身長について：**\n一度保存すると「固定」状態になります。変更が必要なときは「身長を編集」ボタンを押してください\n\n💡 目標体重を設定すると、現在値との差が自動で表示されてモチベーションアップに！`
    },
    {
      id: "apple-health",
      label: "Apple Health連携",
      patterns: ["apple", "health", "ヘルスケア", "healthkit", "xml", "取り込み", "インポート", "watch", "apple watch"],
      answer: `Apple WatchやiPhoneのヘルスケアデータを取り込めます 🍎\n\n**手順：**\n1. iPhoneの「ヘルスケア」アプリを開く\n2. 右上のアイコン → 「すべてのヘルスケアデータを書き出す」\n3. 書き出されたZIPを解凍してXMLファイルを用意\n4. Weight Flowの「🍎 Healthから取り込む」ボタンを押す\n5. XMLファイルを選択 → 自動で体重・ワークアウトが読み込まれます\n\n💡 Apple Watchで計測したランニングやカロリーもそのまま取り込めます！`
    },
    {
      id: "export",
      label: "CSVエクスポート",
      patterns: ["csv", "export", "書き出し", "エクスポート", "ダウンロード", "ファイル", "バックアップ"],
      answer: `記録データをCSVファイルに書き出せます 💾\n\n**手順：**\n1. 「推移グラフ」パネルの右上にある **「CSV書き出し」** ボタンをクリック\n2. ファイルが自動でダウンロードされます\n\n**CSVに含まれるデータ：**\n- 体重記録（日付・時刻・体重）\n- 運動記録（日付・種類・距離・時間・カロリー・心拍数）\n\n💡 ExcelやGoogle スプレッドシートで開いて自分なりの分析もできます！`
    },
    {
      id: "sync",
      label: "デバイス同期の使い方",
      patterns: ["同期", "デバイス同期", "スマホでも", "別端末", "リアルタイム同期", "同期コード", "qr", "QR", "database", "db"],
      answer: buildSyncAnswer
    },
    {
      id: "reset",
      label: "データの初期化",
      patterns: ["削除", "初期化", "リセット", "消す", "やり直し", "クリア"],
      answer: `データを初期化したい場合は以下の手順で行えます ⚠️\n\n**手順：**\n1. 「固定プロフィール」パネルを下にスクロール\n2. **「データを初期化」** ボタンを押す\n3. 確認メッセージが出るのでOKを押す\n\n⚠️ **注意：** 初期化すると**すべての記録・プロフィールが消えます**。元に戻せないので、必要な場合は先にCSVでバックアップしておきましょう！`
    },
    {
      id: "history",
      label: "記録履歴の確認",
      patterns: ["履歴", "history", "一覧", "過去", "ログ", "見る", "確認"],
      answer: `過去の記録は「記録履歴」パネルで確認できます 📋\n\n**見方：**\n- タブで **⚖️ 体重** / **🏃 運動** を切り替えられます\n- 体重記録には前回比（↑↓）も表示されます\n- 各記録の右端の **「削除」** ボタンで個別に削除できます\n\n💡 記録が増えるほど統計とグラフが充実してきます。毎日続けてみてください！`
    },
    {
      id: "bmi",
      label: "BMIって何ですか？",
      patterns: ["bmi", "体格指数", "肥満", "標準体重", "痩せ"],
      answer: `BMI（ボディマス指数）は体重と身長から肥満度を示す指標です ⚖️\n\n**計算式：** BMI = 体重(kg) ÷ 身長(m)²\n\n**判定基準（日本肥満学会）：**\n- 18.5未満 → 低体重（痩せ）\n- 18.5〜25未満 → 普通体重（標準）\n- 25〜30未満 → 肥満度1\n- 30以上 → 肥満度2以上\n\nWeight Flowでは**固定身長を設定**するとBMIが自動計算されて統計パネルに表示されます！`
    },
    {
      id: "start",
      label: "まず何から始める？",
      patterns: ["最初", "始め方", "スタート", "初めて", "初心者", "どこから"],
      answer: `初めての方はこの順番で始めると使いやすいです！ 🚀\n\n**Step 1** 📏 **身長を設定する**\n「固定プロフィール」で身長を入力→保存するとBMIが使えます\n\n**Step 2** 🎯 **目標体重を決める**\n同じくプロフィールで目標体重を設定。目標までの差がわかります\n\n**Step 3** ⚖️ **今日の体重を記録する**\n「Quick Log」に体重を入力して「記録を保存」！\n\n**Step 4** 🏃 **運動したら記録する**\n「Quick Log」の運動タブから種類・時間などを入力\n\nあとは毎日続けるだけです！グラフや統計が育っていくのを楽しんでください 😊`
    }
  ];

  const FALLBACK_RESPONSE = `うーん、その質問はちょっとわからなかったです 🤔\n\n以下のことなら詳しくお答えできます！気になるトピックを選んでみてください 👇`;

  // ─── チャットUIを作成 ─────────────────────────────────────────────────────
  function createChatWidget() {
    const widget = document.createElement("div");
    widget.id = "wf-chat";
    widget.innerHTML = `
      <!-- 最小化時のミニボタン -->
      <button id="wf-chat-mini" class="wf-chat-mini" aria-label="チャットを表示" hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      <!-- 通常表示エリア -->
      <div id="wf-chat-main">
        <!-- 開閉ボタン -->
        <button id="wf-chat-toggle" class="wf-chat-toggle" aria-label="使い方を聞く" aria-expanded="false">
          <span class="wf-chat-toggle-icon wf-chat-toggle-open">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span class="wf-chat-toggle-icon wf-chat-toggle-close" hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </span>
          <span class="wf-chat-toggle-label">使い方を聞く</span>
          <span class="wf-chat-toggle-label wf-chat-toggle-label-close" hidden>閉じる</span>
        </button>

        <!-- 非表示ボタン（スマホのみ表示） -->
        <button id="wf-chat-dismiss" class="wf-chat-dismiss" aria-label="チャットを隠す">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- チャットパネル -->
      <div id="wf-chat-panel" class="wf-chat-panel" hidden role="dialog" aria-label="Weight Flow サポートチャット">
        <!-- ヘッダー -->
        <div class="wf-chat-header">
          <div class="wf-chat-avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
              <path d="M12 8v4l3 3"/>
            </svg>
          </div>
          <div>
            <p class="wf-chat-bot-name">${BOT_NAME}</p>
            <p class="wf-chat-bot-status">● オンライン</p>
          </div>
        </div>

        <!-- メッセージエリア -->
        <div id="wf-chat-messages" class="wf-chat-messages" role="log" aria-live="polite"></div>

        <!-- 入力エリア -->
        <div class="wf-chat-footer">
          <input
            id="wf-chat-input"
            class="wf-chat-input"
            type="text"
            placeholder="質問を入力..."
            autocomplete="off"
            aria-label="質問を入力"
          >
          <button id="wf-chat-send" class="wf-chat-send" aria-label="送信">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(widget);
  }

  // ─── メッセージ追加 ───────────────────────────────────────────────────────
  function addMessage(text, sender) {
    const messages = document.getElementById("wf-chat-messages");
    const bubble = document.createElement("div");
    bubble.className = `wf-msg wf-msg-${sender}`;

    // **太字** パターンをHTMLに変換
    const html = text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

    bubble.innerHTML = `<div class="wf-msg-bubble">${html}</div>`;
    messages.appendChild(bubble);

    // 最新メッセージにスクロール
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });

    return bubble;
  }

  // ─── サジェストチップ追加 ─────────────────────────────────────────────────
  function addSuggestions(items) {
    const messages = document.getElementById("wf-chat-messages");
    const chips = document.createElement("div");
    chips.className = "wf-chips";
    items.forEach(item => {
      const btn = document.createElement("button");
      btn.className = "wf-chip";
      btn.textContent = item.label;
      btn.addEventListener("click", () => {
        chips.remove();
        handleUserMessage(item.label);
      });
      chips.appendChild(btn);
    });
    messages.appendChild(chips);
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  // ─── タイピングインジケーター ─────────────────────────────────────────────
  function showTyping() {
    const messages = document.getElementById("wf-chat-messages");
    const el = document.createElement("div");
    el.className = "wf-msg wf-msg-bot wf-typing-wrapper";
    el.innerHTML = `<div class="wf-msg-bubble wf-typing"><span></span><span></span><span></span></div>`;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  // ─── キーワードマッチ ────────────────────────────────────────────────────
  function findResponse(input) {
    const q = input.toLowerCase().replace(/\s+/g, "");
    for (const faq of FAQ) {
      if (faq.patterns.some(p => q.includes(p.toLowerCase()))) {
        return faq;
      }
    }
    return null;
  }

  // ─── ユーザーメッセージ処理 ───────────────────────────────────────────────
  function handleUserMessage(text) {
    if (!text.trim()) return;

    // ユーザーのメッセージを表示
    addMessage(text, "user");

    // 入力フィールドをクリア
    const input = document.getElementById("wf-chat-input");
    if (input) input.value = "";

    // タイピングを演出
    const typingEl = showTyping();

    setTimeout(() => {
      typingEl.remove();

      const match = findResponse(text);
      if (match) {
        const answer = typeof match.answer === "function" ? match.answer() : match.answer;
        addMessage(answer, "bot");
        // フォローアップのサジェスト（別のFAQ）
        const others = FAQ.filter(f => f.id !== match.id).slice(0, 3);
        addFollowUp(others);
      } else {
        addMessage(FALLBACK_RESPONSE, "bot");
        addSuggestions(FAQ.slice(0, 6));
      }
    }, TYPING_DELAY);
  }

  // ─── フォローアップ提案 ───────────────────────────────────────────────────
  function addFollowUp(items) {
    const messages = document.getElementById("wf-chat-messages");
    const wrapper = document.createElement("div");
    wrapper.className = "wf-followup";
    wrapper.innerHTML = `<p class="wf-followup-label">他に気になることは？</p>`;

    const chips = document.createElement("div");
    chips.className = "wf-chips";
    items.forEach(item => {
      const btn = document.createElement("button");
      btn.className = "wf-chip";
      btn.textContent = item.label;
      btn.addEventListener("click", () => {
        wrapper.remove();
        handleUserMessage(item.label);
      });
      chips.appendChild(btn);
    });

    wrapper.appendChild(chips);
    messages.appendChild(wrapper);
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  // ─── ウェルカムメッセージ ─────────────────────────────────────────────────
  function showWelcome() {
    const messages = document.getElementById("wf-chat-messages");
    messages.innerHTML = "";

    const typingEl = showTyping();
    setTimeout(() => {
      typingEl.remove();
      addMessage("こんにちは！Weight Flowの使い方サポートbotです 👋\n\n「何ができるの？」「どうやって使うの？」など、気軽に聞いてください！\n\nよく聞かれる質問はこちらです 👇", "bot");

      // 最初のサジェスト
      addSuggestions([
        FAQ.find(f => f.id === "start"),
        FAQ.find(f => f.id === "overview"),
        FAQ.find(f => f.id === "weight"),
        FAQ.find(f => f.id === "workout"),
        FAQ.find(f => f.id === "sync"),
        FAQ.find(f => f.id === "chart"),
        FAQ.find(f => f.id === "apple-health")
      ]);
    }, 600);
  }

  // ─── イベント設定 ─────────────────────────────────────────────────────────
  function bindChatEvents() {
    const toggle = document.getElementById("wf-chat-toggle");
    const panel = document.getElementById("wf-chat-panel");
    const input = document.getElementById("wf-chat-input");
    const sendBtn = document.getElementById("wf-chat-send");
    const dismissBtn = document.getElementById("wf-chat-dismiss");
    const miniBtn = document.getElementById("wf-chat-mini");
    const chatMain = document.getElementById("wf-chat-main");

    let isOpen = false;
    let hasOpened = false;

    // 非表示ボタン（×）
    dismissBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      chatMain.hidden = true;
      panel.hidden = true;
      panel.classList.remove("wf-chat-panel-open");
      miniBtn.hidden = false;
      isOpen = false;
    });

    // ミニボタン（復元）
    miniBtn.addEventListener("click", () => {
      miniBtn.hidden = true;
      chatMain.hidden = false;
    });

    toggle.addEventListener("click", () => {
      isOpen = !isOpen;
      toggle.setAttribute("aria-expanded", String(isOpen));

      const openIcon = toggle.querySelector(".wf-chat-toggle-open");
      const closeIcon = toggle.querySelector(".wf-chat-toggle-close");
      const openLabel = toggle.querySelector(".wf-chat-toggle-label:not(.wf-chat-toggle-label-close)");
      const closeLabel = toggle.querySelector(".wf-chat-toggle-label-close");

      if (isOpen) {
        panel.hidden = false;
        openIcon.hidden = true;
        closeIcon.hidden = false;
        openLabel.hidden = true;
        closeLabel.hidden = false;
        toggle.classList.add("wf-chat-toggle-active");

        // 初回オープン時のみウェルカム
        if (!hasOpened) {
          hasOpened = true;
          showWelcome();
        }

        requestAnimationFrame(() => {
          panel.classList.add("wf-chat-panel-open");
          input.focus();
        });
      } else {
        panel.classList.remove("wf-chat-panel-open");
        openIcon.hidden = false;
        closeIcon.hidden = true;
        openLabel.hidden = false;
        closeLabel.hidden = true;
        toggle.classList.remove("wf-chat-toggle-active");

        setTimeout(() => {
          panel.hidden = true;
        }, 280);
      }
    });

    // 送信ボタン
    sendBtn.addEventListener("click", () => {
      handleUserMessage(input.value.trim());
    });

    // Enterキー
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        handleUserMessage(input.value.trim());
      }
    });
  }

  // ─── 初期化 ──────────────────────────────────────────────────────────────
  function init() {
    createChatWidget();
    bindChatEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
