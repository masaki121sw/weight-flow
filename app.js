// ─── Storage ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "weight-flow-storage-v4";
const DRAFT_STORAGE_KEY = "weight-flow-draft-v1";
const LEGACY_STORAGE_KEYS = [
  "weight-flow-storage-v3",
  "weight-flow-storage-v2",
  "weight-flow-storage-v1",
  "weight-flow-storage",
  "weight-flow-data",
  "weightflow-storage",
  "weightflow-data"
];

const defaultState = {
  profile: { heightCm: "", goalWeightKg: "" },
  entries: [],
  workouts: []
};

const defaultDrafts = {
  entry: { date: "", time: "", weight: "" },
  workout: { date: "", type: "", distance: "", duration: "", calories: "", heartRate: "" },
  profile: { heightCm: "", goalWeightKg: "" }
};

// ─── State ─────────────────────────────────────────────────────────────────
const initialState = loadState();
const initialDrafts = loadDrafts();
let state = initialState.state;
let restoredFromStorageKey = initialState.source && initialState.source !== STORAGE_KEY
  ? initialState.source
  : null;
let formDrafts = initialDrafts ?? structuredClone(defaultDrafts);
let hasStoredDrafts = Boolean(initialDrafts);
let isHeightEditing = !Boolean(state.profile.heightCm);
let activeLogTab = "weight";
let activeHistoryTab = "weight";
let activeChart = "weight";
let activePeriod = "7d";

// ─── Elements ──────────────────────────────────────────────────────────────
const el = {
  entryForm: document.getElementById("entryForm"),
  workoutForm: document.getElementById("workoutForm"),
  profileForm: document.getElementById("profileForm"),
  entryDate: document.getElementById("entryDate"),
  entryTime: document.getElementById("entryTime"),
  entryWeight: document.getElementById("entryWeight"),
  fillLatestButton: document.getElementById("fillLatestButton"),
  fillSampleButton: document.getElementById("fillSampleButton"),
  fillWorkoutSampleButton: document.getElementById("fillWorkoutSampleButton"),
  stepButtons: document.getElementById("stepButtons"),
  workoutDate: document.getElementById("workoutDate"),
  workoutType: document.getElementById("workoutType"),
  workoutDistance: document.getElementById("workoutDistance"),
  workoutDuration: document.getElementById("workoutDuration"),
  workoutCalories: document.getElementById("workoutCalories"),
  workoutHeartRate: document.getElementById("workoutHeartRate"),
  heightCm: document.getElementById("heightCm"),
  goalWeightKg: document.getElementById("goalWeightKg"),
  toggleHeightLockButton: document.getElementById("toggleHeightLockButton"),
  resetButton: document.getElementById("resetButton"),
  exportButton: document.getElementById("exportButton"),
  importHealthButton: document.getElementById("importHealthButton"),
  healthXmlInput: document.getElementById("healthXmlInput"),
  historyList: document.getElementById("historyList"),
  trendChart: document.getElementById("trendChart"),
  chartSummary: document.getElementById("chartSummary"),
  heroCurrentWeight: document.getElementById("heroCurrentWeight"),
  heroStatus: document.getElementById("heroStatus"),
  quickTrendLabel: document.getElementById("quickTrendLabel"),
  heroHeightBadge: document.getElementById("heroHeightBadge"),
  heroGoalBadge: document.getElementById("heroGoalBadge"),
  heroWorkoutBadge: document.getElementById("heroWorkoutBadge"),
  heroWorkoutSub: document.getElementById("heroWorkoutSub"),
  profileHeightValue: document.getElementById("profileHeightValue"),
  profileGoalValue: document.getElementById("profileGoalValue"),
  profileGoalHint: document.getElementById("profileGoalHint"),
  currentWeightStat: document.getElementById("currentWeightStat"),
  currentWeightSubtext: document.getElementById("currentWeightSubtext"),
  latestDeltaStat: document.getElementById("latestDeltaStat"),
  latestDeltaSubtext: document.getElementById("latestDeltaSubtext"),
  rollingAverageStat: document.getElementById("rollingAverageStat"),
  rollingAverageSubtext: document.getElementById("rollingAverageSubtext"),
  startChangeLabel: document.getElementById("startChangeLabel"),
  startChangeStat: document.getElementById("startChangeStat"),
  startChangeSubtext: document.getElementById("startChangeSubtext"),
  goalDeltaStat: document.getElementById("goalDeltaStat"),
  goalDeltaSubtext: document.getElementById("goalDeltaSubtext"),
  bmiStat: document.getElementById("bmiStat"),
  bmiSubtext: document.getElementById("bmiSubtext"),
  weekWorkoutCount: document.getElementById("weekWorkoutCount"),
  weekWorkoutCountSub: document.getElementById("weekWorkoutCountSub"),
  weekDistance: document.getElementById("weekDistance"),
  weekDistanceSub: document.getElementById("weekDistanceSub"),
  weekCalories: document.getElementById("weekCalories"),
  weekCaloriesSub: document.getElementById("weekCaloriesSub"),
  weekAvgPace: document.getElementById("weekAvgPace"),
  weekAvgPaceSub: document.getElementById("weekAvgPaceSub"),
  fitnessSectionLabel: document.getElementById("fitnessSectionLabel"),
};

// ─── Initialize ─────────────────────────────────────────────────────────────
initialize();

function initialize() {
  if (restoredFromStorageKey) {
    writeStateToStorage(state);
    restoredFromStorageKey = null;
  }
  syncEntryDateTimeInputs();
  syncWorkoutDateInput();
  syncProfileForm();
  applyStoredDrafts();
  bindEvents();
  syncHeightLockState();
  render();
}

// ─── Firebase リモートデータ適用（firebase-sync.js から呼ばれる）────────────
window.wfApplyRemoteState = function (remote) {
  state = {
    profile:  { ...defaultState.profile,  ...(remote.profile  ?? {}) },
    entries:  Array.isArray(remote.entries)  ? remote.entries  : [],
    workouts: Array.isArray(remote.workouts) ? remote.workouts : []
  };
  isHeightEditing = !Boolean(state.profile.heightCm);
  syncProfileForm();
  applyStoredDrafts();
  syncHeightLockState();
  render();
};

function bindEvents() {
  el.entryForm.addEventListener("submit", handleEntrySubmit);
  el.workoutForm.addEventListener("submit", handleWorkoutSubmit);
  el.profileForm.addEventListener("submit", handleProfileSubmit);
  el.fillLatestButton.addEventListener("click", fillWithLatestWeight);
  el.fillSampleButton.addEventListener("click", fillWithSampleData);
  el.fillWorkoutSampleButton.addEventListener("click", fillWithWorkoutSample);
  el.stepButtons.addEventListener("click", handleStepAdjust);
  el.toggleHeightLockButton.addEventListener("click", toggleHeightLock);
  el.resetButton.addEventListener("click", resetAllData);
  el.exportButton.addEventListener("click", exportCsv);
  el.importHealthButton.addEventListener("click", () => el.healthXmlInput.click());
  el.healthXmlInput.addEventListener("change", handleHealthImport);
  el.historyList.addEventListener("click", handleHistoryClick);
  [el.entryForm, el.workoutForm, el.profileForm].forEach(form => {
    form.addEventListener("input", persistCurrentInputs);
    form.addEventListener("change", persistCurrentInputs);
  });

  // Log tabs
  document.querySelectorAll(".log-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      activeLogTab = btn.dataset.tab;
      document.querySelectorAll(".log-tab").forEach(b => b.classList.remove("log-tab-active"));
      btn.classList.add("log-tab-active");
      el.entryForm.hidden = activeLogTab !== "weight";
      el.workoutForm.hidden = activeLogTab !== "workout";
    });
  });

  // History tabs
  document.querySelectorAll(".history-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      activeHistoryTab = btn.dataset.history;
      document.querySelectorAll(".history-tab").forEach(b => b.classList.remove("history-tab-active"));
      btn.classList.add("history-tab-active");
      renderHistory();
    });
  });

  // Chart toggles
  document.querySelectorAll(".chart-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeChart = btn.dataset.chart;
      document.querySelectorAll(".chart-toggle-btn").forEach(b => b.classList.remove("chart-toggle-active"));
      btn.classList.add("chart-toggle-active");
      renderChart();
    });
  });

  // Period tabs
  document.querySelectorAll(".period-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      activePeriod = btn.dataset.period;
      document.querySelectorAll(".period-tab").forEach(b => b.classList.remove("period-tab-active"));
      btn.classList.add("period-tab-active");
      const metrics = calculateMetrics(state.profile, state.entries, state.workouts);
      renderStats(metrics);
    });
  });
}

