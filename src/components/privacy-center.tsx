'use client';
import { useLocale, useTranslations } from '@/features/i18n/context';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LegalFields } from './legal-fields';
import { LoaderCircle } from 'lucide-react';
type RequestRecord={id:string;kind:string;status:string;response:string|null;created_at:string};
type Snapshot={account:{email:string};marketing:boolean;acceptances:{id:string;kind:string;terms_version:string;recorded_at:string}[];requests:RequestRecord[];scope:string};
export function PrivacyCenter({acceptOnly=false}:{acceptOnly?:boolean}){
  const t = useTranslations();
  const locale = useLocale();
  const router=useRouter();
  const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function load(){const response=await fetch('/api/privacidade');const result=await response.json();if(!response.ok)throw new Error(result.error??t("Não foi possível carregar seus dados."));setData(result);}
  useEffect(()=>{let active=true;fetch('/api/privacidade').then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error);if(active)setData(result);}).catch(e=>{if(active)setError(e instanceof Error?e.message:t("Falha no carregamento."));});return()=>{active=false};},[t]);
  async function command(payload:unknown){
    setBusy(true);setError('');setMessage('');
    try{const response=await fetch('/api/privacidade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error);await load();return result;}
    catch(e){setError(e instanceof Error?e.message:t("Tente novamente."));return null;}finally{setBusy(false);}
  }
  async function accept(event:FormEvent<HTMLFormElement>){event.preventDefault();const fields=new FormData(event.currentTarget);const result=await command({action:'accept_terms',termsAccepted:fields.has('termsAccepted'),adultConfirmed:fields.has('adultConfirmed'),termsVersion:fields.get('termsVersion'),privacyVersion:fields.get('privacyVersion')});if(result){router.push('/onboarding');router.refresh();}}
  return <div className="privacy-center" aria-busy={busy||(!data&&!error)}>
    {!data&&!error&&<p className="loading-status" role="status"><LoaderCircle size={18} className="spin"/>{t("Carregando os dados da sua conta…")}</p>}
    {!data&&error&&<button className="button secondary" onClick={async()=>{setError('');try{await load()}catch(cause){setError(cause instanceof Error?cause.message:t("Não foi possível carregar seus dados."))}}}>{t("Tentar novamente")}</button>}
    {error&&<p className="form-error" role="alert" tabIndex={-1} ref={node=>node?.focus()}>{t(error)}</p>}{message&&<p role="status">{t(message)}</p>}
    {acceptOnly?<form onSubmit={accept}><LegalFields marketing={false}/><button className="button primary" disabled={busy||!data}>{busy?t("Registrando aceite…"):t("Registrar aceite e continuar")}</button></form>:<>
      <section><h2>{t("Dados e preferências da conta")}</h2>{data&&<><p>{t("Conta: ")}{data.account.email}</p><p>{t("Marketing: ")}{data.marketing?t("autorizado"):t("não autorizado")}{t(". Não há campanhas ativas.")}</p><button className="button secondary" disabled={busy} onClick={async()=>{const result=await command({action:'marketing',enabled:!data.marketing});if(result)setMessage(t("Preferência registrada."));}}>{data.marketing?t("Revogar marketing"):t("Autorizar marketing")}</button><button className="button secondary" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='meus-dados-equipedesk.json';link.click();URL.revokeObjectURL(url);}}>{t("Baixar resumo dos meus dados")}</button><p>{t(data.scope)}</p></>}</section>
      <section><h2>{t("Solicitar acesso, correção ou exclusão")}</h2><p>{t("Não inclua documentos ou dados sensíveis. A exclusão exige análise e execução; enviar o pedido não apaga a conta imediatamente.")}</p><form onSubmit={async event=>{event.preventDefault();const form=event.currentTarget;const fields=new FormData(form);const result=await command({action:'request',kind:fields.get('kind'),details:fields.get('details')});if(result){form.reset();setMessage(t("Pedido recebido. Protocolo: {id}. Acompanhe a resposta abaixo.", { id: result.id }));}}}><label>{t("Tipo do pedido")}<select name="kind"><option value="access">{t("Acesso completo aos meus dados")}</option><option value="delete">{t("Exclusão dos meus dados")}</option><option value="correct">{t("Correção")}</option><option value="other">{t("Outro direito de privacidade")}</option></select></label><label>{t("Detalhes opcionais")}<textarea name="details" maxLength={1000} rows={4}/></label><button className="button primary" disabled={busy||!data}>{t("Registrar pedido")}</button></form></section>
      <section><h2>{t("Meus pedidos")}</h2>{data?.requests.length?data.requests.map(request=><article key={request.id}><h3>{t("Protocolo ")}{request.id}</h3><p>{t(request.kind)} — {request.status==='submitted'?t("Em atendimento"):request.status==='answered'?t("Respondido"):t("Não atendido; veja a justificativa")}</p>{request.response&&<p>{request.response}</p>}</article>):<p>{data?t("Você ainda não registrou pedidos de privacidade."):t("Os pedidos aparecerão depois do carregamento.")}</p>}</section>
      <section><h2>{t("Histórico de aceites e escolhas")}</h2>{data?.acceptances.map(item=><p key={item.id}>{t(item.kind)} {t(" — versão ")}{item.terms_version??t("preferência")} — {new Date(item.recorded_at).toLocaleString(locale)}</p>)}</section>
    </>}
  </div>;
}
