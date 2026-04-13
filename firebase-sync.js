// ─── Weight Flow — Firebase Sync ─────────────────────────────────────────────
// デバイス間でデータをリアルタイム同期するモジュール
// firebase-config.js の FIREBASE_CONFIG を設定済みの場合のみ動作します

(function () {
  "use strict";

  const SYNC_CODE_KEY = "weight-flow-sync-code";
  const STORAGE_KEY   = "weight-flow-storage-v4";
  const DB_PATH       = "wf";

  // ── Firebase が設定済みかチェック ─────────────────────────────────────────
  function isConfigured() {
    try {
      return (
        typeof FIREBASE_CONFIG !== "undefined" &&
        FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY" &&
        FIREBASE_CONFIG.databaseURL &&
        !FIREBASE_CONFIG.databaseURL.includes("YOUR_PROJECT")
      );
    } catch { return false; }
  }

  // ── 8文字の同期コードを生成 ───────────────────────────────────────────────
  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字を除外
    let code = "";
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += "-";
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code; // 例: ABCD-EFGH
  }

  // ── URLパラメータから同期コードを取得 ─────────────────────────────────────
  function getCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("sync");
    if (code && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) return code;
    return null;
  }

  // ── 同期コードの取得 or 生成 ──────────────────────────────────────────────
  function resolveCode() {
    const fromUrl = getCodeFromUrl();
    if (fromUrl) {
      localStorage.setItem(SYNC_CODE_KEY, fromUrl);
      // URLパラメータを除去（見た目をきれいに）
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", clean);
      return fromUrl;
    }
    const stored = localStorage.getItem(SYNC_CODE_KEY);
    if (stored) return stored;
    const newCode = generateCode();
    localStorage.setItem(SYNC_CODE_KEY, newCode);
    return newCode;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  メインの同期クラス
  // ─────────────────────────────────────────────────────────────────────────
  class WeightFlowSync {
    constructor() {
      this.code       = resolveCode();
      this.db         = null;
      this.dbRef      = null;
      this.pushTimer  = null;
      this.lastLocalTs = 0;
      this.isApplyingRemote = false;
      this.status     = "init"; // init | ready | syncing | synced | offline | unconfigured
    }

    // ── Firebase 初期化 ──────────────────────────────────────────────────
    async init() {
      if (!isConfigured()) {
        this.setStatus("unconfigured");
        this._renderPanel();
        return;
      }

      try {
        firebase.initializeApp(FIREBASE_CONFIG);
        this.db    = firebase.database();
        this.dbRef = this.db.ref(`${DB_PATH}/${this.code}`);

        this.setStatus("ready");
        this._renderPanel();

        // 初回: Firebaseからデータを取得（ローカルより新しければ適用）
        await this._pullOnce();

        // リアルタイムリスナー登録
        this._listenRemote();

      } catch (err) {
        console.warn("[WeightFlowSync] Firebase init error:", err);
        this.setStatus("offline");
        this._renderPanel();
      }
    }

    // ── Firebase からデータを一度だけ取得 ───────────────────────────────
    async _pullOnce() {
      try {
        const snap = await this.dbRef.get();
        if (!snap.exists()) return;
        const remote = snap.val();
        if (!remote?._ts) return;

        // ローカルより新しい場合だけ適用
        const localRaw = localStorage.getItem(STORAGE_KEY);
        const local = localRaw ? JSON.parse(localRaw) : null;
        const localTs = local?._ts ?? 0;

        if (remote._ts > localTs) {
          this._applyRemote(remote);
        }
      } catch (err) {
        console.warn("[WeightFlowSync] Pull failed:", err);
      }
    }

    // ── リアルタイムリスナー ─────────────────────────────────────────────
    _listenRemote() {
      this.dbRef.on("value", (snap) => {
        if (!snap.exists() || this.isApplyingRemote) return;
        const remote = snap.val();
        if (!remote?._ts) return;

        // 自分の最後の書き込みより新しい場合だけ適用
        if (remote._ts > this.lastLocalTs + 500) {
          this._applyRemote(remote);
        }
      }, (err) => {
        console.warn("[WeightFlowSync] Listener error:", err);
        this.setStatus("offline");
        this._updateStatusUI();
      });
    }

    // ── リモートデータを適用 ─────────────────────────────────────────────
    _applyRemote(remote) {
      try {
        this.isApplyingRemote = true;

        // _ts などの内部フィールドを除いてlocalStorageに保存
        const { _ts, ...data } = remote;
        const merged = {
          profile: { heightCm: "", goalWeightKg: "", ...(data.profile ?? {}) },
          entries:  Array.isArray(data.entries)  ? data.entries  : [],
          workouts: Array.isArray(data.workouts) ? data.workouts : [],
          _ts: _ts
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

        // アプリに変更を通知（グローバル関数経由）
        if (typeof window.wfApplyRemoteState === "function") {
          window.wfApplyRemoteState(merged);
        }

        this.setStatus("synced");
        this._updateStatusUI();
      } catch (err) {
        console.warn("[WeightFlowSync] Apply failed:", err);
      } finally {
        this.isApplyingRemote = false;
      }
    }

    // ── Firebase へデータをプッシュ（デバウンス1.2秒）───────────────────
    push(state) {
      if (!this.dbRef || this.isApplyingRemote) return;

      clearTimeout(this.pushTimer);
      this.setStatus("syncing");
      this._updateStatusUI();

      this.pushTimer = setTimeout(() => {
        const ts = Date.now();
        this.lastLocalTs = ts;
        this.dbRef.set({ ...state, _ts: ts })
          .then(() => {
            this.setStatus("synced");
            this._updateStatusUI();
          })
          .catch((err) => {
            console.warn("[WeightFlowSync] Push failed:", err);
            this.setStatus("offline");
            this._updateStatusUI();
          });
      }, 1200);
    }

    // ── Firebase のデータを削除（リセット時）────────────────────────────
    clear() {
      if (!this.dbRef) return;
      this.dbRef.remove().catch(() => {});
    }

    // ── 同期コードを変更して再ロード ─────────────────────────────────────
    changeCode(newCode) {
      const clean = newCode.trim().toUpperCase();
      if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(clean)) {
        alert("コードの形式が正しくありません（例: ABCD-EFGH）");
        return;
      }
      if (clean === this.code) {
        alert("現在と同じコードです。");
        return;
      }
      localStorage.setItem(SYNC_CODE_KEY, clean);
      window.location.reload();
    }

    // ── ステータス更新 ───────────────────────────────────────────────────
    setStatus(s) { this.status = s; }

    // ─────────────────────────────────────────────────────────────────────
    //  UI レンダリング
    // ─────────────────────────────────────────────────────────────────────

    _renderPanel() {
      const target = document.getElementById("wf-sync-placeholder");
      if (!target) return;

      const isOk = this.status !== "unconfigured";

      target.innerHTML = `
        <section class="sync-panel panel panel-wide" id="wf-sync-panel">
          <div class="sync-panel-head">
            <div>
              <p class="panel-kicker">Sync</p>
              <h2>デバイス同期</h2>
            </div>
            <div id="wf-sync-status-badge" class="sync-status-badge sync-status-${this.status}">
              ${this._statusLabel()}
            </div>
          </div>

          ${isOk ? `
          <div class="sync-body">

            <!-- コード表示エリア -->
            <div class="sync-code-block">
              <p class="sync-code-label">あなたの同期コード</p>
              <div class="sync-code-row">
                <span class="sync-code-display" id="wf-sync-code-text">${this.code}</span>
                <button class="sync-action-btn" id="wf-sync-copy-btn" title="コードをコピー">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  コピー
                </button>
                <button class="sync-action-btn sync-action-qr" id="wf-sync-qr-btn" title="QRコードを表示">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="19" y="14" width="2" height="2" rx="0.5"/><rect x="14" y="19" width="2" height="2" rx="0.5"/><rect x="19" y="19" width="2" height="2" rx="0.5"/></svg>
                  QRコード
                </button>
              </div>
              <p class="sync-code-hint">スマホでこのコードを入力、またはQRコードをスキャンすると同じデータが見られます</p>
            </div>

            <!-- 別のコードを入力 -->
            <div class="sync-change-block">
              <p class="sync-code-label">別のデバイスのコードを入力</p>
              <div class="sync-change-row">
                <input
                  id="wf-sync-input"
                  class="sync-input"
                  type="text"
                  placeholder="ABCD-EFGH"
                  maxlength="9"
                  autocapitalize="characters"
                  autocomplete="off"
                  spellcheck="false"
                >
                <button class="sync-action-btn sync-action-primary" id="wf-sync-apply-btn">このコードに切り替える</button>
              </div>
            </div>

          </div>
          ` : `
          <div class="sync-unconfigured">
            <p>⚙️ <strong>firebase-config.js</strong> にFirebaseの設定値を入力すると、スマホとリアルタイム同期できるようになります。</p>
            <p>設定ファイル内のコメントに手順が書いてあります。</p>
          </div>
          `}
        </section>

        <!-- QRモーダル -->
        <div id="wf-qr-modal" class="wf-qr-modal" hidden>
          <div class="wf-qr-backdrop" id="wf-qr-backdrop"></div>
          <div class="wf-qr-box">
            <div class="wf-qr-head">
              <p class="wf-qr-title">スマホでスキャン</p>
              <button class="wf-qr-close" id="wf-qr-close">✕</button>
            </div>
            <img id="wf-qr-img" class="wf-qr-img" src="" alt="QRコード" loading="lazy">
            <p class="wf-qr-note">カメラアプリかQRリーダーでスキャンしてください</p>
            <p class="wf-qr-code-label">同期コード: <strong>${this.code}</strong></p>
          </div>
        </div>
      `;

      this._bindPanelEvents();
    }

    _statusLabel() {
      const map = {
        init:          "● 接続中...",
        ready:         "● 準備完了",
        syncing:       "↑ 同期中...",
        synced:        "✓ 同期済み",
        offline:       "✕ オフライン",
        unconfigured:  "⚙ 未設定"
      };
      return map[this.status] ?? "●";
    }

    _updateStatusUI() {
      const badge = document.getElementById("wf-sync-status-badge");
      if (!badge) return;
      badge.className = `sync-status-badge sync-status-${this.status}`;
      badge.textContent = this._statusLabel();
    }

    _bindPanelEvents() {
      // コピーボタン
      document.getElementById("wf-sync-copy-btn")?.addEventListener("click", () => {
        navigator.clipboard.writeText(this.code).then(() => {
          const btn = document.getElementById("wf-sync-copy-btn");
          if (btn) { btn.textContent = "✓ コピー済み"; setTimeout(() => { btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> コピー'; }, 2000); }
        });
      });

      // QRコードボタン
      document.getElementById("wf-sync-qr-btn")?.addEventListener("click", () => {
        const url = `${location.origin}${location.pathname}?sync=${this.code}`;
        const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(url)}&choe=UTF-8`;
        const img = document.getElementById("wf-qr-img");
        if (img) img.src = qrUrl;
        const modal = document.getElementById("wf-qr-modal");
        if (modal) modal.hidden = false;
      });

      // モーダルを閉じる
      document.getElementById("wf-qr-close")?.addEventListener("click", () => {
        document.getElementById("wf-qr-modal").hidden = true;
      });
      document.getElementById("wf-qr-backdrop")?.addEventListener("click", () => {
        document.getElementById("wf-qr-modal").hidden = true;
      });

      // コード入力の自動フォーマット（4文字でハイフン挿入）
      const codeInput = document.getElementById("wf-sync-input");
      codeInput?.addEventListener("input", (e) => {
        let v = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "");
        if (v.length > 4) v = v.slice(0, 4) + "-" + v.slice(4, 8);
        e.target.value = v;
      });

      // コード切り替えボタン
      document.getElementById("wf-sync-apply-btn")?.addEventListener("click", () => {
        const val = document.getElementById("wf-sync-input")?.value ?? "";
        this.changeCode(val);
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  初期化 & グローバル公開
  // ─────────────────────────────────────────────────────────────────────────
  window.wfSync = null;

  document.addEventListener("DOMContentLoaded", () => {
    const sync = new WeightFlowSync();
    window.wfSync = sync;
    sync.init();
  });

})();
