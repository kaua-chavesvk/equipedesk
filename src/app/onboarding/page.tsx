import { serverTranslations } from '@/features/i18n/server';
import { workspaceStart } from '@/lib/server/account-settings';
import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { listOrganizations } from '@/lib/data';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const t = await serverTranslations();
  const orgs = await Promise.all(
    (await listOrganizations()).map(async (org) => ({
      ...org,
      href: await workspaceStart(org.slug, org.id),
    })),
  );
  return (
    <>
      <div className="onboarding-orgs">
        {orgs.length > 0 && (
          <>
            <h2>{t('Seus espaços de trabalho')}</h2>
            <p className="muted">{t('Escolha uma empresa para continuar.')}</p>
            <div>
              {orgs.map((org) => (
                <Link key={org.id} href={org.href}>
                  <strong>{org.name}</strong>
                  <span>
                    {org.role === 'admin'
                      ? t('Administrador')
                      : org.role === 'agent'
                        ? t('Atendente')
                        : t('Solicitante')}{' '}
                    →
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
      <AuthForm mode="empresa" />
    </>
  );
}
