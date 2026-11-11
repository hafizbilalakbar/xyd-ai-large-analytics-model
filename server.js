'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'data.json');

const TRAINING_QUEUE_MS = 300;
const TRAINING_RUN_MS = 16000;
const CATEGORY_CODES = ['PASS', 'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10', 'F11', 'F12', 'F13'];

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept-Language');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

function requireAuth(req, res, next) {
  next();
}

function traceId() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
}

function apiError(message, code, status = 500) {
  return { error: { code, message, trace_id: traceId() } };
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function lcg(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 0) / 0xffffffff;
  };
}

function round3(value) {
  if (value === null || value === undefined) return null;
  return Math.round(value * 1000) / 1000;
}

function buildMetrics(taskId, sampleCount, previousAccuracy) {
  let seed = (hashCode(taskId) * 31 + sampleCount) | 0;
  seed = (seed * 31 + Math.round((previousAccuracy || 0) * 10)) | 0;
  const next = lcg(seed);
  const perClass = {};
  for (const code of CATEGORY_CODES) {
    const base = code === 'PASS' ? 0.99 : (0.84 + next() * 0.13);
    let value = base + (next() * 0.06 - 0.03);
    value = Math.min(1, Math.max(0.80, value));
    if (next() < 0.15) value = null;
    perClass[code] = value === null ? null : round3(value);
  }
  const values = Object.values(perClass).filter((v) => v !== null);
  const accuracy = values.length > 0 ? round3(values.reduce((a, b) => a + b, 0) / values.length) : null;
  return {
    accuracy_macro: accuracy,
    accuracy_weighted: accuracy !== null ? round3(Math.min(1, accuracy + 0.04 + next() * 0.03)) : null,
    per_class: perClass,
    by_combo: { C1: null, C2: null, C3: null, C4: null },
    sample_count: sampleCount ?? null,
    dropped_count: Math.floor(next() * 60),
    eval_mode: 'cv5',
    is_placeholder: false,
    local_count: 0,
    train_params: {
      feature_dim: 50,
      cv_folds: 5,
      hyperparams: {
        objective: 'multi:softprob',
        max_depth: 6,
        learning_rate: 0.1,
        subsample: 0.8,
        colsample_bytree: 0.8,
        min_child_weight: 5,
        gamma: 0.1,
        reg_alpha: 0.1,
        reg_lambda: 1.0,
        tree_method: 'hist',
        nthread: -1,
        seed: 42,
        num_class: 13,
        num_boost_round: 300,
      },
    },
  };
}

function formatStoredDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function versionWeight(version) {
  const m = /^V(\d+)\.(\d+)$/.exec(version || '');
  if (!m) return 0;
  return Number(m[1]) * 1000 + Number(m[2]);
}

function sortVersionsDesc(list) {
  return [...list].sort((a, b) => versionWeight(b.version) - versionWeight(a.version));
}

function findActiveVersion() {
  return data.versions.find((v) => v.is_active) || null;
}

function activateFallbackVersion() {
  // Activate the newest remaining version when the active one is removed.
  const remaining = data.versions.filter((v) => !v.is_active);
  if (remaining.length === 0) {
    return null;
  }
  const newest = sortVersionsDesc(remaining)[0];
  for (const v of data.versions) {
    v.is_active = v.version_id === newest.version_id;
  }
  saveData();
  return newest;
}

function activeVersionLabel() {
  const active = findActiveVersion();
  return active ? active.version : null;
}

