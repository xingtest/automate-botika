// ===== AUTHENTICATION MANAGER =====
const AuthManager = {
    token: localStorage.getItem('acc_token'),
    user: JSON.parse(localStorage.getItem('acc_user') || 'null'),
    init() {
        if (!this.token && !window.location.pathname.includes('auth.html')) {
            window.location.href = 'auth.html';
            return;
        }
        if (this.user) {
            const nameEl = document.getElementById('userName');
            if (nameEl) nameEl.textContent = this.user.username;
        }
        this.validateSession();
    },
    async validateSession() {
        if (!this.token) return;
        try {
            const r = await fetch('http://localhost:3001/api/auth/me', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!r.ok) {
                if (r.status === 401) this.logout();
            }
        } catch (e) { console.warn('Auth validation failed', e); }
    },
    logout() {
        localStorage.removeItem('acc_token');
        localStorage.removeItem('acc_user');
        window.location.href = 'auth.html';
    }
};

// ===== SETTINGS UI MANAGER =====
const SettingsUI = {
    showGrid() {
        // Hide all views
        document.querySelectorAll('.settings-view').forEach(v => v.classList.add('hidden'));
        // Show grid
        document.getElementById('settings-grid-view').classList.remove('hidden');
    },
    showSection(id) {
        // Hide all views
        document.querySelectorAll('.settings-view').forEach(v => v.classList.add('hidden'));
        // Show specific section
        const el = document.getElementById(`settings-${id}`);
        if (el) el.classList.remove('hidden');
    }
};


const CONFIG = (() => {
    const s = JSON.parse(localStorage.getItem('acc_config') || '{}');
    return {
        owner: s.owner || 'katanyaaman',
        repo: s.repo || 'automationtestingjudges',
        workflow_id: s.workflow_id || 'test-reports.yml',
        ref: s.ref || 'main',
        token: s.token || ''
    };
})();

// ===== BACKEND API CLIENT (Hybrid Mode) =====
const BackendAPI = {
    // Use localhost:3001 if origin is not web-based (e.g. file://)
    baseUrl: (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:3001') + '/api',
    connected: false,
    async init() {
        try {
            const r = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
            if (r.ok) { this.connected = true; console.log('%c✅ Backend API connected', 'color:#22c55e;font-weight:bold;'); }
            else { this.connected = false; console.log('%c⚠️ Backend API offline — using localStorage', 'color:#f59e0b;font-weight:bold;'); }
        } catch { this.connected = false; console.log('%c⚠️ Backend API offline — using localStorage', 'color:#f59e0b;font-weight:bold;'); }
        this.updateIndicator();
        return this.connected;
    },
    updateIndicator() {
        const el = document.getElementById('dbStatusDot');
        if (el) el.className = `conn-dot ${this.connected ? '' : 'offline'}`;
    },
    async request(endpoint, opts = {}) {
        if (!this.connected) {
            console.error(`[DEBUG] Backend not connected, cannot call ${endpoint}`);
            return null;
        }
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...opts.headers
            };
            // Add Auth Token if available
            if (AuthManager.token) {
                headers['Authorization'] = `Bearer ${AuthManager.token}`;
            }

            console.log(`[DEBUG] API Request: ${endpoint}`, { headers, method: opts.method || 'GET' });
            const r = await fetch(`${this.baseUrl}${endpoint}`, { headers, ...opts });

            if (!r.ok) {
                const errText = await r.text();
                console.error(`[DEBUG] API Error ${r.status}:`, errText);
                throw new Error(`HTTP ${r.status}: ${errText}`);
            }

            const json = await r.json();
            console.log(`[DEBUG] API Response (${endpoint}):`, json);
            return json;
        } catch (err) {
            console.error(`[DEBUG] API ${endpoint} FAILED:`, err.message);
            return null;
        }
    },
    get(endpoint) { return this.request(endpoint); },
    post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); },
    put(endpoint, data) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }); },
    del(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
    async loadRuns() {
        const c = document.getElementById('dbResultsContent'); if (!c) return;
        console.log('[DEBUG] BackendAPI.loadRuns() called');
        console.log('[DEBUG] Backend connected:', this.connected);
        c.innerHTML = '<div class="skeleton skeleton-card mb-2"></div><div class="skeleton skeleton-card mb-2"></div><div class="skeleton skeleton-card"></div>';

        // Make sure backend is initialized
        if (!this.connected) {
            console.error('[DEBUG] Backend API not connected!');
            c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-8);"><i class="fas fa-wifi-off" style="font-size:2rem;opacity:0.2;display:block;margin-bottom:var(--sp-4);"></i><p>Backend API not connected</p><p class="text-sm" style="margin-top:var(--sp-3);">Please ensure the server is running at localhost:3001</p></div>';
            return;
        }

        const resp = await this.get('/test-runs?limit=50');
        console.log('[DEBUG] test-runs response:', resp);

        if (!resp) {
            console.error('[DEBUG] No response from /test-runs endpoint');
            c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-8);"><i class="fas fa-plug" style="font-size:2rem;opacity:0.2;display:block;margin-bottom:var(--sp-4);"></i><p>API connection error</p><p class="text-sm" style="margin-top:var(--sp-3);">Check browser console for details</p></div>';
            return;
        }

        if (!resp.data || !resp.data.length) {
            console.warn('[DEBUG] No test runs found in database (resp.data is empty or missing)');
            c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-8);"><i class="fas fa-database" style="font-size:2rem;opacity:0.2;display:block;margin-bottom:var(--sp-4);"></i><p>No results in database yet</p><p class="text-sm" style="margin-top:var(--sp-3);">Run a test to populate the database</p></div>';
            return;
        }

        // Update summary stats
        const stats = await this.get('/stats/dashboard');
        console.log('[DEBUG] stats/dashboard response:', stats);
        if (stats) {
            document.getElementById('dbStatTotalRuns').textContent = stats.total_runs || 0;
            const avgScore = stats.avg_score ? parseFloat(stats.avg_score).toFixed(2) : '0.00';
            document.getElementById('dbStatAvgScore').textContent = avgScore;
            document.getElementById('dbStatSuccessRate').textContent = `${stats.success_rate || 0}%`;
        }
        this.renderRuns(resp.data);
    },
    renderRuns(runs) {
        const c = document.getElementById('dbResultsContent');
        const stMap = { success: 'Success', failure: 'Failed' };
        c.innerHTML = `<table class="runs-table"><thead><tr><th>Test ID</th><th>Platform</th><th>Tester</th><th>Date</th><th>Score</th><th>Status</th><th>Duration</th></tr></thead><tbody>${runs.map(r => {
            const status = r.failed > 0 ? 'failure' : 'success';
            const score = parseFloat(r.avg_score).toFixed(2);
            return `<tr onclick="BackendAPI.showRunDetail(${r.id})" style="cursor:pointer">
                <td><code style="font-size:0.75rem">${r.test_id}</code></td>
                <td><span class="platform-tag ${r.platform}">${r.platform}</span></td>
                <td style="font-size:0.8rem">${r.tester_name}</td>
                <td style="font-size:0.8rem">${r.date_test}</td>
                <td style="font-weight:700; color:var(--accent)">${score}</td>
                <td><span class="status-pill ${status}">${status === 'success' ? '✅ PASS' : '❌ FAIL'}</span></td>
                <td style="font-size:0.75rem; color:var(--text-muted)">${r.duration || '—'}</td>
            </tr>`;
        }).join('')}</tbody></table>`;
    },
    async showRunDetail(id) {
        Toast.info('Loading', `Fetching details for run #${id}`);
        console.log('[DEBUG] Fetching run details for id:', id);
        const data = await this.get(`/test-runs/${id}`);
        if (!data) { console.error('[DEBUG] Failed to fetch run details'); return; }
        console.log('[DEBUG] Run Detail:', data);

        // Load artifacts
        const artifacts = await ArtifactManager.loadArtifacts(id);

        // Create modal for details
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:var(--sp-4);';

        const content = document.createElement('div');
        content.style.cssText = 'background:var(--bg-primary);border-radius:var(--radius);padding:var(--sp-6);max-width:900px;max-height:90vh;overflow-y:auto;width:100%;';

        let artifactsHTML = '';
        if (artifacts.length > 0) {
            const byType = {};
            artifacts.forEach(a => {
                if (!byType[a.artifact_type]) byType[a.artifact_type] = [];
                byType[a.artifact_type].push(a);
            });

            artifactsHTML = `<div style="margin-top:var(--sp-4);border-top:1px solid var(--border-color);padding-top:var(--sp-4);">
                <h3 style="margin-bottom:var(--sp-3);"><i class="fas fa-file"></i> Artifacts (${artifacts.length})</h3>`;

            for (const [type, items] of Object.entries(byType)) {
                artifactsHTML += `<div style="margin-bottom:var(--sp-4);">
                    <div style="font-weight:600;font-size:0.9rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:var(--sp-2);">${type}</div>
                    <div style="display:grid;gap:var(--sp-2);">
                        ${items.map(a => ArtifactManager.renderArtifactCard(a)).join('')}
                    </div>
                </div>`;
            }
            artifactsHTML += '</div>';
        }

        content.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-4);">
                <h2>Test Run Details #${id}</h2>
                <button onclick="this.closest('[style*=position\\:fixed]').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-muted);">×</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-4);">
                <div><strong>Platform:</strong> ${data.run.platform}</div>
                <div><strong>Tester:</strong> ${data.run.tester_name}</div>
                <div><strong>Test ID:</strong> <code>${data.run.test_id}</code></div>
                <div><strong>Score:</strong> ${parseFloat(data.run.avg_score).toFixed(2)}</div>
                <div><strong>Status:</strong> ${data.run.failed > 0 ? '❌ FAILED' : '✅ PASSED'}</div>
                <div><strong>Results:</strong> ${data.results?.length || 0} items</div>
            </div>
            ${artifactsHTML}
        `;

        modal.appendChild(content);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        document.body.appendChild(modal);

        Toast.success('Loaded', `Found ${data.results?.length || 0} results and ${artifacts.length} artifacts`);
    }
};

// ===== ARTIFACT MANAGER =====
const ArtifactManager = {
    async loadArtifacts(runId) {
        try {
            const resp = await BackendAPI.get(`/artifacts?run_id=${runId}`);
            if (!resp || !resp.data) return [];
            return resp.data;
        } catch (err) {
            console.error('Error loading artifacts:', err);
            return [];
        }
    },
    async downloadArtifact(artifactId, filename) {
        try {
            window.location.href = `http://localhost:3001/api/artifacts/${artifactId}/download`;
            Toast.success('Download started', `${filename}`);
        } catch (err) {
            Toast.error('Download failed', err.message);
        }
    },
    renderArtifactCard(artifact) {
        const icons = {
            json: 'fa-file-code',
            html: 'fa-file-lines',
            excel: 'fa-file-excel',
            screenshot: 'fa-image',
            pdf: 'fa-file-pdf',
            zip: 'fa-file-archive'
        };
        const icon = icons[artifact.artifact_type] || 'fa-file';
        const size = this.formatFileSize(artifact.file_size);
        const date = new Date(artifact.created_at).toLocaleString();

        return `<div style="display:flex;align-items:center;padding:var(--sp-3);border:1px solid var(--border-color);border-radius:var(--radius);gap:var(--sp-3);background:var(--bg-secondary);">
            <i class="fas ${icon}" style="font-size:1.5rem;color:var(--accent);opacity:0.7;"></i>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:0.9rem;word-break:break-word;">${this.esc(artifact.filename)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${artifact.artifact_type} • ${size} • ${date}</div>
                ${artifact.description ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">${this.esc(artifact.description)}</div>` : ''}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="ArtifactManager.downloadArtifact(${artifact.id}, '${artifact.filename.replace(/'/g, "\\'")}')"><i class="fas fa-download"></i></button>
        </div>`;
    },
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
};

// ===== TOAST =====
const Toast = {
    container: null,
    init() { this.container = document.getElementById('toastContainer'); },
    show(title, msg, type = 'info', dur = 4000) {
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<i class="fas ${icons[type] || icons.info} toast-icon"></i><div class="toast-body"><div class="toast-title">${title}</div><div class="toast-message">${msg}</div></div><button class="toast-close" onclick="this.closest('.toast').remove()"><i class="fas fa-times"></i></button>`;
        this.container.appendChild(t);
        setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, dur);
    },
    success(t, m) { this.show(t, m, 'success'); }, error(t, m) { this.show(t, m, 'error', 6000); },
    warning(t, m) { this.show(t, m, 'warning', 5000); }, info(t, m) { this.show(t, m, 'info'); }
};

