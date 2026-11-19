// Compressão gzip nativa do navegador (a memória do console comprime muito bem).

async function pipe(data: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export const gzip = (data: Uint8Array): Promise<Uint8Array> => pipe(data, new CompressionStream('gzip'));
export const gunzip = (data: Uint8Array): Promise<Uint8Array> => pipe(data, new DecompressionStream('gzip'));
