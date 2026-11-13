'use client';

import Link from 'next/link';
import { Entrance } from './entrance';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Layers3, LoaderCircle, Ticket, Users, MessagesSquare } from 'lucide-react';
import { LegalFields } from './legal-fields';
import { safeRedirect } from '@/lib/safe-redirect';

type Mode = 'login' | 'cadastro' | 'recuperar' | 'empresa' | 'convite' | 'senha';
const subscribeHydration = () => () => {};
const copy = {
  login: { title: 'Entre na sua conta.', description: 'Acesse os chamados e acompanhe o atendimento da sua equipe.', action: 'Entrar no meu espaço', pending: 'Entrando…' },
  cadastro: { title: 'Crie sua conta.', description: 'Use seu e-mail para começar ou participar de uma empresa.', action: 'Continuar', pending: 'Criando conta…' },
  recuperar: { title: 'Recupere seu acesso.', description: 'Informe o e-mail da sua conta para receber um link de recuperação.', action: 'Enviar link de recuperação', pending: 'Enviando link…' },
  empresa: { title: 'Crie um espaço de trabalho.', description: 'Reúna sua equipe e organize as solicitações da empresa.', action: 'Criar empresa', pending: 'Criando empresa…' },
  convite: { title: 'Entre para continuar.', description: 'Use a conta que recebeu o convite para acessar a empresa.', action: 'Continuar', pending: 'Entrando…' },
  senha: { title: 'Defina uma nova senha.', description: 'Escolha uma senha com pelo menos 8 caracteres para sua conta.', action: 'Salvar nova senha', pending: 'Salvando senha…' },
};

export function AuthForm({ mode, allowDemo = false }: { mode: Mode; token?: string; allowDemo?: boolean }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [done, setDone] = useState('');
  const [visible, setVisible] = useState(false);
  const content = copy[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setDone('');
    const fields = new FormData(event.currentTarget);
    const payload = Object.fromEntries(fields);
    if (mode === 'cadastro' && !String(payload.name ?? '').trim()) delete payload.name;
    const legal = mode === 'cadastro' ? { termsAccepted: fields.has('termsAccepted'), adultConfirmed: fields.has('adultConfirmed'), marketingConsent: fields.has('marketingConsent') } : {};
    try {
      const response = await fetch(mode === 'empresa' ? '/api/empresas' : '/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'empresa' ? payload : { ...payload, ...legal, action: mode === 'cadastro' ? 'signup' : mode === 'recuperar' ? 'recover' : mode === 'senha' ? 'update_password' : 'login' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? result.error ?? 'Não foi possível continuar. Tente novamente.');
      if (mode === 'recuperar' || mode === 'cadastro') setDone(result.message ?? 'Confira seu e-mail para continuar.');
      else {
        const next = new URLSearchParams(window.location.search).get('next');
        router.push(mode === 'empresa' ? `/e/${payload.slug}` : safeRedirect(next)); router.refresh();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Confira sua conexão e tente novamente.'); }
    finally { setBusy(false); }
  }

  async function openDemo() {
    setDemoBusy(true); setError('');
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'demo' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'A demonstração não está disponível neste ambiente.');
      router.push('/e/aurora'); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a demonstração.'); }
    finally { setDemoBusy(false); }
  }

  return <main className={mode==='empresa'?'auth-page company-setup':'auth-page auth-layout'} id="content">
    <div className="auth-intro">
      <Link href="/" className="brand" aria-label="EquipeDesk, início"><span className="brand-icon"><Layers3 size={24} aria-hidden="true" /></span>equipe<span>desk</span><span className="brand-dot">.</span></Link>
      <div className="auth-intro-copy">
        <p className="eyebrow">Atendimento interno</p>
        <h2>Organize pedidos.<br />Acompanhe soluções.</h2>
        <p>Um espaço para saber o que precisa ser feito, quem está cuidando e como cada chamado está avançando.</p>
        <ul className="auth-features">
          <li><Ticket size={20} aria-hidden="true" /><span>Chamados organizados por estado e prioridade</span></li>
          <li><Users size={20} aria-hidden="true" /><span>Acesso por empresa e papel na equipe</span></li>
          <li><MessagesSquare size={20} aria-hidden="true" /><span>Conversas e histórico em um só lugar</span></li>
        </ul>
      </div>
      <p className="auth-intro-footer">EquipeDesk <span>Atendimento da sua equipe</span></p>
    </div>
    <div className="auth-form-area">
      <Entrance><section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">{mode === 'empresa' ? 'Espaço de trabalho' : 'Sua conta'}</p>
        <h1 id="auth-title">{content.title}</h1>
        <p className="muted">{content.description}</p>
        <form method="post" onSubmit={submit} aria-busy={busy}>
          {(mode === 'cadastro' || mode === 'empresa') && <label htmlFor="auth-name">{mode === 'empresa' ? 'Nome da empresa' : 'Nome de exibição (opcional)'}<input id="auth-name" name="name" required={mode === 'empresa'} maxLength={100} autoComplete={mode === 'empresa' ? 'organization' : 'name'} placeholder={mode === 'empresa' ? 'Nome da empresa' : 'Como você quer ser chamado'} /></label>}
          {mode !== 'senha' && (mode === 'empresa' ? <label htmlFor="auth-slug">Endereço da empresa<input id="auth-slug" name="slug" required minLength={2} maxLength={60} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="minha-empresa" autoCapitalize="none" spellCheck={false} aria-describedby="slug-help" /><small id="slug-help">Use letras minúsculas, números e hífens. Ex.: minha-empresa.</small></label> : <label htmlFor="auth-email">E-mail<input id="auth-email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com.br" autoCapitalize="none" spellCheck={false} /></label>)}
          {mode !== 'recuperar' && mode !== 'empresa' && <div className="password-field">
            <div className="field-heading"><label htmlFor="auth-password">Senha</label>{mode === 'login' && <Link href="/recuperar">Esqueci minha senha</Link>}</div>
            <div className="password-input"><input id="auth-password" name="password" type={visible ? 'text' : 'password'} minLength={8} required autoComplete={mode === 'cadastro' || mode === 'senha' ? 'new-password' : 'current-password'} aria-describedby={mode === 'cadastro' || mode === 'senha' ? 'password-help' : undefined} /><button type="button" disabled={!hydrated} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
            {(mode === 'cadastro' || mode === 'senha') && <small id="password-help" className="field-help">Use pelo menos 8 caracteres.</small>}
          </div>}
          {mode === 'cadastro' && <LegalFields />}
          {error && <p role="alert" className="form-error" tabIndex={-1} ref={element => element?.focus()}>{error}</p>}
          {done && <p role="status" className="success" tabIndex={-1} ref={element => element?.focus()}><Check size={20} aria-hidden="true" />{done}</p>}
          <button className="button primary auth-submit" disabled={!hydrated || busy || demoBusy}>{busy ? <><LoaderCircle className="spin" size={18} aria-hidden="true" />{content.pending}</> : <>{content.action}<ArrowRight size={18} aria-hidden="true" /></>}</button>
        </form>
        <div className="auth-links">{mode === 'login' ? <p>Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></p> : <Link href="/login">Voltar para o login</Link>}</div>
        {allowDemo && <div className="demo-option"><p>Quer conhecer a interface antes?</p><button className="demo-link" disabled={demoBusy || busy} onClick={openDemo}>{demoBusy ? 'Abrindo demonstração…' : 'Conhecer a demonstração'}<ArrowRight size={16} aria-hidden="true" /></button><small>A demonstração usa dados fictícios.</small></div>}
      </section></Entrance>
    </div>
  </main>;
}