// ─── Handlers ───────────────────────────────────────────────────────────────
function handleEntrySubmit(event) {
  event.preventDefault();
  const date = el.entryDate.value || todayIsoDate();
  const time = el.entryTime.value || currentTimeValue();
  const weight = parseNumber(el.entryWeight.value);
  if (!weight) { alert("体重を入力してください。"); return; }

  const recordedAt = combineDateAndTime(date, time);
  const existing = state.entries.find(e => e.recordedAt === recordedAt);
  if (existing) {
    state.entries = state.entries.map(e => e.recordedAt === recordedAt ? { ...e, weightKg: weight } : e);
  } else {
    state.entries = [...state.entries, { id: crypto.randomUUID(), recordedAt, weightKg: weight }];
  }

  persist();
  clearDraftSection("entry");
  el.entryWeight.value = "";
  syncEntryDateTimeInputs();
  persistCurrentInputs();
  render();
  el.entryWeight.focus();
}

function handleWorkoutSubmit(event) {
  event.preventDefault();
  const date = el.workoutDate.value || todayIsoDate();
  const type = el.workoutType.value;
  const distance = parseNumber(el.workoutDistance.value);
  const duration = parseNumber(el.workoutDuration.value);
  const calories = parseNumber(el.workoutCalories.value);
  const heartRate = parseNumber(el.workoutHeartRate.value);

  if (!distance && !duration && !calories) {
    alert("距離・時間・カロリーのいずれかを入力してください。");
    return;
  }

  state.workouts = [...state.workouts, {
    id: crypto.randomUUID(),
    date,
    type,
    distanceKm: distance,
    durationMin: duration,
    calories,
    heartRateBpm: heartRate
  }];

  persist();
  clearDraftSection("workout");
  el.workoutForm.reset();
  syncWorkoutDateInput();
  persistCurrentInputs();
  render();
}

function handleProfileSubmit(event) {
  event.preventDefault();
  state.profile = {
    heightCm: el.heightCm.value.trim(),
    goalWeightKg: el.goalWeightKg.value.trim()
  };
  if (state.profile.heightCm) isHeightEditing = false;
  persist();
  clearDraftSection("profile");
  syncHeightLockState();
  persistCurrentInputs();
  render();
}

function handleStepAdjust(event) {
  const button = event.target.closest("[data-adjust]");
  if (!button) return;
  const delta = parseFloat(button.dataset.adjust);
  const base = parseNumber(el.entryWeight.value) ?? getLatestEntry(state.entries)?.weightKg ?? 0;
  el.entryWeight.value = Math.max(0.1, base + delta).toFixed(1);
  persistCurrentInputs();
}

function toggleHeightLock() {
  if (!state.profile.heightCm) { el.heightCm.focus(); return; }
  isHeightEditing = !isHeightEditing;
  syncHeightLockState();
  if (isHeightEditing) { el.heightCm.focus(); el.heightCm.select(); }
}

function handleHistoryClick(event) {
  const btn = event.target.closest("[data-entry-id]");
  if (!btn) return;
  const { entryId, entryType } = btn.dataset;
  if (entryType === "workout") {
    state.workouts = state.workouts.filter(w => w.id !== entryId);
  } else {
    state.entries = state.entries.filter(e => e.id !== entryId);
  }
  persist();
  render();
}

function fillWithLatestWeight() {
  const latest = getLatestEntry(state.entries);
  if (!latest) { alert("まだ前回値がありません。最初の記録を追加してください。"); return; }
  el.entryWeight.value = formatWeight(latest.weightKg);
  persistCurrentInputs();
  el.entryWeight.focus();
  el.entryWeight.select();
}

function fillWithSampleData() {
  if (state.entries.length > 0) {
    if (!confirm("サンプルデータを入れると、今の記録は上書きされます。続けますか？")) return;
  }
  state = {
    profile: { heightCm: "170", goalWeightKg: "68.0" },
    entries: buildSampleEntries(),
    workouts: buildSampleWorkouts()
  };
  isHeightEditing = false;
  persist();
  clearAllDrafts();
  syncEntryDateTimeInputs();
  syncWorkoutDateInput();
  syncProfileForm();
  syncHeightLockState();
  persistCurrentInputs();
  render();
}

function fillWithWorkoutSample() {
  state.workouts = [...state.workouts, ...buildSampleWorkouts()];
  persist();
  render();
}

function resetAllData() {
  if (!confirm("記録とプロフィールをすべて削除します。よろしいですか？")) return;
  state = structuredClone(defaultState);
  isHeightEditing = true;
  localStorage.removeItem(STORAGE_KEY);
  clearAllDrafts();
  // Firebase のデータも削除
  window.wfSync?.clear();
  syncProfileForm();
  syncHeightLockState();
  el.entryForm.reset();
  el.workoutForm.reset();
  syncEntryDateTimeInputs();
  syncWorkoutDateInput();
  render();
}

