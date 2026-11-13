'use client';
import { useState } from 'react';
export function Unsubscribe({token}:{token:string}){
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  return <><p>Confirme para revogar o consentimento de marketing deste link. Não é necessário entrar na conta.</p><button className="button primary" disabled={busy} onClick={async()=>{setBusy(true);try{const response=await fetch('/api/privacidade/descadastro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const result=await response.json();if(!response.ok)throw new Error(result.error);setMessage(result.message);}catch(e){setMessage(e instanceof Error?e.message:'Tente novamente.');}finally{setBusy(false);}}}>Confirmar descadastro</button>{message&&<p role="status">{message}</p>}</>;
}
