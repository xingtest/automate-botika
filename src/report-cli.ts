import { generateReportFromLatestTest } from './utils/report-generator';
import { generateExcelReportFromLatest } from './utils/excel-report-generator';

const openInBrowser = process.argv.includes('--open');

async function generateReports() {
  try {
    console.log('🚀 Starting report generation...');
    console.log(`📂 Current directory: ${process.cwd()}`);
    console.log(`🔧 Open in browser: ${openInBrowser}`);

    // Generate HTML report
    console.log('\n📊 Generating HTML report...');
    const htmlFile = await generateReportFromLatestTest(openInBrowser);

    // Generate Excel report
    console.log('\n📊 Generating Excel report...');
    const excelFile = await generateExcelReportFromLatest();

    if (htmlFile && excelFile) {
      console.log('\n✅ Reports generated successfully');
      console.log(`   HTML: ${htmlFile}`);
      console.log(`   Excel: ${excelFile}`);
      process.exit(0);
    } else {
      console.log('\n❌ Failed to generate reports');
      console.log('   HTML file: ' + (htmlFile || 'NOT GENERATED'));
      console.log('   Excel file: ' + (excelFile || 'NOT GENERATED'));
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error generating reports:');
    console.error('   Message:', error instanceof Error ? error.message : String(error));
    console.error('   Stack:', error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
}

generateReports();
