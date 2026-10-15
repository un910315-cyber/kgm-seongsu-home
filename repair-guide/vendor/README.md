# PDF rendering dependency

Mozilla PDF.js (`pdfjs-dist`) 6.4.299, from the official npm distribution:
https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz

Only the minified browser library/worker and rendering resources are included.
The Apache 2.0 license is in `pdfjs-6.4.299/LICENSE`; font/resource licenses remain
in their original folders. No PDF scripting/sandbox viewer is loaded. The app
renders a single selected page to canvas and disables JavaScript evaluation.

Keep this versioned directory immutable. Upgrade library and worker together.
Files are read from browser Blob URLs and are not sent to a third-party service.