function defaultData() {
  const now = new Date();
  const base = new Date(now);
  base.setDate(base.getDate() - 7);
  const v2Metrics = {
    accuracy_macro: 0.9581,
    accuracy_weighted: 0.9893,
    per_class: { PASS: 0.9975, F01: 1, F02: 1, F03: 0.9857, F04: 0.8696, F05: 0.9293, F06: 0.8824, F07: null, F08: 1, F09: null, F10: null, F11: null, F12: null, F13: null },
    by_combo: { C1: null, C2: null, C3: null, C4: null },
    sample_count: 1499, dropped_count: 0, eval_mode: 'cv5', is_placeholder: false, local_count: 0,
  };
  const v3Metrics = {
    accuracy_macro: 0.9563,
    accuracy_weighted: 0.9929,
    per_class: { PASS: 0.9963, F01: 1, F02: 0.9615, F03: 1, F04: 0.8696, F05: 0.9406, F06: 0.8824, F07: null, F08: 1, F09: null, F10: null, F11: null, F12: null, F13: null },
    by_combo: { C1: null, C2: null, C3: null, C4: null },
    sample_count: 3254, dropped_count: 0, eval_mode: 'cv5', is_placeholder: false, local_count: 0,
  };
  return {
    nextVersionId: 3,
    versions: [
      {
        version_id: 2, version: 'V3.0', type: 'basic', trained_at: formatStoredDate(base.toISOString()),
        sample_count: 3254, accuracy_macro: 0.9563, is_active: true, metrics: v3Metrics,
        parent_version_id: null, training_scope: null, source_task_id: null,
      },
      {
        version_id: 1, version: 'V2.0', type: 'basic', trained_at: formatStoredDate(base.toISOString()),
        sample_count: 1499, accuracy_macro: 0.9581, is_active: false, metrics: v2Metrics,
        parent_version_id: null, training_scope: null, source_task_id: null,
      },
    ],
    tasks: [],
    monitors: [],
  };
}

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.versions) && Array.isArray(parsed.tasks)) return parsed;
    return defaultData();
  } catch {
    return defaultData();
  }
}

function saveData() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch { /* best effort */ }
}

let data = loadData();

function advanceJobs() {
  const now = Date.now();
  let changed = false;
  for (const task of data.tasks) {
    if (task.status === 'pending') {
      const createdAt = Date.parse(task.created_at);
      if (now - createdAt >= TRAINING_QUEUE_MS) {
        task.status = 'running';
        task.started_at = new Date(createdAt + TRAINING_QUEUE_MS).toISOString();
        task.progress = 1;
        task.log_summary = (task.log_summary ? task.log_summary + '\n' : '') + `[${new Date(createdAt + TRAINING_QUEUE_MS).toLocaleTimeString('en-GB', { hour12: false })}] Training started.`;
        changed = true;
      }
    }
    if (task.status === 'running') {
      const startedAt = Date.parse(task.started_at || task.created_at);
      const elapsed = Math.max(0, now - startedAt);
      const progress = Math.min(99, Math.floor((elapsed / TRAINING_RUN_MS) * 100));
      if (progress !== task.progress) { task.progress = progress; changed = true; }
      task.duration_ms = elapsed;
      if (elapsed >= TRAINING_RUN_MS) {
        finishTask(task, now);
        changed = true;
      }
    }
  }
  if (changed) saveData();
}

function finishTask(task, nowMs) {
  const now = new Date(nowMs);
  const nowIso = now.toISOString();
  const elapsed = nowMs - Date.parse(task.created_at);
  const active = data.versions.find((v) => v.is_active);
  const nextVersion = active ? nextVersionFor(active) : 'V1.0';
  const metrics = buildMetrics(task.task_id, task.sample_count, active ? active.accuracy_macro : 0.95);
  const logTime = (d) => d.toLocaleTimeString('en-GB', { hour12: false });
  task.status = 'done';
  task.progress = 100;
  task.finished_at = nowIso;
  task.duration_ms = elapsed;
  task.model_version = nextVersion;
  task.model_version_id = `candidate-${task.task_id}`;
  task.created_version_id = Number(nextVersion.replace('V', '').split('.')[0]) * 100 + Number(nextVersion.replace('V', '').split('.')[1] || 0);
  task.metrics = metrics;
  task.log_summary = (task.log_summary ? task.log_summary + '\n' : '')
    + `[${logTime(now)}] Grouped rotation validation completed.\n[${logTime(now)}] Candidate version ${nextVersion} produced.`;

  const versionId = data.nextVersionId++;
  data.versions.push({
    version_id: versionId,
    version: nextVersion,
    type: 'local',
    trained_at: nowIso,
    sample_count: task.sample_count,
    accuracy_macro: metrics.accuracy_macro,
    is_active: false,
    metrics,
    parent_version_id: active ? active.version_id : null,
    training_scope: task.scope,
    source_task_id: task.task_id,
  });
  saveData();
}

