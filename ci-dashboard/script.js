// ===== AUTOMATION COMMAND CENTER v2.0 =====
const CONFIG = (() => {
    const s = JSON.parse(localStorage.getItem('acc_config') || '{}');
    return { owner: s.owner || 'katanyaaman', repo: s.repo || 'automationtestingjudges', workflow_id: s.workflow_id || 'test-reports.yml', ref: s.ref || 'main' };
})();

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
    },
    toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
    get() { return document.documentElement.getAttribute('data-theme'); }
};

// ===== ROUTER =====
const Router = {
    pages: ['dashboard', 'run-tests', 'history', 'reports', 'presets', 'activity', 'scheduler', 'settings'],
    titles: { dashboard: 'Dashboard', 'run-tests': 'Run Tests', history: 'Run History', reports: 'Reports', presets: 'Presets', activity: 'Activity Feed', scheduler: 'Scheduler', settings: 'Settings' },
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
        if (page === 'presets') PresetManager.render();
        if (page === 'activity') ActivityFeed.render();
        if (page === 'scheduler') Scheduler.render();
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
    getToken() { return document.getElementById('tokenInput')?.value?.trim() || ''; },
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
        if (!this.getToken()) { c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-8);"><i class="fas fa-key" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:var(--sp-4);"></i><p>Enter token in Run Tests to view</p></div>'; return; }
        c.innerHTML = '<div class="skeleton skeleton-card mb-4"></div><div class="skeleton skeleton-card mb-4"></div><div class="skeleton skeleton-card"></div>';
        let runs = await this.getRuns();
        const filter = document.getElementById('historyFilterStatus')?.value;
        if (filter && filter !== 'all') runs = runs.filter(r => (r.conclusion || r.status) === filter);
        if (!runs.length) { c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-8);"><p>No runs found</p></div>'; return; }
        const badge = document.getElementById('historyBadge'); if (badge) badge.textContent = runs.length;
        const pinned = JSON.parse(localStorage.getItem('acc_pinned') || '[]');
        c.innerHTML = `<table class="runs-table"><thead><tr><th></th><th>Run</th><th>Status</th><th>Branch</th><th>Trigger</th><th>Started</th><th>Duration</th><th></th></tr></thead><tbody>${runs.map(r => this.renderRow(r, pinned)).join('')}</tbody></table>`;
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
        if (!GitHubAPI.getToken()) { this.setEmpty(); return; }
        try {
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
        } catch { this.setEmpty(); }
    },
    setEmpty() { ['statTotalRuns', 'statSuccessRate', 'statLastRun'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '—'; }); document.getElementById('recentRunsList').innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-6);"><p class="text-sm">Enter token to view stats</p></div>'; },
    renderRecent(runs) {
        const c = document.getElementById('recentRunsList'); if (!c || !runs.length) return;
        const colors = { success: 'var(--success)', failure: 'var(--error)', in_progress: 'var(--running)', queued: 'var(--queued)' };
        c.innerHTML = runs.map(r => { const st = r.conclusion || r.status; return `<div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) 0;border-bottom:1px solid var(--border-color);"><div style="width:8px;height:8px;border-radius:50%;background:${colors[st] || 'var(--text-muted)'};flex-shrink:0;"></div><div style="flex:1;"><div style="font-size:0.85rem;font-weight:600;">#${r.run_number}</div><div style="font-size:0.72rem;color:var(--text-muted);">${r.event} • ${GitHubAPI.timeAgo(new Date(r.created_at))}</div></div><a href="${r.html_url}" target="_blank" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.7rem;"><i class="fas fa-external-link-alt"></i></a></div>`; }).join('');
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
    getAll() { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); },
    add(title, msg, type = 'info') {
        const notifs = this.getAll();
        notifs.unshift({ id: Date.now(), title, msg, type, time: new Date().toISOString(), read: false });
        if (notifs.length > 50) notifs.length = 50;
        localStorage.setItem(this.KEY, JSON.stringify(notifs));
        this.updateDot(); this.renderPanel();
    },
    clear() { localStorage.removeItem(this.KEY); this.updateDot(); this.renderPanel(); },
    updateDot() { const dot = document.getElementById('notifDot'); const unread = this.getAll().filter(n => !n.read).length; if (dot) dot.classList.toggle('hidden', unread === 0); },
    renderPanel() {
        const body = document.getElementById('notifPanelBody'); if (!body) return;
        const notifs = this.getAll();
        if (!notifs.length) { body.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>No notifications</p></div>'; return; }
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle', dispatch: 'fa-play' };
        const colors = { success: 'color:var(--success)', error: 'color:var(--error)', warning: 'color:var(--warning)', info: 'color:var(--info)', dispatch: 'color:var(--accent)' };
        body.innerHTML = notifs.slice(0, 20).map(n => `<div class="notif-item ${n.read ? '' : 'unread'}"><div class="notif-item-icon" style="${colors[n.type] || ''}"><i class="fas ${icons[n.type] || icons.info}"></i></div><div class="notif-item-body"><div class="notif-item-title">${n.title}</div><div class="notif-item-msg">${n.msg}</div><div class="notif-item-time">${GitHubAPI.timeAgo(new Date(n.time))}</div></div></div>`).join('');
        // Mark all as read
        const updated = this.getAll().map(n => ({ ...n, read: true }));
        localStorage.setItem(this.KEY, JSON.stringify(updated));
    },
    toggle() { const p = document.getElementById('notifPanel'); p?.classList.toggle('open'); if (p?.classList.contains('open')) { this.renderPanel(); setTimeout(() => this.updateDot(), 500); } }
};

