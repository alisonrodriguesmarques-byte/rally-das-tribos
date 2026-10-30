'use strict';

console.error(
  'Development database creation is blocked until SQLite handle identity can be proven. No file or directory was created.'
);
process.exitCode = 1;
