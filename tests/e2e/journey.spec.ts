import { test, expect } from '@playwright/test';

test.beforeEach(async ({request,context}) => {
  await request.post('/api/consentimento/cookies',{data:{optional:false}});
  const response=await request.post('/api/auth',{data:{action:'demo'}});
  expect(response.ok()).toBeTruthy();
  await context.addCookies((await request.storageState()).cookies);
});

test('abre, comenta, assume, resolve e reabre um chamado', async ({page},testInfo) => {
  const title=`Acesso ao projeto ${Date.now()}`;
  await page.goto('/e/aurora');
  await expect(page.getByRole('heading',{name:/Olá, Marina/})).toBeVisible();
  await page.screenshot({path:`artifacts/dashboard-${testInfo.project.name}.png`,fullPage:true,caret:'initial'});
  await page.getByRole('button',{name:'Novo chamado',exact:true}).click();
  await page.getByLabel('Título do chamado').fill(title);
  await page.getByLabel('Descrição',{exact:true}).fill('Preciso de acesso ao projeto para continuar o atendimento da equipe.');
  await page.getByRole('button',{name:'Abrir chamado',exact:true}).click();
  await page.getByRole('link',{name:`Abrir ${title}`,exact:true}).click();
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await page.getByLabel('Escreva uma mensagem').fill('Confirmei os dados da solicitação.');
  await page.getByRole('button',{name:'Enviar mensagem'}).click();
  await expect(page.getByText('Confirmei os dados da solicitação.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Assumir chamado'}).click();
  await expect(page.getByRole('button',{name:'Resolver chamado'})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Resolver chamado'}).click();
  await expect(page.getByRole('button',{name:'Reabrir chamado'})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept('O acesso continua indisponível.'));
  await page.getByRole('button',{name:'Reabrir chamado'}).click();
  await expect(page.getByRole('button',{name:'Assumir chamado'})).toBeVisible();
});

test('recusa leitura, comentário e transição por ID de outra empresa', async ({request}) => {
  const created=await request.post('/api/empresas/aurora/chamados',{data:{title:'Privado da Aurora',description:'Este chamado pertence exclusivamente à empresa Aurora.',priority:'medium'}});
  expect(created.status()).toBe(201);
  const ticket=await created.json();
  const before=await request.get(`/api/empresas/aurora/chamados/${ticket.id}`);
  const history=await before.json();
  expect((await request.get(`/api/empresas/orbita/chamados/${ticket.id}`)).status()).toBe(404);
  expect((await request.post(`/api/empresas/orbita/chamados/${ticket.id}/comentarios`,{data:{body:'Tentativa externa'}})).status()).toBe(404);
  expect((await request.post(`/api/empresas/orbita/chamados/${ticket.id}/transicoes`,{data:{action:'assign',version:1}})).status()).toBe(404);
  const after=await (await request.get(`/api/empresas/aurora/chamados/${ticket.id}`)).json();
  expect(after.events).toEqual(history.events);
  expect(after.comments).toEqual(history.comments);
});

test('disputa pela mesma versão tem um vencedor e um evento', async ({request}) => {
  const created=await request.post('/api/empresas/aurora/chamados',{data:{title:'Disputa de atendimento',description:'Chamado para verificar atualização condicional por versão.',priority:'high'}});
  const ticket=await created.json();
  const responses=await Promise.all([1,2].map(()=>request.post(`/api/empresas/aurora/chamados/${ticket.id}/transicoes`,{data:{action:'assign',version:1}})));
  expect(responses.map(r=>r.status()).sort()).toEqual([200,409]);
  const result=await (await request.get(`/api/empresas/aurora/chamados/${ticket.id}`)).json();
  expect(result.ticket.version).toBe(2);
  expect(result.events).toHaveLength(2);
});

test('busca vazia e formulário de login são acessíveis', async ({page}) => {
  await page.goto('/e/aurora/chamados');
  await page.getByRole('textbox',{name:'Buscar chamados'}).fill('nenhum-resultado-xyz');
  await expect(page.getByRole('heading',{name:'Nenhum chamado por aqui.'})).toBeVisible();
  await page.goto('/login');
  await expect(page.getByLabel('E-mail',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Senha',{exact:true})).toBeVisible();
});

test('papel solicitante e contagens acompanham a empresa ativa', async ({request}) => {
  const created=await request.post('/api/empresas/orbita/chamados',{data:{title:'Meu chamado na Órbita',description:'Solicitação de teste para verificar o papel diferente por empresa.',priority:'low'}});
  expect(created.status()).toBe(201);
  const ticket=await created.json();
  const attempt=await request.post(`/api/empresas/orbita/chamados/${ticket.id}/transicoes`,{data:{action:'assign',version:1}});
  expect(attempt.status(),await attempt.text()).toBe(403);
  const queue=await (await request.get('/api/empresas/orbita/chamados?pageSize=50')).json();
  const counts=await (await request.get('/api/empresas/orbita/painel')).json();
  expect(counts.total).toBe(queue.total);
  expect(counts.open+counts.in_progress+counts.resolved).toBe(queue.total);
  expect(queue.data.every((item:{requester_id:string})=>item.requester_id===ticket.requester_id)).toBe(true);
  const after=await (await request.get(`/api/empresas/orbita/chamados/${ticket.id}`)).json();
  expect(after.events).toHaveLength(1);
});

test('protege último administrador e rejeita autoria ou empresa no corpo', async ({request}) => {
  const members=await (await request.get('/api/empresas/aurora/membros')).json();
  const administrator=members.data.find((member:{role:string})=>member.role==='admin');
  expect((await request.patch(`/api/empresas/aurora/membros/${administrator.user_id}`,{data:{role:'requester'}})).status()).toBe(409);
  expect((await request.delete(`/api/empresas/aurora/membros/${administrator.user_id}`)).status()).toBe(409);
  const attack=await request.post('/api/empresas/aurora/chamados',{data:{title:'Autor manipulado',description:'Tentativa de escolher um autor diferente no corpo.',priority:'medium',requester_id:'33333333-3333-4333-8333-333333333333',organization_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}});
  expect(attack.status()).toBe(422);
});

test('aceite de convite abre a empresa retornada pela API', async ({page}) => {
  await page.route('**/api/convites/aceitar', route => route.fulfill({
    json: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', slug: 'orbita' },
  }));
  await page.goto(`/convite/${'a'.repeat(64)}`);
  await page.getByRole('button', { name: 'Aceitar convite', exact: true }).click();
  await expect(page).toHaveURL(/\/e\/orbita$/);
  await expect(page.locator('.workspace-switch')).toContainText('Órbita Tecnologia');
});

test('aceite de convite mostra o erro da API e permite tentar novamente', async ({page}) => {
  let attempts = 0;
  await page.route('**/api/convites/aceitar', route => {
    attempts++;
    return route.fulfill(attempts === 1
      ? { status: 409, json: { error: 'Convite expirado ou já utilizado.' } }
      : { json: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', slug: 'aurora' } });
  });
  await page.goto(`/convite/${'a'.repeat(64)}`);
  await page.getByRole('button', { name: 'Aceitar convite', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Convite expirado ou já utilizado.');
  await expect(page.getByRole('main').getByRole('alert')).toBeFocused();
  await page.getByRole('button', { name: 'Aceitar convite', exact: true }).click();
  await expect(page).toHaveURL(/\/e\/aurora$/);
});

test('falha ao carregar conversa mostra erro e permite recarregar', async ({page}) => {
  const id = '00000000-0000-4000-8000-000000000001';
  let failed = true;
  await page.route(`**/api/empresas/aurora/chamados/${id}`, route => failed
    ? route.fulfill({ status: 500, json: { error: 'Não foi possível carregar a conversa. Tente novamente.' } })
    : route.continue());
  await page.goto(`/e/aurora/chamados/${id}`);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Não foi possível carregar a conversa.');
  failed = false;
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith(`/api/empresas/aurora/chamados/${id}`)),
    page.getByRole('button', { name: 'Carregar conversa completa' }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar mensagem' })).toBeVisible();
});

test('autenticação incompleta e reabertura inválida retornam 422', async ({request}) => {
  for (const payload of [
    { action: 'login', email: 'marina@example.com' },
    { action: 'signup', password: 'senha-segura' },
    { action: 'recover' },
    { action: 'update_password' },
  ]) {
    expect((await request.post('/api/auth', { data: payload })).status()).toBe(422);
  }
  const created = await request.post('/api/empresas/aurora/chamados', { data: {
    title: 'Limites de reabertura', description: 'Chamado para verificar os limites do motivo de reabertura.',
  } });
  const ticket = await created.json();
  const url = `/api/empresas/aurora/chamados/${ticket.id}/transicoes`;
  expect((await request.post(url, { data: { action: 'assign', version: 1 } })).status()).toBe(200);
  expect((await request.post(url, { data: { action: 'resolve', version: 2 } })).status()).toBe(200);
  for (const reason of ['ab', 'a'.repeat(1001)]) {
    expect((await request.post(url, { data: { action: 'reopen', version: 3, reason } })).status()).toBe(422);
  }
  const before = await (await request.get(`/api/empresas/aurora/chamados/${ticket.id}`)).json();
  expect(before.ticket.version).toBe(3);
  expect(before.events).toHaveLength(3);
  expect((await request.post(url, { data: { action: 'reopen', version: 3, reason: 'a'.repeat(1000) } })).status()).toBe(200);
});

test('pagina no servidor, preserva busca na URL e abre detalhe fora da página', async ({page,request}) => {
  const first=await (await request.get('/api/empresas/aurora/chamados?pageSize=6')).json();
  const second=await (await request.get('/api/empresas/aurora/chamados?pageSize=6&page=2')).json();
  expect(first.data).toHaveLength(6);
  expect(second.data).toHaveLength(first.total-6);
  expect(second.data.every((t:{id:string})=>!first.data.some((a:{id:string})=>a.id===t.id))).toBe(true);
  await page.goto('/e/aurora/chamados?page=2');
  await expect(page.locator('tbody tr')).toHaveCount(second.data.length);
  await page.getByRole('textbox',{name:'Buscar chamados'}).fill('Notebook');
  await expect(page).toHaveURL(/q=Notebook/);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('textbox',{name:'Buscar chamados'})).toHaveValue('Notebook');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.goto(`/e/aurora/chamados/${first.data[0].id}?page=2&q=inexistente`);
  await expect(page.getByRole('heading',{name:first.data[0].title,exact:true})).toBeVisible();
  expect((await request.get('/api/empresas/aurora/chamados?status=invalid')).status()).toBe(422);
});

test('aplica cabeçalhos, bloqueia CSRF, uploads e arquivos privados',async({request})=>{
 const page=await request.get('/login');
 expect(page.headers()['x-frame-options']).toBe('DENY');
 expect(page.headers()['x-content-type-options']).toBe('nosniff');
 expect(page.headers()['referrer-policy']).toBe('no-referrer');
 expect(page.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
 expect((await request.post('/api/auth',{headers:{origin:'https://evil.example'},data:{action:'demo'}})).status()).toBe(403);
 expect((await request.post('/api/auth',{headers:{'content-type':'multipart/form-data; boundary=test'},data:'--test'})).status()).toBe(415);
 expect((await request.post('/api/auth',{headers:{'content-type':'application/json'},data:Buffer.from('{')})).status()).toBe(400);
 expect((await request.post('/api/auth',{data:{action:'demo',padding:'x'.repeat(33000)}})).status()).toBe(413);
 for(const path of ['/.env','/.git/config','/database.sql','/app.js.map'])expect((await request.get(path)).status()).toBe(404);
});

test('renderiza conteúdo malicioso como texto e bloqueia script sem nonce',async({page,request})=>{
 const title='<img src=x onerror=window.xssExecuted=true>';
 const created=await request.post('/api/empresas/aurora/chamados',{data:{title,description:'Descrição de teste de escape de HTML e proteção XSS.'}});
 expect(created.status()).toBe(201);
 const ticket=await created.json();
 await page.route(`**/e/aurora/chamados/${ticket.id}`,async route=>{
  const response=await route.fetch();
  const html=await response.text();
  await route.fulfill({response,body:html.replace('</head>','<script>window.xssExecuted=true</script></head>')});
 });
 await page.goto(`/e/aurora/chamados/${ticket.id}`);
 await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Boolean((window as Window & {xssExecuted?:boolean}).xssExecuted))).toBe(false);
});

test('login oferece política de privacidade sem pedir escolha de cookies inexistentes', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Privacidade', exact: true })).toHaveAttribute('href', '/privacidade');
  await expect(page.getByRole('button', { name: 'Permitir opcionais' })).toHaveCount(0);
  expect((await context.cookies()).some(cookie => cookie.name === 'desk_cookie_choice')).toBe(false);
});

test('cadastro exige termos e maioridade com marketing separado e desmarcado',async({page,request})=>{
 expect((await request.post('/api/auth',{data:{action:'signup',email:'test@example.com',password:'example-password'}})).status()).toBe(422);
 let submitted:Record<string,unknown>|undefined;
 await page.route('**/api/auth',async route=>{submitted=route.request().postDataJSON();await route.fulfill({json:{message:'Confira seu e-mail.'}});});
 await page.goto('/cadastro');
 await page.getByLabel('E-mail',{exact:true}).fill('test@example.com');
 await page.getByLabel('Senha',{exact:true}).fill('example-password');
 const marketing=page.getByRole('checkbox',{name:/Quero receber comunicações/});await expect(marketing).not.toBeChecked();
 expect(await page.locator('form').evaluate(form=>(form as HTMLFormElement).checkValidity())).toBe(false);
 await page.getByRole('checkbox',{name:/Li e aceito/}).check();
 const adult=page.getByRole('checkbox',{name:/Confirmo que tenho 18 anos/});await adult.focus();await page.keyboard.press('Space');
 await expect(adult).toBeChecked();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Confira seu e-mail'})).toBeVisible();
 expect(submitted).toMatchObject({termsAccepted:true,adultConfirmed:true,marketingConsent:false,termsVersion:'2026-11-12',privacyVersion:'2026-11-12'});
 expect(submitted).not.toHaveProperty('name');
});

test('documentos mostram contato real e pedido de exclusão recebe protocolo',async({page})=>{
 await page.goto('/privacidade');await expect(page.getByRole('heading',{name:'Política de Privacidade',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'mikaelson.desk@gmail.com',exact:true})).toHaveAttribute('href','mailto:mikaelson.desk@gmail.com');
 await expect(page.getByText('Endereço: Professor Edgard de Arruda, 1825, Dom Lustosa',{exact:true})).toBeVisible();
 const snapshot={account:{email:'test@example.com'},marketing:false,acceptances:[],requests:[],scope:'Resumo da conta.'};
 let payload:Record<string,unknown>|undefined;
 await page.route('**/api/privacidade',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:snapshot});
  payload=route.request().postDataJSON();snapshot.requests.push({id:'protocol-test',kind:'delete',status:'submitted',response:null,created_at:new Date().toISOString()} as never);
  return route.fulfill({status:201,json:{id:'protocol-test'}});
 });
 await page.goto('/meus-dados');await page.getByLabel('Tipo do pedido').selectOption('delete');
 await page.getByRole('button',{name:'Registrar pedido',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Pedido recebido. Protocolo: protocol-test'})).toBeVisible();
 expect(payload).toMatchObject({action:'request',kind:'delete',details:''});
 await expect(page.getByText('delete — Em atendimento',{exact:true})).toBeVisible();
});

test('botão principal mantém contraste de texto suficiente',async({page})=>{
 await page.goto('/login');
 const ratio=await page.getByRole('button',{name:'Entrar no meu espaço',exact:true}).evaluate(button=>{
  const style=getComputedStyle(button);
  function luminance(css:string){const values=(css.match(/[\d.]+/g)??[]).slice(0,3).map(Number).map(value=>{const n=value/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;});return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;}
  const a=luminance(style.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
 });
 expect(ratio).toBeGreaterThanOrEqual(4.5);
});

