import { expect, it } from 'vitest';
import { authInput } from '../../src/lib/http/auth-input';
import { privacyInput } from '../../src/lib/privacy-input';
import { LEGAL_VERSION, legalIdentity } from '../../src/lib/legal';
const signup={action:'signup',email:'person@example.com',password:'example-password',termsAccepted:true,adultConfirmed:true,termsVersion:LEGAL_VERSION,privacyVersion:LEGAL_VERSION};
it('exige aceite e maioridade no servidor e mantém marketing desligado por padrão',()=>{
 expect(authInput.parse(signup)).toMatchObject({marketingConsent:false});
 for(const field of ['termsAccepted','adultConfirmed','termsVersion','privacyVersion']){
  const incomplete={...signup} as Record<string,unknown>;delete incomplete[field];expect(authInput.safeParse(incomplete).success).toBe(false);
 }
 expect(authInput.safeParse({...signup,termsAccepted:false}).success).toBe(false);
 expect(authInput.safeParse({...signup,adultConfirmed:false}).success).toBe(false);
 expect(authInput.safeParse({...signup,termsVersion:'old-version'}).success).toBe(false);
});
it('marketing é uma escolha distinta e aceita revogação sem novo aceite',()=>{
 expect(authInput.parse({...signup,marketingConsent:true})).toMatchObject({marketingConsent:true});
 expect(privacyInput.parse({action:'marketing',enabled:false})).toEqual({action:'marketing',enabled:false});
});
it('rejeita escolha de identidade e status em pedidos de titulares',()=>{
 expect(privacyInput.safeParse({action:'request',kind:'delete',user_id:'someone-else'}).success).toBe(false);
 expect(privacyInput.safeParse({action:'request',kind:'delete',status:'answered'}).success).toBe(false);
 expect(privacyInput.safeParse({action:'request',kind:'access',details:'a'.repeat(1001)}).success).toBe(false);
});
it('publica apenas a identificação fornecida, sem inventar CNPJ',()=>{
 expect(legalIdentity()).toMatchObject({name:'mikaelson desk',email:'mikaelson.desk@gmail.com',cnpj:''});
});
