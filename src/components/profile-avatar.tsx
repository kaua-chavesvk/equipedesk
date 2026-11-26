'use client';

import Image from 'next/image';
import { useState } from 'react';

const colors = ['avatar-blue', 'avatar-violet', 'avatar-green', 'avatar-orange'];

export function ProfileAvatar({
  name,
  url,
  size = 36,
  decorative = true,
}: {
  name: string;
  url?: string | null;
  size?: number;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState<string>();
  const [renewal, setRenewal] = useState<{ original: string; next: string }>();
  const activeUrl = renewal?.original === url ? renewal?.next : url;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('')
      .toUpperCase() || 'ED';
  const hue = Array.from(name.normalize('NFC')).reduce(
    (sum, letter) => (sum + letter.codePointAt(0)!) % colors.length,
    0,
  );
  async function renew() {
    if (!url || !activeUrl) return;
    setFailed(activeUrl);
    if (activeUrl !== url) return;
    const match = /^\/api\/perfis\/([0-9a-f-]{36})\/foto\?/.exec(url);
    if (!match) return;
    try {
      const response = await fetch('/api/perfis/' + match[1] + '/foto-url', { cache: 'no-store' });
      if (!response.ok) return;
      const result = await response.json();
      if (typeof result.url === 'string' && result.url !== url)
        setRenewal({ original: url, next: result.url });
    } catch {
      /* An unavailable photo keeps the initials visible. */
    }
  }
  return (
    <span
      className={`avatar profile-avatar ${colors[hue]}`}
      style={{ width: size, height: size }}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
    >
      {activeUrl && failed !== activeUrl ? (
        <Image
          src={activeUrl}
          alt=""
          width={size}
          height={size}
          unoptimized
          onError={() => void renew()}
        />
      ) : (
        initials
      )}
    </span>
  );
}
