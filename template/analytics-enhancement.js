/**
 * COMPREHENSIVE ANALYTICS ENHANCEMENT
 * All of the Above Implementation
 * 
 * Features:
 * - Phase 1: Quick Wins (Success Badge, Better Legend, Tooltips, Chart Download)
 * - Phase 2: Additional Metrics (Quality Score, Performance Metrics, Comparison)
 * - Phase 3: Chart Type Toggle (Pie/Bar/Donut)
 * - Phase 4: Historical Trends (Trend Charts, Date Filters)
 * - Phase 5: Interactive Features (Drill-down, Export Options)
 * - Phase 6: Advanced Analytics (Distribution, Insights, Recommendations)
 */

// ============================================================================
// PHASE 1: QUICK WINS - SUCCESS BADGE & CELEBRATION
// ============================================================================

function renderSuccessBadge(passRate) {
    const container = document.getElementById('success-badge-container');
    if (!container) return;

    let badgeHTML = '';

    if (passRate >= 95) {
        // Perfect or near-perfect score
        badgeHTML = `
      <div class="success-celebration bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500 rounded-2xl p-6 mb-6 animate-fade-in">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="text-6xl animate-bounce">🎉</div>
            <div>
              <h3 class="text-2xl font-bold text-green-700">Perfect Score!</h3>
              <p class="text-green-600">All tests passed successfully - Outstanding work!</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-5xl font-bold text-green-700">${passRate}%</div>
            <div class="text-sm text-green-600">Pass Rate</div>
          </div>
        </div>
        ${passRate === 100 ? '<div class="mt-4 text-center text-green-600 font-medium">🏆 Flawless Execution! 🏆</div>' : ''}
      </div>
    `;
    } else if (passRate >= 80) {
        // Good score
        badgeHTML = `
      <div class="success-badge bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-500 rounded-2xl p-6 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="text-5xl">✅</div>
            <div>
              <h3 class="text-xl font-bold text-blue-700">Great Job!</h3>
              <p class="text-blue-600">Most tests passed - Keep up the good work!</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-4xl font-bold text-blue-700">${passRate}%</div>
            <div class="text-sm text-blue-600">Pass Rate</div>
          </div>
        </div>
      </div>
    `;
    } else if (passRate >= 60) {
        // Needs improvement
        badgeHTML = `
      <div class="warning-badge bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-500 rounded-2xl p-6 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="text-5xl">⚠️</div>
            <div>
              <h3 class="text-xl font-bold text-yellow-700">Needs Improvement</h3>
              <p class="text-yellow-600">Some tests failed - Review and optimize</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-4xl font-bold text-yellow-700">${passRate}%</div>
            <div class="text-sm text-yellow-600">Pass Rate</div>
          </div>
        </div>
      </div>
    `;
    } else {
        // Critical - needs attention
        badgeHTML = `
      <div class="critical-badge bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-500 rounded-2xl p-6 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="text-5xl">🚨</div>
            <div>
              <h3 class="text-xl font-bold text-red-700">Critical Issues</h3>
              <p class="text-red-600">Many tests failed - Immediate action required</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-4xl font-bold text-red-700">${passRate}%</div>
            <div class="text-sm text-red-600">Pass Rate</div>
          </div>
        </div>
      </div>
    `;
    }

    container.innerHTML = badgeHTML;
}

// ============================================================================
// PHASE 2: ADDITIONAL METRICS - QUALITY SCORE
// ============================================================================

function calculateQualityScore(data) {
    if (!data || data.length === 0) return 0;

    const passedTests = data.filter(item => item.status === 'pass').length;
    const passRate = (passedTests / data.length) * 100;

    // Calculate average score
    const totalScore = data.reduce((sum, item) => sum + (parseFloat(item.skor) || 0), 0);
    const avgScore = (totalScore / data.length) * 100;

    // Calculate speed score (faster is better, max 10 seconds per test = 100%)
    const avgDuration = data.reduce((sum, item) => {
        const seconds = parseDurationToSeconds(item.duration);
        return sum + seconds;
    }, 0) / data.length;

    const speedScore = Math.max(0, 100 - (avgDuration / 10 * 100));

    // Weighted quality score: 40% pass rate, 40% avg score, 20% speed
    const qualityScore = (passRate * 0.4) + (avgScore * 0.4) + (speedScore * 0.2);

    return Math.round(qualityScore);
}

