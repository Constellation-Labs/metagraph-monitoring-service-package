import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'index.ts',
    interfaces: 'interfaces.ts',
    services: 'services.ts',
    'default-restart-conditions': 'default-restart-conditions.ts',
    'default-alert-conditions': 'default-alert-conditions.ts',
    'restart-groups': 'restart-groups.ts',
    shared: 'shared.ts',
  },
  format: ['cjs', 'esm'], // Build for commonJS and ESmodules
  dts: true, // Generate declaration file (.d.ts)
  splitting: false,
  sourcemap: true,
  clean: true,
});
