'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LegalFields } from './legal-fields';
import { LoaderCircle } from 'lucide-react';
type RequestRecord={id:string;kind:string;status:string;response:string|null;created_at:string};
type Snapshot={account:{email:string};marketing:boolean;acceptances:{id:string;kind:string;terms_version:string;recorded_at:string}[];requests:RequestRecord[];scope:string};
export function PrivacyCenter({acceptOnly=false}:{acceptOnly?:boolean}){
  const router=useRouter();
  const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function load(){const response=await fetch('/api/privacidade');const result=await response.json();if(!response.ok)throw new Error(result.error??'Não foi possível carregar seus dados.');setData(result);}
  useEffect(()=>{let active=true;fetch('/api/privacidade').then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error);if(active)setData(result);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Falha no carregamento.');});return()=>{active=false};},[]);
  async function command(payload:unknown){
    setBusy(true);setError('');setMessage('');
    try{const response=await fetch('/api/privacidade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error);await load();return result;}
    catch(e){setError(e instanceof Error?e.message:'Tente novamente.');return null;}finally{setBusy(false);}
  }
  async function accept(event:FormEvent<HTMLFormElement>){event.preventDefault();const fields=new FormData(event.currentTarget);const result=await command({action:'accept_terms',termsAccepted:fields.has('termsAccepted'),adultConfirmed:fields.has('adultConfirmed'),termsVersion:fields.get('termsVersion'),privacyVersion:fields.get('privacyVersion')});if(result){router.push('/onboarding');router.refresh();}}
  return <div className="privacy-center" aria-busy={busy||(!data&&!error)}>
    {!data&&!error&&<p className="loading-status" role="status"><LoaderCircle size={18} className="spin"/>Carregando os dados da sua conta…</p>}
    {!data&&error&&<button className="button secondary" onClick={async()=>{setError('');try{await load()}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível carregar seus dados.')}}}>Tentar novamente</button>}
    {error&&<p className="form-error" role="alert" tabIndex={-1} ref={node=>node?.focus()}>{error}</p>}{message&&<p role="status">{message}</p>}
    {acceptOnly?<form onSubmit={accept}><LegalFields marketing={false}/><button className="button primary" disabled={busy||!data}>{busy?'Registrando aceite…':'Registrar aceite e continuar'}</button></form>:<>
      <section><h2>Dados e preferências da conta</h2>{data&&<><p>Conta: {data.account.email}</p><p>Marketing: {data.marketing?'autorizado':'não autorizado'}. Não há campanhas ativas.</p><button className="button secondary" disabled={busy} onClick={async()=>{const result=await command({action:'marketing',enabled:!data.marketing});if(result)setMessage('Preferência registrada.');}}>{data.marketing?'Revogar marketing':'Autorizar marketing'}</button><button className="button secondary" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='meus-dados-equipedesk.json';link.click();URL.revokeObjectURL(url);}}>Baixar resumo dos meus dados</button><p>{data.scope}</p></>}</section>
      <section><h2>Solicitar acesso, correção ou exclusão</h2><p>Não inclua documentos ou dados sensíveis. A exclusão exige análise e execução; enviar o pedido não apaga a conta imediatamente.</p><form onSubmit={async event=>{event.preventDefault();const form=event.currentTarget;const fields=new FormData(form);const result=await command({action:'request',kind:fields.get('kind'),details:fields.get('details')});if(result){form.reset();setMessage(`Pedido recebido. Protocolo: ${result.id}. Acompanhe a resposta abaixo.`);}}}><label>Tipo do pedido<select name="kind"><option value="access">Acesso completo aos meus dados</option><option value="delete">Exclusão dos meus dados</option><option value="correct">Correção</option><option value="other">Outro direito de privacidade</option></select></label><label>Detalhes opcionais<textarea name="details" maxLength={1000} rows={4}/></label><button className="button primary" disabled={busy||!data}>Registrar pedido</button></form></section>
      <section><h2>Meus pedidos</h2>{data?.requests.length?data.requests.map(request=><article key={request.id}><h3>Protocolo {request.id}</h3><p>{request.kind} — {request.status==='submitted'?'Em atendimento':request.status==='answered'?'Respondido':'Não atendido; veja a justificativa'}</p>{request.response&&<p>{request.response}</p>}</article>):<p>{data?'Você ainda não registrou pedidos de privacidade.':'Os pedidos aparecerão depois do carregamento.'}</p>}</section>
      <section><h2>Histórico de aceites e escolhas</h2>{data?.acceptances.map(item=><p key={item.id}>{item.kind} — versão {item.terms_version??'preferência'} — {new Date(item.recorded_at).toLocaleString('pt-BR')}</p>)}</section>
    </>}
  </div>;
}