// ===== ACTIVITY FEED =====
const ActivityFeed = {
    KEY: 'acc_activity',
    getAll() { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); },
    add(title, desc, type = 'system') {
        const items = this.getAll();
        items.unshift({ id: Date.now(), title, desc, type, time: new Date().toISOString() });
        if (items.length > 100) items.length = 100;
        localStorage.setItem(this.KEY, JSON.stringify(items));
    },
    clear() { localStorage.removeItem(this.KEY); this.render(); },
    render() {
        const c = document.getElementById('activityTimeline'); if (!c) return;
        const items = this.getAll();
        if (!items.length) { c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-8);"><i class="fas fa-stream" style="font-size:2rem;opacity:0.2;display:block;margin-bottom:var(--sp-4);"></i><p>No activity yet</p></div>'; return; }
        c.innerHTML = items.slice(0, 50).map(a => `<div class="activity-item"><div class="activity-icon ${a.type}"><i class="fas fa-${a.type === 'dispatch' ? 'play' : a.type === 'success' ? 'check' : a.type === 'error' ? 'times' : a.type === 'config' ? 'cog' : 'info-circle'}"></i></div><div class="activity-body"><div class="activity-title">${a.title}</div><div class="activity-desc">${a.desc}</div><div class="activity-time">${GitHubAPI.timeAgo(new Date(a.time))}</div></div></div>`).join('');
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
        document.getElementById('cmdPaletteOverlay')?.classList.add('open');
        const inp = document.getElementById('cmdPaletteInput'); inp.value = ''; inp.focus();
        this.filter('');
    },
    close() { document.getElementById('cmdPaletteOverlay')?.classList.remove('open'); },
    filter(q) {
        const results = document.getElementById('cmdPaletteResults');
        const filtered = q ? this.commands.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : this.commands;
        results.innerHTML = filtered.map((c, i) => `<div class="cmd-result ${i === 0 ? 'selected' : ''}" data-idx="${i}" onclick="CmdPalette.commands.find(x=>x.name==='${c.name}').action()"><i class="fas ${c.icon}"></i><span>${c.name}</span>${c.hint ? `<span class="cmd-result-hint">${c.hint}</span>` : ''}</div>`).join('');
    }
};

