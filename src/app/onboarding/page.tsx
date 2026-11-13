import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { listOrganizations } from '@/lib/data';
export const dynamic='force-dynamic';
export default async function Page(){const orgs=await listOrganizations();return <><div className="onboarding-orgs">{orgs.length>0&&<><h2>Seus espaços de trabalho</h2><p className="muted">Escolha uma empresa para continuar.</p><div>{orgs.map(org=><Link key={org.id} href={`/e/${org.slug}`}><strong>{org.name}</strong><span>{org.role==='admin'?'Administrador':org.role==='agent'?'Atendente':'Solicitante'} →</span></Link>)}</div></>}</div><AuthForm mode="empresa"/></>}