function exportCsv() {
  const sorted = getSortedEntries(state.entries);
  if (sorted.length === 0 && state.workouts.length === 0) { alert("書き出す記録がまだありません。"); return; }

  const weightRows = sorted.map(e => [
    "weight", csvSafe(e.recordedAt), e.recordedAt.slice(0,10), e.recordedAt.slice(11,16), e.weightKg, "", "", "", ""
  ]);
  const workoutRows = state.workouts.map(w => [
    "workout", csvSafe(w.date), w.date, "", "", w.type, w.distanceKm ?? "", w.durationMin ?? "", w.calories ?? ""
  ]);

  const header = ["type", "recordedAt", "date", "time", "weightKg", "workoutType", "distanceKm", "durationMin", "calories"];
  const csv = [header.join(","), ...weightRows.map(r => r.join(",")), ...workoutRows.map(r => r.join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `weight-flow-${todayIsoDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ─── Render ──────────────────────────────────────────────────────────────────
function render() {
  const metrics = calculateMetrics(state.profile, state.entries, state.workouts);
  renderHero(metrics);
  renderProfile(metrics);
  renderStats(metrics);
  renderHistory();
  renderChart();
}

function renderHero(metrics) {
  el.heroHeightBadge.textContent = metrics.heightLabel;
  el.heroGoalBadge.textContent = metrics.goalLabel;
  el.heroCurrentWeight.textContent = metrics.currentWeight ? `${formatWeight(metrics.currentWeight)} kg` : "--.- kg";
  el.heroStatus.textContent = metrics.heroMessage;
  el.quickTrendLabel.textContent = metrics.quickTrendText;
  el.heroWorkoutBadge.textContent = `${metrics.thisWeekWorkouts.length} 回`;
  el.heroWorkoutSub.textContent = metrics.thisWeekWorkouts.length > 0
    ? `今週 ${metrics.thisWeekCalories > 0 ? metrics.thisWeekCalories + " kcal消費" : "記録あり"}`
    : "今週はまだ記録なし";
}

function renderProfile(metrics) {
  el.profileHeightValue.textContent = metrics.heightLabel;
  el.profileGoalValue.textContent = metrics.goalLabel;
  el.profileGoalHint.textContent = metrics.profileGoalHint;
}

function renderStats(metrics) {
  el.currentWeightStat.textContent = metrics.currentWeight ? `${formatWeight(metrics.currentWeight)} kg` : "--.- kg";
  el.currentWeightSubtext.textContent = metrics.currentDateLabel;
  el.latestDeltaStat.textContent = metrics.latestDeltaLabel;
  el.latestDeltaSubtext.textContent = metrics.latestDeltaSubtext;
  el.rollingAverageStat.textContent = metrics.rollingAverageLabel;
  el.rollingAverageSubtext.textContent = metrics.rollingAverageSubtext;
  if (el.startChangeLabel) el.startChangeLabel.textContent = `${metrics.periodLabel}の変化`;
  el.startChangeStat.textContent = metrics.periodChangeLabel;
  el.startChangeSubtext.textContent = metrics.periodChangeSubtext;
  el.goalDeltaStat.textContent = metrics.goalDeltaLabel;
  el.goalDeltaSubtext.textContent = metrics.goalDeltaSubtext;
  el.bmiStat.textContent = metrics.bmiLabel;
  el.bmiSubtext.textContent = metrics.bmiSubtext;

  // Fitness stats
  if (el.fitnessSectionLabel) {
    el.fitnessSectionLabel.textContent = `🏃 フィットネス（${metrics.periodLabel}）`;
  }
  el.weekWorkoutCount.textContent = `${metrics.thisWeekWorkouts.length} 回`;
  el.weekWorkoutCountSub.textContent = metrics.thisWeekWorkouts.length > 0
    ? `${metrics.periodLabel} ${metrics.thisWeekWorkouts.map(w => workoutLabel(w.type)).join("・")}`
    : `${metrics.periodLabel}のワークアウト`;
  el.weekDistance.textContent = metrics.thisWeekDistance > 0 ? `${metrics.thisWeekDistance.toFixed(1)} km` : "-- km";
  el.weekDistanceSub.textContent = metrics.thisWeekDistance > 0 ? `${metrics.thisWeekWorkouts.filter(w => w.distanceKm).length}件の合計` : "今週の走行・歩行距離";
  el.weekCalories.textContent = metrics.thisWeekCalories > 0 ? `${metrics.thisWeekCalories} kcal` : "-- kcal";
  el.weekCaloriesSub.textContent = metrics.thisWeekCalories > 0 ? `平均 ${Math.round(metrics.thisWeekCalories / Math.max(1, metrics.thisWeekWorkouts.filter(w => w.calories).length))} kcal/回` : "今週の合計消費";
  el.weekAvgPace.textContent = metrics.avgPaceLabel;
  el.weekAvgPaceSub.textContent = metrics.avgPaceSub;
}

function renderHistory() {
  if (activeHistoryTab === "workout") {
    renderWorkoutHistory();
  } else {
    renderWeightHistory();
  }
}

function renderWeightHistory() {
  const sorted = getSortedEntries(state.entries);
  if (sorted.length === 0) {
    el.historyList.innerHTML = '<li class="history-empty">まだ体重の記録がありません。クイックログから入力してください。</li>';
    return;
  }
  el.historyList.innerHTML = sorted.slice().reverse().map((entry, ri) => {
    const origIdx = sorted.length - 1 - ri;
    const prev = sorted[origIdx - 1];
    return `
      <li class="history-item">
        <div class="history-main">
          <div class="history-date">${formatDateTime(entry.recordedAt)}</div>
          <div class="history-weight">${formatWeight(entry.weightKg)} kg</div>
        </div>
        ${buildHistoryDelta(entry, prev)}
        <button type="button" class="history-remove" data-entry-id="${entry.id}" data-entry-type="weight">削除</button>
      </li>
    `;
  }).join("");
}

function renderWorkoutHistory() {
  const sorted = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length === 0) {
    el.historyList.innerHTML = '<li class="history-empty">まだ運動の記録がありません。ワークアウトタブから入力してください。</li>';
    return;
  }
  el.historyList.innerHTML = sorted.map(w => {
    const pills = [];
    if (w.distanceKm) pills.push(`🗺 ${w.distanceKm.toFixed(2)} km`);
    if (w.durationMin) pills.push(`⏱ ${w.durationMin} 分`);
    if (w.calories) pills.push(`🔥 ${w.calories} kcal`);
    if (w.heartRateBpm) pills.push(`❤️ ${w.heartRateBpm} bpm`);
    return `
      <li class="history-item history-item-workout">
        <div class="history-main">
          <div class="history-date">${formatDate(w.date)}</div>
          <div class="history-weight">${workoutLabel(w.type)}</div>
        </div>
        ${pills.map(p => `<span class="history-stat-pill">${p}</span>`).join("")}
        <button type="button" class="history-remove" data-entry-id="${w.id}" data-entry-type="workout">削除</button>
      </li>
    `;
  }).join("");
}

// ─── Chart ───────────────────────────────────────────────────────────────────
function renderChart() {
  const sorted = getSortedEntries(state.entries);
  const goalWeight = parseNumber(state.profile.goalWeightKg);

  if (activeChart === "weight") {
    renderWeightChart(sorted, goalWeight);
  } else if (activeChart === "workout") {
    renderWorkoutChart();
  } else {
    renderCombinedChart(sorted, goalWeight);
  }
}

function renderWeightChart(sorted, goalWeight) {
  const svg = el.trendChart;
  if (sorted.length === 0) {
    svg.innerHTML = emptyChartSVG("体重の記録がまだありません", "体重を入力すると、ここに推移が描画されます");
    el.chartSummary.textContent = "記録が増えると、ここに推移の要約が表示されます。";
    return;
  }

  const { width, height, padding, innerWidth, innerHeight } = chartDims();
  const weights = sorted.map(e => e.weightKg);
  const minW = Math.min(...weights, isFinite(goalWeight) ? goalWeight : weights[0]);
  const maxW = Math.max(...weights, isFinite(goalWeight) ? goalWeight : weights[0]);
  const range = Math.max(1, maxW - minW);

  const xFor = (i) => padding.left + (sorted.length === 1 ? innerWidth / 2 : (i / (sorted.length - 1)) * innerWidth);
  const yFor = (w) => padding.top + (1 - (w - minW) / range) * innerHeight;

  const points = sorted.map((e, i) => ({ x: xFor(i), y: yFor(e.weightKg), w: e.weightKg }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${points.at(-1).x.toFixed(1)} ${(height - padding.bottom).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - padding.bottom).toFixed(1)} Z`;

  const yTicks = [0, 0.5, 1].map(step => {
    const v = maxW - range * step, y = yFor(v);
    return `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${width - padding.right}" y2="${y.toFixed(1)}" stroke="rgba(26,47,40,0.1)" stroke-dasharray="5 7"></line>
            <text x="${padding.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#5e7268">${formatWeight(v)}kg</text>`;
  }).join("");

  const xLabels = buildXLabels(sorted, xFor, height - 18);
  const goalLine = isFinite(goalWeight)
    ? `<line x1="${padding.left}" y1="${yFor(goalWeight).toFixed(1)}" x2="${width - padding.right}" y2="${yFor(goalWeight).toFixed(1)}" stroke="#d97348" stroke-width="2" stroke-dasharray="7 7"></line>
       <text x="${width - padding.right}" y="${(yFor(goalWeight) - 9).toFixed(1)}" text-anchor="end" font-size="11" fill="#d97348">Goal ${formatWeight(goalWeight)}kg</text>` : "";
  const dots = points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="#fffbf4" stroke="#1c7d67" stroke-width="2.5"></circle>`).join("");

  svg.innerHTML = `
    <defs>
      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(28,125,103,0.3)"></stop>
        <stop offset="100%" stop-color="rgba(28,125,103,0.02)"></stop>
      </linearGradient>
    </defs>
    ${yTicks}${goalLine}
    <path d="${area}" fill="url(#areaFill)"></path>
    <path d="${line}" fill="none" stroke="#1c7d67" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path>
    ${dots}${xLabels}
  `;

  const first = sorted[0], last = sorted.at(-1);
  const totalChange = last.weightKg - first.weightKg;
  const goalSummary = isFinite(goalWeight) ? goalSummaryText(last.weightKg, goalWeight) : "目標体重を入れると、ゴールラインも表示されます。";
  el.chartSummary.textContent = `${formatDateTime(first.recordedAt)}から${formatDateTime(last.recordedAt)}までで ${formatWeightChange(totalChange)}。${goalSummary}`;
}

function renderWorkoutChart() {
  const svg = el.trendChart;
  if (state.workouts.length === 0) {
    svg.innerHTML = emptyChartSVG("運動の記録がまだありません", "ワークアウトを入力すると、ここにカロリー消費などが描画されます");
    el.chartSummary.textContent = "運動を記録すると、ここに推移の要約が表示されます。";
    return;
  }

  const sorted = [...state.workouts].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-20);
  const { width, height, padding, innerWidth, innerHeight } = chartDims();

  const maxCal = Math.max(...recent.map(w => w.calories || 0), 1);
  const barW = Math.max(4, Math.floor((innerWidth / recent.length) * 0.6));
  const gap = innerWidth / (recent.length - 0.5 || 1);

  const bars = recent.map((w, i) => {
    const x = padding.left + i * gap;
    const h = ((w.calories || 0) / maxCal) * innerHeight;
    const y = height - padding.bottom - h;
    const color = workoutColor(w.type);
    const label = (w.calories || 0) > 0 ? `${w.calories}` : "";
    return `
      <rect x="${(x - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="5" fill="${color}" opacity="0.85"></rect>
      ${label ? `<text x="${x.toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="10" fill="#5e7268">${label}</text>` : ""}
      <text x="${x.toFixed(1)}" y="${(height - 6).toFixed(1)}" text-anchor="middle" font-size="10" fill="#5e7268">${formatShortDate(w.date)}</text>
    `;
  }).join("");

  // Y ticks
  const yTicks = [0, 0.5, 1].map(step => {
    const v = Math.round(maxCal * step);
    const y = height - padding.bottom - step * innerHeight;
    return `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${width - padding.right}" y2="${y.toFixed(1)}" stroke="rgba(26,47,40,0.08)" stroke-dasharray="5 7"></line>
            <text x="${padding.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#5e7268">${v}</text>`;
  }).join("");

  svg.innerHTML = `${yTicks}${bars}`;

  const totalCal = sorted.reduce((s, w) => s + (w.calories || 0), 0);
  el.chartSummary.textContent = `全${sorted.length}回の運動記録。合計消費カロリー ${totalCal} kcal。最近20件を表示しています。`;
}

function renderCombinedChart(sortedEntries, goalWeight) {
  const svg = el.trendChart;
  if (sortedEntries.length === 0 && state.workouts.length === 0) {
    svg.innerHTML = emptyChartSVG("記録がまだありません", "体重と運動を記録すると、統合グラフが表示されます");
    el.chartSummary.textContent = "体重と運動を記録すると、ここに統合グラフが表示されます。";
    return;
  }

  const { width, height, padding, innerWidth, innerHeight } = chartDims();

  // Weight line (left axis)
  let weightSVG = "";
  if (sortedEntries.length > 0) {
    const weights = sortedEntries.map(e => e.weightKg);
    const minW = Math.min(...weights, isFinite(goalWeight) ? goalWeight : weights[0]);
    const maxW = Math.max(...weights, isFinite(goalWeight) ? goalWeight : weights[0]);
    const range = Math.max(1, maxW - minW);
    const xFor = (i) => padding.left + (sortedEntries.length === 1 ? innerWidth / 2 : (i / (sortedEntries.length - 1)) * innerWidth);
    const yFor = (w) => padding.top + (1 - (w - minW) / range) * innerHeight;
    const points = sortedEntries.map((e, i) => ({ x: xFor(i), y: yFor(e.weightKg) }));
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const dots = points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#fffbf4" stroke="#1c7d67" stroke-width="2.5"></circle>`).join("");
    const xLabels = buildXLabels(sortedEntries, xFor, height - 18);
    weightSVG = `
      <defs>
        <linearGradient id="aFill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(28,125,103,0.2)"></stop>
          <stop offset="100%" stop-color="rgba(28,125,103,0.01)"></stop>
        </linearGradient>
      </defs>
      <path d="${line} L ${points.at(-1).x.toFixed(1)} ${(height - padding.bottom).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - padding.bottom).toFixed(1)} Z" fill="url(#aFill2)"></path>
      <path d="${line}" fill="none" stroke="#1c7d67" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      ${dots}${xLabels}
      <text x="${padding.left - 10}" y="${(padding.top).toFixed(1)}" text-anchor="end" font-size="10" fill="#1c7d67">体重</text>
    `;
  }

  // Workout dots
  let workoutSVG = "";
  if (state.workouts.length > 0 && sortedEntries.length > 0) {
    const firstDate = new Date(sortedEntries[0].recordedAt);
    const lastDate = new Date(sortedEntries.at(-1).recordedAt);
    const span = Math.max(1, lastDate - firstDate);

    workoutSVG = state.workouts.map(w => {
      const d = new Date(w.date + "T12:00:00");
      const ratio = (d - firstDate) / span;
      if (ratio < -0.05 || ratio > 1.05) return "";
      const x = padding.left + ratio * innerWidth;
      const y = height - padding.bottom - 12;
      const color = workoutColor(w.type);
      return `
        <line x1="${x.toFixed(1)}" y1="${padding.top}" x2="${x.toFixed(1)}" y2="${(height - padding.bottom).toFixed(1)}" stroke="${color}" stroke-width="1.5" opacity="0.25" stroke-dasharray="3 5"></line>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${color}" opacity="0.8"></circle>
        <text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="8" fill="#fff">${workoutEmoji(w.type)}</text>
      `;
    }).join("");
  }

  svg.innerHTML = weightSVG + workoutSVG;

  const totalWorkouts = state.workouts.length;
  const totalCal = state.workouts.reduce((s, w) => s + (w.calories || 0), 0);
  el.chartSummary.textContent = `体重推移と${totalWorkouts}回の運動記録を統合表示。縦線がワークアウトのタイミングを示します。${totalCal > 0 ? `合計消費カロリー ${totalCal} kcal。` : ""}`;
}