// ===== PRESET MANAGER =====
const PresetManager = {
    KEY: 'acc_presets',
    getAll() { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); },
    save(name, color = '#6366f1') {
        const presets = this.getAll();
        const preset = { id: Date.now(), name, color, platform: document.getElementById('platformSelect').value, filename: document.getElementById('filenameInput').value, testerName: document.getElementById('testerNameInput').value, greeting: document.getElementById('greetingInput').value, webchatUrl: document.getElementById('webchatUrlInput').value, telegramBot: document.getElementById('telegramBotInput').value, instagramUser: document.getElementById('instagramUrlInput').value, facebookId: document.getElementById('facebookUrlInput').value, dhaiUrl: document.getElementById('dhaiUrlInput').value, dhaiWakeWord: document.getElementById('dhaiWakeWordInput')?.value || '', createdAt: new Date().toISOString() };
        presets.push(preset); localStorage.setItem(this.KEY, JSON.stringify(presets));
        Toast.success('Saved', `"${name}" preset saved`); ActivityFeed.add('Preset Saved', `Saved "${name}" for ${preset.platform}`, 'config'); this.render();
    },
    delete(id) { let p = this.getAll().filter(x => x.id !== id); localStorage.setItem(this.KEY, JSON.stringify(p)); Toast.info('Deleted', 'Preset removed'); this.render(); },
    load(id) {
        const p = this.getAll().find(x => x.id === id); if (!p) return;
        document.getElementById('platformSelect').value = p.platform;
        document.getElementById('filenameInput').value = p.filename || 'testing';
        document.getElementById('testerNameInput').value = p.testerName || 'GitHub Actions Bot';
        document.getElementById('greetingInput').value = p.greeting || 'Haloo';
        document.getElementById('webchatUrlInput').value = p.webchatUrl || '';
        document.getElementById('telegramBotInput').value = p.telegramBot || '';
        document.getElementById('instagramUrlInput').value = p.instagramUser || '';
        document.getElementById('facebookUrlInput').value = p.facebookId || '';
        document.getElementById('dhaiUrlInput').value = p.dhaiUrl || '';
        if (document.getElementById('dhaiWakeWordInput')) document.getElementById('dhaiWakeWordInput').value = p.dhaiWakeWord || '';
        switchPlatformFields(p.platform); Toast.success('Loaded', `"${p.name}" applied`); Router.navigate('run-tests');
    },
    render() {
        const grid = document.getElementById('presetGrid'); if (!grid) return;
        const presets = this.getAll();
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
    getAll() { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); },
    save(s) { const all = this.getAll(); all.push(s); localStorage.setItem(this.KEY, JSON.stringify(all)); },
    delete(id) { localStorage.setItem(this.KEY, JSON.stringify(this.getAll().filter(x => x.id !== id))); if (this.timers[id]) { clearInterval(this.timers[id]); delete this.timers[id]; } this.render(); },
    togglePause(id) { const all = this.getAll(); const s = all.find(x => x.id === id); if (!s) return; s.paused = !s.paused; localStorage.setItem(this.KEY, JSON.stringify(all)); if (s.paused && this.timers[id]) { clearInterval(this.timers[id]); delete this.timers[id]; } else if (!s.paused) { this.startTimer(s); } this.render(); },
    startTimer(s) {
        if (this.timers[s.id]) clearInterval(this.timers[s.id]);
        this.timers[s.id] = setInterval(() => {
            if (s.presetId) { PresetManager.load(s.presetId); }
            Toast.info('Scheduled Run', `Running "${s.name}"`);
            ActivityFeed.add('Scheduled Run', `Auto-triggered "${s.name}"`, 'dispatch');
            triggerWorkflow();
        }, s.interval * 60000);
    },
    startAll() { this.getAll().filter(s => !s.paused).forEach(s => this.startTimer(s)); },
    add(name, interval, presetId) {
        const s = { id: Date.now(), name, interval: parseInt(interval), presetId: presetId || null, paused: false, createdAt: new Date().toISOString() };
        this.save(s); this.startTimer(s); Toast.success('Scheduled', `"${name}" will run every ${interval} min`); ActivityFeed.add('Schedule Created', `"${name}" every ${interval}min`, 'config'); this.render();
    },
    render() {
        const c = document.getElementById('scheduleList'); if (!c) return;
        const all = this.getAll();
        if (!all.length) { c.innerHTML = '<div class="text-center text-muted" style="padding:var(--sp-8);"><i class="fas fa-calendar-alt" style="font-size:2rem;opacity:0.2;display:block;margin-bottom:var(--sp-4);"></i><p>No scheduled runs</p></div>'; return; }
        c.innerHTML = all.map(s => `<div class="schedule-item"><div class="schedule-icon"><i class="fas fa-calendar-check"></i></div><div class="schedule-info"><div class="schedule-name">${esc(s.name)}</div><div class="schedule-detail">Every ${s.interval} min${s.presetId ? ' • Uses preset' : ' • Current config'}</div></div><span class="schedule-status ${s.paused ? 'paused' : 'active'}">${s.paused ? 'Paused' : 'Active'}</span><button class="btn btn-sm btn-ghost" onclick="Scheduler.togglePause(${s.id})"><i class="fas fa-${s.paused ? 'play' : 'pause'}"></i></button><button class="btn btn-sm btn-ghost" onclick="Scheduler.delete(${s.id})" style="color:var(--error);"><i class="fas fa-trash"></i></button></div>`).join('');
    }
};