function nextVersionFor(active) {
  const m = /^V(\d+)\.(\d+)$/.exec(active.version || '');
  const major = m ? Number(m[1]) : 1;
  let maxMinor = -1;
  for (const v of data.versions) {
    const mm = /^V(\d+)\.(\d+)$/.exec(v.version || '');
    if (mm && Number(mm[1]) === major) maxMinor = Math.max(maxMinor, Number(mm[2]));
  }
  return `V${major}.${maxMinor + 1}`;
}

function findVersion(id) {
  return data.versions.find((v) => String(v.version_id) === String(id) || v.version === id) || null;
}
function findTask(taskId) {
  return data.tasks.find((t) => t.task_id === taskId) || null;
}
function findVersionBySourceTaskId(sourceTaskId) {
  return data.versions.find((v) => v.source_task_id === sourceTaskId) || null;
}

function versionToListItem(v) {
  return {
    version_id: v.version_id,
    version: v.version,
    type: v.type,
    trained_at: v.trained_at,
    sample_count: v.sample_count,
    accuracy_macro: v.accuracy_macro,
    is_active: v.is_active,
    parent_version_id: v.parent_version_id,
    training_scope: v.training_scope,
  };
}

function versionToDetail(v) {
  return {
    ...versionToListItem(v),
    metrics: v.metrics || null,
  };
}

function taskToJob(task) {
  return {
    task_id: task.task_id,
    status: task.status,
    scope: task.scope,
    sample_count: task.sample_count,
    created_at: task.created_at,
    started_at: task.started_at,
    finished_at: task.finished_at,
    duration_ms: task.duration_ms,
    progress: task.progress,
    model_version: task.model_version,
    model_version_id: task.model_version_id,
    created_version_id: task.created_version_id,
    deleted: !!task.deleted,
    log_summary: task.log_summary ?? null,
    metrics: task.metrics ?? null,
  };
}

// ---------- Auth ----------
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json(apiError('Invalid credentials.', 'INVALID_CREDENTIALS', 400));
  }
  const token = crypto.randomBytes(16).toString('hex');
  res.json({
    token,
    user: { user_id: '1', username: username || 'admin', roles: [], is_super_admin: true, language: 'zh-CN' },
    permissions: ['*'],
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', version: 'v0.0.33', model_version: activeVersionLabel(), xyd: { online: true } });
});

function ensureMonitors() {
  if (!Array.isArray(data.monitors)) {
    data.monitors = [];
    saveData();
  }
}

// ---------- Training ----------
app.get('/api/v1/training/preview', requireAuth, (req, res) => {
  advanceJobs();
  const active = data.versions.find((v) => v.is_active);
  const correctedTotal = 0;
  res.json({
    active_version: active ? active.version : null,
    active_train_count: active ? active.sample_count : null,
    sample_count: active ? active.sample_count : 0,
    base_sample_count: active ? active.sample_count : 0,
    local_total: 0,
    new_corrections: 0,
    eta_text: estimateEta(active ? active.sample_count : 0),
  });
});

function estimateEta(sampleCount) {
  if (!Number.isFinite(sampleCount) || sampleCount <= 0) return null;
  const low = Math.max(1, Math.round(sampleCount / 3254));
  return `Approximately ${low}\u2013${low + 1} minutes`;
}

app.get('/api/v1/training/jobs', requireAuth, (req, res) => {
  advanceJobs();
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.max(1, Math.min(100, parseInt(req.query.page_size || '20', 10)));
  const ordered = [...data.tasks]
    .filter((t) => !t.deleted)
    .map(taskToJob)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const start = (page - 1) * pageSize;
  res.json({ items: ordered.slice(start, start + pageSize), page, page_size: pageSize, total: ordered.length });
});

app.get('/api/v1/training/jobs/:id', requireAuth, (req, res) => {
  advanceJobs();
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json(apiError('Training task not found.', 'NOT_FOUND', 404));
  res.json(taskToJob(task));
});

