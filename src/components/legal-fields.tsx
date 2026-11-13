import Link from 'next/link';
import { LEGAL_VERSION } from '@/lib/legal';
export function LegalFields({marketing=true}:{marketing?:boolean}){return <fieldset className="legal-fields">
  <legend>Termos e escolhas de privacidade</legend>
  <input type="hidden" name="termsVersion" value={LEGAL_VERSION}/><input type="hidden" name="privacyVersion" value={LEGAL_VERSION}/>
  <label className="check-label"><input name="termsAccepted" type="checkbox" required/><span>Li e aceito os <Link href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso (abre em nova aba)</Link> e tomei ciência da <Link href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade (abre em nova aba)</Link>.</span></label>
  <label className="check-label"><input name="adultConfirmed" type="checkbox" required/><span>Confirmo que tenho 18 anos ou mais.</span></label>
  {marketing&&<label className="check-label"><input name="marketingConsent" type="checkbox"/><span>Quero receber comunicações de marketing por e-mail. Opcional; posso retirar esta escolha a qualquer momento. Nenhuma campanha está ativa nesta versão.</span></label>}
</fieldset>}