// ===== SETTINGS =====
const Settings = {
    soundEnabled: JSON.parse(localStorage.getItem('acc_sound') || 'true'),
    setSound(on) { this.soundEnabled = on; localStorage.setItem('acc_sound', JSON.stringify(on)); document.getElementById('soundOnBtn')?.classList.toggle('active', on); document.getElementById('soundOffBtn')?.classList.toggle('active', !on); Toast.info('Sound', on ? 'Sound alerts on' : 'Sound alerts off'); },
    updateStorageUsed() { const used = new Blob(Object.values(localStorage)).size; document.getElementById('storageUsed').textContent = `${(used / 1024).toFixed(1)} KB`; }
};

// ===== FORM LOGIC =====
let uploadedFile = null, runMode = 'single';
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function setRunMode(m) { runMode = m; document.getElementById('modeSingleBtn').classList.toggle('active', m === 'single'); document.getElementById('modeBatchBtn').classList.toggle('active', m === 'batch'); document.getElementById('singlePlatformGroup').classList.toggle('hidden', m === 'batch'); document.getElementById('batchPlatformGroup').classList.toggle('hidden', m === 'single'); if (m === 'batch') { updateBatchPlatformFields(); } else { switchPlatformFields(document.getElementById('platformSelect').value); } }
function switchPlatformFields(p) { document.querySelectorAll('.platform-field').forEach(f => f.classList.remove('active')); document.getElementById(`field-${p}`)?.classList.add('active'); }
function updateBatchPlatformFields() { document.querySelectorAll('.platform-field').forEach(f => f.classList.remove('active')); document.querySelectorAll('.platform-check input:checked').forEach(cb => { const field = document.getElementById(`field-${cb.value}`); if (field) field.classList.add('active'); }); }
function clearFile(e) { if (e) e.stopPropagation(); uploadedFile = null; document.getElementById('fileUpload').value = ''; document.getElementById('fileDropText').innerHTML = 'Drag & drop or <strong>click to browse</strong>'; document.getElementById('fileDropZone').classList.remove('has-file'); document.getElementById('fileClearBtn').classList.add('hidden'); document.getElementById('filenameGroup').style.display = ''; document.getElementById('dataPreviewGroup')?.classList.add('hidden'); }
function getFormData() { const p = document.getElementById('platformSelect').value; return { SELECTED_PLATFORM: p, FILENAME: uploadedFile ? uploadedFile.name : (document.getElementById('filenameInput').value + '.xlsx' || 'testing.xlsx'), TESTER_NAME: document.getElementById('testerNameInput').value || 'GitHub Actions Bot', GREETING: document.getElementById('greetingInput').value || 'Haloo', WEBCHAT_URL: document.getElementById('webchatUrlInput').value || 'https://chat.botika.online/tpUyiey', DHAI_TARGET_URL: document.getElementById('dhaiUrlInput').value || '', DHAI_WAKE_WORD: document.getElementById('dhaiWakeWordInput')?.value || 'halo luna', INSTAGRAM_USERNAME: document.getElementById('instagramUrlInput').value || '', FACEBOOK_FANPAGE_ID: document.getElementById('facebookUrlInput').value || '', TELEGRAM_BOT_USERNAME: document.getElementById('telegramBotInput').value || '' }; }
function resetForm() {
    document.getElementById('platformSelect').value = 'webchat'; switchPlatformFields('webchat');
    document.getElementById('tokenInput').value = ''; document.getElementById('tokenInput').type = 'password';
    ['filenameInput', 'testerNameInput', 'greetingInput'].forEach((id, i) => { document.getElementById(id).value = ['testing', 'GitHub Actions Bot', 'Haloo'][i]; });
    document.getElementById('webchatUrlInput').value = 'https://chat.botika.online/tpUyiey';
    ['telegramBotInput', 'instagramUrlInput', 'facebookUrlInput', 'dhaiUrlInput'].forEach(id => { document.getElementById(id).value = ''; });
    if (document.getElementById('dhaiWakeWordInput')) document.getElementById('dhaiWakeWordInput').value = '';
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

    // Sidebar
    document.getElementById('sidebarToggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('collapsed'));
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => { document.getElementById('sidebar')?.classList.toggle('mobile-open'); document.getElementById('mobileOverlay')?.classList.toggle('show'); });
    document.getElementById('mobileOverlay')?.addEventListener('click', () => { document.getElementById('sidebar')?.classList.remove('mobile-open'); document.getElementById('mobileOverlay')?.classList.remove('show'); });

    // Theme
    document.getElementById('themeToggle')?.addEventListener('click', () => ThemeManager.toggle());

    // Platform
    document.getElementById('platformSelect')?.addEventListener('change', e => switchPlatformFields(e.target.value));
    document.querySelectorAll('.platform-check input').forEach(cb => cb.addEventListener('change', () => { cb.closest('.platform-check').classList.toggle('checked', cb.checked); if (runMode === 'batch') updateBatchPlatformFields(); }));

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
        const sel = document.getElementById('schedulePresetInput'); sel.innerHTML = '<option value="">— Current Config —</option>';
        PresetManager.getAll().forEach(p => { sel.innerHTML += `<option value="${p.id}">${p.name}</option>`; });
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
        CONFIG.owner = document.getElementById('settingOwner').value.trim(); CONFIG.repo = document.getElementById('settingRepo').value.trim();
        CONFIG.workflow_id = document.getElementById('settingWorkflow').value.trim(); CONFIG.ref = document.getElementById('settingBranch').value.trim();
        localStorage.setItem('acc_config', JSON.stringify(CONFIG));
        document.getElementById('envInfo').innerHTML = `<span class="env-tag"><i class="fas fa-code-branch"></i> ${CONFIG.ref}</span><span class="env-tag"><i class="fas fa-file-code"></i> ${CONFIG.workflow_id}</span><span class="env-tag"><i class="fab fa-github"></i> ${CONFIG.owner}/${CONFIG.repo}</span>`;
        Toast.success('Saved', 'Settings updated'); ActivityFeed.add('Settings Updated', `${CONFIG.owner}/${CONFIG.repo}`, 'config'); Settings.updateStorageUsed();
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
        const keys = { 1: 'dashboard', 2: 'run-tests', 3: 'history', 4: 'reports', 5: 'presets', 6: 'activity', 7: 'scheduler', 8: 'settings' };
        if (keys[e.key]) { e.preventDefault(); Router.navigate(keys[e.key]); return; }
        if (e.key === '?') { e.preventDefault(); openModal('shortcutsModal'); }
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); NotifCenter.toggle(); }
    });

    // Init fields
    switchPlatformFields('webchat');
    document.getElementById('settingOwner').value = CONFIG.owner; document.getElementById('settingRepo').value = CONFIG.repo;
    document.getElementById('settingWorkflow').value = CONFIG.workflow_id; document.getElementById('settingBranch').value = CONFIG.ref;
    document.getElementById('envInfo').innerHTML = `<span class="env-tag"><i class="fas fa-code-branch"></i> ${CONFIG.ref}</span><span class="env-tag"><i class="fas fa-file-code"></i> ${CONFIG.workflow_id}</span><span class="env-tag"><i class="fab fa-github"></i> ${CONFIG.owner}/${CONFIG.repo}</span>`;
    // Sound init
    document.getElementById('soundOnBtn')?.classList.toggle('active', Settings.soundEnabled);
    document.getElementById('soundOffBtn')?.classList.toggle('active', !Settings.soundEnabled);

    ActivityFeed.add('Dashboard Started', 'Command Center initialized', 'system');
    console.log('%c🚀 Automation Command Center v2.0', 'color:#6366f1;font-size:16px;font-weight:bold;');
});
