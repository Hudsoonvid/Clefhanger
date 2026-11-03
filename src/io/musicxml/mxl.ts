import { strFromU8, unzipSync } from 'fflate';
import { MusicXMLError } from './import';

/** Extract the main score document from a compressed MusicXML (.mxl) archive. */
export function readMxl(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new MusicXMLError('This .mxl file could not be unzipped.');
  }
  const container = files['META-INF/container.xml'];
  if (container) {
    const doc = new DOMParser().parseFromString(strFromU8(container), 'application/xml');
    const path = doc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
    if (path && files[path]) return strFromU8(files[path]);
  }
  const fallback = Object.keys(files).find((name) => !name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(name));
  if (!fallback) throw new MusicXMLError('No score was found inside this .mxl file.');
  return strFromU8(files[fallback]);
}

/** Import text or bytes, detecting compressed .mxl by its zip signature. */
export function musicXMLText(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  return isZip ? readMxl(bytes) : new TextDecoder().decode(bytes);
}
