import fs from 'fs';
import path from 'path';

const files = [
  '00001_initial_schema.sql',
  '00002_rls_policies.sql',
  '00003_rpc_record_sale.sql'
];

let sql = '';
for (const file of files) {
  const content = fs.readFileSync(path.join('supabase/migrations', file), 'utf8');
  sql += '-- Migration: ' + file + '\n\n';
  sql += content + '\n\n';
}

fs.writeFileSync('C:\\Users\\BIAMOU\\.gemini\\antigravity-ide\\brain\\797e469c-0317-42a9-b7a1-a30e7d0c554a\\supabase_migrations.md', '# Mettre en place Supabase\n\nCopie et colle le code ci-dessous dans l\\'**éditeur SQL** de Supabase et clique sur **RUN**.\n\n`sql\n' + sql + '\n`');