function renderQualityScoreCard(qualityScore) {
    const container = document.getElementById('quality-score-container');
    if (!container) return;

    let color = 'green';
    let icon = '🌟';
    let label = 'Excellent';

    if (qualityScore < 60) {
        color = 'red';
        icon = '⚠️';
        label = 'Poor';
    } else if (qualityScore < 80) {
        color = 'yellow';
        icon = '⭐';
        label = 'Good';
    }

    const html = `
    <div class="bg-primary-themed p-6 rounded-3xl shadow-xl">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-semibold text-content-primary-themed">Quality Score</h3>
        <span class="text-3xl">${icon}</span>
      </div>
      <div class="relative pt-1">
        <div class="flex mb-2 items-center justify-between">
          <div>
            <span class="text-5xl font-bold text-${color}-600">${qualityScore}</span>
            <span class="text-2xl text-content-tertiary-themed">/100</span>
          </div>
          <span class="text-sm font-semibold inline-block py-1 px-2 uppercase rounded-full text-${color}-600 bg-${color}-200">
            ${label}
          </span>
        </div>
        <div class="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-${color}-200">
          <div style="width:${qualityScore}%" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-${color}-500 transition-all duration-500"></div>
        </div>
        <p class="text-xs text-content-tertiary-themed">
          Based on pass rate (40%), avg score (40%), and speed (20%)
        </p>
      </div>
    </div>
  `;

    container.innerHTML = html;
}

// ============================================================================
// PHASE 2: PERFORMANCE METRICS
// ============================================================================

function renderPerformanceMetrics(data) {
    const container = document.getElementById('performance-metrics-container');
    if (!container || !data || data.length === 0) return;

    // Calculate metrics
    const durations = data.map(item => parseDurationToSeconds(item.duration));
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    const testsPerMinute = data.length > 0 ? (60 / avgDuration).toFixed(1) : '0';

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const html = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-primary-themed p-5 rounded-2xl shadow-lg border-l-4 border-blue-500">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-content-secondary-themed">Avg Response Time</p>
            <p class="text-3xl font-bold text-content-primary-themed">${formatTime(avgDuration)}</p>
          </div>
          <div class="text-4xl">⏱️</div>
        </div>
      </div>
      
      <div class="bg-primary-themed p-5 rounded-2xl shadow-lg border-l-4 border-green-500">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-content-secondary-themed">Tests per Minute</p>
            <p class="text-3xl font-bold text-content-primary-themed">${testsPerMinute}</p>
          </div>
          <div class="text-4xl">🚀</div>
        </div>
      </div>
      
      <div class="bg-primary-themed p-5 rounded-2xl shadow-lg border-l-4 border-purple-500">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-content-secondary-themed">Fastest Test</p>
            <p class="text-3xl font-bold text-content-primary-themed">${formatTime(minDuration)}</p>
          </div>
          <div class="text-4xl">⚡</div>
        </div>
      </div>
    </div>
  `;

    container.innerHTML = html;
}

// ============================================================================
// PHASE 3: CHART TYPE TOGGLE
// ============================================================================

let currentChartType = 'pie'; // 'pie', 'bar', 'donut'

function renderChartTypeToggle() {
    const container = document.getElementById('chart-type-toggle-container');
    if (!container) return;

    const html = `
    <div class="flex items-center space-x-2 bg-secondary-themed p-2 rounded-lg">
      <span class="text-sm text-content-secondary-themed font-medium">Chart Type:</span>
      <button onclick="switchChartType('pie')" id="chart-btn-pie" class="chart-type-btn px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentChartType === 'pie' ? 'bg-brand-primary text-white' : 'bg-transparent text-content-tertiary-themed hover:bg-muted-themed'}">
        📊 Pie
      </button>
      <button onclick="switchChartType('bar')" id="chart-btn-bar" class="chart-type-btn px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentChartType === 'bar' ? 'bg-brand-primary text-white' : 'bg-transparent text-content-tertiary-themed hover:bg-muted-themed'}">
        📈 Bar
      </button>
      <button onclick="switchChartType('donut')" id="chart-btn-donut" class="chart-type-btn px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentChartType === 'donut' ? 'bg-brand-primary text-white' : 'bg-transparent text-content-tertiary-themed hover:bg-muted-themed'}">
        🍩 Donut
      </button>
    </div>
  `;

    container.innerHTML = html;
}

function switchChartType(type) {
    currentChartType = type;

    // Update button states
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.classList.remove('bg-brand-primary', 'text-white');
        btn.classList.add('bg-transparent', 'text-content-tertiary-themed');
    });

    const activeBtn = document.getElementById(`chart-btn-${type}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-brand-primary', 'text-white');
        activeBtn.classList.remove('bg-transparent', 'text-content-tertiary-themed');
    }

    // Re-render chart with new type
    // This will be called from the main render function
    window.dispatchEvent(new CustomEvent('chartTypeChanged', { detail: { type } }));
}

