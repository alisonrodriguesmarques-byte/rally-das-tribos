const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'dist');
fs.rmSync(out,{recursive:true,force:true});
fs.cpSync(path.join(root,'frontend/public'),out,{recursive:true});
const vendor=path.join(out,'vendor');fs.mkdirSync(vendor,{recursive:true});
fs.cpSync(path.join(root,'backend/node_modules/chart.js/dist'),vendor,{recursive:true});
console.log('Frontend estático e Chart.js preparados em dist.');
