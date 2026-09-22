// Build-time only: reads the payload the prebuild exporter writes. Pages embed
// what they need; nothing fetches it at runtime.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Payload } from './types';

/** The payload as written, for pages that inline it verbatim. */
export const readPayloadJson = (): string => readFileSync(join(process.cwd(), 'public/build/data.json'), 'utf8');

// Parsed as text, not imported, so the checker does not infer a type for
// 600 KB of JSON.
export const readPayload = (): Payload => JSON.parse(readPayloadJson()) as Payload;