function emptyChartSVG(title, sub) {
  const { width, height } = chartDims();
  const inset = width <= 380 ? 10 : 16;
  const cardWidth = width - inset * 2;
  const cardHeight = height - inset * 2;
  const titleY = Math.round(height * 0.48);
  const subY = titleY + 28;
  const titleFont = width <= 380 ? 18 : 24;
  const subFont = width <= 380 ? 11 : 14;
  return `
    <rect x="${inset}" y="${inset}" width="${cardWidth}" height="${cardHeight}" rx="20" fill="rgba(255,255,255,0.5)"></rect>
    <text x="${width / 2}" y="${titleY}" text-anchor="middle" font-size="${titleFont}" fill="#1a2f28" font-family="DM Sans, sans-serif">${title}</text>
    <text x="${width / 2}" y="${subY}" text-anchor="middle" font-size="${subFont}" fill="#5e7268" font-family="DM Sans, sans-serif">${sub}</text>
  `;
}

function chartDims() {
  const viewport = window.innerWidth || 720;
  const mobile = viewport <= 430;
  const tablet = viewport > 430 && viewport <= 780;
  const width = mobile ? 360 : tablet ? 520 : 720;
  const height = mobile ? 248 : tablet ? 274 : 300;
  const padding = mobile
    ? { top: 18, right: 16, bottom: 34, left: 34 }
    : tablet
      ? { top: 22, right: 24, bottom: 44, left: 40 }
      : { top: 26, right: 32, bottom: 50, left: 46 };
  return { width, height, padding, innerWidth: width - padding.left - padding.right, innerHeight: height - padding.top - padding.bottom };
}

