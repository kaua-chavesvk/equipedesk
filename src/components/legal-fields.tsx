'use client';
import { useTranslations } from '@/features/i18n/context';

import Link from 'next/link';
import { LEGAL_VERSION } from '@/lib/legal';
export function LegalFields({marketing=true}:{marketing?:boolean}){
  const t = useTranslations();return <fieldset className="legal-fields">
  <legend>{t("Termos e escolhas de privacidade")}</legend>
  <input type="hidden" name="termsVersion" value={LEGAL_VERSION}/><input type="hidden" name="privacyVersion" value={LEGAL_VERSION}/>
  <label className="check-label"><input name="termsAccepted" type="checkbox" required/><span>{t("Li e aceito os ")}<Link href="/termos" target="_blank" rel="noopener noreferrer">{t("Termos de Uso (abre em nova aba)")}</Link> {t(" e tomei ciência da ")}<Link href="/privacidade" target="_blank" rel="noopener noreferrer">{t("Política de Privacidade (abre em nova aba)")}</Link>.</span></label>
  <label className="check-label"><input name="adultConfirmed" type="checkbox" required/><span>{t("Confirmo que tenho 18 anos ou mais.")}</span></label>
  {marketing&&<label className="check-label"><input name="marketingConsent" type="checkbox"/><span>{t("Quero receber comunicações de marketing por e-mail. Opcional; posso retirar esta escolha a qualquer momento. Nenhuma campanha está ativa nesta versão.")}</span></label>}
</fieldset>}
