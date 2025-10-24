import { generateReportFromLatestTest } from './utils/report-generator';
import { generateExcelReportFromLatest } from './utils/excel-report-generator';

const openInBrowser = process.argv.includes('--open');

async function generateReports() {
  try {
    // Generate HTML report
    const htmlFile = await generateReportFromLatestTest(openInBrowser);
    
    // Generate Excel report
    const excelFile = await generateExcelReportFromLatest();
    
    if (htmlFile || excelFile) {
      console.log('✅ Reports generated successfully');
      if (htmlFile) console.log(`   HTML: ${htmlFile}`);
      if (excelFile) console.log(`   Excel: ${excelFile}`);
      process.exit(0);
    } else {
      console.log('❌ Failed to generate reports');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateReports();
