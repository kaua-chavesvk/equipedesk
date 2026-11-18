'use client';
import { useTranslations } from '@/features/i18n/context';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  return (
    <main className="auth-page">
      <section className="auth-card" role="alert">
        <span className="eyebrow">{t('VAMOS TENTAR DE NOVO')}</span>
        <h1>{t('Não conseguimos carregar este espaço.')}</h1>
        <p className="muted" style={{ margin: '20px 0' }}>
          {t('Confira sua conexão e tente novamente. Seus chamados continuam protegidos.')}
        </p>
        <button className="button primary" onClick={reset}>
          {t('Tentar novamente')}
        </button>
      </section>
    </main>
  );
}
