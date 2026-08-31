import fs from 'fs';
const sql = fs.readFileSync('combined.sql', 'utf8');
const mdContent = # Mettre en place Supabase\n\nCopie et colle le code ci-dessous dans l'éditeur SQL de ton tableau de bord Supabase et clique sur **Run**.\n\n\\\sql\n + sql + \n\\\\n;
fs.writeFileSync('C:/Users/BIAMOU/.gemini/antigravity-ide/brain/797e469c-0317-42a9-b7a1-a30e7d0c554a/supabase_setup.md', mdContent);