window.switchChartType = switchChartType;

// ============================================================================
// PHASE 4: HISTORICAL TRENDS - DATA STORAGE
// ============================================================================

const HISTORY_STORAGE_KEY = 'test_report_history';
const MAX_HISTORY_ITEMS = 30;

function saveTestRunToHistory(summary, results) {
    try {
        const history = getTestHistory();

        const newEntry = {
            id: summary.id_test || Date.now().toString(),
            timestamp: new Date().toISOString(),
            date: summary.date_test,
            tester: summary.tester_name,
            passRate: (summary.success / (summary.success + summary.failed) * 100).toFixed(1),
            totalTests: summary.success + summary.failed,
            passed: summary.success,
            failed: summary.failed,
            avgScore: results.reduce((sum, r) => sum + (parseFloat(r.skor) || 0), 0) / results.length,
            duration: summary.duration
        };

        history.unshift(newEntry);

        // Keep only last MAX_HISTORY_ITEMS
        if (history.length > MAX_HISTORY_ITEMS) {
            history.splice(MAX_HISTORY_ITEMS);
        }

        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
        console.log('✅ Test run saved to history');
    } catch (error) {
        console.error('Failed to save to history:', error);
    }
}

function getTestHistory() {
    try {
        const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Failed to load history:', error);
        return [];
    }
}

// ============================================================================
// PHASE 4: HISTORICAL TREND CHART
// ============================================================================

function renderHistoricalTrendChart() {
    const container = document.getElementById('historical-trend-container');
    if (!container) return;

    const history = getTestHistory();

    if (history.length < 2) {
        container.innerHTML = `
      <div class="bg-primary-themed p-6 rounded-3xl shadow-xl">
        <h3 class="text-xl font-semibold text-content-primary-themed mb-4">📈 Historical Trends</h3>
        <p class="text-content-tertiary-themed text-center py-8">
          Not enough data yet. Run more tests to see trends over time.
        </p>
      </div>
    `;
        return;
    }

    // Prepare data for trend chart (reverse to show oldest first)
    const trendData = history.slice(0, 10).reverse().map((entry, index) => ({
        name: `Run ${index + 1}`,
        passRate: parseFloat(entry.passRate),
        avgScore: (parseFloat(entry.avgScore) * 100).toFixed(1),
        date: new Date(entry.timestamp).toLocaleDateString()
    }));

    const html = `
    <div class="bg-primary-themed p-6 rounded-3xl shadow-xl">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-semibold text-content-primary-themed">📈 Historical Trends</h3>
        <div class="flex items-center space-x-2">
          <button onclick="filterHistory('7days')" class="px-3 py-1 text-sm rounded-md bg-secondary-themed hover:bg-muted-themed">7 Days</button>
          <button onclick="filterHistory('30days')" class="px-3 py-1 text-sm rounded-md bg-secondary-themed hover:bg-muted-themed">30 Days</button>
          <button onclick="filterHistory('all')" class="px-3 py-1 text-sm rounded-md bg-brand-primary text-white">All</button>
        </div>
      </div>
      <div id="trend-chart-container" style="height: 300px;">
        <!-- React chart will be rendered here -->
      </div>
      <div class="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p class="text-sm text-content-tertiary-themed">Best Run</p>
          <p class="text-2xl font-bold text-green-600">${Math.max(...history.map(h => parseFloat(h.passRate)))}%</p>
        </div>
        <div>
          <p class="text-sm text-content-tertiary-themed">Average</p>
          <p class="text-2xl font-bold text-blue-600">${(history.reduce((sum, h) => sum + parseFloat(h.passRate), 0) / history.length).toFixed(1)}%</p>
        </div>
        <div>
          <p class="text-sm text-content-tertiary-themed">Total Runs</p>
          <p class="text-2xl font-bold text-purple-600">${history.length}</p>
        </div>
      </div>
    </div>
  `;

    container.innerHTML = html;

    // Render the actual trend chart using React/Recharts
    // This will be called from main render function
}

