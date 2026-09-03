// Minimal ambient typing for the one Node module the vitest suite reads
// (scrollTimeline.test.ts pins `--journey-length` against segments.ts's
// JOURNEY_PX by reading the CSS/HTML sources). The app itself never imports
// Node; this keeps `@types/node` out of a browser-only project.
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
  export function existsSync(path: string | URL): boolean;
}