// ─── Metrics ─────────────────────────────────────────────────────────────────
function calculateMetrics(profile, entries, workouts) {
  const sortedEntries = getSortedEntries(entries);
  const currentEntry = getLatestEntry(sortedEntries);
  const previousEntry = sortedEntries.length > 1 ? sortedEntries[sortedEntries.length - 2] : null;
  const firstEntry = sortedEntries[0] ?? null;
  const currentWeight = currentEntry?.weightKg ?? null;
  const goalWeight = parseNumber(profile.goalWeightKg);
  const heightCm = parseNumber(profile.heightCm);
  const heightLabel = (isFinite(heightCm) && heightCm > 0) ? `${formatWeight(heightCm)} cm` : "未設定";
  const goalLabel = (isFinite(goalWeight) && goalWeight > 0) ? `${formatWeight(goalWeight)} kg` : "--.- kg";

  let heroMessage = "最初の記録を追加すると、ここに進捗が表示されます。";
  let quickTrendText = "前回比は記録が増えると表示されます。";
  let currentDateLabel = "最新の記録を表示します";
  let latestDeltaLabel = "--.- kg";
  let latestDeltaSubtext = "ひとつ前の記録と比較します";
  let rollingAverageLabel = "--.- kg";
  let rollingAverageSubtext = "最新の数件から平均を出します";
  let startChangeLabel = "--.- kg";
  let startChangeSubtext = "最初の記録と比較します";
  let goalDeltaLabel = "--.- kg";
  let goalDeltaSubtext = "目標体重との差です";
  let bmiLabel = "--.-";
  let bmiSubtext = "固定身長を設定すると計算されます";
  let profileGoalHint = "目標を入れると到達までの差分を自動表示します。";

  if (currentEntry) {
    currentDateLabel = `${formatDateTime(currentEntry.recordedAt)} の記録`;
    heroMessage = "目標体重を設定すると、ここに達成までの距離が表示されます。";
    const recent = sortedEntries.slice(-Math.min(7, sortedEntries.length));
    const avg = recent.reduce((s, e) => s + e.weightKg, 0) / recent.length;
    rollingAverageLabel = `${formatWeight(avg)} kg`;
    rollingAverageSubtext = `最新${recent.length}件の平均`;
  }

  if (currentEntry && previousEntry) {
    const delta = currentEntry.weightKg - previousEntry.weightKg;
    latestDeltaLabel = formatWeightChange(delta);
    latestDeltaSubtext = `${formatDateTime(previousEntry.recordedAt)} と比較`;
    quickTrendText = `${formatDateTime(previousEntry.recordedAt)} から ${formatWeightChange(delta)}。`;
  } else if (currentEntry) {
    latestDeltaLabel = "初回";
    latestDeltaSubtext = "比較対象の記録がまだありません";
    quickTrendText = "これは最初の記録です。次回から前回比が出ます。";
  }

  if (currentEntry && firstEntry) {
    const startDelta = currentEntry.weightKg - firstEntry.weightKg;
    startChangeLabel = formatWeightChange(startDelta);
    startChangeSubtext = `${formatDateTime(firstEntry.recordedAt)} からの変化`;
  }

  if (currentWeight && isFinite(goalWeight)) {
    const remaining = currentWeight - goalWeight;
    goalDeltaLabel = `${Math.abs(remaining).toFixed(1)} kg`;
    goalDeltaSubtext = goalDistanceText(remaining);
    heroMessage = goalSummaryText(currentWeight, goalWeight);
    profileGoalHint = goalDistanceText(remaining);
  }

  if (currentWeight && isFinite(heightCm) && heightCm > 0) {
    const bmi = currentWeight / ((heightCm / 100) ** 2);
    bmiLabel = bmi.toFixed(1);
    bmiSubtext = bmiStatusLabel(bmi);
  }

  // ─ Period filtering ─────────────────────────────────────────────────────
  const now = new Date();
  const periodStart = getPeriodStart(activePeriod, now);
  const periodLabel = getPeriodLabel(activePeriod);

  // Entries and workouts within the selected period
  const periodEntries = periodStart
    ? sortedEntries.filter(e => new Date(e.recordedAt) >= periodStart)
    : sortedEntries;
  const periodWorkouts = periodStart
    ? workouts.filter(w => new Date(w.date + "T00:00:00") >= periodStart)
    : workouts;

  // Rolling average: use period entries (or all if none in period)
  if (currentEntry) {
    const base = periodEntries.length > 0 ? periodEntries : sortedEntries.slice(-7);
    const avg = base.reduce((s, e) => s + e.weightKg, 0) / base.length;
    rollingAverageLabel = `${formatWeight(avg)} kg`;
    rollingAverageSubtext = periodEntries.length > 0
      ? `${periodLabel}内 ${base.length}件の平均`
      : `最新${base.length}件の平均`;
  }

  // Period weight change: earliest entry in period → latest
  let periodChangeLabel = "--.- kg";
  let periodChangeSubtext = `${periodLabel}の変化`;
  if (periodEntries.length >= 2) {
    const periodFirst = periodEntries[0];
    const periodLast = periodEntries[periodEntries.length - 1];
    const periodDelta = periodLast.weightKg - periodFirst.weightKg;
    periodChangeLabel = formatWeightChange(periodDelta);
    periodChangeSubtext = `${formatDateTime(periodFirst.recordedAt)} から`;
  } else if (periodEntries.length === 1) {
    periodChangeLabel = `${formatWeight(periodEntries[0].weightKg)} kg`;
    periodChangeSubtext = `${periodLabel}内は1件のみ`;
  }

  // Fitness stats for selected period
  const thisWeekWorkouts = periodWorkouts;
  const thisWeekDistance = thisWeekWorkouts.reduce((s, w) => s + (w.distanceKm || 0), 0);
  const thisWeekCalories = thisWeekWorkouts.reduce((s, w) => s + (w.calories || 0), 0);

  // Average pace for running workouts
  const runWorkouts = thisWeekWorkouts.filter(w => w.type === "running" && w.distanceKm && w.durationMin);
  let avgPaceLabel = "--'--\"";
  let avgPaceSub = "ランニング平均ペース";
  if (runWorkouts.length > 0) {
    const totalDist = runWorkouts.reduce((s, w) => s + w.distanceKm, 0);
    const totalMin = runWorkouts.reduce((s, w) => s + w.durationMin, 0);
    const paceMin = totalMin / totalDist;
    const paceM = Math.floor(paceMin);
    const paceS = Math.round((paceMin - paceM) * 60);
    avgPaceLabel = `${paceM}'${String(paceS).padStart(2, "0")}"`;
    avgPaceSub = `${periodLabel} ${runWorkouts.length}回のランニング`;
  }

  return {
    sortedEntries, currentWeight, goalWeight, heightLabel, goalLabel,
    heroMessage, quickTrendText, currentDateLabel,
    latestDeltaLabel, latestDeltaSubtext,
    rollingAverageLabel, rollingAverageSubtext,
    startChangeLabel, startChangeSubtext,
    periodChangeLabel, periodChangeSubtext,
    goalDeltaLabel, goalDeltaSubtext,
    bmiLabel, bmiSubtext, profileGoalHint,
    thisWeekWorkouts, thisWeekDistance, thisWeekCalories,
    avgPaceLabel, avgPaceSub, periodLabel
  };
}

