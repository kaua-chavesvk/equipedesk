'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AVATAR_SOURCE_LIMIT } from '@/features/account-settings/contracts';
import { DeskDialog } from './desk-dialog';
import { ProfileAvatar } from './profile-avatar';

const copy = {
  'pt-BR': {
    title: 'Foto de perfil',
    help: 'Visível para colegas de empresas que você compartilha.',
    choose: 'Selecionar foto',
    preview: 'Recortar foto',
    zoom: 'Zoom',
    save: 'Salvar foto',
    remove: 'Remover foto',
    pending: 'Processando…',
    invalid: 'Escolha um JPEG, PNG ou WebP de até 2 MiB.',
    saved: 'Foto salva.',
    removed: 'Foto removida do perfil.',
    cleanup: 'Foto retirada do perfil. A exclusão do arquivo está pendente.',
    error: 'Não foi possível atualizar a foto. Tente novamente.',
    instructions:
      'Arraste a foto para ajustar o enquadramento. Use o zoom para aproximar. Com o teclado, use as setas para mover e Home para centralizar.',
    position: 'Posicionar foto',
    reset: 'Centralizar foto',
  },
  en: {
    title: 'Profile photo',
    help: 'Visible to colleagues in companies you share.',
    choose: 'Choose photo',
    preview: 'Crop photo',
    zoom: 'Zoom',
    save: 'Save photo',
    remove: 'Remove photo',
    pending: 'Processing…',
    invalid: 'Choose a JPEG, PNG or WebP up to 2 MiB.',
    saved: 'Photo saved.',
    removed: 'Photo removed from your profile.',
    cleanup: 'Photo hidden. File deletion is pending.',
    error: 'Could not update your photo. Try again.',
    instructions:
      'Drag the photo to adjust the crop. Use zoom to get closer. With a keyboard, use arrow keys to move and Home to centre.',
    position: 'Position photo',
    reset: 'Centre photo',
  },
} as const;

export function AvatarSettings({
  profile,
  uploadEnabled,
  locale,
  url,
}: {
  profile: { display_name: string; version: number; hasAvatar: boolean };
  uploadEnabled: boolean;
  locale: 'pt-BR' | 'en';
  url?: string | null;
}) {
  const router = useRouter();
  const t = copy[locale];
  const [selection, setSelection] = useState<{ file: File; url: string } | null>(null);
  const [crop, setCrop] = useState({ zoom: 1, x: 0.5, y: 0.5 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const drag = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    size: number;
  } | null>(null);
  const side = Math.max(1, Math.floor(Math.min(dimensions.width, dimensions.height) / crop.zoom));
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  useEffect(
    () => () => {
      if (selection) URL.revokeObjectURL(selection.url);
    },
    [selection],
  );

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
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((100 * event.loaded) / event.total));
    };
    function failed() {
      setBusy(false);
      toast.error(t.error);
    }
    request.onerror = failed;
    request.ontimeout = failed;
    request.onload = () => {
      if (request.status !== 201) {
        failed();
        return;
      }
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
      const response = await fetch('/api/conta/foto', {
        method: 'DELETE',
        headers: { 'If-Match': `"${profile.version}"` },
      });
      if (!response.ok) throw new Error();
      toast.success(response.status === 202 ? t.cleanup : t.removed);
      router.refresh();
    } catch {
      toast.error(t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-photo">
      <h3>{t.title}</h3>
      <div className="settings-photo-intro">
        <ProfileAvatar name={profile.display_name} url={url} size={64} />
        <p className="muted">{t.help}</p>
      </div>
      {uploadEnabled && (
        <label>
          {t.choose}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              if (
                file.size > AVATAR_SOURCE_LIMIT ||
                !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
              ) {
                toast.error(t.invalid);
                return;
              }
              setCrop({ zoom: 1, x: 0.5, y: 0.5 });
              setDimensions({ width: 1, height: 1 });
              setSelection({ file, url: URL.createObjectURL(file) });
            }}
          />
        </label>
      )}
      {profile.hasAvatar && (
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => void remove()}
        >
          {t.remove}
        </button>
      )}
      {selection && (
        <DeskDialog
          title={t.preview}
          description={t.instructions}
          lang={locale}
          open
          onOpenChange={(open) => {
            if (!open && !busy) setSelection(null);
          }}
        >
          <div
            className="avatar-crop-preview"
            role="group"
            tabIndex={0}
            aria-label={t.position}
            aria-disabled={busy}
            onPointerDown={(event) => {
              if (busy || event.button !== 0 || !event.isPrimary) return;
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY,
                x: crop.x,
                y: crop.y,
                size: event.currentTarget.getBoundingClientRect().width,
              };
            }}
            onPointerMove={(event) => {
              const start = drag.current;
              if (busy || !start || start.pointerId !== event.pointerId) return;
              const overflowX = ((dimensions.width - side) * start.size) / side;
              const overflowY = ((dimensions.height - side) * start.size) / side;
              setCrop((current) => ({
                ...current,
                x:
                  overflowX > 0
                    ? clamp(start.x - (event.clientX - start.clientX) / overflowX)
                    : 0.5,
                y:
                  overflowY > 0
                    ? clamp(start.y - (event.clientY - start.clientY) / overflowY)
                    : 0.5,
              }));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
            onKeyDown={(event) => {
              if (
                busy ||
                !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)
              )
                return;
              event.preventDefault();
              const step = event.shiftKey ? 0.1 : 0.02;
              setCrop((current) =>
                event.key === 'Home'
                  ? { ...current, x: 0.5, y: 0.5 }
                  : {
                      ...current,
                      x: clamp(
                        current.x +
                          (event.key === 'ArrowLeft'
                            ? step
                            : event.key === 'ArrowRight'
                              ? -step
                              : 0),
                      ),
                      y: clamp(
                        current.y +
                          (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0),
                      ),
                    },
              );
            }}
          >
            <Image
              src={selection.url}
              alt=""
              width={dimensions.width}
              height={dimensions.height}
              unoptimized
              draggable={false}
              onLoad={(event) =>
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              onError={() => {
                setSelection(null);
                toast.error(t.invalid);
              }}
              style={{
                width: (100 * dimensions.width) / side + '%',
                height: (100 * dimensions.height) / side + '%',
                maxWidth: 'none',
                position: 'absolute',
                left: (-100 * (dimensions.width - side) * crop.x) / side + '%',
                top: (-100 * (dimensions.height - side) * crop.y) / side + '%',
              }}
            />
          </div>
          <fieldset disabled={busy} className="avatar-crop-controls">
            <label>
              {t.zoom}
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={crop.zoom}
                onChange={(event) => {
                  drag.current = null;
                  setCrop((values) => ({ ...values, zoom: Number(event.target.value) }));
                }}
              />
            </label>
            <button
              type="button"
              className="button secondary"
              onClick={() => setCrop({ zoom: 1, x: 0.5, y: 0.5 })}
            >
              {t.reset}
            </button>
          </fieldset>
          {busy && <progress aria-label={t.pending} value={progress} max={100} />}
          <button
            type="button"
            className="button primary"
            disabled={busy || dimensions.width < 2}
            onClick={upload}
          >
            {busy ? t.pending : t.save}
          </button>
        </DeskDialog>
      )}
    </section>
  );
}