// ============================================================================
// PHASE 5: INTERACTIVE FEATURES - DRILL DOWN
// ============================================================================

function enableChartDrillDown() {
    // Add click handlers to chart segments
    window.addEventListener('chartSegmentClick', (event) => {
        const { segment } = event.detail;

        // Filter table based on clicked segment
        if (segment === 'pass') {
            quickFilterStatus('pass');
        } else if (segment === 'failed') {
            quickFilterStatus('failed');
        }

        // Scroll to table
        document.getElementById('data-result-card')?.scrollIntoView({ behavior: 'smooth' });
    });
}

// ============================================================================
// PHASE 6: ADVANCED ANALYTICS - INSIGHTS & RECOMMENDATIONS
// ============================================================================

function generateInsights(data, history) {
    const insights = [];

    if (!data || data.length === 0) return insights;

    const passRate = (data.filter(d => d.status === 'pass').length / data.length * 100);

    // Insight 1: Pass rate trend
    if (history && history.length > 1) {
        const previousPassRate = parseFloat(history[1].passRate);
        const change = passRate - previousPassRate;

        if (change > 5) {
            insights.push({
                type: 'success',
                icon: '📈',
                title: 'Improving Performance',
                message: `Pass rate increased by ${change.toFixed(1)}% compared to previous run`
            });
        } else if (change < -5) {
            insights.push({
                type: 'warning',
                icon: '📉',
                title: 'Performance Decline',
                message: `Pass rate decreased by ${Math.abs(change).toFixed(1)}% compared to previous run`
            });
        }
    }

    // Insight 2: Slow tests
    const slowTests = data.filter(d => parseDurationToSeconds(d.duration) > 15);
    if (slowTests.length > 0) {
        insights.push({
            type: 'info',
            icon: '🐌',
            title: 'Slow Tests Detected',
            message: `${slowTests.length} test(s) took longer than 15 seconds. Consider optimization.`
        });
    }

    // Insight 3: Perfect score
    if (passRate === 100) {
        insights.push({
            type: 'success',
            icon: '🏆',
            title: 'Perfect Score!',
            message: 'All tests passed successfully. Excellent work!'
        });
    }

    // Insight 4: Low scores
    const lowScoreTests = data.filter(d => parseFloat(d.skor) < 0.6);
    if (lowScoreTests.length > 0) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: 'Low Score Tests',
            message: `${lowScoreTests.length} test(s) have scores below 60%. Review these tests.`
        });
    }

    return insights;
}

