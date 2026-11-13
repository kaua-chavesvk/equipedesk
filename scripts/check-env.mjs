import { environmentProblems } from '../src/lib/security.ts';

const vercelBuild = process.argv.includes('--vercel-build');
if (!vercelBuild || process.env.VERCEL_ENV === 'production') {
  const problems = environmentProblems({ ...process.env, NODE_ENV: 'production' });
  if (problems.length) {
    console.error(JSON.stringify({ status: 'invalid', problems }, null, 2));
    process.exitCode = 1;
  } else {
    console.log('Configuração de produção válida.');
  }
}
