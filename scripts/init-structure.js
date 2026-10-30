/**
 * Script de inicialização da estrutura de diretórios do projeto
 * Garante que todas as pastas necessárias existam
 */

const fs = require('fs');
const path = require('path');

const directories = [
  'backend/controllers',
  'backend/routes',
  'backend/repositories',
  'backend/database/migrations',
  'backend/middleware',
  'backend/utils',
  'frontend/css',
  'frontend/js',
  'frontend/images',
  'public'
];

const rootDir = path.join(__dirname, '..');

console.log('🚀 Inicializando estrutura de diretórios...');

directories.forEach(dir => {
  const fullPath = path.join(rootDir, dir);
  
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Criado: ${dir}`);
  } else {
    console.log(`⏭️  Já existe: ${dir}`);
  }
});

console.log('\n✨ Estrutura de diretórios inicializada com sucesso!');