function renderInsightsPanel(insights) {
    const container = document.getElementById('insights-container');
    if (!container) return;

    if (insights.length === 0) {
        container.innerHTML = '';
        return;
    }

    const colorMap = {
        success: 'green',
        warning: 'yellow',
        info: 'blue',
        error: 'red'
    };

    const html = `
    <div class="bg-primary-themed p-6 rounded-3xl shadow-xl mb-8">
      <h3 class="text-xl font-semibold text-content-primary-themed mb-4">💡 Insights & Recommendations</h3>
      <div class="space-y-3">
        ${insights.map(insight => `
          <div class="flex items-start space-x-3 p-4 rounded-lg bg-${colorMap[insight.type]}-50 border-l-4 border-${colorMap[insight.type]}-500">
            <span class="text-2xl">${insight.icon}</span>
            <div class="flex-1">
              <h4 class="font-semibold text-${colorMap[insight.type]}-700">${insight.title}</h4>
              <p class="text-sm text-${colorMap[insight.type]}-600">${insight.message}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

    container.innerHTML = html;
}

// ============================================================================
// PHASE 6: SCORE DISTRIBUTION CHART
// ============================================================================

function renderScoreDistribution(data) {
    const container = document.getElementById('score-distribution-container');
    if (!container || !data || data.length === 0) return;

    // Create score buckets
    const buckets = {
        '0-20%': 0,
        '21-40%': 0,
        '41-60%': 0,
        '61-80%': 0,
        '81-100%': 0
    };

    data.forEach(item => {
        const score = parseFloat(item.skor) * 100;
        if (score <= 20) buckets['0-20%']++;
        else if (score <= 40) buckets['21-40%']++;
        else if (score <= 60) buckets['41-60%']++;
        else if (score <= 80) buckets['61-80%']++;
        else buckets['81-100%']++;
    });

    const html = `
    <div class="bg-primary-themed p-6 rounded-3xl shadow-xl">
      <h3 class="text-xl font-semibold text-content-primary-themed mb-4">📊 Score Distribution</h3>
      <div id="score-distribution-chart" style="height: 250px;">
        <!-- React chart will be rendered here -->
      </div>
    </div>
  `;

    container.innerHTML = html;

    // Store bucket data for chart rendering
    window.scoreDistributionData = Object.entries(buckets).map(([range, count]) => ({
        range,
        count,
        percentage: ((count / data.length) * 100).toFixed(1)
    }));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseDurationToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split(':');
    if (parts.length === 3) {
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        const seconds = parseInt(parts[2], 10) || 0;
        return (hours * 3600) + (minutes * 60) + seconds;
    } else if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10) || 0;
        const seconds = parseInt(parts[1], 10) || 0;
        return (minutes * 60) + seconds;
    } else if (parts.length === 1) {
        return parseInt(parts[0], 10) || 0;
    }
    return 0;
}

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================

function initializeAnalyticsEnhancements(data, summary) {
    console.log('🚀 Initializing Analytics Enhancements...');

    // Calculate metrics
    const passRate = (summary.success / (summary.success + summary.failed) * 100).toFixed(1);
    const qualityScore = calculateQualityScore(data);
    const history = getTestHistory();
    const insights = generateInsights(data, history);

    // Phase 1: Success Badge
    renderSuccessBadge(parseFloat(passRate));

    // Phase 2: Quality Score & Performance Metrics
    renderQualityScoreCard(qualityScore);
    renderPerformanceMetrics(data);

    // Phase 3: Chart Type Toggle
    renderChartTypeToggle();

    // Phase 4: Historical Trends
    renderHistoricalTrendChart();
    saveTestRunToHistory(summary, data);

    // Phase 5: Interactive Features
    enableChartDrillDown();

    // Phase 6: Advanced Analytics
    renderInsightsPanel(insights);
    renderScoreDistribution(data);

    console.log('✅ Analytics Enhancements Initialized');
}

// Export for use in template
window.initializeAnalyticsEnhancements = initializeAnalyticsEnhancements;
window.renderSuccessBadge = renderSuccessBadge;
window.calculateQualityScore = calculateQualityScore;
window.renderPerformanceMetrics = renderPerformanceMetrics;
window.renderChartTypeToggle = renderChartTypeToggle;
window.renderHistoricalTrendChart = renderHistoricalTrendChart;
window.generateInsights = generateInsights;
window.renderScoreDistribution = renderScoreDistribution;
