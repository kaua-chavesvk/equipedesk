'use client';

import Image from 'next/image';
import { useState } from 'react';

const colors = ['avatar-blue', 'avatar-violet', 'avatar-green', 'avatar-orange'];

export function ProfileAvatar({ name, url, size = 36, decorative = true }: {
  name: string; url?: string | null; size?: number; decorative?: boolean;
}) {
  const [failed, setFailed] = useState<string>();
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => Array.from(part)[0]).join('').toUpperCase() || 'ED';
  const hue = Array.from(name.normalize('NFC')).reduce((sum, letter) => (sum + letter.codePointAt(0)!) % colors.length, 0);
  return <span className={`avatar profile-avatar ${colors[hue]}`} style={{ width: size, height: size }}
    aria-hidden={decorative || undefined} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : name}>
    {url && failed !== url
      ? <Image src={url} alt="" width={size} height={size} unoptimized onError={() => setFailed(url)} />
      : initials}
  </span>;
}