// ─── Period Helpers ───────────────────────────────────────────────────────────
function getPeriodStart(period, now) {
  if (period === "all") return null;
  const d = new Date(now);
  if (period === "7d") {
    d.setDate(d.getDate() - 6);
  } else if (period === "30d") {
    d.setDate(d.getDate() - 29);
  } else if (period === "90d") {
    d.setDate(d.getDate() - 89);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPeriodLabel(period) {
  const labels = { "7d": "今週", "30d": "30日", "90d": "90日", "all": "全期間" };
  return labels[period] || period;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function workoutLabel(type) {
  const labels = { running: "🏃 ランニング", walking: "🚶 ウォーキング", cycling: "🚴 サイクリング", swimming: "🏊 スイミング", hiit: "🔥 HIIT", strength: "💪 筋トレ", yoga: "🧘 ヨガ", other: "⚡ その他" };
  return labels[type] || type;
}

function workoutEmoji(type) {
  const e = { running: "🏃", walking: "🚶", cycling: "🚴", swimming: "🏊", hiit: "🔥", strength: "💪", yoga: "🧘", other: "⚡" };
  return e[type] || "⚡";
}

function workoutColor(type) {
  const colors = { running: "#3b6fff", walking: "#2fa882", cycling: "#d97348", swimming: "#3bbfdc", hiit: "#e8455a", strength: "#9b6de8", yoga: "#4eaa8e", other: "#8899aa" };
  return colors[type] || "#8899aa";
}

function getSortedEntries(entries) {
  return entries
    .map(e => ({ id: e.id ?? crypto.randomUUID(), recordedAt: normalizeRecordedAt(e), weightKg: parseNumber(e.weightKg) }))
    .filter(e => e.recordedAt && e.weightKg)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

function getLatestEntry(entries) {
  const sorted = getSortedEntries(entries);
  return sorted[sorted.length - 1] ?? null;
}

function loadDrafts() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeDrafts(parsed);
  } catch {
    return null;
  }
}

function loadState() {
  try {
    const candidates = buildStorageCandidates();
    let best = null;

    for (const key of candidates) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = safeJsonParse(raw);
      const normalized = normalizeStateCandidate(parsed);
      if (!normalized) continue;

      const score = scoreStoredState(normalized, key === STORAGE_KEY);
      if (!best || score > best.score) {
        best = { state: normalized, source: key, score };
      }
    }

    if (best) {
      return best;
    }

    return { state: structuredClone(defaultState), source: null };
  } catch {
    return { state: structuredClone(defaultState), source: null };
  }
}

function persist() {
  writeStateToStorage(state);
  // Firebase 同期フック（firebase-sync.js が読み込まれている場合のみ動作）
  window.wfSync?.push(state);
}

function normalizeDrafts(raw) {
  return {
    entry: {
      date: String(raw?.entry?.date ?? ""),
      time: String(raw?.entry?.time ?? ""),
      weight: String(raw?.entry?.weight ?? "")
    },
    workout: {
      date: String(raw?.workout?.date ?? ""),
      type: String(raw?.workout?.type ?? ""),
      distance: String(raw?.workout?.distance ?? ""),
      duration: String(raw?.workout?.duration ?? ""),
      calories: String(raw?.workout?.calories ?? ""),
      heartRate: String(raw?.workout?.heartRate ?? "")
    },
    profile: {
      heightCm: String(raw?.profile?.heightCm ?? ""),
      goalWeightKg: String(raw?.profile?.goalWeightKg ?? "")
    }
  };
}

function collectCurrentInputs() {
  return {
    entry: {
      date: el.entryDate.value,
      time: el.entryTime.value,
      weight: el.entryWeight.value
    },
    workout: {
      date: el.workoutDate.value,
      type: el.workoutType.value,
      distance: el.workoutDistance.value,
      duration: el.workoutDuration.value,
      calories: el.workoutCalories.value,
      heartRate: el.workoutHeartRate.value
    },
    profile: {
      heightCm: el.heightCm.value,
      goalWeightKg: el.goalWeightKg.value
    }
  };
}

function persistCurrentInputs() {
  formDrafts = normalizeDrafts(collectCurrentInputs());
  hasStoredDrafts = true;
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formDrafts));
}

function applyStoredDrafts() {
  if (!hasStoredDrafts) return;

  el.entryDate.value = formDrafts.entry.date;
  el.entryTime.value = formDrafts.entry.time;
  el.entryWeight.value = formDrafts.entry.weight;

  el.workoutDate.value = formDrafts.workout.date;
  if (formDrafts.workout.type) el.workoutType.value = formDrafts.workout.type;
  el.workoutDistance.value = formDrafts.workout.distance;
  el.workoutDuration.value = formDrafts.workout.duration;
  el.workoutCalories.value = formDrafts.workout.calories;
  el.workoutHeartRate.value = formDrafts.workout.heartRate;

  el.heightCm.value = formDrafts.profile.heightCm;
  el.goalWeightKg.value = formDrafts.profile.goalWeightKg;
}

function clearDraftSection(section) {
  formDrafts = {
    ...formDrafts,
    [section]: structuredClone(defaultDrafts[section])
  };
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formDrafts));
}

