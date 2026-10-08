import { lazy, ComponentType } from 'react';

/**
 * React.lazy with one silent retry — absorbs transient chunk 404 after deploy.
 */
export function lazyPage<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (err) {
      await new Promise((r) => setTimeout(r, 350));
      return await importer();
    }
  });
}
