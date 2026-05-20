const fs = require('fs');
const nodes = ['manual-trigger', 'read-excel', 'playwright-webchat', 'playwright-facebook', 'playwright-instagram', 'telegram', 'ai-evaluate', 'generate-report'];

nodes.forEach(n => {
  const content = fs.readFileSync('ci-dashboard/server/services/nodes/' + n + '-node.js', 'utf8');
  const type = content.match(/type:\s*['"]([^'"]+)['"]/);
  const label = content.match(/label:\s*['"]([^'"]+)['"]/);
  const icon = content.match(/icon:\s*['"]([^'"]+)['"]/);
  const color = content.match(/color:\s*['"]([^'"]+)['"]/);
  
  console.log(`${n} -> type: ${type?type[1]:''}, label: ${label?label[1]:''}, icon: ${icon?icon[1]:''}, color: ${color?color[1]:''}`);
});
