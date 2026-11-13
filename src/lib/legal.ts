export const LEGAL_VERSION = '2026-11-12';
export const COOKIE_VERSION = '1';
export const retention = [
  ['Conta e vínculos','Enquanto a conta ou o vínculo estiver ativo; pedidos de exclusão passam por verificação de identidade e de obrigações legais.'],
  ['Chamados, comentários e histórico','12 meses após a resolução do chamado; reabertura reinicia a contagem. Suspensão de descarte exige justificativa legal.'],
  ['Aceites e preferências','Durante a conta e até 5 anos após seu encerramento, limitados à comprovação de direitos e obrigações.'],
  ['Pedidos de privacidade','Até 5 anos após a conclusão, para comprovar o atendimento; anexos e documentos desnecessários não são solicitados.'],
  ['Preferência de cookies','180 dias no navegador, ou até a revogação ou mudança de versão.'],
  ['Marketing','Até revogar o consentimento ou encerrar a conta; registro mínimo da revogação é conservado para evitar novos envios.'],
  ['Registros de incidentes','Pelo menos 5 anos, conforme regulamentação da ANPD.'],
  ['Logs operacionais e backups','Prazos do provedor precisam ser confirmados antes da publicação; não há provedor de produção conectado nesta versão.'],
] as const;

export function legalIdentity() {
  return {
    name: process.env.LEGAL_ENTITY_NAME ?? 'mikaelson desk',
    email: process.env.PRIVACY_CONTACT_EMAIL ?? 'mikaelson.desk@gmail.com',
    cnpj: process.env.LEGAL_ENTITY_CNPJ ?? '',
    address: process.env.LEGAL_ENTITY_ADDRESS ?? 'Professor Edgard de Arruda, 1825, Dom Lustosa',
  };
}