app.post('/api/v1/training/start', requireAuth, (req, res) => {
  advanceJobs();
  if (data.tasks.some((t) => !t.deleted && (t.status === 'pending' || t.status === 'running'))) {
    return res.status(409).json(apiError('A training task is already in progress.', 'TRAINING_IN_PROGRESS', 409));
  }
  const active = data.versions.find((v) => v.is_active);
  const now = new Date();
  const taskId = `T${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0')}`;
  const task = {
    task_id: taskId,
    status: 'pending',
    scope: 'all_stations',
    sample_count: active ? active.sample_count : 0,
    created_at: now.toISOString(),
    started_at: null,
    finished_at: null,
    duration_ms: null,
    progress: 0,
    model_version: null,
    model_version_id: null,
    created_version_id: null,
    deleted: false,
    log_summary: `[${now.toLocaleTimeString('en-GB', { hour12: false })}] Task queued.`,
    metrics: null,
  };
  data.tasks.push(task);
  saveData();
  res.json({ task_id: taskId });
});

app.post('/api/v1/training/jobs/:id/cancel', requireAuth, (req, res) => {
  advanceJobs();
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json(apiError('Training task not found.', 'NOT_FOUND', 404));
  if (task.status !== 'pending' && task.status !== 'running') {
    return res.status(409).json(apiError('The training task is no longer running.', 'NOT_RUNNING', 409));
  }
  const now = new Date();
  const startedAt = Date.parse(task.started_at || task.created_at);
  const elapsed = now.getTime() - startedAt;
  task.status = 'cancelled';
  task.finished_at = now.toISOString();
  task.duration_ms = elapsed;
  task.log_summary = (task.log_summary ? task.log_summary + '\n' : '')
    + `[${now.toLocaleTimeString('en-GB', { hour12: false })}] Training task terminated by the operator.`;
  saveData();
  res.json(taskToJob(task));
});

app.delete('/api/v1/training/jobs/:id', requireAuth, (req, res) => {
  advanceJobs();
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json(apiError('Task not found.', 'NOT_FOUND', 404));
  if (task.status === 'pending' || task.status === 'running') {
    return res.status(409).json(apiError('Running tasks cannot be deleted.', 'RUNNING_TASK', 409));
  }
  let deletedVersion = null;
  if (task.created_version_id !== null) {
    const version = findVersionBySourceTaskId(task.task_id);
    if (version) {
      if (version.is_active) {
        activateFallbackVersion();
      }
      if (data.versions.length <= 1) {
        return res.status(409).json(apiError('Cannot delete the last remaining version.', 'LAST_VERSION', 409));
      }
      data.versions = data.versions.filter((v) => v.version_id !== version.version_id);
      deletedVersion = version.version;
    }
  }
  data.tasks = data.tasks.filter((t) => t.task_id !== task.task_id);
  saveData();
  res.json({ ok: true, deleted_version: deletedVersion, task_id: task.task_id });
});

// ---------- Models / Versions ----------
app.get('/api/v1/models/versions', requireAuth, (req, res) => {
  advanceJobs();
  const items = sortVersionsDesc(data.versions).map(versionToListItem);
  const defaultCompare = items.slice(0, 2).map((v) => String(v.version_id));
  res.json({ items, default_compare: defaultCompare });
});

app.get('/api/v1/models/compare', requireAuth, (req, res) => {
  const v1 = findVersion(req.query.v1);
  const v2 = findVersion(req.query.v2);
  if (!v1 || !v2) return res.status(404).json(apiError('Version not found.', 'NOT_FOUND', 404));
  res.json({ v1: versionToDetail(v1), v2: versionToDetail(v2) });
});

app.get('/api/v1/models/:id', requireAuth, (req, res) => {
  const v = findVersion(req.params.id);
  if (!v) return res.status(404).json(apiError('Version not found.', 'NOT_FOUND', 404));
  res.json(versionToDetail(v));
});

app.post('/api/v1/models/:id/activate', requireAuth, (req, res) => {
  const target = findVersion(req.params.id);
  if (!target) return res.status(404).json(apiError('Version not found.', 'NOT_FOUND', 404));
  if (target.is_active) return res.status(409).json(apiError(`${target.version} is already in use.`, 'ALREADY_ACTIVE', 409));
  const startedAt = Date.now();
  for (const v of data.versions) v.is_active = v.version_id === target.version_id;
  target.is_active = true;
  saveData();
  res.json({ version_id: target.version_id, version: target.version, duration_ms: Date.now() - startedAt });
});