// ===== THEME =====
const ThemeManager = {
    init() { this.set(localStorage.getItem('acc_theme') || 'light', false); },
    set(theme, save = true) {
        document.documentElement.setAttribute('data-theme', theme);
        if (save) localStorage.setItem('acc_theme', theme);
        const d = document.getElementById('themeDarkBtn'), l = document.getElementById('themeLightBtn');
        if (d && l) { d.classList.toggle('active', theme === 'dark'); l.classList.toggle('active', theme === 'light'); }
        const t = document.getElementById('themeToggle');
        if (t) { t.innerHTML = `<i class="fas fa-${theme === 'dark' ? 'sun' : 'moon'}"></i>`; }
    },
    toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
    get() { return document.documentElement.getAttribute('data-theme'); }
};

// ===== ROUTER =====
const Router = {
    pages: ['dashboard', 'run-tests', 'history', 'reports', 'db-results', 'presets', 'activity', 'scheduler', 'settings'],
    titles: { dashboard: 'Dashboard', 'run-tests': 'Run Tests', history: 'Run History', reports: 'Reports', 'db-results': 'DB Results', presets: 'Presets', activity: 'Activity Feed', scheduler: 'Scheduler', settings: 'Settings' },
    init() { window.addEventListener('hashchange', () => this.handleRoute()); this.handleRoute(); },
    handleRoute() { const h = window.location.hash.slice(1) || 'dashboard'; this.show(this.pages.includes(h) ? h : 'dashboard'); },
    navigate(p) { window.location.hash = p; },
    show(page) {
        document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
        const t = document.getElementById(`page-${page}`);
        if (t) { void t.offsetWidth; t.classList.add('active'); }
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');
        const pt = document.getElementById('pageTitle'), bc = document.getElementById('breadcrumbPage');
        if (pt) pt.textContent = this.titles[page] || page;
        if (bc) bc.textContent = this.titles[page] || page;
        document.getElementById('sidebar')?.classList.remove('mobile-open');
        document.getElementById('mobileOverlay')?.classList.remove('show');
        if (page === 'history') GitHubAPI.loadHistory();
        if (page === 'dashboard') DashboardStats.refresh();
        if (page === 'history') GitHubAPI.loadHistory();
        if (page === 'presets') PresetManager.render();
        if (page === 'activity') ActivityFeed.render();
        if (page === 'scheduler') Scheduler.render();
        if (page === 'db-results') { console.log('[DEBUG] Loading DB Results...'); BackendAPI.loadRuns(); }
        if (page === 'reports') { console.log('[DEBUG] Loading Reports...'); ReportManager.render(); }
        document.getElementById('mobileOverlay')?.classList.remove('show');
        document.getElementById('sidebar')?.classList.remove('mobile-open');
    }
};

// ===== TERMINAL LOG =====
const TerminalLog = {
    body: null, section: null,
    init() { this.body = document.getElementById('terminalBody'); this.section = document.getElementById('outputSection'); },
    log(msg, type = 'info') {
        if (this.section) this.section.style.display = 'block';
        const time = new Date().toLocaleTimeString();
        const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
        const line = document.createElement('div');
        line.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${type}">${icons[type] || icons.info} ${this.esc(msg)}</span>`;
        this.body.appendChild(line);
        this.body.scrollTop = this.body.scrollHeight;
    },
    clear() { if (this.body) this.body.innerHTML = ''; },
    copyAll() { navigator.clipboard.writeText(this.body.innerText).then(() => Toast.success('Copied', 'Log copied to clipboard')); },
    toggleExpand() { this.body?.classList.toggle('expanded'); },
    toggleSearch() { const s = document.getElementById('terminalSearch'); s?.classList.toggle('open'); if (s?.classList.contains('open')) document.getElementById('terminalSearchInput')?.focus(); },
    downloadLog() {
        const blob = new Blob([this.body.innerText], { type: 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`; a.click();
    },
    esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
};

// ===== GITHUB API =====
const GitHubAPI = {
    pollingInterval: null,
    getToken() { return CONFIG.token || document.getElementById('tokenInput')?.value?.trim() || ''; },
    getApiBase() { return `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}`; },
    async apiFetch(endpoint, opts = {}) {
        const token = this.getToken();
        const headers = { 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', ...opts.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return fetch(`${this.getApiBase()}${endpoint}`, { ...opts, headers });
    },
    async checkConnection() {
        const dot = document.getElementById('connDot'); if (!dot) return;
        dot.className = 'conn-dot checking';
        if (!this.getToken()) { dot.className = 'conn-dot offline'; return false; }
        try { const r = await this.apiFetch(''); if (r.ok) { dot.className = 'conn-dot'; return true; } dot.className = 'conn-dot offline'; return false; }
        catch { dot.className = 'conn-dot offline'; return false; }
    },
    async dispatchWorkflow(inputs) {
        return this.apiFetch(`/actions/workflows/${CONFIG.workflow_id}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: CONFIG.ref, inputs }) });
    },
    async uploadFile(file) {
        const path = `assets/xlsx/${file.name}`, msg = `📤 Upload: ${file.name} via Dashboard`;
        TerminalLog.log(`Uploading ${file.name}...`, 'info');
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
        let sha = null;
        try { const c = await this.apiFetch(`/contents/${path}`); if (c.ok) { sha = (await c.json()).sha; } } catch { }
        const resp = await this.apiFetch(`/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message: msg, content: b64, sha, branch: CONFIG.ref }) });
        if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
        TerminalLog.log('File uploaded!', 'success'); return resp.json();
    },
    async getRuns(count = 20) {
        try { const r = await this.apiFetch(`/actions/workflows/${CONFIG.workflow_id}/runs?per_page=${count}`); if (!r.ok) return []; const d = await r.json(); return d.workflow_runs || []; } catch { return []; }
    },
    async loadHistory() {
        const c = document.getElementById('historyContent'); if (!c) return;
        c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-8);"><i class="fas fa-github" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:var(--sp-4);"></i><p>GitHub Workflow History</p><p style="font-size:0.85rem;margin-top:var(--sp-2);">View your workflow runs directly on GitHub</p><a href="https://github.com/katanyaaman/automationtestingjudges/actions" target="_blank" class="btn btn-secondary" style="margin-top:var(--sp-4);"><i class="fas fa-external-link-alt"></i> Open on GitHub</a></div>';
    },
    renderRow(run, pinned = []) {
        const st = run.conclusion || run.status;
        const sm = { success: { i: 'fa-check-circle', l: 'Success' }, failure: { i: 'fa-times-circle', l: 'Failed' }, in_progress: { i: 'fa-spinner', l: 'Running' }, queued: { i: 'fa-clock', l: 'Queued' }, cancelled: { i: 'fa-ban', l: 'Cancelled' } };
        const s = sm[st] || { i: 'fa-question', l: st };
        const ago = run.created_at ? this.timeAgo(new Date(run.created_at)) : '—';
        const dur = run.updated_at && run.created_at ? this.fmtDur(new Date(run.updated_at) - new Date(run.created_at)) : '—';
        const isPinned = pinned.includes(run.id);
        return `<tr><td><button class="pin-btn ${isPinned ? 'pinned' : ''}" onclick="togglePin(${run.id})" title="Pin"><i class="fas fa-thumbtack"></i></button></td><td><strong>#${run.run_number}</strong></td><td><span class="status-pill ${st}"><i class="fas ${s.i}"></i> ${s.l}</span></td><td><code style="font-size:0.78rem;">${run.head_branch}</code></td><td style="font-size:0.8rem;color:var(--text-secondary);">${run.event}</td><td style="font-size:0.8rem;color:var(--text-secondary);">${ago}</td><td style="font-size:0.8rem;color:var(--text-secondary);">${dur}</td><td><a href="${run.html_url}" target="_blank" class="btn btn-secondary btn-sm"><i class="fas fa-external-link-alt"></i></a></td></tr>`;
    },
    timeAgo(d) {
        const s = Math.floor((new Date() - d) / 1000);
        for (const { label: l, seconds: v } of [{ label: 'y', seconds: 31536000 }, { label: 'mo', seconds: 2592000 }, { label: 'd', seconds: 86400 }, { label: 'h', seconds: 3600 }, { label: 'm', seconds: 60 }]) { const c = Math.floor(s / v); if (c > 0) return `${c}${l} ago`; }
        return 'just now';
    },
    formatDateTime(d) {
        const date = new Date(d);
        const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        const formatted = date.toLocaleDateString('en-US', options);
        const ago = this.timeAgo(date);
        return `${formatted} (${ago})`;
    },
    fmtDur(ms) { const s = Math.floor(ms / 1000); if (s < 60) return `${s}s`; const m = Math.floor(s / 60); if (m < 60) return `${m}m ${s % 60}s`; return `${Math.floor(m / 60)}h ${m % 60}m`; },
    startPolling(runId) {
        document.getElementById('pollIndicator')?.classList.add('active');
        this.pollingInterval = setInterval(async () => {
            try {
                const r = await this.apiFetch(`/actions/runs/${runId}`); if (!r.ok) return; const run = await r.json(); const st = run.conclusion || run.status;
                if (run.conclusion) { this.stopPolling(); if (run.conclusion === 'success') { Toast.success('Complete', `Run #${run.run_number} passed!`); TerminalLog.log(`Run #${run.run_number} success!`, 'success'); NotifCenter.add('Test Passed', `Run #${run.run_number} completed successfully`, 'success'); } else { Toast.error('Failed', `Run #${run.run_number}: ${run.conclusion}`); TerminalLog.log(`Run #${run.run_number}: ${run.conclusion}`, 'error'); NotifCenter.add('Test Failed', `Run #${run.run_number}: ${run.conclusion}`, 'error'); } }
                else { TerminalLog.log(`Polling: #${run.run_number} is ${st}...`, 'info'); }
            } catch (e) { TerminalLog.log(`Poll error: ${e.message}`, 'warning'); }
        }, 10000);
    },
    stopPolling() { if (this.pollingInterval) { clearInterval(this.pollingInterval); this.pollingInterval = null; } document.getElementById('pollIndicator')?.classList.remove('active'); },
    async findLatestRun() { const r = await this.getRuns(5); return r.length ? r[0] : null; }
};

