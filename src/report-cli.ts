import { generateReportFromLatestTest } from './utils/report-generator';

const openInBrowser = process.argv.includes('--open');

generateReportFromLatestTest(openInBrowser)
  .then(outputFile => {
    if (outputFile) {
      console.log('✅ Report generated successfully');
      process.exit(0);
    } else {
      console.log('❌ Failed to generate report');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
