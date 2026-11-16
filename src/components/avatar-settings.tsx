'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AVATAR_SOURCE_LIMIT } from '@/features/account-settings/contracts';
import { DeskDialog } from './desk-dialog';
import { ProfileAvatar } from './profile-avatar';

const copy = {
  'pt-BR': { title: 'Foto de perfil', help: 'Visível para colegas de empresas que você compartilha.',
    choose: 'Selecionar foto', preview: 'Recortar foto', zoom: 'Zoom', x: 'Posição horizontal', y: 'Posição vertical',
    save: 'Salvar foto', remove: 'Remover foto', pending: 'Processando…', invalid: 'Escolha um JPEG, PNG ou WebP de até 2 MiB.',
    saved: 'Foto salva.', removed: 'Foto removida do perfil.', cleanup: 'Foto retirada do perfil. A exclusão do arquivo está pendente.',
    error: 'Não foi possível atualizar a foto. Tente novamente.', instructions: 'Use os controles para ajustar o enquadramento.' },
  en: { title: 'Profile photo', help: 'Visible to colleagues in companies you share.',
    choose: 'Choose photo', preview: 'Crop photo', zoom: 'Zoom', x: 'Horizontal position', y: 'Vertical position',
    save: 'Save photo', remove: 'Remove photo', pending: 'Processing…', invalid: 'Choose a JPEG, PNG or WebP up to 2 MiB.',
    saved: 'Photo saved.', removed: 'Photo removed from your profile.', cleanup: 'Photo hidden. File deletion is pending.',
    error: 'Could not update your photo. Try again.', instructions: 'Use the controls to adjust your crop.' },
} as const;

export function AvatarSettings({ profile, uploadEnabled, locale, url }: {
  profile: { display_name: string; version: number; hasAvatar: boolean };
  uploadEnabled: boolean; locale: 'pt-BR' | 'en'; url?: string | null;
}) {
  const router = useRouter();
  const t = copy[locale];
  const [selection, setSelection] = useState<{ file: File; url: string } | null>(null);
  const [crop, setCrop] = useState({ zoom: 1, x: .5, y: .5 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => () => { if (selection) URL.revokeObjectURL(selection.url); }, [selection]);

  function upload() {
    if (!selection || busy) return;
    const body = new FormData();
    body.append('file', selection.file);
    body.append('crop', JSON.stringify(crop));
    body.append('version', String(profile.version));
    setBusy(true);
    setProgress(0);
    const request = new XMLHttpRequest();
    request.open('POST', '/api/conta/foto');
    request.timeout = 30_000;
    request.upload.onprogress = event => {
      if (event.lengthComputable) setProgress(Math.round(100 * event.loaded / event.total));
    };
    function failed() { setBusy(false); toast.error(t.error); }
    request.onerror = failed;
    request.ontimeout = failed;
    request.onload = () => {
      if (request.status !== 201) { failed(); return; }
      setBusy(false);
      setSelection(null);
      toast.success(t.saved);
      router.refresh();
    };
    request.send(body);
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch('/api/conta/foto', { method: 'DELETE', headers: { 'If-Match': `"${profile.version}"` } });
      if (!response.ok) throw new Error();
      toast.success(response.status === 202 ? t.cleanup : t.removed);
      router.refresh();
    } catch { toast.error(t.error); }
    finally { setBusy(false); }
  }

  return <section className="settings-photo">
    <h3>{t.title}</h3>
    <div className="settings-photo-intro"><ProfileAvatar name={profile.display_name} url={url} size={64} /><p className="muted">{t.help}</p></div>
    {uploadEnabled && <label>{t.choose}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (file.size > AVATAR_SOURCE_LIMIT || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error(t.invalid); return; }
      setCrop({ zoom: 1, x: .5, y: .5 });
      setSelection({ file, url: URL.createObjectURL(file) });
    }} /></label>}
    {profile.hasAvatar && <button type="button" className="button secondary" disabled={busy} onClick={() => void remove()}>{t.remove}</button>}
    {selection && <DeskDialog title={t.preview} description={t.instructions} open onOpenChange={open => { if (!open && !busy) setSelection(null); }}>
      <div className="avatar-crop-preview"><Image src={selection.url} alt="" fill unoptimized
        style={{ objectFit: 'cover', objectPosition: `${crop.x * 100}% ${crop.y * 100}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x * 100}% ${crop.y * 100}%` }} /></div>
      <fieldset disabled={busy} className="avatar-crop-controls">
        {([['zoom', t.zoom, 1, 3], ['x', t.x, 0, 1], ['y', t.y, 0, 1]] as const).map(([key, label, min, max]) =>
          <label key={key}>{label}<input type="range" min={min} max={max} step={.01} value={crop[key]}
            onChange={event => setCrop(values => ({ ...values, [key]: Number(event.target.value) }))} /></label>)}
      </fieldset>
      {busy && <progress aria-label={t.pending} value={progress} max={100} />}
      <button type="button" className="button primary" disabled={busy} onClick={upload}>{busy ? t.pending : t.save}</button>
    </DeskDialog>}
  </section>;
}