function togglePin(id) { let p = JSON.parse(localStorage.getItem('acc_pinned') || '[]'); if (p.includes(id)) p = p.filter(x => x !== id); else p.push(id); localStorage.setItem('acc_pinned', JSON.stringify(p)); GitHubAPI.loadHistory(); }

// ===== DASHBOARD STATS =====
const DashboardStats = {
    async refresh() {
        if (!GitHubAPI.getToken() && !BackendAPI.connected) { this.setEmpty(); return; }
        try {
            // Try Backend first for richer stats
            if (BackendAPI.connected) {
                const stats = await BackendAPI.get('/stats/dashboard');
                if (stats) {
                    document.getElementById('statTotalRuns').textContent = stats.total_runs || 0;
                    document.getElementById('statSuccessRate').textContent = `${stats.success_rate || 0}%`;
                    document.getElementById('successBar').style.width = `${stats.success_rate || 0}%`;
                    const lastRun = stats.recent_runs?.[0];
                    document.getElementById('statLastRun').textContent = lastRun ? GitHubAPI.timeAgo(new Date(lastRun.created_at)) : '—';
                    if (stats.recent_runs) this.renderRecentDB(stats.recent_runs);
                    this.updatePlatformHealthDB(stats.platforms);
                    return;
                }
            }

            // Fallback to GitHub API
            const runs = await GitHubAPI.getRuns(30); if (!runs.length) { this.setEmpty(); return; }
            document.getElementById('statTotalRuns').textContent = runs.length;
            const done = runs.filter(r => r.conclusion), ok = done.filter(r => r.conclusion === 'success');
            const rate = done.length ? Math.round(ok.length / done.length * 100) : 0;
            document.getElementById('statSuccessRate').textContent = `${rate}%`;
            document.getElementById('successBar').style.width = `${rate}%`;
            document.getElementById('statLastRun').textContent = GitHubAPI.timeAgo(new Date(runs[0].created_at));
            document.getElementById('historyBadge').textContent = runs.length;
            this.renderRecent(runs.slice(0, 5));
            this.updatePlatformHealth(runs);
            this.renderSparkline(runs);
        } catch (err) { console.error('Refresh stats error:', err); this.setEmpty(); }
    },
    setEmpty() { ['statTotalRuns', 'statSuccessRate', 'statLastRun'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '—'; }); document.getElementById('recentRunsList').innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-6);"><p class="text-sm">Enter token to view stats</p></div>'; },
    renderRecent(runs) {
        const c = document.getElementById('recentRunsList'); if (!c || !runs.length) return;
        const colors = { success: 'var(--success)', failure: 'var(--error)', in_progress: 'var(--running)', queued: 'var(--queued)' };
        c.innerHTML = runs.map(r => { const st = r.conclusion || r.status; return `<div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) 0;border-bottom:1px solid var(--border-color);"><div style="width:8px;height:8px;border-radius:50%;background:${colors[st] || 'var(--text-muted)'};flex-shrink:0;"></div><div style="flex:1;"><div style="font-size:0.85rem;font-weight:600;">#${r.run_number}</div><div style="font-size:0.72rem;color:var(--text-muted);">${r.event} • ${GitHubAPI.timeAgo(new Date(r.created_at))}</div></div><a href="${r.html_url}" target="_blank" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.7rem;"><i class="fas fa-external-link-alt"></i></a></div>`; }).join('');
    },
    renderRecentDB(runs) {
        const c = document.getElementById('recentRunsList'); if (!c) return;
        c.innerHTML = runs.map(r => {
            const status = r.failed > 0 ? 'failure' : 'success';
            return `<div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) 0;border-bottom:1px solid var(--border-color); cursor:pointer" onclick="Router.navigate('db-results'); BackendAPI.showRunDetail(${r.id})">
                <div style="width:8px;height:8px;border-radius:50%;background:var(--${status === 'success' ? 'success' : 'error'});flex-shrink:0;"></div>
                <div style="flex:1;">
                    <div style="font-size:0.85rem;font-weight:600;">${r.platform} Test</div>
                    <div style="font-size:0.72rem;color:var(--text-muted);">${r.tester_name} • ${GitHubAPI.timeAgo(new Date(r.created_at))}</div>
                </div>
                <div style="font-size:0.8rem; font-weight:700; color:var(--accent)">${parseFloat(r.avg_score).toFixed(1)}</div>
            </div>`;
        }).join('');
    },
    updatePlatformHealth(runs) {
        const platforms = ['webchat', 'telegram', 'instagram', 'facebook', 'dhai'];
        platforms.forEach(p => {
            const card = document.querySelector(`.ph-card[data-platform="${p}"]`); if (!card) return;
            const dot = card.querySelector('.ph-dot'), status = card.querySelector('.ph-status');
            // Find latest run mentioning this platform (simplified)
            dot.className = 'ph-dot'; status.textContent = 'No data';
            const latest = runs.find(r => r.name?.toLowerCase().includes(p));
            if (latest) {
                const st = latest.conclusion || latest.status;
                if (st === 'success') { dot.classList.add('ok'); status.textContent = 'Passing'; }
                else if (st === 'failure') { dot.classList.add('fail'); status.textContent = 'Failing'; }
                else if (st === 'in_progress') { dot.classList.add('running'); status.textContent = 'Running'; }
            }
        });
    },
    updatePlatformHealthDB(platforms) {
        platforms.forEach(p => {
            const card = document.querySelector(`.ph-card[data-platform="${p.platform}"]`); if (!card) return;
            const dot = card.querySelector('.ph-dot'), status = card.querySelector('.ph-status');
            dot.className = 'ph-dot';
            const score = parseFloat(p.avg_score);
            if (score >= 0.8) { dot.classList.add('ok'); status.textContent = 'Passing'; }
            else if (score >= 0.5) { dot.classList.add('warning'); status.textContent = 'Degraded'; }
            else { dot.classList.add('fail'); status.textContent = 'Failing'; }
        });
    },
    renderSparkline(runs) {
        const c = document.getElementById('sparkRuns'); if (!c) return;
        const last7 = runs.slice(0, 7).reverse(); if (last7.length < 2) return;
        const pts = last7.map((r, i) => { const x = (i / (last7.length - 1)) * 100; const y = r.conclusion === 'success' ? 20 : 70; return `${x},${y}`; });
        c.innerHTML = `<svg viewBox="0 0 100 80" preserveAspectRatio="none"><polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
};

// ===== NOTIFICATION CENTER =====
const NotifCenter = {
    KEY: 'acc_notifs',
    getAllLocal() { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); },
    async getAll() {
        if (BackendAPI.connected) {
            const resp = await BackendAPI.get('/notifications');
            if (resp && resp.data) return resp.data.map(n => ({ ...n, time: n.created_at, read: !!n.is_read }));
        }
        return this.getAllLocal();
    },
    async add(title, msg, type = 'info') {
        const notif = { title, msg, type, time: new Date().toISOString(), read: false };
        // Save locally
        const local = this.getAllLocal(); local.unshift({ id: Date.now(), ...notif });
        if (local.length > 50) local.length = 50;
        localStorage.setItem(this.KEY, JSON.stringify(local));
        // Save to backend
        if (BackendAPI.connected) await BackendAPI.post('/notifications', { title, message: msg, type });
        this.updateDot(); this.renderPanel();
    },
    async clear() {
        localStorage.removeItem(this.KEY);
        if (BackendAPI.connected) await BackendAPI.del('/notifications');
        this.updateDot(); this.renderPanel();
    },
    async updateDot() {
        const dot = document.getElementById('notifDot'); if (!dot) return;
        const all = await this.getAll();
        const unread = all.filter(n => !n.read).length;
        dot.classList.toggle('hidden', unread === 0);
    },
    async renderPanel() {
        const body = document.getElementById('notifPanelBody'); if (!body) return;
        const notifs = await this.getAll();
        if (!notifs.length) { body.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>No notifications</p></div>'; return; }
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle', dispatch: 'fa-play' };
        const colors = { success: 'color:var(--success)', error: 'color:var(--error)', warning: 'color:var(--warning)', info: 'color:var(--info)', dispatch: 'color:var(--accent)' };
        body.innerHTML = notifs.slice(0, 20).map(n => `<div class="notif-item ${n.read ? '' : 'unread'}"><div class="notif-item-icon" style="${colors[n.type] || ''}"><i class="fas ${icons[n.type] || icons.info}"></i></div><div class="notif-item-body"><div class="notif-item-title">${n.title}</div><div class="notif-item-msg">${n.msg}</div><div class="notif-item-time">${GitHubAPI.timeAgo(new Date(n.time))}</div></div></div>`).join('');
        // Mark all as read in backend and local
        if (BackendAPI.connected) await BackendAPI.put('/notifications/read-all');
        const local = this.getAllLocal().map(n => ({ ...n, read: true }));
        localStorage.setItem(this.KEY, JSON.stringify(local));
    },
    toggle() { const p = document.getElementById('notifPanel'); p?.classList.toggle('open'); if (p?.classList.contains('open')) { this.renderPanel(); setTimeout(() => this.updateDot(), 500); } }
};

// ===== ACTIVITY FEED =====
const ActivityFeed = {
    KEY: 'acc_activity',
    getAll() { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); },
    async add(title, desc, type = 'system') {
        // Save to localStorage
        const items = this.getAll();
        items.unshift({ id: Date.now(), title, desc, type, time: new Date().toISOString() });
        if (items.length > 100) items.length = 100;
        localStorage.setItem(this.KEY, JSON.stringify(items));
        // Also save to backend
        BackendAPI.post('/activity', { title, description: desc, type });
    },
    async clear() {
        localStorage.removeItem(this.KEY);
        await BackendAPI.del('/activity');
        this.render();
    },
    async render() {
        const c = document.getElementById('activityTimeline'); if (!c) return;
        let items = [];
        // Try backend first
        if (BackendAPI.connected) {
            const resp = await BackendAPI.get('/activity?limit=50');
            if (resp && resp.data && resp.data.length) { items = resp.data.map(a => ({ title: a.title, desc: a.description, type: a.type, time: a.created_at })); }
        }
        // Fallback to localStorage
        if (!items.length) items = this.getAll();
        if (!items.length) { c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-8);"><i class="fas fa-stream" style="font-size:2rem;opacity:0.2;display:block;margin-bottom:var(--sp-4);"></i><p>No activity yet</p></div>'; return; }
        c.innerHTML = items.slice(0, 50).map(a => `<div class="activity-item" title="${GitHubAPI.formatDateTime(a.time)}"><div class="activity-icon ${a.type}"><i class="fas fa-${a.type === 'dispatch' ? 'play' : a.type === 'success' ? 'check' : a.type === 'error' ? 'times' : a.type === 'config' ? 'cog' : 'info-circle'}"></i></div><div class="activity-body"><div class="activity-title">${a.title}</div><div class="activity-desc">${a.desc}</div><div class="activity-time">${GitHubAPI.formatDateTime(a.time)}</div></div></div>`).join('');
    }
};

// ===== COMMAND PALETTE =====
const CmdPalette = {
    commands: [
        { name: 'Run Tests', icon: 'fa-play', action: () => { Router.navigate('run-tests'); CmdPalette.close(); }, hint: '2' },
        { name: 'Dashboard', icon: 'fa-chart-pie', action: () => { Router.navigate('dashboard'); CmdPalette.close(); }, hint: '1' },
        { name: 'View History', icon: 'fa-clock-rotate-left', action: () => { Router.navigate('history'); CmdPalette.close(); }, hint: '3' },
        { name: 'Reports', icon: 'fa-chart-bar', action: () => { Router.navigate('reports'); CmdPalette.close(); }, hint: '4' },
        { name: 'Presets', icon: 'fa-bookmark', action: () => { Router.navigate('presets'); CmdPalette.close(); }, hint: '5' },
        { name: 'Activity Feed', icon: 'fa-stream', action: () => { Router.navigate('activity'); CmdPalette.close(); }, hint: '6' },
        { name: 'Scheduler', icon: 'fa-calendar-alt', action: () => { Router.navigate('scheduler'); CmdPalette.close(); }, hint: '7' },
        { name: 'Settings', icon: 'fa-gear', action: () => { Router.navigate('settings'); CmdPalette.close(); }, hint: '8' },
        { name: 'Toggle Theme', icon: 'fa-adjust', action: () => { ThemeManager.toggle(); CmdPalette.close(); } },
        { name: 'Trigger Workflow', icon: 'fa-rocket', action: () => { CmdPalette.close(); triggerWorkflow(); } },
        { name: 'Reset Form', icon: 'fa-redo', action: () => { CmdPalette.close(); resetForm(); } },
        { name: 'Clear Logs', icon: 'fa-trash', action: () => { TerminalLog.clear(); CmdPalette.close(); } },
        { name: 'Check Connection', icon: 'fa-wifi', action: () => { GitHubAPI.checkConnection(); CmdPalette.close(); } },
        { name: 'Refresh Dashboard', icon: 'fa-sync-alt', action: () => { DashboardStats.refresh(); CmdPalette.close(); } },
    ],
    open() {
        const overlay = document.getElementById('cmdPaletteOverlay');
        if (overlay) overlay.classList.add('open');
        const inp = document.getElementById('cmdPaletteInput');
        if (inp) { inp.value = ''; inp.focus(); }
        this.filter('');
    },
    close() { document.getElementById('cmdPaletteOverlay')?.classList.remove('open'); },
    filter(q) {
        const results = document.getElementById('cmdPaletteResults');
        if (!results) return;
        const filtered = q ? this.commands.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : this.commands;
        results.innerHTML = filtered.map((c, i) => `<div class="cmd-result ${i === 0 ? 'selected' : ''}" data-idx="${i}" onclick="CmdPalette.commands.find(x=>x.name==='${c.name}').action()"><i class="fas ${c.icon}"></i><span>${c.name}</span>${c.hint ? `<span class="cmd-result-hint">${c.hint}</span>` : ''}</div>`).join('');
    }
};

// ===== REPORT MANAGER =====
const ReportManager = {
    async render() {
        const c = document.getElementById('reportContent'); if (!c) return;
        console.log('[DEBUG] ReportManager.render() called');
        c.innerHTML = '<div style="padding:var(--sp-6);text-align:center;">Loading reports...</div>';
        try {
            this.allRuns = []; this.filteredRuns = [];
            if (BackendAPI.connected) {
                const stats = await BackendAPI.get('/stats/dashboard');
                if (stats && stats.recent_runs && stats.recent_runs.length > 0) {
                    console.log('[DEBUG] Found recent runs from backend:', stats.recent_runs.length);
                    this.allRuns = stats.recent_runs;
                    this.filteredRuns = [...this.allRuns];
                    this.renderControls();
                    this.renderTable();
                    return;
                } else {
                    console.log('[DEBUG] No recent runs in backend');
                    c.innerHTML = '<div class="text-center" style="padding:var(--sp-6);color:var(--text-muted);"><p><i class="fas fa-inbox" style="font-size:2rem;margin-bottom:var(--sp-2);"></i></p><p>No reports available</p><p style="font-size:0.85rem;">Run a test to generate a report</p></div>';
                    return;
                }
            }
            c.innerHTML = '<div class="text-center" style="padding:var(--sp-6);color:var(--text-muted);"><p><i class="fas fa-plug" style="font-size:2rem;margin-bottom:var(--sp-2);opacity:0.3;"></i></p><p>Backend not connected</p><p style="font-size:0.85rem;">Please ensure the server is running</p></div>';
        } catch (e) {
            console.error('[DEBUG] Error loading reports:', e);
            c.innerHTML = '<div style="padding:var(--sp-6);color:var(--error);"><strong>Error loading reports:</strong> ' + this.esc(e.message) + '</div>';
        }
    },
    renderRecentRuns(runs) {
        const c = document.getElementById('reportContent');
        c.innerHTML = `<div class="reports-grid">${runs.map(r => `
            <div class="report-card" onclick="BackendAPI.showRunDetail(${r.id})" style="cursor:pointer">
                <div class="report-header" style="background:linear-gradient(135deg,var(--accent-light),var(--accent));padding:var(--sp-4);border-radius:var(--radius);color:white;">
                    <div style="font-size:0.9rem;font-weight:600;">${r.platform || 'Test'} Report</div>
                    <div style="font-size:0.75rem;opacity:0.8;">${r.test_id}</div>
                </div>
                <div style="padding:var(--sp-4);">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-3);">
                        <div>
                            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Tester</div>
                            <div style="font-weight:600;font-size:0.9rem;">${r.tester_name}</div>
                        </div>
                        <div>
                            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Score</div>
                            <div style="font-weight:700;font-size:0.9rem;color:var(--accent);">${parseFloat(r.avg_score).toFixed(1)}</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);">
                        <div>
                            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Questions</div>
                            <div style="font-weight:600;font-size:0.9rem;">${r.total_question || 0}</div>
                        </div>
                        <div>
                            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Status</div>
                            <span class="status-pill ${r.failed > 0 ? 'failure' : 'success'}" style="font-size:0.75rem;">${r.failed > 0 ? '❌ FAIL' : '✅ PASS'}</span>
                        </div>
                    </div>
                    <div style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border-color);font-size:0.75rem;color:var(--text-muted);">
                        ${GitHubAPI.formatDateTime(r.created_at)}
                    </div>
                </div>
            </div>
        `).join('')}</div>`;
    },
    renderGitHubRuns(runs) {
        const c = document.getElementById('reportContent');
        c.innerHTML = `<div class="reports-grid">${runs.slice(0, 6).map(r => `
            <div class="report-card" style="cursor:pointer" onclick="window.open('${r.html_url}')">
                <div class="report-header" style="background:linear-gradient(135deg,var(--accent-light),var(--accent));padding:var(--sp-4);border-radius:var(--radius);color:white;">
                    <div style="font-size:0.9rem;font-weight:600;">Workflow Run #${r.run_number}</div>
                    <div style="font-size:0.75rem;opacity:0.8;">${r.event}</div>
                </div>
                <div style="padding:var(--sp-4);">
                    <div style="display:grid;grid-template-columns:1fr;gap:var(--sp-3);margin-bottom:var(--sp-3);">
                        <div>
                            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Branch</div>
                            <div style="font-weight:600;font-size:0.9rem;"><code>${r.head_branch}</code></div>
                        </div>
                    </div>
                    <div>
                        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Status</div>
                        <span class="status-pill ${r.conclusion || r.status}" style="font-size:0.75rem;"><i class="fas ${r.conclusion === 'success' ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${r.conclusion || r.status}</span>
                    </div>
                    <div style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border-color);font-size:0.75rem;color:var(--text-muted);">
                        ${GitHubAPI.formatDateTime(r.created_at)}
                    </div>
                </div>
            </div>
        `).join('')}</div>`;
    },

    // TABLE RENDERING METHODS
    renderControls() {
        const c = document.getElementById('reportContent');
        const parent = c.parentElement;
        const existingControls = parent.querySelector('.report-filter-controls');
        if (existingControls) existingControls.remove();
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'report-filter-controls';
        controlsDiv.style.cssText = 'margin-bottom:var(--sp-4);display:flex;gap:var(--sp-3);flex-wrap:wrap;align-items:center;';
        controlsDiv.innerHTML = `<input type="text" id="reportSearch" placeholder="🔍 Search tester or title..." style="flex:1;min-width:200px;padding:var(--sp-2);border:1px solid var(--border-color);border-radius:var(--radius);background:var(--input-bg);color:var(--text-primary);" onkeyup="ReportManager.applyFilters()"><div style="display:flex;gap:var(--sp-2);"><input type="date" id="reportDateFrom" title="From date" style="padding:var(--sp-2);border:1px solid var(--border-color);border-radius:var(--radius);background:var(--input-bg);color:var(--text-primary);" onchange="ReportManager.applyFilters()"><input type="date" id="reportDateTo" title="To date" style="padding:var(--sp-2);border:1px solid var(--border-color);border-radius:var(--radius);background:var(--input-bg);color:var(--text-primary);" onchange="ReportManager.applyFilters()"></div><button class="btn btn-secondary btn-sm" onclick="ReportManager.resetFilters()"><i class="fas fa-redo"></i> Reset</button>`;
        parent.insertBefore(controlsDiv, c);
    },

    applyFilters() {
        const searchVal = document.getElementById('reportSearch')?.value?.toLowerCase() || '';
        const dateFrom = document.getElementById('reportDateFrom')?.value;
        const dateTo = document.getElementById('reportDateTo')?.value;
        this.filteredRuns = this.allRuns.filter(r => {
            const matchesSearch = !searchVal || (r.tester_name?.toLowerCase().includes(searchVal)) || (r.test_id?.toLowerCase().includes(searchVal)) || (r.platform?.toLowerCase().includes(searchVal));
            const runDate = new Date(r.created_at);
            const matchesFromDate = !dateFrom || runDate >= new Date(dateFrom + 'T00:00:00');
            const matchesToDate = !dateTo || runDate <= new Date(dateTo + 'T23:59:59');
            return matchesSearch && matchesFromDate && matchesToDate;
        });
        console.log('[DEBUG] Filtered runs:', this.filteredRuns.length);
        if (this.allRuns[0]?.html_url) { this.renderGitHubTable(); } else { this.renderTable(); }
    },

    resetFilters() {
        document.getElementById('reportSearch').value = '';
        document.getElementById('reportDateFrom').value = '';
        document.getElementById('reportDateTo').value = '';
        this.filteredRuns = [...this.allRuns];
        if (this.allRuns[0]?.html_url) { this.renderGitHubTable(); } else { this.renderTable(); }
    },

    renderTable() {
        const c = document.getElementById('reportContent');
        const pinned = JSON.parse(localStorage.getItem('acc_reports_pinned') || '[]');
        if (!this.filteredRuns.length) { c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-6);"><p>No reports match your filters</p></div>'; return; }
        c.innerHTML = `<table class="runs-table" style="width:100%;"><thead><tr><th style="width:40px"></th><th>Run Title</th><th>Tester</th><th>Platform</th><th>Score</th><th>Status</th><th>Started</th><th>Duration</th><th style="width:100px">Actions</th></tr></thead><tbody>${this.filteredRuns.map(r => this.renderRow(r, pinned)).join('')}</tbody></table>`;
    },

    renderRow(run, pinned = []) {
        const status = run.failed > 0 ? 'failure' : 'success';
        const score = parseFloat(run.avg_score || 0).toFixed(2);
        const isPinned = pinned.includes(run.id);
        const startedTime = GitHubAPI.formatDateTime(run.created_at);
        const duration = run.duration || '—';
        const title = run.test_id || `${run.platform} Test`;
        return `<tr onclick="BackendAPI.showRunDetail(${run.id})" style="cursor:pointer;"><td><button class="pin-btn ${isPinned ? 'pinned' : ''}" onclick="event.stopPropagation();ReportManager.togglePin(${run.id})" title="Pin" style="border:none;background:none;cursor:pointer;color:var(--text-muted);"><i class="fas fa-thumbtack"></i></button></td><td><strong>${this.esc(title)}</strong></td><td style="font-size:0.8rem">${this.esc(run.tester_name)}</td><td><span class="platform-tag ${run.platform}">${run.platform}</span></td><td style="font-weight:700;color:var(--accent)">${score}</td><td><span class="status-pill ${status}" style="font-size:0.75rem;">${status === 'success' ? '✅ PASS' : '❌ FAIL'}</span></td><td style="font-size:0.75rem;color:var(--text-muted);">${startedTime}</td><td style="font-size:0.75rem;color:var(--text-muted);">${duration}</td><td style="position:relative;"><div class="btn-group" style="display:flex;gap:6px;"><button onclick="event.stopPropagation();BackendAPI.showRunDetail(${run.id})" class="btn btn-secondary btn-sm" title="View Details"><i class="fas fa-eye"></i></button><button onclick="event.stopPropagation();ReportManager.showDownloadMenu(event, ${run.id})" class="btn btn-secondary btn-sm" title="Download Artifacts"><i class="fas fa-download"></i></button></div></td></tr>`;
    },

    showDownloadMenu(event, runId) {
        event.preventDefault();
        const menu = document.createElement('div');
        menu.style.cssText = 'position:absolute;top:100%;right:0;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius);box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:1000;min-width:180px;';
        menu.innerHTML = '<div style="padding:var(--sp-2);">Loading artifacts...</div>';
        document.body.appendChild(menu);

        // Position menu properly
        const btn = event.target.closest('.btn-group');
        const rect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';

        // Load artifacts
        ArtifactManager.loadArtifacts(runId).then(artifacts => {
            if (!artifacts.length) {
                menu.innerHTML = '<div style="padding:var(--sp-3);color:var(--text-muted);font-size:0.85rem;text-align:center;">No artifacts</div>';
                return;
            }

            const grouped = {};
            artifacts.forEach(a => {
                if (!grouped[a.artifact_type]) grouped[a.artifact_type] = [];
                grouped[a.artifact_type].push(a);
            });

            let html = '';
            for (const [type, items] of Object.entries(grouped)) {
                html += `<div style="border-bottom:1px solid var(--border-color);padding:var(--sp-2);">
                    <div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;color:var(--accent);margin-bottom:var(--sp-1);">${type}</div>`;
                items.forEach(a => {
                    const size = ReportManager.formatSize(a.file_size);
                    html += `<button onclick="event.stopPropagation();ArtifactManager.downloadArtifact(${a.id}, '${a.filename.replace(/'/g, "\\'")}');this.closest('[style*=position]').remove();" style="display:block;width:100%;text-align:left;padding:var(--sp-2);background:none;border:none;color:var(--text-primary);cursor:pointer;font-size:0.8rem;border-radius:var(--radius);" onmouseover="this.style.background='var(--bg-primary)'" onmouseout="this.style.background='none'">
                        <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;"><strong>${a.filename}</strong></div>
                        <div style="font-size:0.7rem;color:var(--text-muted);">${size}</div>
                    </button>`;
                });
                html += '</div>';
            }
            menu.innerHTML = html;
        });

        // Close menu on click outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && !e.target.closest('.btn-group')) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    },

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    renderGitHubTable() {
        const c = document.getElementById('reportContent');
        const pinned = JSON.parse(localStorage.getItem('acc_reports_pinned') || '[]');
        if (!this.filteredRuns.length) { c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-6);"><p>No workflow runs match your filters</p></div>'; return; }
        c.innerHTML = `<table class="runs-table" style="width:100%;"><thead><tr><th style="width:40px"></th><th>Run #</th><th>Branch</th><th>Event</th><th>Status</th><th>Started</th><th>Duration</th><th style="width:60px"></th></tr></thead><tbody>${this.filteredRuns.map(r => this.renderGitHubRow(r, pinned)).join('')}</tbody></table>`;
    },

    renderGitHubRow(run, pinned = []) {
        const st = run.conclusion || run.status;
        const statusIcon = st === 'success' ? '✅' : st === 'failure' ? '❌' : '🔄';
        const isPinned = pinned.includes(run.id);
        const duration = run.updated_at && run.created_at ? GitHubAPI.fmtDur(new Date(run.updated_at) - new Date(run.created_at)) : '—';
        const startedTime = GitHubAPI.formatDateTime(run.created_at);
        return `<tr style="cursor:pointer;" onclick="window.open('${run.html_url}')"><td><button class="pin-btn ${isPinned ? 'pinned' : ''}" onclick="event.stopPropagation();ReportManager.togglePin(${run.id})" title="Pin" style="border:none;background:none;cursor:pointer;color:var(--text-muted);"><i class="fas fa-thumbtack"></i></button></td><td><strong>#${run.run_number}</strong></td><td><code style="font-size:0.75rem;">${run.head_branch}</code></td><td style="font-size:0.8rem;">${run.event}</td><td><span class="status-pill ${st}" style="font-size:0.75rem;">${statusIcon} ${st}</span></td><td style="font-size:0.75rem;color:var(--text-muted);">${startedTime}</td><td style="font-size:0.75rem;color:var(--text-muted);">${duration}</td><td><a href="${run.html_url}" target="_blank" class="btn btn-secondary btn-sm" onclick="event.stopPropagation()"><i class="fas fa-external-link-alt"></i></a></td></tr>`;
    },

    togglePin(id) {
        let pinned = JSON.parse(localStorage.getItem('acc_reports_pinned') || '[]');
        if (pinned.includes(id)) { pinned = pinned.filter(x => x !== id); } else { pinned.push(id); }
        localStorage.setItem('acc_reports_pinned', JSON.stringify(pinned));
        this.renderTable();
    },

    esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
};

