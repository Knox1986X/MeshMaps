/**
 * Region archives live in the app's private storage (OPFS): /regions/<file>.pmtiles.
 * OPFS is supported by Android WebView (Chromium) and by the Tauri/WebKitGTK webview.
 */
const DIR = 'regions';

async function regionsDir(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) {
    throw new Error('Хранилище устройства (OPFS) недоступно в этом окружении');
  }
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR, { create: true });
}

/** Streams a file into app storage, reporting progress in bytes. */
export async function writeRegionFile(
  fileName: string,
  src: File,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const dir = await regionsDir();
  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  const reader = src.stream().getReader();
  let done = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      await writable.write(chunk.value);
      done += chunk.value.byteLength;
      onProgress(done, src.size);
    }
    await writable.close();
  } catch (err) {
    await writable.abort().catch(() => undefined);
    throw err;
  }
}

export async function openRegionFile(fileName: string): Promise<File> {
  const dir = await regionsDir();
  const handle = await dir.getFileHandle(fileName);
  return handle.getFile();
}

export async function removeRegionFile(fileName: string): Promise<void> {
  const dir = await regionsDir();
  await dir.removeEntry(fileName).catch(() => undefined);
}
