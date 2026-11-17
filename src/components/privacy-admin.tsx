'use client';
import { useLocale, useTranslations } from '@/features/i18n/context';

import { useState } from 'react';
type Item={id:string;kind:string;details:string;status:string;created_at:string;due_at:string;response:string|null};
export function PrivacyAdmin({items}:{items:Item[]}){
  const t = useTranslations();
  const locale = useLocale();
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <>{message&&<p role="status">{t(message)}</p>}{items.length?items.map(item=><article key={item.id}><h2>{t("Protocolo ")}{item.id}</h2><p>{t("Tipo: ")}{t(item.kind)}{t(". Situação: ")}{t(item.status)}{t(". Recebido em ")}{new Date(item.created_at).toLocaleDateString(locale)}.</p><p>{item.details||t("Sem detalhes adicionais.")}</p>{item.response&&<p>{t("Resposta: ")}{item.response}</p>}{item.status==='submitted'&&<form onSubmit={async event=>{event.preventDefault();const fields=new FormData(event.currentTarget);setBusy(true);try{const response=await fetch('/api/privacidade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'answer',id:item.id,status:fields.get('status'),response:fields.get('response')})});const result=await response.json();if(!response.ok)throw new Error(result.error);setMessage(t("Resposta registrada. Recarregue para atualizar a fila."));}catch(e){setMessage(e instanceof Error?e.message:t("Tente novamente."));}finally{setBusy(false);}}}><p>{t("Registre a resposta somente após executar o atendimento. Este formulário não exclui contas nem dados.")}</p><label>{t("Resultado")}<select name="status"><option value="answered">{t("Pedido atendido e respondido")}</option><option value="denied">{t("Não atendido, com justificativa")}</option></select></label><label>{t("Resposta ao titular")}<textarea name="response" required minLength={10} maxLength={2000}/></label><button className="button primary" disabled={busy}>{t("Registrar resposta")}</button></form>}</article>):<p>{t("Nenhum pedido na consulta.")}</p>}</>;
}