// ===== PRESET MANAGER =====
const PresetManager = {
    KEY: 'acc_presets',
    getAll() { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); },
    async save(name, color = '#6366f1') {
        const presetData = { name, color, platform: document.getElementById('platformSelect').value, filename: document.getElementById('filenameInput').value, tester_name: document.getElementById('testerNameInput').value, greeting: document.getElementById('greetingInput').value, webchat_url: document.getElementById('webchatUrlInput').value, telegram_bot: document.getElementById('telegramBotInput').value, instagram_user: document.getElementById('instagramUrlInput').value, facebook_id: document.getElementById('facebookUrlInput').value, dhai_url: document.getElementById('dhaiUrlInput').value };
        // Save to backend
        const apiResult = await BackendAPI.post('/presets', presetData);
        // Also save to localStorage
        const presets = this.getAll();
        const preset = { id: apiResult?.id || Date.now(), ...presetData, createdAt: new Date().toISOString() };
        presets.push(preset); localStorage.setItem(this.KEY, JSON.stringify(presets));
        Toast.success('Saved', `"${name}" preset saved`); ActivityFeed.add('Preset Saved', `Saved "${name}" for ${preset.platform}`, 'config'); this.render();
    },
    async delete(id) {
        let p = this.getAll().filter(x => x.id !== id); localStorage.setItem(this.KEY, JSON.stringify(p));
        await BackendAPI.del(`/presets/${id}`);
        Toast.info('Deleted', 'Preset removed'); this.render();
    },
    async load(id) {
        let p = this.getAll().find(x => x.id === id);
        // Try backend if not in localStorage
        if (!p && BackendAPI.connected) {
            const resp = await BackendAPI.get('/presets');
            if (resp && resp.data) p = resp.data.find(x => x.id === id);
        }
        if (p) {
            const platSel = document.getElementById('platformSelect');
            if (platSel) platSel.value = p.platform;
            const fileInp = document.getElementById('filenameInput');
            if (fileInp) fileInp.value = p.filename || 'testing';
            const testInp = document.getElementById('testerNameInput');
            if (testInp) testInp.value = p.tester_name || p.testerName || 'GitHub Actions Bot';
            const greetInp = document.getElementById('greetingInput');
            if (greetInp) greetInp.value = p.greeting || 'Haloo';
            const webInp = document.getElementById('webchatUrlInput');
            if (webInp) webInp.value = p.webchat_url || p.webchatUrl || '';
            const tgInp = document.getElementById('telegramBotInput');
            if (tgInp) tgInp.value = p.telegram_bot || p.telegramBot || '';
            const instInp = document.getElementById('instagramUrlInput');
            if (instInp) instInp.value = p.instagram_user || p.instagramUser || '';
            const fbInp = document.getElementById('facebookUrlInput');
            if (fbInp) fbInp.value = p.facebook_id || p.facebookId || '';
            const dhaiInp = document.getElementById('dhaiUrlInput');
            if (dhaiInp) dhaiInp.value = p.dhai_url || p.dhaiUrl || '';
            switchPlatformFields(p.platform); Toast.success('Loaded', `"${p.name}" applied`); Router.navigate('run-tests');
        }
    },
    async render() {
        const grid = document.getElementById('presetGrid'); if (!grid) return;
        let presets = [];
        // Try backend first
        if (BackendAPI.connected) {
            const resp = await BackendAPI.get('/presets');
            if (resp && resp.data && resp.data.length) { presets = resp.data.map(p => ({ ...p, createdAt: p.created_at })); }
        }
        // Fallback to localStorage
        if (!presets.length) presets = this.getAll();
        if (!presets.length) { grid.innerHTML = '<div class="text-center text-muted" style="grid-column:1/-1;padding:var(--sp-12);"><i class="fas fa-bookmark" style="font-size:2.5rem;opacity:0.2;margin-bottom:var(--sp-4);display:block;"></i><p>No presets saved yet</p></div>'; return; }
        const emojis = { webchat: '🌐', telegram: '✈️', instagram: '📷', facebook: '👥', dhai: '🤖' };
        grid.innerHTML = presets.map(p => `<div class="preset-card" style="--accent:${p.color || '#6366f1'}" onclick="PresetManager.load(${p.id})"><div class="preset-name"><i class="fas fa-bookmark" style="color:${p.color || 'var(--accent-light)'};"></i>${esc(p.name)}</div><div class="preset-platform">${emojis[p.platform] || '🔧'} ${p.platform}${p.filename ? ' • ' + p.filename : ''}</div><div class="preset-meta">${GitHubAPI.timeAgo(new Date(p.createdAt))}</div><button class="preset-delete" onclick="event.stopPropagation();PresetManager.delete(${p.id})" title="Delete"><i class="fas fa-trash"></i></button></div>`).join('');
    },
    exportAll() {
        const blob = new Blob([JSON.stringify(this.getAll(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'presets-export.json'; a.click(); Toast.success('Exported', 'Presets exported');
    },
    importFromFile() {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
        inp.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { try { const data = JSON.parse(ev.target.result); if (Array.isArray(data)) { localStorage.setItem(this.KEY, JSON.stringify([...this.getAll(), ...data])); Toast.success('Imported', `${data.length} presets imported`); this.render(); } else Toast.error('Error', 'Invalid preset file'); } catch { Toast.error('Error', 'Could not parse file'); } }; r.readAsText(f); };
        inp.click();
    }
};

// ===== SCHEDULER =====
const Scheduler = {
    KEY: 'acc_schedules', timers: {},
    getAllLocal() { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); },
    async getAll() {
        if (BackendAPI.connected) {
            const resp = await BackendAPI.get('/schedules');
            if (resp && resp.data) return resp.data.map(s => ({ ...s, interval: s.interval_min, createdAt: s.created_at, paused: !!s.paused }));
        }
        return this.getAllLocal();
    },
    async saveLocal(s) { const all = this.getAllLocal(); all.push(s); localStorage.setItem(this.KEY, JSON.stringify(all)); },
    async delete(id) {
        localStorage.setItem(this.KEY, JSON.stringify(this.getAllLocal().filter(x => x.id !== id)));
        if (BackendAPI.connected) await BackendAPI.del(`/schedules/${id}`);
        if (this.timers[id]) { clearInterval(this.timers[id]); delete this.timers[id]; }
        this.render();
    },
    async togglePause(id) {
        const all = await this.getAll();
        const s = all.find(x => x.id === id);
        if (!s) return;
        s.paused = !s.paused;
        // Update local
        const local = this.getAllLocal(); const ls = local.find(x => x.id === id); if (ls) ls.paused = s.paused;
        localStorage.setItem(this.KEY, JSON.stringify(local));
        // Update backend
        if (BackendAPI.connected) await BackendAPI.put(`/schedules/${id}`, { name: s.name, interval_min: s.interval, preset_id: s.presetId, paused: s.paused });

        if (s.paused && this.timers[id]) { clearInterval(this.timers[id]); delete this.timers[id]; }
        else if (!s.paused) { this.startTimer(s); }
        this.render();
    },
    startTimer(s) {
        if (this.timers[s.id]) clearInterval(this.timers[s.id]);
        this.timers[s.id] = setInterval(() => {
            if (s.presetId) { PresetManager.load(s.presetId); }
            Toast.info('Scheduled Run', `Running "${s.name}"`);
            ActivityFeed.add('Scheduled Run', `Auto-triggered "${s.name}"`, 'dispatch');
            triggerWorkflow();
        }, s.interval * 60000);
    },
    async startAll() { const all = await this.getAll(); all.filter(s => !s.paused).forEach(s => this.startTimer(s)); },
    async add(name, interval, presetId) {
        const s = { id: Date.now(), name, interval: parseInt(interval), presetId: presetId || null, paused: false, createdAt: new Date().toISOString() };
        await this.saveLocal(s);
        if (BackendAPI.connected) {
            const resp = await BackendAPI.post('/schedules', { name: s.name, interval_min: s.interval, preset_id: s.presetId, paused: false });
            if (resp && resp.id) s.id = resp.id; // Sync ID
        }
        this.startTimer(s); Toast.success('Scheduled', `"${name}" will run every ${interval} min`);
        ActivityFeed.add('Schedule Created', `"${name}" every ${interval}min`, 'config'); this.render();
    },
    async render() {
        const c = document.getElementById('scheduleList'); if (!c) return;
        const all = await this.getAll();
        if (!all.length) { c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-8);"><i class="fas fa-calendar-alt" style="font-size:2rem;opacity:0.2;display:block;margin-bottom:var(--sp-4);"></i><p>No scheduled runs</p></div>'; return; }
        c.innerHTML = all.map(s => `<div class="schedule-item"><div class="schedule-icon"><i class="fas fa-calendar-check"></i></div><div class="schedule-info"><div class="schedule-name">${esc(s.name)}</div><div class="schedule-detail">Every ${s.interval} min${s.presetId ? ' • Uses preset' : ' • Current config'}</div></div><span class="schedule-status ${s.paused ? 'paused' : 'active'}">${s.paused ? 'Paused' : 'Active'}</span><button class="btn btn-sm btn-ghost" onclick="Scheduler.togglePause(${s.id})"><i class="fas fa-${s.paused ? 'play' : 'pause'}"></i></button><button class="btn btn-sm btn-ghost" onclick="Scheduler.delete(${s.id})" style="color:var(--error);"><i class="fas fa-trash"></i></button></div>`).join('');
    }
};

// ===== SETTINGS =====
const Settings = {
    soundEnabled: JSON.parse(localStorage.getItem('acc_sound') || 'true'),
    setSound(on) { this.soundEnabled = on; localStorage.setItem('acc_sound', JSON.stringify(on)); document.getElementById('soundOnBtn')?.classList.toggle('active', on); document.getElementById('soundOffBtn')?.classList.toggle('active', !on); Toast.info('Sound', on ? 'Sound alerts on' : 'Sound alerts off'); },
    updateStorageUsed() {
        const used = new Blob(Object.values(localStorage)).size;
        const el = document.getElementById('storageUsed');
        if (el) el.textContent = `${(used / 1024).toFixed(1)} KB`;
    }
};

// ===== FORM LOGIC =====
let uploadedFile = null, runMode = 'single';
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function setRunMode(m) { runMode = m; document.getElementById('modeSingleBtn').classList.toggle('active', m === 'single'); document.getElementById('modeBatchBtn').classList.toggle('active', m === 'batch'); document.getElementById('singlePlatformGroup').classList.toggle('hidden', m === 'batch'); document.getElementById('batchPlatformGroup').classList.toggle('hidden', m === 'single'); if (m === 'batch') { updateBatchPlatformFields(); } else { switchPlatformFields(document.getElementById('platformSelect').value); } }
function switchPlatformFields(p) { document.querySelectorAll('.platform-field').forEach(f => f.classList.remove('active')); document.getElementById(`field-${p}`)?.classList.add('active'); }
function updateBatchPlatformFields() { document.querySelectorAll('.platform-field').forEach(f => f.classList.remove('active')); document.querySelectorAll('.platform-check input:checked').forEach(cb => { const field = document.getElementById(`field-${cb.value}`); if (field) field.classList.add('active'); }); }
function clearFile(e) { if (e) e.stopPropagation(); uploadedFile = null; document.getElementById('fileUpload').value = ''; document.getElementById('fileDropText').innerHTML = 'Drag & drop or <strong>click to browse</strong>'; document.getElementById('fileDropZone').classList.remove('has-file'); document.getElementById('fileClearBtn').classList.add('hidden'); document.getElementById('filenameGroup').style.display = ''; document.getElementById('dataPreviewGroup')?.classList.add('hidden'); }
function getFormData() {
    const p = document.getElementById('platformSelect').value;
    const runTitle = document.getElementById('runTitleInput')?.value?.trim() || 'Manual Test Run';
    const user = AuthManager.user?.username || 'Guest';

    const backendUrl = localStorage.getItem('acc_backend_url') || window.location.origin;

    return {
        USER_ID: AuthManager.user?.id || '',
        RUN_NAME: `${user}: ${runTitle}`,
        SELECTED_PLATFORM: p,
        FILENAME: uploadedFile ? uploadedFile.name : (document.getElementById('filenameInput').value + '.xlsx' || 'testing.xlsx'),
        TESTER_NAME: document.getElementById('testerNameInput').value || 'GitHub Actions Bot',
        GREETING: document.getElementById('greetingInput').value || 'Haloo',
        WEBCHAT_URL: document.getElementById('webchatUrlInput').value || 'https://chat.botika.online/tpUyiey',
        WEBCHAT_NAME: document.getElementById('webchatNameInput')?.value || '',
        WEBCHAT_EMAIL: document.getElementById('webchatEmailInput')?.value || '',
        WEBCHAT_PHONE: document.getElementById('webchatPhoneInput')?.value || '',
        DHAI_TARGET_URL: document.getElementById('dhaiUrlInput').value || '',
        INSTAGRAM_USERNAME: document.getElementById('instagramUrlInput').value || '',
        FACEBOOK_FANPAGE_ID: document.getElementById('facebookUrlInput').value || '',
        TELEGRAM_BOT_USERNAME: document.getElementById('telegramBotInput').value || '',
        BACKEND_URL: backendUrl
    };
}
function resetForm() {
    document.getElementById('platformSelect').value = 'webchat'; switchPlatformFields('webchat');
    document.getElementById('runTitleInput').value = 'Manual Test Run';
    ['webchatNameInput', 'webchatEmailInput', 'webchatPhoneInput'].forEach(id => { document.getElementById(id).value = ''; });
    ['filenameInput', 'testerNameInput', 'greetingInput'].forEach((id, i) => { document.getElementById(id).value = ['testing', 'GitHub Actions Bot', 'Haloo'][i]; });
    document.getElementById('webchatUrlInput').value = 'https://chat.botika.online/tpUyiey';
    ['telegramBotInput', 'instagramUrlInput', 'facebookUrlInput', 'dhaiUrlInput'].forEach(id => { document.getElementById(id).value = ''; });

    document.getElementById('repeatCountInput').value = '1'; document.getElementById('runTagInput').value = '';
    clearFile(); TerminalLog.clear(); document.getElementById('outputSection').style.display = 'none'; setRunMode('single'); Toast.info('Reset', 'Form reset');
}
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ===== TRIGGER =====
async function triggerWorkflow() {
    const token = GitHubAPI.getToken();
    if (!token) { Toast.error('Token Required', 'Enter your GitHub token'); document.getElementById('tokenInput')?.focus(); return; }
    const runBtn = document.getElementById('runBtn');
    runBtn.classList.add('loading'); runBtn.disabled = true; runBtn.innerHTML = '<i class="fas fa-spinner"></i><span>Running...</span>';
    TerminalLog.clear(); document.getElementById('outputSection').style.display = 'block';
    const repeatCount = Math.min(parseInt(document.getElementById('repeatCountInput')?.value || 1), 10);
    const tag = document.getElementById('runTagInput')?.value?.trim() || '';
    try {
        let platforms = [];
        if (runMode === 'batch') { document.querySelectorAll('.platform-check input:checked').forEach(cb => platforms.push(cb.value)); if (!platforms.length) { Toast.warning('No Platforms', 'Select at least one'); throw new Error('skip'); } }
        else platforms = [document.getElementById('platformSelect').value];
        if (uploadedFile) { TerminalLog.log('Uploading test file...', 'info'); await GitHubAPI.uploadFile(uploadedFile); await new Promise(r => setTimeout(r, 2000)); }
        for (let rep = 0; rep < repeatCount; rep++) {
            if (repeatCount > 1) TerminalLog.log(`--- Repeat ${rep + 1}/${repeatCount} ---`, 'info');
            for (let i = 0; i < platforms.length; i++) {
                const plat = platforms[i], fd = getFormData(); fd.SELECTED_PLATFORM = plat;
                if (tag) fd.RUN_TAG = tag;
                TerminalLog.log(`${runMode === 'batch' ? `[${i + 1}/${platforms.length}] ` : ''}Triggering ${plat.toUpperCase()}...`, 'info');
                const resp = await GitHubAPI.dispatchWorkflow(fd);
                if (resp.ok) {
                    TerminalLog.log(`${plat.toUpperCase()} dispatched!`, 'success'); Toast.success('Dispatched', `${plat.toUpperCase()} triggered`);
                    ActivityFeed.add('Workflow Dispatched', `${plat.toUpperCase()} test triggered${tag ? ' [' + tag + ']' : ''}${repeatCount > 1 ? ' (' + ((rep * platforms.length) + i + 1) + '/' + (repeatCount * platforms.length) + ')' : ''}`, 'dispatch');
                    NotifCenter.add('Dispatched', `${plat.toUpperCase()} workflow started`, 'dispatch');
                    if (i === platforms.length - 1 && rep === repeatCount - 1) { TerminalLog.log('Waiting 5s before polling...', 'info'); await new Promise(r => setTimeout(r, 5000)); const latest = await GitHubAPI.findLatestRun(); if (latest && !latest.conclusion) { GitHubAPI.startPolling(latest.id); } }
                    if (i < platforms.length - 1) await new Promise(r => setTimeout(r, 3000));
                } else { const txt = await resp.text(); let msg = `Failed (${resp.status})`; try { msg = JSON.parse(txt).message || msg; } catch { } TerminalLog.log(`Failed: ${msg}`, 'error'); Toast.error('Failed', msg); ActivityFeed.add('Dispatch Failed', msg, 'error'); }
            }
            if (rep < repeatCount - 1) { TerminalLog.log('Waiting 5s before next repeat...', 'info'); await new Promise(r => setTimeout(r, 5000)); }
        }
    } catch (e) { if (e.message !== 'skip') { TerminalLog.log(`Error: ${e.message}`, 'error'); Toast.error('Error', e.message); } }
    finally { runBtn.classList.remove('loading'); runBtn.disabled = false; runBtn.innerHTML = '<i class="fas fa-play-circle"></i><span>Run Tests</span>'; }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    Toast.init(); ThemeManager.init(); TerminalLog.init(); Router.init(); PresetManager.render(); NotifCenter.updateDot(); Scheduler.startAll(); Settings.updateStorageUsed();
    BackendAPI.init();

    // Sidebar
    document.getElementById('sidebarToggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('collapsed'));
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => { document.getElementById('sidebar')?.classList.toggle('mobile-open'); document.getElementById('mobileOverlay')?.classList.toggle('show'); });
    document.getElementById('mobileOverlay')?.addEventListener('click', () => { document.getElementById('sidebar')?.classList.remove('mobile-open'); document.getElementById('mobileOverlay')?.classList.remove('show'); });

    // Theme
    document.getElementById('themeToggle')?.addEventListener('click', () => ThemeManager.toggle());

    // Platform
    document.getElementById('platformSelect')?.addEventListener('change', e => switchPlatformFields(e.target.value));
    document.querySelectorAll('.platform-check').forEach(card => {
        const cb = card.querySelector('input');
        // No click listener needed on the card because it's a <label>
        // Clicking the label automatically toggles the checkbox.
        cb.addEventListener('change', () => {
            card.classList.toggle('checked', cb.checked);
            if (runMode === 'batch') updateBatchPlatformFields();
        });
    });

    // Token
    document.getElementById('toggleTokenBtn')?.addEventListener('click', () => { const i = document.getElementById('tokenInput'), b = document.getElementById('toggleTokenBtn'); if (i.type === 'password') { i.type = 'text'; b.innerHTML = '<i class="fas fa-eye-slash"></i>'; } else { i.type = 'password'; b.innerHTML = '<i class="fas fa-eye"></i>'; } });
    let tokenDebounce;
    document.getElementById('tokenInput')?.addEventListener('input', () => { clearTimeout(tokenDebounce); tokenDebounce = setTimeout(() => GitHubAPI.checkConnection(), 800); });

    // File upload
    const dz = document.getElementById('fileDropZone'), fi = document.getElementById('fileUpload');
    dz?.addEventListener('click', () => fi?.click());
    dz?.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz?.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz?.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer.files.length) { fi.files = e.dataTransfer.files; handleFile(e.dataTransfer.files[0]); } });
    fi?.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

    function handleFile(file) {
        uploadedFile = file; const sz = (file.size / 1024).toFixed(1);
        document.getElementById('fileDropText').textContent = `${file.name} (${sz} KB)`;
        dz.classList.add('has-file'); document.getElementById('fileClearBtn').classList.remove('hidden');
        document.getElementById('filenameGroup').style.display = 'none'; Toast.info('File', file.name);
        // CSV preview
        if (file.name.endsWith('.csv')) {
            const reader = new FileReader(); reader.onload = ev => {
                const lines = ev.target.result.split('\n').filter(l => l.trim()).slice(0, 6);
                if (lines.length < 2) return;
                const headers = lines[0].split(','); const rows = lines.slice(1);
                const tbl = document.getElementById('dataPreviewTable');
                tbl.querySelector('thead').innerHTML = `<tr>${headers.map(h => `<th>${h.trim()}</th>`).join('')}</tr>`;
                tbl.querySelector('tbody').innerHTML = rows.map(r => `<tr>${r.split(',').map(c => `<td>${c.trim()}</td>`).join('')}</tr>`).join('');
                document.getElementById('dataPreviewCount').textContent = `${rows.length} rows`;
                document.getElementById('dataPreviewGroup')?.classList.remove('hidden');
            }; reader.readAsText(file);
        }
    }

    // Buttons
    document.getElementById('runBtn')?.addEventListener('click', triggerWorkflow);
    document.getElementById('clearBtn')?.addEventListener('click', resetForm);

    // Save Preset
    document.getElementById('savePresetBtn')?.addEventListener('click', () => openModal('savePresetModal'));
    document.querySelectorAll('.color-dot').forEach(dot => dot.addEventListener('click', () => { document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active')); dot.classList.add('active'); }));
    document.getElementById('confirmSavePresetBtn')?.addEventListener('click', () => {
        const name = document.getElementById('presetNameInput')?.value?.trim(); if (!name) { Toast.warning('Name', 'Enter a name'); return; }
        const color = document.querySelector('.color-dot.active')?.dataset.color || '#6366f1';
        PresetManager.save(name, color); document.getElementById('presetNameInput').value = ''; closeModal('savePresetModal');
    });

    // Presets import/export
    document.getElementById('exportPresetsBtn')?.addEventListener('click', () => PresetManager.exportAll());
    document.getElementById('importPresetBtn')?.addEventListener('click', () => PresetManager.importFromFile());

    // Report
    document.getElementById('loadReportBtn')?.addEventListener('click', () => openModal('loadReportModal'));
    document.getElementById('confirmLoadReportBtn')?.addEventListener('click', () => { const url = document.getElementById('reportUrlInput')?.value?.trim(); if (!url) { Toast.warning('URL', 'Enter a URL'); return; } document.getElementById('reportContent').innerHTML = `<iframe class="report-iframe" src="${url}"></iframe>`; closeModal('loadReportModal'); Toast.success('Loaded', 'Report embedded'); });
    document.getElementById('downloadArtifactBtn')?.addEventListener('click', () => { Toast.info('Artifacts', 'Download from GitHub Actions page'); window.open(`https://github.com/${CONFIG.owner}/${CONFIG.repo}/actions`, '_blank'); });

    // Notifications
    document.getElementById('notifBtn')?.addEventListener('click', () => NotifCenter.toggle());
    document.getElementById('clearNotifsBtn')?.addEventListener('click', () => { NotifCenter.clear(); Toast.info('Cleared', 'Notifications cleared'); });

    // Command Palette
    document.getElementById('cmdPaletteBtn')?.addEventListener('click', () => CmdPalette.open());
    document.getElementById('cmdPaletteInput')?.addEventListener('input', e => CmdPalette.filter(e.target.value));
    document.getElementById('cmdPaletteOverlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) CmdPalette.close(); });

    // Scheduler
    document.getElementById('addScheduleBtn')?.addEventListener('click', () => {
        const sel = document.getElementById('schedulePresetInput');
        if (sel) {
            sel.innerHTML = '<option value="">— Current Config —</option>';
            PresetManager.getAll().forEach(p => { sel.innerHTML += `<option value="${p.id}">${p.name}</option>`; });
        }
        openModal('addScheduleModal');
    });
    document.getElementById('confirmAddScheduleBtn')?.addEventListener('click', () => {
        const name = document.getElementById('scheduleNameInput')?.value?.trim(); if (!name) { Toast.warning('Name', 'Enter a name'); return; }
        Scheduler.add(name, document.getElementById('scheduleIntervalInput').value, document.getElementById('schedulePresetInput').value);
        document.getElementById('scheduleNameInput').value = ''; closeModal('addScheduleModal');
    });

    // Activity
    document.getElementById('clearActivityBtn')?.addEventListener('click', () => { ActivityFeed.clear(); Toast.info('Cleared', 'Activity feed cleared'); });

    // Settings
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
        CONFIG.owner = document.getElementById('settingOwner').value.trim();
        CONFIG.repo = document.getElementById('settingRepo').value.trim();
        CONFIG.workflow_id = document.getElementById('settingWorkflow').value.trim();
        CONFIG.ref = document.getElementById('settingBranch').value.trim();
        CONFIG.token = document.getElementById('tokenInput').value.trim();
        const backendUrl = document.getElementById('settingBackendUrl').value.trim();
        if (backendUrl) localStorage.setItem('acc_backend_url', backendUrl);
        else localStorage.removeItem('acc_backend_url'); // Clear if empty

        localStorage.setItem('acc_config', JSON.stringify(CONFIG));
        document.getElementById('envInfo').innerHTML = `<span class="env-tag"><i class="fas fa-code-branch"></i> ${CONFIG.ref}</span><span class="env-tag"><i class="fas fa-file-code"></i> ${CONFIG.workflow_id}</span><span class="env-tag"><i class="fab fa-github"></i> ${CONFIG.owner}/${CONFIG.repo}</span>`;
        Toast.success('Saved', 'Settings updated');
        ActivityFeed.add('Settings Updated', `${CONFIG.owner}/${CONFIG.repo}`, 'config');
        Settings.updateStorageUsed();
        GitHubAPI.checkConnection(); // Update connection status after saving
    });
    document.getElementById('exportSettingsBtn')?.addEventListener('click', () => {
        const data = { config: CONFIG, presets: PresetManager.getAll(), theme: ThemeManager.get(), activity: ActivityFeed.getAll(), schedules: Scheduler.getAll() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `acc-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); Toast.success('Exported', 'All data exported');
    });
    document.getElementById('importSettingsBtn')?.addEventListener('click', () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
        inp.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { try { const d = JSON.parse(ev.target.result); if (d.config) localStorage.setItem('acc_config', JSON.stringify(d.config)); if (d.presets) localStorage.setItem('acc_presets', JSON.stringify(d.presets)); if (d.theme) localStorage.setItem('acc_theme', d.theme); Toast.success('Imported', 'Data imported. Reloading...'); setTimeout(() => location.reload(), 1000); } catch { Toast.error('Error', 'Invalid file'); } }; r.readAsText(f); }; inp.click();
    });
    document.getElementById('clearAllDataBtn')?.addEventListener('click', () => { if (confirm('Clear ALL saved data?')) { localStorage.removeItem('acc_config'); localStorage.removeItem('acc_presets'); localStorage.removeItem('acc_theme'); localStorage.removeItem('acc_activity'); localStorage.removeItem('acc_notifs'); localStorage.removeItem('acc_schedules'); localStorage.removeItem('acc_pinned'); Toast.warning('Cleared', 'All data removed'); location.reload(); } });

    // Shortcuts & Conn
    document.getElementById('shortcutsBtn')?.addEventListener('click', () => openModal('shortcutsModal'));
    document.getElementById('connStatusBtn')?.addEventListener('click', () => { Toast.info('Checking...', 'Testing connection'); GitHubAPI.checkConnection().then(ok => { if (ok) Toast.success('Connected', 'GitHub API reachable'); else Toast.error('Disconnected', 'Check your token'); }); });
    document.getElementById('refreshDashboardBtn')?.addEventListener('click', () => { DashboardStats.refresh(); Toast.info('Refreshing', 'Loading data...'); });
    document.getElementById('refreshHistoryBtn')?.addEventListener('click', () => { GitHubAPI.loadHistory(); Toast.info('Refreshing', 'Loading runs...'); });
    document.getElementById('historyFilterStatus')?.addEventListener('change', () => GitHubAPI.loadHistory());

    // Terminal search
    document.getElementById('terminalSearchInput')?.addEventListener('input', e => { const q = e.target.value.toLowerCase(); TerminalLog.body.querySelectorAll('div').forEach(l => { l.style.display = l.textContent.toLowerCase().includes(q) || !q ? '' : 'none'; }); });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (e.key === 'Escape') { document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); CmdPalette.close(); document.getElementById('notifPanel')?.classList.remove('open'); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); CmdPalette.open(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); triggerWorkflow(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); resetForm(); return; }
        if (isInput) return;
        const keys = { 1: 'dashboard', 2: 'run-tests', 3: 'history', 4: 'db-results', 5: 'reports', 6: 'presets', 7: 'activity', 8: 'scheduler', 9: 'settings' };
        if (keys[e.key]) { e.preventDefault(); Router.navigate(keys[e.key]); return; }
        if (e.key === '?') { e.preventDefault(); openModal('shortcutsModal'); }
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); NotifCenter.toggle(); }
        if (e.key === 'L' && e.shiftKey && e.ctrlKey) { e.preventDefault(); AuthManager.logout(); }
    });

    // Initialize Auth
    AuthManager.init();

    // Init fields
    switchPlatformFields('webchat');
    const sOwner = document.getElementById('settingOwner');
    if (sOwner) sOwner.value = CONFIG.owner;
    const sRepo = document.getElementById('settingRepo');
    if (sRepo) sRepo.value = CONFIG.repo;
    const sWorkflow = document.getElementById('settingWorkflow');
    if (sWorkflow) sWorkflow.value = CONFIG.workflow_id;
    const sBranch = document.getElementById('settingBranch');
    if (sBranch) sBranch.value = CONFIG.ref;
    const sBackend = document.getElementById('settingBackendUrl');
    if (sBackend) sBackend.value = localStorage.getItem('acc_backend_url') || '';
    const sToken = document.getElementById('tokenInput');
    if (sToken) sToken.value = CONFIG.token;
    const envInfo = document.getElementById('envInfo');
    if (envInfo) envInfo.innerHTML = `<span class="env-tag"><i class="fas fa-code-branch"></i> ${CONFIG.ref}</span><span class="env-tag"><i class="fas fa-file-code"></i> ${CONFIG.workflow_id}</span><span class="env-tag"><i class="fab fa-github"></i> ${CONFIG.owner}/${CONFIG.repo}</span>`;
    // Sound init
    document.getElementById('soundOnBtn')?.classList.toggle('active', Settings.soundEnabled);
    document.getElementById('soundOffBtn')?.classList.toggle('active', !Settings.soundEnabled);

    ActivityFeed.add('Dashboard Started', 'Command Center initialized', 'system');
    console.log('%c🚀 Automation Command Center v2.0', 'color:#6366f1;font-size:16px;font-weight:bold;');
});
