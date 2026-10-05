import * as cornerstone from '@cornerstonejs/core';
import type { Volume, StudyMeta } from './types';

export async function setupCornerstoneVolume(volumeId: string, meta: StudyMeta, rawVolume: Volume) {
  // Create cornerstone local volume
  const volumeObject = cornerstone.volumeLoader.createLocalVolume(volumeId, {
    metadata: {
      FrameOfReferenceUID: meta.id,
      ImageOrientationPatient: [1, 0, 0, 0, 1, 0], // Default Axial orientation
      BitsAllocated: 16,
      BitsStored: 16,
      SamplesPerPixel: 1,
      HighBit: 15,
      PixelRepresentation: 1, // Signed
      PhotometricInterpretation: "MONOCHROME2",
      Columns: meta.dims[0],
      Rows: meta.dims[1],
      PixelSpacing: [meta.spacing[1], meta.spacing[0]], // Array of [row spacing, column spacing] -> [y, x]
    } as cornerstone.Types.Metadata,
    dimensions: [meta.dims[0], meta.dims[1], meta.dims[2]],
    spacing: [meta.spacing[0], meta.spacing[1], meta.spacing[2]],
    origin: [0, 0, 0],
    direction: [1, 0, 0, 0, 1, 0, 0, 0, 1], // Identity matrix
    scalarData: rawVolume.data,
  });

  if (!volumeObject) throw new Error('Cornerstone failed to create local volume');

  const imageIds = volumeObject.imageIds;
  if (!imageIds || imageIds.length !== meta.dims[2]) {
    throw new Error('Cornerstone did not create metadata for all volume slices');
  }

  // Setup metadata provider for Image Plane module (used by Crosshairs)
  const imagePlaneMetadata = new Map<string, cornerstone.Types.ImagePlaneModule>();
  imageIds.forEach((imageId, index) => {
    const sliceLocation = index * meta.spacing[2];
    imagePlaneMetadata.set(imageId, {
      frameOfReferenceUID: meta.id,
      rows: meta.dims[1],
      columns: meta.dims[0],
      rowCosines: [1, 0, 0],
      columnCosines: [0, 1, 0],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      imagePositionPatient: [0, 0, sliceLocation],
      pixelSpacing: [meta.spacing[1], meta.spacing[0]], // [row spacing, column spacing] -> [y, x]
      rowPixelSpacing: meta.spacing[1],
      columnPixelSpacing: meta.spacing[0],
      sliceThickness: meta.spacing[2],
      spacingBetweenSlices: meta.spacing[2],
      sliceLocation: sliceLocation,
    });
  });

  const localImageMetadataProvider = (type: string, ...queries: unknown[]) => {
    const imageId = queries[0];
    if (type !== cornerstone.Enums.MetadataModules.IMAGE_PLANE || typeof imageId !== 'string') {
      return undefined;
    }
    return imagePlaneMetadata.get(imageId);
  };

  cornerstone.metaData.addProvider(localImageMetadataProvider, 1000);

  return { volumeId, localImageMetadataProvider };
}

export function cleanupCornerstoneVolume(volumeId: string, provider: any) {
  if (provider) {
    cornerstone.metaData.removeProvider(provider);
  }
  if (cornerstone.cache.getVolume(volumeId)) {
    cornerstone.cache.removeVolumeLoadObject(volumeId);
  }
}
