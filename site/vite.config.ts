import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` passes --port 5180 --strictPort (localhost-only) on the CLI;
// `npm run dev:lan` additionally passes --host for real-device tests — the
// ONLY script that exposes the dev server beyond this machine. `server` here
// is a belt-and-suspenders fallback so the fixed port holds even as bare
// `vite`; LAN exposure remains dev:lan-only.
export default defineConfig({
  plugins: [react()],
  // MPA, not SPA: the fast-lane pages (/resume, /experience, /projects,
  // /contact) are real static pages (Task 8) at project-root .html files —
  // Vite's mpa htmlFallbackMiddleware maps a clean URL like `/resume` to
  // `resume.html` automatically when that file exists at the server root, no
  // rewrite plugin needed. No SPA history fallback silently re-serving the app.
  appType: 'mpa',
  server: {
    port: 5180,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      // Every top-level .html file Vite should treat as a page entry. `main`
      // (the journey) plus the four fast-lane pages — additive; nothing here
      // changes behavior for the journey entry itself. Plain relative paths
      // (resolved against the project root, this file's directory) so the
      // config needs no Node type declarations.
      input: {
        main: 'index.html',
        resume: 'resume.html',
        experience: 'experience.html',
        projects: 'projects.html',
        contact: 'contact.html',
        // Static, zero-JS — most static hosts (Netlify, GitHub Pages,
        // Vercel's static output) serve dist/404.html automatically for an
        // unmatched path when it exists at the build root.
        notFound: '404.html',
      },
    },
  },
});