function clearAllDrafts() {
  formDrafts = structuredClone(defaultDrafts);
  hasStoredDrafts = false;
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

function writeStateToStorage(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function buildStorageCandidates() {
  const keys = new Set([STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || key === STORAGE_KEY || key.includes("sync-code")) continue;
    if (/weight|flow|bodymass|workout/i.test(key)) {
      keys.add(key);
    }
  }

  return [...keys];
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeStateCandidate(candidate) {
  if (candidate == null) return null;

  if (Array.isArray(candidate)) {
    const mixed = normalizeMixedRecords(candidate);
    return hasMeaningfulState(mixed) ? mixed : null;
  }

  if (typeof candidate !== "object") return null;

  const mixed = normalizeMixedRecords(candidate.records ?? candidate.logs ?? candidate.items ?? []);
  const entries = normalizeEntries(pickCollection(
    candidate.entries,
    candidate.weights,
    candidate.weightEntries,
    candidate.weightLogs,
    mixed.entries
  ));
  const workouts = normalizeWorkouts(pickCollection(
    candidate.workouts,
    candidate.workoutEntries,
    candidate.workoutLogs,
    candidate.activities,
    candidate.exercises,
    mixed.workouts
  ));
  const profile = normalizeProfileCandidate(
    candidate.profile ??
    candidate.userProfile ??
    candidate.settings ??
    candidate.user ??
    {}
  );

  const normalized = { profile, entries, workouts };
  if (!hasMeaningfulState(normalized)) return null;
  return normalized;
}

function normalizeMixedRecords(records) {
  const normalized = { profile: { ...defaultState.profile }, entries: [], workouts: [] };
  if (!Array.isArray(records)) return normalized;

  records.forEach((record, index) => {
    const entry = normalizeEntryCandidate(record, index);
    if (entry) {
      normalized.entries.push(entry);
      return;
    }

    const workout = normalizeWorkoutCandidate(record, index);
    if (workout) {
      normalized.workouts.push(workout);
    }
  });

  normalized.entries.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  normalized.workouts.sort((a, b) => a.date.localeCompare(b.date));
  return normalized;
}

function pickCollection(...collections) {
  return collections.find(list => Array.isArray(list) && list.length > 0)
    ?? collections.find(Array.isArray)
    ?? [];
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry, index) => normalizeEntryCandidate(entry, index))
    .filter(Boolean)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

function normalizeWorkouts(workouts) {
  if (!Array.isArray(workouts)) return [];

  return workouts
    .map((workout, index) => normalizeWorkoutCandidate(workout, index))
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeEntryCandidate(entry, index) {
  if (!entry || typeof entry !== "object") return null;

  const recordedAt = normalizeDateTimeValue(
    entry.recordedAt ??
    entry.datetime ??
    entry.timestamp ??
    entry.createdAt ??
    entry.loggedAt ??
    entry.dateTime
  ) || normalizeRecordedAt(entry);
  const weightKg = parseNumber(
    entry.weightKg ??
    entry.weight ??
    entry.value ??
    entry.kg ??
    entry.bodyMass
  );

  if (!recordedAt || weightKg == null) return null;

  return {
    id: entry.id ?? `restored-entry-${index}-${recordedAt}`,
    recordedAt,
    weightKg
  };
}

function normalizeWorkoutCandidate(workout, index) {
  if (!workout || typeof workout !== "object") return null;

  const date = normalizeDateValue(
    workout.date ??
    workout.recordedAt ??
    workout.datetime ??
    workout.timestamp ??
    workout.createdAt
  );
  const distanceKm = parseNumber(workout.distanceKm ?? workout.distance);
  const durationMin = parseNumber(workout.durationMin ?? workout.duration);
  const calories = parseNumber(workout.calories ?? workout.energy ?? workout.kcal);
  const heartRateBpm = parseNumber(workout.heartRateBpm ?? workout.heartRate ?? workout.avgHeartRate);

  if (!date || (distanceKm == null && durationMin == null && calories == null)) return null;

  return {
    id: workout.id ?? `restored-workout-${index}-${date}`,
    date,
    type: workout.type ?? workout.workoutType ?? workout.activityType ?? "other",
    distanceKm,
    durationMin,
    calories,
    heartRateBpm
  };
}

function normalizeProfileCandidate(profile) {
  return {
    heightCm: String(profile?.heightCm ?? profile?.height ?? "").trim(),
    goalWeightKg: String(profile?.goalWeightKg ?? profile?.goalWeight ?? profile?.goal ?? "").trim()
  };
}

function normalizeDateTimeValue(value) {
  if (value == null || value === "") return "";

  if (typeof value === "number") {
    const date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return combineDateAndTime(isoLocalDate(date), currentTimeValue(date));
  }

  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return text.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return combineDateAndTime(text, "08:00");

  const date = new Date(text);
  if (isNaN(date.getTime())) return "";
  return combineDateAndTime(isoLocalDate(date), currentTimeValue(date));
}

function normalizeDateValue(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();

  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return isoLocalDate(date);
}

function hasMeaningfulState(candidate) {
  if (!candidate) return false;
  const profile = candidate.profile ?? {};

  return (
    Boolean(profile.heightCm) ||
    Boolean(profile.goalWeightKg) ||
    (Array.isArray(candidate.entries) && candidate.entries.length > 0) ||
    (Array.isArray(candidate.workouts) && candidate.workouts.length > 0)
  );
}

function scoreStoredState(candidate, isCurrentKey) {
  const entryCount = Array.isArray(candidate.entries) ? candidate.entries.length : 0;
  const workoutCount = Array.isArray(candidate.workouts) ? candidate.workouts.length : 0;
  const profileCount = [candidate.profile?.heightCm, candidate.profile?.goalWeightKg].filter(Boolean).length;

  return entryCount * 10 + workoutCount * 10 + profileCount + (isCurrentKey ? 0.5 : 0);
}

function syncProfileForm() {
  el.heightCm.value = state.profile.heightCm ?? "";
  el.goalWeightKg.value = state.profile.goalWeightKg ?? "";
}

function syncHeightLockState() {
  const hasHeight = Boolean(state.profile.heightCm);
  const shouldLock = hasHeight && !isHeightEditing;
  el.heightCm.readOnly = shouldLock;
  el.heightCm.classList.toggle("is-locked", shouldLock);
  el.toggleHeightLockButton.hidden = !hasHeight;
  el.toggleHeightLockButton.textContent = shouldLock ? "身長を編集" : "編集を閉じる";
}

function syncEntryDateTimeInputs(date = new Date()) {
  el.entryDate.value = isoLocalDate(date);
  el.entryTime.value = currentTimeValue(date);
}

function syncWorkoutDateInput(date = new Date()) {
  el.workoutDate.value = isoLocalDate(date);
}

function buildSampleEntries() {
  const base = new Date();
  const weights = [75.8, 75.5, 75.2, 74.9, 74.7, 74.4, 74.1, 73.9];
  const times = ["07:20", "20:40", "07:10", "21:05", "07:15", "19:50", "07:00", "20:10"];
  return weights.map((w, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() - (weights.length - 1 - i) * 2);
    return { id: crypto.randomUUID(), recordedAt: combineDateAndTime(isoLocalDate(d), times[i]), weightKg: w };
  });
}

function buildSampleWorkouts() {
  const base = new Date();
  const samples = [
    { daysAgo: 1, type: "running", distanceKm: 5.2, durationMin: 28, calories: 320, heartRateBpm: 158 },
    { daysAgo: 3, type: "strength", distanceKm: null, durationMin: 45, calories: 210, heartRateBpm: 132 },
    { daysAgo: 5, type: "running", distanceKm: 8.0, durationMin: 44, calories: 490, heartRateBpm: 162 },
    { daysAgo: 6, type: "walking", distanceKm: 3.1, durationMin: 38, calories: 140, heartRateBpm: 108 },
    { daysAgo: 8, type: "cycling", distanceKm: 18.5, durationMin: 55, calories: 420, heartRateBpm: 145 },
    { daysAgo: 10, type: "hiit", distanceKm: null, durationMin: 25, calories: 350, heartRateBpm: 172 },
  ];
  return samples.map(s => {
    const d = new Date(base);
    d.setDate(base.getDate() - s.daysAgo);
    return { id: crypto.randomUUID(), date: isoLocalDate(d), type: s.type, distanceKm: s.distanceKm, durationMin: s.durationMin, calories: s.calories, heartRateBpm: s.heartRateBpm };
  });
}

function buildXLabels(entries, xFor, y) {
  const labels = new Map();
  labels.set(0, entries[0]);
  const mobile = (window.innerWidth || 720) <= 430;
  if (!mobile && entries.length > 2) labels.set(Math.floor((entries.length - 1) / 2), entries[Math.floor((entries.length - 1) / 2)]);
  if (entries.length > 1) labels.set(entries.length - 1, entries.at(-1));
  const fontSize = mobile ? 9 : 11;
  return [...labels.entries()].map(([i, e]) =>
    `<text x="${xFor(i).toFixed(1)}" y="${y}" text-anchor="middle" font-size="${fontSize}" fill="#5e7268">${mobile ? formatTinyDateTime(e.recordedAt) : formatShortDateTime(e.recordedAt)}</text>`
  ).join("");
}

function buildHistoryDelta(entry, prev) {
  if (!prev) return '<span class="history-delta history-delta-flat">初回</span>';
  const delta = entry.weightKg - prev.weightKg;
  if (delta === 0) return '<span class="history-delta history-delta-flat">変化なし</span>';
  const cls = delta < 0 ? "history-delta-down" : "history-delta-up";
  return `<span class="history-delta ${cls}">${formatWeightChange(delta)}</span>`;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function parseNumber(v) {
  if (v === "" || v == null) return null;
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
}

function formatWeight(v) { return Number(v).toFixed(1); }

function formatWeightChange(v) {
  if (!isFinite(v) || v === 0) return "変化なし";
  return v < 0 ? `${Math.abs(v).toFixed(1)} kg減` : `${Math.abs(v).toFixed(1)} kg増`;
}

function goalDistanceText(remaining) {
  if (remaining > 0) return `あと ${formatWeight(remaining)} kg で目標です`;
  if (remaining < 0) return `目標を ${formatWeight(Math.abs(remaining))} kg クリアしています`;
  return "目標体重に到達しています";
}

function goalSummaryText(current, goal) {
  const remaining = current - goal;
  if (remaining > 0) return `目標まであと ${formatWeight(remaining)} kg。今日も体重だけ記録して流れを確認しましょう。`;
  if (remaining < 0) return `目標を ${formatWeight(Math.abs(remaining))} kg クリアしています。今のペースを維持しましょう。`;
  return "目標体重に到達しています。次は維持のリズム作りです。";
}

function bmiStatusLabel(bmi) {
  if (bmi < 18.5) return "BMIは低体重の範囲です";
  if (bmi < 25) return "BMIは標準の範囲です";
  if (bmi < 30) return "BMIは肥満1度の範囲です";
  return "BMIは高めです";
}

function formatDate(v) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(v));
}

function formatDateTime(v) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
}

