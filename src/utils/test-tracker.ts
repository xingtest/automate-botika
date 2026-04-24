/**
 * Test Result Tracker
 * Tracks test results, calculates statistics, and manages exit codes
 */

export interface TestResult {
  no: number | string;
  title: string;
  question: string;
  response_kb: string;
  response_llm: string;
  score: number;
  status: 'pass' | 'failed';
  duration: string;
  image_capture: string;
  explanation: string;
}

export interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  failRate: number;
  averageScore: number;
  totalDuration: string;
}

export class TestTracker {
  private results: TestResult[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Add a test result
   */
  addResult(result: TestResult): void {
    this.results.push(result);
  }

  /**
   * Get all results
   */
  getResults(): TestResult[] {
    return [...this.results];
  }

  /**
   * Calculate summary statistics
   */
  getSummary(): TestSummary {
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'failed').length;

    const passRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;
    const failRate = totalTests > 0 ? (failed / totalTests) * 100 : 0;

    const totalScore = this.results.reduce((sum, r) => sum + r.score, 0);
    const averageScore = totalTests > 0 ? totalScore / totalTests : 0;

    const totalDuration = this.calculateTotalDuration();

    return {
      totalTests,
      passed,
      failed,
      passRate: parseFloat(passRate.toFixed(2)),
      failRate: parseFloat(failRate.toFixed(2)),
      averageScore: parseFloat(averageScore.toFixed(3)),
      totalDuration
    };
  }

  /**
   * Print summary to console
   */
  printSummary(): void {
    const summary = this.getSummary();

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests:    ${summary.totalTests}`);
    console.log(`✅ Passed:      ${summary.passed} (${summary.passRate}%)`);
    console.log(`❌ Failed:      ${summary.failed} (${summary.failRate}%)`);
    console.log(`📈 Avg Score:   ${summary.averageScore.toFixed(3)}`);
    console.log(`⏱️  Duration:    ${summary.totalDuration}`);
    console.log('='.repeat(60) + '\n');

    // Print failed tests if any
    if (summary.failed > 0) {
      console.log('❌ FAILED TESTS:');
      console.log('-'.repeat(60));
      this.results
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`  ${r.no}. ${r.title}`);
          console.log(`     Question: ${r.question}`);
          console.log(`     Score: ${r.score.toFixed(3)}`);
          console.log(`     Reason: ${r.explanation}`);
          console.log('');
        });
      console.log('-'.repeat(60) + '\n');
    }
  }

  /**
   * Get appropriate exit code based on results
   * Returns 0 if all tests passed, 1 if any failed
   */
  getExitCode(): number {
    const summary = this.getSummary();
    return summary.failed > 0 ? 1 : 0;
  }

  /**
   * Assert that a test passed
   */
  assertPassed(result: TestResult): void {
    if (result.status !== 'pass') {
      console.warn(`⚠️ Test failed: ${result.title} (Score: ${result.score})`);
    }
  }

  /**
   * Assert minimum pass rate
   */
  assertMinimumPassRate(minimumRate: number): boolean {
    const summary = this.getSummary();
    const passed = summary.passRate >= minimumRate;

    if (!passed) {
      console.error(`❌ Pass rate ${summary.passRate}% is below minimum ${minimumRate}%`);
    }

    return passed;
  }

  /**
   * Calculate total duration
   */
  private calculateTotalDuration(): string {
    const endTime = Date.now();
    const durationMs = endTime - this.startTime;

    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Save results to JSON file
   * Merges with existing summary data to preserve metadata
   */
  saveResults(filepath: string): void {
    const fs = require('fs');
    const path = require('path');

    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Read existing summary data if it exists
    let existingData: any = {};
    if (fs.existsSync(filepath)) {
      try {
        const fileContent = fs.readFileSync(filepath, 'utf-8');
        existingData = JSON.parse(fileContent);
        console.log(`📖 Reading existing summary data from: ${filepath}`);
      } catch (error) {
        console.warn(`⚠️ Could not read existing summary file, creating new one`);
      }
    }

    // Get new summary statistics
    const newSummary = this.getSummary();

    // Merge: preserve existing metadata, update statistics
    const mergedData = {
      // Preserve existing metadata fields (from platform-specific code)
      ...existingData,
      // Update summary statistics (from TestTracker)
      duration: newSummary.totalDuration, // Root level duration for report compatibility
      summary: {
        ...(existingData.summary || {}),
        totalTests: newSummary.totalTests,
        passed: newSummary.passed,
        failed: newSummary.failed,
        passRate: newSummary.passRate,
        failRate: newSummary.failRate,
        averageScore: newSummary.averageScore,
        totalDuration: newSummary.totalDuration
      },
      results: this.results,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(filepath, JSON.stringify(mergedData, null, 2));
    console.log(`💾 Test results saved to: ${filepath}`);
    console.log(`   ✅ Merged with existing metadata`);
  }
}