app.delete('/api/v1/models/:id', requireAuth, (req, res) => {
  const record = findVersion(req.params.id);
  if (!record) return res.status(404).json(apiError('Version not found.', 'NOT_FOUND', 404));
  if (record.is_active) {
    activateFallbackVersion();
  }
  if (data.versions.length <= 1) return res.status(409).json(apiError('Cannot delete the last remaining version.', 'LAST_VERSION', 409));
  let deletedTaskId = null;
  if (record.source_task_id) {
    const task = findTask(record.source_task_id);
    if (task) {
      if (task.status === 'pending' || task.status === 'running') {
        return res.status(409).json(apiError('Running tasks cannot be deleted.', 'RUNNING_TASK', 409));
      }
      data.tasks = data.tasks.filter((t) => t.task_id !== record.source_task_id);
      deletedTaskId = record.source_task_id;
    }
  }
  data.versions = data.versions.filter((v) => v.version_id !== record.version_id);
  saveData();
  res.json({ ok: true, deleted_task_id: deletedTaskId, version_id: record.version_id, version: record.version });
});

function lockCurve() {
  const pts = [];
  let t = 0;
  for (let i = 0; i <= 12; i++) {
    const angle = (i / 12) * 74.2;
    const torque = 13.8 * Math.sin((angle / 74.2) * (Math.PI / 2));
    pts.push({ angle: round3(angle), torque: round3(torque) });
  }
  return pts;
}

// ---------- Monitor ----------
app.get('/api/v1/monitor/latest', requireAuth, (req, res) => {
  advanceJobs();
  ensureMonitors();
  const active = findActiveVersion();
  const monitors = (data.monitors || [])
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  // Filter monitors by active version - only show samples from the active version
  const versionFilter = active ? (v => v.model_version === active.version) : () => true;
  const items = monitors
    .filter(versionFilter)
    .map((record) => {
      const pass = record.pass_fail === true;
      return {
        sample_no: record.sample_no ?? record.id,
        created_at: record.created_at,
        pass_fail: pass,
        top_code: pass ? null : (record.top_code ?? null),
        top_confidence: record.top_confidence ?? null,
        model_version: record.model_version ?? (active ? active.version : null),
        workstation: record.workstation ?? 'WS-01',
        torque: typeof record.torque === 'number' ? record.torque : 0,
        angle: typeof record.angle === 'number' ? record.angle : 0,
        curve: Array.isArray(record.curve) ? record.curve : lockCurve(),
        results: pass ? [{ code: 'PASS', name: 'Pass' }] : [{ code: record.top_code ?? 'F01', name: record.top_code ?? 'Fail' }],
      };
    });
  res.json({ items, active_version: active ? active.version : null });
});

// Ingest a single lock/monitor record from the device or test harness.
app.post('/api/v1/monitor/ingest', requireAuth, (req, res) => {
  ensureMonitors();
  const record = req.body || {};
  if (!record.created_at) {
    return res.status(400).json(apiError('created_at is required.', 'INVALID_RECORD', 400));
  }
  const entry = {
    id: record.id || `M-${Date.now()}`,
    sample_no: record.sample_no,
    created_at: record.created_at,
    pass_fail: record.pass_fail === true,
    top_code: record.top_code ?? null,
    top_confidence: typeof record.top_confidence === 'number' ? record.top_confidence : null,
    model_version: record.model_version ?? null,
    workstation: record.workstation ?? 'WS-01',
    torque: typeof record.torque === 'number' ? record.torque : 0,
    angle: typeof record.angle === 'number' ? record.angle : 0,
    curve: Array.isArray(record.curve) ? record.curve : lockCurve(),
    results: record.results ?? null,
  };
  data.monitors.push(entry);
  saveData();
  res.json({ ok: true, id: entry.id });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`XYD analytics backend listening on http://localhost:${PORT}`);
});
