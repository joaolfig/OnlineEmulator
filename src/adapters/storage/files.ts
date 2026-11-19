// Salvar e abrir arquivos do computador do usuário.

/** Baixa um arquivo. Usa o seletor de pasta (File System Access API) quando o navegador suporta. */
export async function saveFile(data: Uint8Array, fileName: string): Promise<void> {
  const blob = new Blob([data as Uint8Array<ArrayBuffer>]);
  const picker = (
    window as Window & {
      showSaveFilePicker?: (o: { suggestedName: string }) => Promise<FileSystemFileHandle>;
    }
  ).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: fileName });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // usuário cancelou
      throw err;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Nome de arquivo com a data de hoje, ex.: "Mario Party 2 (2026-11-19).eep". */
export const datedFileName = (name: string, extension: string, date = new Date()): string =>
  `${name} (${date.toISOString().slice(0, 10)}).${extension}`;
