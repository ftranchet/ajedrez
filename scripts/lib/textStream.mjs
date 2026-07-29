// Lectura de los exports de Lichess, que se publican comprimidos en zstd.
//
// Vivía duplicado en build-radar-dataset.mjs y add-lichess-puzzles.mjs, los dos
// spawneando el binario `zstd`. Node lo trae de fábrica desde 22.15 (`zlib`
// expone zstd), así que exigir una instalación del sistema para agrandar el
// catálogo era un requisito de más en el camino que el proyecto quiere que sea
// de dos comandos. Se prefiere el built-in y se cae al binario solo si el Node
// que corre es anterior.
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createZstdDecompress } from 'node:zlib';

/**
 * Stream de texto de un archivo `.csv`/`.pgn`, comprimido con zstd o no.
 * `stop()` corta la lectura sin esperar el final del archivo (los exports
 * pesan cientos de MB y los scripts paran cuando llenaron su cupo).
 */
export function openTextStream(file) {
  if (!file.endsWith('.zst')) return { stream: createReadStream(file), stop() {} };

  if (typeof createZstdDecompress === 'function') {
    const source = createReadStream(file);
    const decoder = createZstdDecompress();
    source.pipe(decoder);
    return {
      stream: decoder,
      stop() {
        source.destroy();
        decoder.destroy();
      },
    };
  }

  const decoder = spawn('zstd', ['-dc', '--', file]);
  decoder.stderr.pipe(process.stderr);
  decoder.on('error', () => {
    console.error(
      'Este Node no trae zstd (hace falta 22.15+) y tampoco se pudo ejecutar `zstd`.\n' +
        'Instalalo, o descomprimí el archivo a mano y pasá el .csv/.pgn.',
    );
    process.exitCode = 1;
  });
  return { stream: decoder.stdout, stop: () => decoder.kill() };
}