function formatShortDate(v) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(v));
}

function formatShortDateTime(v) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
}

function formatTinyDateTime(v) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(v));
}

function todayIsoDate() { return isoLocalDate(new Date()); }

function currentTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function combineDateAndTime(date, time) { return `${date}T${time}`; }

function normalizeRecordedAt(entry) {
  if (entry.recordedAt) return entry.recordedAt.slice(0, 16);
  if (entry.date) return combineDateAndTime(entry.date, entry.time ?? "08:00");
  return "";
}

function isoLocalDate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function csvSafe(v) { return `"${String(v).replaceAll('"', '""')}"`; }

// ─── Apple Health Import ──────────────────────────────────────────────────────
function handleHealthImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(e.target.result, "text/xml");

      const parseError = xml.querySelector("parsererror");
      if (parseError) throw new Error("XMLのパースに失敗しました");

      const { entries: newEntries, workouts: newWorkouts, stats } = parseHealthXML(xml);

      let addedEntries = 0, addedWorkouts = 0;

      for (const entry of newEntries) {
        const duplicate = state.entries.find(ex => ex.recordedAt === entry.recordedAt);
        if (!duplicate) {
          state.entries.push(entry);
          addedEntries++;
        }
      }

      for (const workout of newWorkouts) {
        const duplicate = state.workouts.find(ex =>
          ex.date === workout.date &&
          ex.type === workout.type &&
          ex.durationMin === workout.durationMin
        );
        if (!duplicate) {
          state.workouts.push(workout);
          addedWorkouts++;
        }
      }

      persist();
      render();

      const skippedEntries = stats.totalWeight - addedEntries;
      const skippedWorkouts = stats.totalWorkouts - addedWorkouts;
      const skipMsg = (skippedEntries + skippedWorkouts) > 0
        ? `\n（重複スキップ: 体重${skippedEntries}件 / 運動${skippedWorkouts}件）`
        : "";
      alert(`インポート完了！\n✅ 体重: ${addedEntries}件追加\n✅ 運動: ${addedWorkouts}件追加${skipMsg}`);
    } catch (err) {
      alert("インポートに失敗しました。\nApple HealthアプリからエクスポートしたXMLファイルを選択してください。\n\n取得方法: ヘルスケアアプリ → プロフィール → すべてのヘルスケアデータをエクスポート");
      console.error(err);
    }
    event.target.value = "";
  };
  reader.readAsText(file, "utf-8");
}

function parseHealthXML(xml) {
  const entries = [];
  const workouts = [];

  // 体重レコード
  const weightRecords = xml.querySelectorAll('Record[type="HKQuantityTypeIdentifierBodyMass"]');
  weightRecords.forEach(record => {
    const dateStr = record.getAttribute("startDate") || record.getAttribute("creationDate");
    const rawValue = parseFloat(record.getAttribute("value"));
    const unit = record.getAttribute("unit") || "kg";

    if (!dateStr || !isFinite(rawValue)) return;

    // ポンド → kg 変換
    const weightKg = unit === "lb" ? rawValue * 0.453592 : rawValue;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return;

    const recordedAt =
      isoLocalDate(date) + "T" +
      String(date.getHours()).padStart(2, "0") + ":" +
      String(date.getMinutes()).padStart(2, "0");

    entries.push({
      id: crypto.randomUUID(),
      recordedAt,
      weightKg: parseFloat(weightKg.toFixed(1))
    });
  });

  // ワークアウトレコード
  const workoutNodes = xml.querySelectorAll("Workout");
  workoutNodes.forEach(node => {
    const activityType = node.getAttribute("workoutActivityType") || "";
    const type = mapHealthWorkoutType(activityType);

    const dateStr = node.getAttribute("startDate") || node.getAttribute("creationDate");
    if (!dateStr) return;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return;

    const dateOnly = isoLocalDate(date);

    // 時間（分）
    const durationRaw = parseFloat(node.getAttribute("duration") || "");
    const durationUnit = node.getAttribute("durationUnit") || "min";
    let durationMin = null;
    if (isFinite(durationRaw)) {
      durationMin = durationUnit === "min"
        ? Math.round(durationRaw)
        : Math.round(durationRaw / 60);
    }

    // 距離（km）
    const distRaw = parseFloat(node.getAttribute("totalDistance") || "");
    const distUnit = node.getAttribute("totalDistanceUnit") || "km";
    let distanceKm = null;
    if (isFinite(distRaw) && distRaw > 0) {
      distanceKm = distUnit === "mi"
        ? parseFloat((distRaw * 1.60934).toFixed(2))
        : parseFloat(distRaw.toFixed(2));
    }

    // カロリー
    const calRaw = parseFloat(node.getAttribute("totalEnergyBurned") || "");
    const calories = isFinite(calRaw) && calRaw > 0 ? Math.round(calRaw) : null;

    // 平均心拍数
    let heartRateBpm = null;
    const hrStat = node.querySelector('WorkoutStatistics[type="HKQuantityTypeIdentifierHeartRate"]');
    if (hrStat) {
      const avg = parseFloat(hrStat.getAttribute("average") || "");
      if (isFinite(avg)) heartRateBpm = Math.round(avg);
    }

    if (!durationMin && !distanceKm && !calories) return;

    workouts.push({
      id: crypto.randomUUID(),
      date: dateOnly,
      type,
      distanceKm,
      durationMin,
      calories,
      heartRateBpm
    });
  });

  return {
    entries,
    workouts,
    stats: { totalWeight: weightRecords.length, totalWorkouts: workoutNodes.length }
  };
}

function mapHealthWorkoutType(activityType) {
  if (activityType.includes("Running")) return "running";
  if (activityType.includes("Walking")) return "walking";
  if (activityType.includes("Cycling")) return "cycling";
  if (activityType.includes("Swimming")) return "swimming";
  if (activityType.includes("HighIntensityIntervalTraining") || activityType.includes("CrossTraining")) return "hiit";
  if (activityType.includes("TraditionalStrengthTraining") || activityType.includes("FunctionalStrengthTraining") || activityType.includes("CoreTraining")) return "strength";
  if (activityType.includes("Yoga") || activityType.includes("MindAndBody")) return "yoga";
  return "other";
}
