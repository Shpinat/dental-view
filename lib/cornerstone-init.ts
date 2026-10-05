import * as cornerstone from '@cornerstonejs/core';

import * as cornerstoneTools from '@cornerstonejs/tools';

let initialization: Promise<void> | undefined;

export function initializeCornerstone(): Promise<void> {
  if (!initialization) {
    initialization = Promise.resolve().then(() => {
      cornerstone.init();
      cornerstoneTools.init();

      cornerstone.registerImageLoader('local', (imageId) => {
        const image = cornerstone.cache.getImage(imageId);
        if (!image) {
          return {
            promise: Promise.reject(new Error(`Local slice ${imageId} missing from cache.`)),
          };
        }
        return { promise: Promise.resolve(image) };
      });
    });
  }
  return initialization;
}
