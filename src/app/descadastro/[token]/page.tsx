import { notFound } from 'next/navigation';
import { LegalShell } from '@/components/legal-shell';
import { Unsubscribe } from '@/components/unsubscribe';
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;if(!/^[a-f0-9]{64}$/.test(token))notFound();return <LegalShell title="Revogar marketing"><Unsubscribe token={token}/></LegalShell>}
