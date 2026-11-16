import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

/**
 * Saves a file to the user: Android → share sheet (Files, Drive, Telegram…);
 * desktop/Tauri → regular download.
 */
export async function saveFile(name: string, mime: string, data: Uint8Array | string): Promise<void> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: name,
      data: toBase64(bytes),
      directory: Directory.Cache,
      recursive: true,
    });
    const uri = await Filesystem.getUri({ path: name, directory: Directory.Cache });
    await Share.share({ title: name, url: uri.uri, dialogTitle: 'Сохранить файл' });
    return;
  }
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Reads a user-picked File as text or bytes. */
export async function readBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}
