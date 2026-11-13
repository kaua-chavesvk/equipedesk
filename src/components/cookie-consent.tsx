import Link from 'next/link';

export function LegalFooter() {
  return <footer className="legal-footer">
    <Link href="/privacidade">Privacidade</Link>
    <Link href="/termos">Termos de uso</Link>
    <Link href="/meus-dados">Meus dados</Link>
    <Link href="/licencas">Licenças</Link>
  </footer>;
}
