import { AuthForm } from '@/components/auth-form';
import { demoEnabled } from '@/lib/data';
export default function Page(){return <AuthForm mode="login" allowDemo={demoEnabled()}/>}
